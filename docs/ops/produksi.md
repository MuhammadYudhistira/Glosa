# Glosa di Produksi: Panduan Deploy

Panduan ini untuk pemilik proyek. Isinya dua hal sekaligus:
- langkah menyiapkan dan menjalankan Glosa di `https://glosa.nuvrastudio.space`;
- penjelasan *kenapa* tiap langkah ada, supaya kamu paham cara kerjanya dan bisa memakai pola yang sama untuk web berikutnya.

Kerjakan berurutan dari bagian 3 sampai 7 untuk deploy pertama. Bagian 8 dan seterusnya untuk sehari-hari.

## 1. Gambaran besar

```
Laptop ── git push ──▶ GitHub ──▶ GitHub Actions
                                   1. test (lint, unit, DB, E2E)
                                   2. build image → ghcr.io/muhammadyudhistira/glosa:<sha>
                                   3. menunggu kamu menekan Approve
                                   4. migrasi database prod, lalu SSH ke VPS

Pengunjung ──HTTPS──▶ VPS
                       /opt/proxy (stack bersama)
                         caddy ── sertifikat HTTPS, meneruskan ke web yang tepat
                         uptime-kuma ── status.nuvrastudio.space
                       /opt/glosa (stack Glosa)
                         app ── server Glosa (glosa-app:3000)
                         sweep ── sapuan Storage tiap jam

app dan sweep ──▶ Supabase prod (database, auth, Storage) ── di luar VPS
```

- **DNS** mengarahkan nama `glosa.nuvrastudio.space` ke IP VPS.
- **Caddy** satu-satunya program yang mendengar port 80/443. Ia meminta sertifikat HTTPS ke Let's Encrypt secara otomatis, lalu meneruskan permintaan ke container yang tepat berdasarkan nama host.
- **Container** `app` menjalankan Glosa dari sebuah *image*: paket berisi aplikasi yang sudah dibangun beserta Node.js. Image dibangun GitHub Actions dan disimpan di GHCR (GitHub Container Registry). VPS hanya mengunduh dan menjalankannya.
- **Database, login, dan file buku** ada di Supabase, bukan di VPS. Karena itu VPS bisa dibangun ulang kapan saja tanpa kehilangan data anggota.

**Kenapa Docker Compose, bukan Kubernetes?** Kubernetes berguna untuk menjalankan aplikasi di banyak server sekaligus. Untuk satu VPS, Docker Compose memberi hal yang sama (container, jaringan, restart otomatis) dengan jauh lebih sedikit bagian yang harus dirawat. Semua yang kamu pelajari di sini (image, container, jaringan, reverse proxy, secret, CI/CD) adalah dasar Kubernetes juga. Kalau suatu saat ingin belajar Kubernetes, coba k3s di VPS terpisah atau di laptop (k3d/kind) dengan image yang sama.

## 2. Istilah singkat

| Istilah | Artinya di sini |
|---|---|
| Image | Paket siap jalan: `ghcr.io/muhammadyudhistira/glosa:<sha>`. `<sha>` = commit asalnya, jadi setiap versi bisa ditelusuri. |
| Container | Image yang sedang berjalan. `app` dan `sweep` memakai image yang sama dengan perintah berbeda. |
| Compose | Berkas YAML yang menjelaskan container apa saja yang berjalan, env-nya, dan jaringannya. Satu folder = satu *stack*. |
| Jaringan `web` | Jaringan Docker bersama. Caddy dan semua web bergabung di sini, sehingga Caddy bisa memanggil `glosa-app:3000` tanpa membuka port ke internet. |
| Volume | Penyimpanan container yang tidak hilang saat container dibuat ulang (sertifikat Caddy, data Uptime Kuma). |
| Reverse proxy | Program di depan (Caddy) yang menerima semua permintaan, lalu meneruskannya ke aplikasi yang tepat. |
| Environment GitHub `production` | Tempat secret produksi disimpan, dengan aturan "harus disetujui pemilik" sebelum job memakainya. |
| Secret | Nilai rahasia (kunci, sandi) yang tidak boleh masuk repo. Kunci Supabase prod hanya ada di `/opt/glosa/.env` di VPS. |

## 3. Akun dan layanan (sekali)

### 3.1 DNS

Di pengelola DNS `nuvrastudio.space`, buat dua record **A** ke IP VPS:

| Nama | Tipe | Nilai |
|---|---|---|
| `glosa` | A | IP VPS |
| `status` | A | IP VPS |

Cek dari laptop: `nslookup glosa.nuvrastudio.space` harus menjawab IP VPS. Perubahan DNS bisa butuh beberapa menit sampai beberapa jam. Caddy baru bisa mendapat sertifikat setelah DNS benar.

### 3.2 Supabase prod

1. Buat proyek baru **glosa-prod**, region **Southeast Asia (Singapore)**, paket gratis. Simpan *database password* di pengelola sandi. Catat *project ref* dari URL dashboard (`https://supabase.com/dashboard/project/<ref>`).
2. **Account → Access Tokens:** buat token bernama `github-actions-glosa`. Ini untuk `SUPABASE_ACCESS_TOKEN` (bagian 5).
3. **Authentication → URL Configuration:** Site URL `https://glosa.nuvrastudio.space`, Redirect URLs `https://glosa.nuvrastudio.space/**`.
4. **Authentication → Sign In / Providers → Email:** *Confirm email* **ON**, panjang sandi minimum **8**.
5. **Authentication → Email Templates:**
   - *Confirm signup*: subjek **Konfirmasi keanggotaan Glosa**, isi dari `supabase/templates/confirmation.html`;
   - *Reset password*: subjek **Atur ulang kata sandi Glosa**, isi dari `supabase/templates/recovery.html`.
6. SMTP diisi setelah Resend siap (3.3). Provider Google diisi setelah 3.5.
7. Skema database **tidak** dibuat dari dashboard: pipeline menjalankan migrasi saat deploy pertama (bagian 6). Hook undangan diaktifkan setelah deploy pertama (6.3), karena fungsinya baru ada setelah migrasi.

Kenapa proyek terpisah dari dev? Supaya test otomatis (yang membuat dan menghapus akun) tidak pernah menyentuh data anggota sungguhan.

### 3.3 Resend (email)

1. Buat akun di resend.com. **Domains → Add Domain:** `glosa.nuvrastudio.space`.
2. Salin **persis** record DNS yang ditampilkan Resend (MX dan TXT untuk SPF dan DKIM) ke DNS `nuvrastudio.space`. Tunggu sampai status domain **Verified**.
3. **API Keys:** buat dua kunci, `glosa-prod` dan `glosa-dev` (izin *Sending access*).
4. Di Supabase **prod**, Authentication → Emails → SMTP Settings:

| Kolom | Nilai |
|---|---|
| Sender email | `no-reply@glosa.nuvrastudio.space` |
| Sender name | `Glosa` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | kunci API `glosa-prod` |

5. Ulangi di Supabase **dev** dengan kunci `glosa-dev`. Lalu di GitHub (Settings → Secrets and variables → Actions → *Repository secrets*), isi `E2E_SMTP_EMAIL` dengan `delivered+{id}@resend.dev`, supaya dua test E2E email sungguhan ikut berjalan.

Kenapa SMTP sendiri? Email bawaan Supabase dibatasi beberapa email per jam dan hanya untuk anggota tim. Dengan domain sendiri, email konfirmasi datang dari alamat Glosa dan tidak masuk spam.

### 3.4 Sentry (laporan error)

1. Buat akun di sentry.io dan organisasi, lalu proyek **React** bernama `glosa`. Satu proyek dipakai browser, server, dan sapuan sekaligus.
2. Catat **DSN** (Project Settings → Client Keys). Nilai ini masuk `SENTRY_DSN` di `/opt/glosa/.env`.
3. **Settings → Auth Tokens:** buat *Organization token* untuk unggah source map. Nilai ini masuk `SENTRY_AUTH_TOKEN` (bagian 5).
4. Catat *slug* organisasi dan proyek (terlihat di URL) untuk `SENTRY_ORG` dan `SENTRY_PROJECT`.

Source map adalah peta dari kode yang sudah diperkecil ke kode aslinya. Peta diunggah ke Sentry saat build supaya laporan error menunjuk baris yang benar, lalu dihapus dari image supaya tidak bisa diunduh pengunjung.

### 3.5 Google Cloud (masuk dengan Google)

1. Di Google Cloud Console, buat OAuth client baru (*Web application*) bernama `Glosa prod`.
   - Authorized JavaScript origins: `https://glosa.nuvrastudio.space`
   - Authorized redirect URIs: `https://<prod-ref>.supabase.co/auth/v1/callback`
2. Di **OAuth consent screen**, biarkan *Publishing status* **Testing**. Tambahkan email penguji di *Test users*. Authorized domains: `nuvrastudio.space`.
3. Di Supabase prod, Authentication → Sign In / Providers → **Google**: aktifkan, lalu isi Client ID dan Client Secret.

Ingat: penguji Google juga harus ada di daftar undangan (8.2). Mode *Testing* membatasi siapa yang boleh login di sisi Google, sedangkan daftar undangan membatasinya di sisi Glosa.

### 3.6 Hook undangan di proyek dev

Migrasi undangan sudah ada di proyek dev (dijalankan saat implementasi) dengan pendaftaran **tertutup**. Supaya test E2E tetap bisa mendaftarkan akun:

1. Supabase **dev** → SQL Editor: `update public.app_settings set signups_open = true;`
2. Authentication → Hooks → **Before User Created** → *Postgres* → fungsi `public.before_user_created` → aktifkan.

Urutannya penting. Kalau hook diaktifkan sebelum `signups_open = true`, semua pendaftaran di dev ditolak.

## 4. Menyiapkan VPS (sekali)

### 4.1 User pribadimu

Masuk pertama kali sebagai root (sandi atau kunci dari penyedia VPS), lalu buat user pribadi dengan kunci SSH. Di laptop (PowerShell atau Git Bash):

```bash
ssh-keygen -t ed25519 -C "laptop-pemilik"          # kalau belum punya kunci
ssh root@<IP-VPS>
```

Di VPS:

```bash
adduser <namamu>
usermod -aG sudo <namamu>
mkdir -p /home/<namamu>/.ssh
nano /home/<namamu>/.ssh/authorized_keys           # tempel isi ~/.ssh/id_ed25519.pub dari laptop
chown -R <namamu>:<namamu> /home/<namamu>/.ssh
chmod 700 /home/<namamu>/.ssh && chmod 600 /home/<namamu>/.ssh/authorized_keys
```

Buka terminal baru dan pastikan `ssh <namamu>@<IP-VPS>` berhasil **sebelum** lanjut. Langkah berikutnya mematikan login root dan login dengan sandi.

### 4.2 Kunci SSH untuk GitHub Actions dan skrip persiapan

GitHub Actions butuh kuncinya sendiri untuk masuk sebagai user `deploy`. Di laptop:

```bash
ssh-keygen -t ed25519 -f glosa-deploy -C "github-actions-glosa" -N ""
```

Hasilnya dua berkas: `glosa-deploy` (rahasia, untuk GitHub) dan `glosa-deploy.pub` (publik, untuk VPS).

Salin skrip ke VPS lalu jalankan dengan sudo dari user pribadimu:

```bash
scp scripts/vps-setup.sh <namamu>@<IP-VPS>:~
ssh <namamu>@<IP-VPS>
sudo bash vps-setup.sh "ssh-ed25519 AAAA...isi glosa-deploy.pub... github-actions-glosa"
```

Argumennya adalah seluruh isi satu baris `glosa-deploy.pub`, di dalam tanda kutip.

Yang dikerjakan skrip (bacalah isinya, singkat):
- **Docker Engine dan compose plugin**, dari repositori resmi Docker.
- **User `deploy`** di grup `docker`. GitHub Actions masuk sebagai user ini dan hanya bisa mengatur container, bukan menjadi root.
- **SSH hanya dengan kunci, tanpa root.** Langkah ini dilewati kalau skrip tidak dijalankan lewat sudo dari user yang punya kunci, supaya kamu tidak terkunci.
- **Firewall `ufw`:** hanya port 22 (SSH), 80, dan 443. Catatan: port yang dibuka container Docker melewati `ufw`. Itu sebabnya hanya Caddy yang membuka port; aplikasi tidak pernah membuka port ke host.
- **Swap 2 GB**, supaya build atau lonjakan memori tidak membuat proses dimatikan.
- **Update keamanan otomatis** (`unattended-upgrades`).
- **Jaringan `web`**, serta folder `/opt/proxy`, `/opt/proxy/sites`, dan `/opt/glosa`.

Skrip aman dijalankan ulang.

### 4.3 Menyalakan stack bersama

Dari laptop, di folder repo:

```bash
scp deploy/proxy/compose.yml deploy/proxy/Caddyfile <namamu>@<IP-VPS>:~
```

Di VPS:

```bash
sudo install -o deploy -g deploy -m 644 ~/compose.yml ~/Caddyfile /opt/proxy/
sudo -iu deploy
cd /opt/proxy
docker compose up -d
docker compose ps                  # caddy dan uptime-kuma: running
docker compose logs caddy          # cari "certificate obtained successfully" untuk status.nuvrastudio.space
```

Buka `https://status.nuvrastudio.space`. Kalau gemboknya muncul, DNS, firewall, dan Caddy sudah benar. **Segera buat akun admin Uptime Kuma**, karena halaman pertama ini terbuka untuk siapa saja sampai akun dibuat.

Kalau sertifikat gagal: pastikan DNS sudah mengarah ke VPS (3.1) dan port 80 terbuka. Let's Encrypt memeriksa lewat port 80.

### 4.4 Env Glosa

Di VPS, sebagai user `deploy` (`sudo -iu deploy`):

```bash
cd /opt/glosa
nano .env               # isi mengikuti deploy/.env.example di repo
chmod 600 .env
```

Nilai dari Supabase prod → Project Settings → API Keys (publishable dan secret). `SENTRY_DSN` dari 3.4. `KUMA_PUSH_URL` diisi di 4.6. Biarkan `SWEEP_DRY_RUN=1` dulu (lihat 8.4).

Kenapa di VPS, bukan di GitHub? Kunci rahasia prod membuka seluruh database. Dengan hanya menyimpannya di VPS, kebocoran di GitHub tidak membuka data anggota. Image juga tidak berisi rahasia, sehingga aman disimpan di registry.

### 4.5 Izin VPS mengunduh image

Image di GHCR bersifat privat. Di GitHub → Settings → Developer settings → Personal access tokens (classic), buat token dengan izin **`read:packages`** saja. Lalu di VPS:

```bash
sudo -iu deploy
docker login ghcr.io -u MuhammadYudhistira       # sandi = token tadi
```

Login tersimpan di `/home/deploy/.docker/config.json`. Cukup sekali.

### 4.6 Monitor Uptime Kuma

Di `https://status.nuvrastudio.space`:

1. **Settings → Notifications:** tambah *SMTP* dengan Host `smtp.resend.com`, Port `465`, Security `SSL`, Username `resend`, Password kunci `glosa-prod`, From `no-reply@glosa.nuvrastudio.space`, To email-mu. Centang *Default enabled*.
2. Tambah tiga monitor:

| Nama | Tipe | Isian |
|---|---|---|
| Glosa | HTTP(s) | URL `https://glosa.nuvrastudio.space/api/health`, interval 60 detik, *Certificate Expiry Notification* aktif (peringatan < 14 hari) |
| Supabase prod | HTTP(s) | URL `https://<prod-ref>.supabase.co/auth/v1/health`, interval 300 detik |
| Sapuan | Push | *Heartbeat Interval* 3900 detik (65 menit) |

3. Salin **Push URL** monitor Sapuan ke `KUMA_PUSH_URL` di `/opt/glosa/.env`.

Monitor Supabase juga menjaga proyek gratis tetap aktif. Proyek gratis dijeda setelah 7 hari tanpa aktivitas.

**Cek luar:** buat akun UptimeRobot (gratis) dengan satu monitor HTTP ke `https://glosa.nuvrastudio.space/api/health` tiap 5 menit dan notifikasi email. Gunanya: kalau VPS mati total, Uptime Kuma ikut mati dan tidak bisa mengabari.

## 5. GitHub: environment, secret, dan variable

Di repo GitHub → **Settings**:

1. **Environments → New environment → `production`.** Centang *Required reviewers* dan pilih dirimu. Inilah tombol *Approve* sebelum setiap deploy.
2. Secret di environment `production`:

| Secret | Nilai |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | token dari 3.2 langkah 2 |
| `PROD_SUPABASE_PROJECT_REF` | ref proyek prod |
| `PROD_SUPABASE_DB_PASSWORD` | password database prod |
| `VPS_HOST` | IP VPS |
| `VPS_SSH_KEY` | isi berkas `glosa-deploy` (kunci privat) |
| `VPS_KNOWN_HOSTS` | keluaran `ssh-keyscan -t ed25519 <IP-VPS>` |

   Cocokkan `VPS_KNOWN_HOSTS` dengan sidik jari di VPS (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`). Dengan begitu GitHub tidak pernah tertipu server palsu.

3. **Secrets and variables → Actions:**
   - *Repository secret* `SENTRY_AUTH_TOKEN`;
   - *Repository variables* `SENTRY_ORG` dan `SENTRY_PROJECT` (dari 3.4).
4. Setelah bagian 3 dan 4 selesai, tambahkan *Repository variable* **`DEPLOY_ENABLED` = `true`**. Sebelum variable ini ada, CI tetap membangun dan mengunggah image, tetapi tidak mencoba deploy.

Hapus berkas `glosa-deploy` dari laptop setelah disalin ke GitHub, atau simpan di pengelola sandi.

## 6. Deploy pertama

### 6.1 Memicu deploy

Push ke `main` (atau jalankan ulang workflow CI terakhir di `main`). Di tab **Actions**:
1. `test` berjalan seperti biasa;
2. `image` membangun image, menyalakannya sekali untuk mengecek `/api/health`, lalu mengunggahnya ke GHCR;
3. `deploy` berhenti di **Waiting for review**. Klik **Review deployments → production → Approve and deploy**.

### 6.2 Yang terjadi setelah Approve

1. `supabase db push` menjalankan migrasi yang belum ada di prod. Pada deploy pertama, ini membuat seluruh skema.
2. `compose.yml` dan `glosa.caddy` disalin ke `/opt/glosa`.
3. `deploy/release.sh` berjalan di VPS:
   - menulis `GLOSA_TAG=<sha>` ke `release.env`;
   - `docker compose pull` dan `up -d`, sehingga container baru menggantikan yang lama;
   - menyalin `glosa.caddy` ke `/opt/proxy/sites/` dengan cadangan, lalu `caddy validate`. Kalau ditolak, berkas lama dikembalikan dan deploy gagal. Kalau diterima, `caddy reload`;
   - membersihkan image yang tidak dipakai lebih dari seminggu.
4. Smoke check menunggu sampai `https://glosa.nuvrastudio.space/api/health` menjawab versi baru, paling lama 2 menit.

Pada deploy pertama, Caddy juga meminta sertifikat untuk `glosa.nuvrastudio.space`, jadi beberapa detik pertama bisa lebih lambat.

### 6.3 Mengaktifkan hook undangan di prod

Setelah deploy pertama, fungsi `public.before_user_created` sudah ada di prod, dengan pendaftaran **tertutup** (`signups_open = false`).

1. Supabase prod → Authentication → Hooks → **Before User Created** → *Postgres* → `public.before_user_created` → aktifkan.
2. Tambahkan undangan pertama (8.2), termasuk emailmu sendiri.

## 7. Pemeriksaan setelah deploy pertama

Kerjakan sekali, lalu tandai di catatan:

- [ ] **HP Android sungguhan:** buka situsnya, pasang PWA, daftar dengan email undangan, simpan buku, lalu baca dalam mode pesawat.
- [ ] **Header cache** (dari laptop):

  ```bash
  curl -sI https://glosa.nuvrastudio.space/sw.js | grep -i cache-control          # no-cache
  curl -sI https://glosa.nuvrastudio.space/_shell.html | grep -i cache-control    # no-cache
  curl -s https://glosa.nuvrastudio.space/ | grep -o '/assets/[^"]*\.js' | head -1
  curl -sI https://glosa.nuvrastudio.space/<path asset tadi> | grep -i cache-control   # public, max-age=31536000, immutable
  ```

- [ ] **Email:** konfirmasi dan reset sandi datang dari `no-reply@glosa.nuvrastudio.space`.
- [ ] **Undangan:** email di luar undangan ditolak dengan pesan "Glosa sedang dalam uji coba tertutup…", lewat form daftar maupun Google (Google kembali ke halaman "Pendaftaran masih tertutup").
- [ ] **Uji manual 1D di build produksi:** profil performa lobi dengan CPU 4× lebih lambat (DevTools), navigasi keyboard, *reduced motion*, serta halaman `/` dan `/login`.
- [ ] **Sentry:** buka DevTools Console di situs, jalankan `setTimeout(() => { throw new Error("uji sentry") })`, lalu pastikan error muncul di Sentry dengan *release* = SHA deploy.
- [ ] **Monitor:** di VPS jalankan `cd /opt/glosa && docker compose --env-file .env --env-file release.env stop app`. Tunggu sampai Uptime Kuma dan UptimeRobot mengirim email, lalu `... start app`.
- [ ] **Sapuan:** `docker compose --env-file .env --env-file release.env logs sweep` menampilkan baris JSON `"status":"dry_run"`, dan monitor Sapuan di Kuma hijau.

## 8. Sehari-hari

Semua perintah di bagian ini dijalankan di VPS sebagai `deploy` (`sudo -iu deploy`). Supaya singkat, buat alias sekali di `~/.bashrc` user `deploy`:

```bash
alias glosa='docker compose -f /opt/glosa/compose.yml --env-file /opt/glosa/.env --env-file /opt/glosa/release.env'
alias proxy='docker compose -f /opt/proxy/compose.yml'
```

### 8.1 Melihat keadaan

```bash
glosa ps                       # status container dan health
glosa logs -f app              # log aplikasi (Ctrl+C untuk berhenti)
glosa logs --since 2h sweep    # sapuan dua jam terakhir
proxy logs caddy               # sertifikat dan error proxy
cat /opt/glosa/release.env     # versi yang sedang berjalan
```

Log dibatasi 10 MB × 5 berkas per container, jadi disk tidak penuh oleh log.

### 8.2 Mengundang anggota

Supabase prod → SQL Editor:

```sql
insert into public.signup_invites (email, note)
values (lower('Teman@Contoh.com'), 'teman kantor');

select * from public.signup_invites order by created_at desc;   -- daftar undangan
delete from public.signup_invites where email = lower('Teman@Contoh.com');
```

Email selalu disimpan dalam huruf kecil. Kolomnya menolak huruf besar, jadi selalu bungkus dengan `lower(...)`.

### 8.3 Rollback

Kalau versi baru bermasalah: GitHub → **Actions → Deploy → Run workflow**, lalu isi `tag` dengan SHA commit lengkap versi yang baik (lihat riwayat `release.env` di log deploy sebelumnya, atau daftar commit `main`). Setelah *Approve*, versi itu berjalan lagi.

Rollback **tidak** menjalankan migrasi. Ini aman karena aturan di bagian 9: skema baru selalu tetap cocok untuk kode lama.

### 8.4 Sapuan Storage

Sapuan berjalan saat container naik, lalu tiap jam. Ia menghapus:
1. upload yang tidak selesai lebih dari 1 jam;
2. akun tanpa profil yang lebih tua dari 1 jam;
3. folder milik akun yang sudah tidak punya profil;
4. file yang tidak dirujuk buku mana pun dan lebih tua dari 1 jam.

**Hari pertama: dry run.** Dengan `SWEEP_DRY_RUN=1`, sapuan hanya mencatat rencananya. Baca beberapa putaran di `glosa logs sweep`. Kalau rencananya masuk akal, ubah ke `SWEEP_DRY_RUN=0` di `/opt/glosa/.env`, lalu `glosa up -d sweep`.

**Kalau sapuan berhenti karena batas** (lebih dari 50 objek atau 5 akun dalam satu putaran): Sentry mengirim laporan dan monitor Sapuan di Kuma menjadi merah setelah 65 menit. Baca rencananya di log. Kalau memang benar, jalankan sekali dengan batas lebih besar:

```bash
glosa run --rm -e SWEEP_MAX_DELETIONS=200 -e SWEEP_DRY_RUN=0 sweep node dist/sweep.mjs
```

Kalau rencananya tidak masuk akal, jangan dijalankan: itu tanda ada yang salah, dan batas ini memang dibuat untuk menangkapnya.

### 8.5 Restart dan pembaruan sistem

```bash
glosa restart app          # menyalakan ulang aplikasi
proxy restart caddy        # setelah mengubah /opt/proxy/Caddyfile sendiri
sudo reboot                # semua container kembali sendiri (restart: unless-stopped)
```

`unattended-upgrades` memasang update keamanan otomatis. Sesekali jalankan `sudo apt update && sudo apt upgrade` dan reboot kalau diminta.

## 9. Aturan migrasi

Migrasi berjalan **sebelum** container baru naik, jadi selama beberapa detik kode lama berjalan di atas skema baru. Rollback (8.3) juga menjalankan kode lama di atas skema baru. Karena itu:

- **Satu deploy hanya boleh menambah:** tabel baru, kolom baru dengan default (atau boleh kosong), atau fungsi baru.
- **Menghapus atau mengganti nama** dilakukan dua langkah:
  1. deploy kode yang tidak memakai kolom atau tabel itu lagi;
  2. deploy berikutnya baru menghapusnya.
- Migrasi selalu dijalankan pipeline (`supabase db push`), tidak pernah lewat SQL editor prod. SQL editor prod hanya untuk data (undangan, `app_settings`).

## 10. Menambah web kedua

Pola ini yang membuat VPS siap untuk banyak web. Misalnya web baru `catatan`:

1. DNS: record A `catatan.nuvrastudio.space` ke IP VPS.
2. Buat folder `/opt/catatan` dengan `compose.yml` sendiri. Layanan web-nya bergabung ke jaringan `web` dengan alias berawalan nama web:

   ```yaml
   services:
     app:
       image: ghcr.io/muhammadyudhistira/catatan:${CATATAN_TAG}
       restart: unless-stopped
       networks:
         web:
           aliases: [catatan-app]
   networks:
     web:
       external: true
   ```

3. Buat `/opt/proxy/sites/catatan.caddy`:

   ```
   catatan.nuvrastudio.space {
   	encode zstd gzip
   	reverse_proxy catatan-app:3000
   }
   ```

4. `proxy exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`, lalu `proxy exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`.

Web lain tidak tersentuh. Saat web kedua benar-benar datang, pindahkan `deploy/proxy/` dari repo Glosa ke repo infra tersendiri. Alias berawalan nama web penting: nama layanan seperti `app` bisa sama di beberapa stack, sedangkan alias harus unik di jaringan `web`.

## 11. Sebelum dibuka untuk umum

Bukan bagian uji coba. Kerjakan saat siap:

- [ ] Naik ke **Supabase Pro**: backup harian dan tanpa jeda 7 hari.
- [ ] Verifikasi aplikasi Google: domain `nuvrastudio.space` di Google Search Console, lalu layar persetujuan *In production*.
- [ ] Tinjau ulang `/privacy` dan `/terms`.
- [ ] `update public.app_settings set signups_open = true;` di SQL editor prod. Tidak perlu deploy ulang.

## 12. Kalau ada masalah

| Gejala | Periksa |
|---|---|
| Browser: "502 Bad Gateway" | `glosa ps`: apakah `app` berjalan dan *healthy*? `glosa logs app` untuk error saat start, misalnya env kurang. |
| Sertifikat tidak terbit | DNS sudah mengarah ke VPS? Port 80 terbuka (`sudo ufw status`)? `proxy logs caddy`. |
| Deploy gagal di "Release on the VPS" | Baca log langkah itu di Actions. `Caddy rejected glosa.caddy`: berkas lama sudah dikembalikan, situs tetap jalan dengan blok lama; perbaiki `deploy/glosa.caddy`. `pull access denied`: ulangi 4.5. |
| Deploy gagal di "Smoke check" | Container baru naik tapi versinya tidak terlihat: `glosa ps` dan `glosa logs app`. Rollback (8.3) kalau perlu. |
| Monitor Supabase merah | Proyek dijeda? Buka dashboard Supabase dan *Restore*. |
| Monitor Sapuan merah | `glosa logs sweep`: lihat galat terakhir dan laporan di Sentry (8.4). |
| Pendaftaran ditolak untuk email undangan | Email di `signup_invites` harus huruf kecil dan sama persis. Untuk Google, email juga harus terdaftar di *Test users* (3.5). |
