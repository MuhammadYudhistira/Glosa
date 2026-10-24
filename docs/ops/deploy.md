# Deploy Glosa: Dev Sekarang, Prod Nanti

Panduan ini untuk pemilik proyek. Isinya:
- langkah menjalankan Glosa **dev** di `https://glosa.nuvrastudio.space`, dengan deploy otomatis setiap `main` hijau;
- penjelasan *kenapa* tiap langkah ada, supaya polanya bisa dipakai lagi untuk prod dan web berikutnya.

Untuk deploy dev pertama, kerjakan bagian 3 sampai 5 berurutan. Bagian 6 untuk sehari-hari, bagian 8 saat prod tiba.

## 1. Gambaran besar

```
Laptop ── git push ──▶ GitHub ──▶ GitHub Actions
                                   1. test (lint, unit, DB, E2E) ke Supabase dev
                                   2. build image → ghcr.io/muhammadyudhistira/glosa:<sha>
                                   3. deploy-dev: SSH ke VPS, tanpa Approve

Pengunjung ──HTTPS──▶ VPS
                       /opt/proxy (stack bersama)
                         caddy ── sertifikat HTTPS, meneruskan ke web yang tepat
                         uptime-kuma ── status.nuvrastudio.space
                       /opt/glosa-dev (Glosa dev, glosa.nuvrastudio.space)
                         app ── server Glosa (glosa-dev-app:3000)
                         sweep ── sapuan Storage tiap jam (dry run)
                       /opt/glosa-prod (Glosa prod, nanti, domain sendiri)

glosa-dev ──▶ Supabase dev (database, auth, Storage), juga dipakai test CI
glosa-prod ──▶ Supabase prod (nanti)
```

- **Satu image, banyak environment.** Image yang sama berjalan di dev dan nanti di prod. Bedanya hanya isi `/opt/glosa-<env>/.env`.
- **Caddy** satu-satunya program yang mendengar port 80/443. Ia meminta sertifikat HTTPS ke Let's Encrypt secara otomatis, lalu meneruskan permintaan ke container yang tepat berdasarkan nama host.
- **Database, login, dan file buku** ada di Supabase, bukan di VPS. VPS bisa dibangun ulang kapan saja tanpa kehilangan data.

**Kenapa Docker Compose, bukan Kubernetes?** Kubernetes berguna untuk banyak server sekaligus. Untuk satu VPS, Docker Compose memberi hal yang sama (container, jaringan, restart otomatis) dengan jauh lebih sedikit bagian yang harus dirawat. Semua yang dipelajari di sini (image, container, jaringan, reverse proxy, secret, CI/CD) adalah dasar Kubernetes juga.

## 2. Istilah singkat

| Istilah | Artinya di sini |
|---|---|
| Image | Paket siap jalan: `ghcr.io/muhammadyudhistira/glosa:<sha>`. `<sha>` = commit asalnya. |
| Container | Image yang sedang berjalan. `app` dan `sweep` memakai image yang sama dengan perintah berbeda. |
| Stack | Satu folder dengan `compose.yml`: `/opt/proxy`, `/opt/glosa-dev`. Nama folder menjadi nama proyek compose (`glosa-dev`). |
| Environment | `dev` atau `prod`. Di GitHub, environment menyimpan secret dan variable masing-masing. Di VPS, tiap environment punya stack sendiri. |
| Jaringan `web` | Jaringan Docker bersama. Caddy memanggil `glosa-dev-app:3000` di sini tanpa membuka port ke internet. |
| Volume | Penyimpanan container yang tidak hilang saat container dibuat ulang (sertifikat Caddy, data Uptime Kuma). |
| Secret | Nilai rahasia (kunci, sandi) yang tidak boleh masuk repo. |

## 3. Menyiapkan VPS (sekali, untuk semua environment)

### 3.1 DNS

Di pengelola DNS `nuvrastudio.space`, buat dua record **A** ke IP VPS:

| Nama | Tipe | Nilai |
|---|---|---|
| `glosa` | A | IP VPS |
| `status` | A | IP VPS |

Cek dari laptop: `nslookup glosa.nuvrastudio.space` harus menjawab IP VPS. Caddy baru bisa mendapat sertifikat setelah DNS benar.

### 3.2 User pribadimu

Masuk pertama kali sebagai root, lalu buat user pribadi dengan kunci SSH. Di laptop:

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

Pastikan `ssh <namamu>@<IP-VPS>` berhasil dari terminal baru **sebelum** lanjut. Langkah berikutnya mematikan login root dan login dengan sandi.

### 3.3 Kunci SSH GitHub Actions dan skrip persiapan

GitHub Actions masuk sebagai user `deploy` dengan kuncinya sendiri. Di laptop:

```bash
ssh-keygen -t ed25519 -f glosa-deploy -C "github-actions-glosa" -N ""
```

Hasilnya `glosa-deploy` (rahasia, untuk GitHub) dan `glosa-deploy.pub` (publik, untuk VPS). Salin skrip ke VPS, lalu jalankan dengan sudo dari user pribadimu:

```bash
scp scripts/vps-setup.sh <namamu>@<IP-VPS>:~
ssh <namamu>@<IP-VPS>
sudo bash vps-setup.sh "ssh-ed25519 AAAA...isi glosa-deploy.pub... github-actions-glosa"
```

Yang dikerjakan skrip (bacalah isinya, singkat):
- **Docker Engine dan compose plugin**, dari repositori resmi Docker.
- **User `deploy`** di grup `docker`. GitHub Actions masuk sebagai user ini dan hanya bisa mengatur container, bukan menjadi root.
- **SSH hanya dengan kunci, tanpa root.** Dilewati kalau skrip tidak dijalankan lewat sudo dari user yang punya kunci, supaya kamu tidak terkunci.
- **Firewall `ufw`:** hanya port 22, 80, dan 443. Port yang dibuka container Docker melewati `ufw`; itu sebabnya hanya Caddy yang membuka port.
- **Swap 2 GB** dan **update keamanan otomatis**.
- **Jaringan `web`**, serta folder `/opt/proxy`, `/opt/proxy/sites`, `/opt/glosa-dev`, dan `/opt/glosa-prod`.

Skrip aman dijalankan ulang.

### 3.4 Menyalakan stack bersama

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

Buka `https://status.nuvrastudio.space`. **Segera buat akun admin Uptime Kuma**, karena halaman pertama ini terbuka untuk siapa saja sampai akun dibuat.

Kalau sertifikat gagal: pastikan DNS sudah mengarah ke VPS dan port 80 terbuka. Let's Encrypt memeriksa lewat port 80.

### 3.5 Izin VPS mengunduh image

Image di GHCR bersifat privat. Di GitHub → Settings → Developer settings → Personal access tokens (classic), buat token dengan izin **`read:packages`** saja. Lalu di VPS:

```bash
sudo -iu deploy
docker login ghcr.io -u MuhammadYudhistira       # sandi = token tadi
```

Cukup sekali; berlaku untuk semua environment.

## 4. Environment dev (sekali)

### 4.1 Setelan proyek Supabase dev

Di dashboard proyek **dev**:

1. **Authentication → URL Configuration:**
   - Site URL `https://glosa.nuvrastudio.space`;
   - Redirect URLs: tambahkan `https://glosa.nuvrastudio.space/**`, dan biarkan alamat `localhost` yang sudah ada.

   Tautan di email konfirmasi dan reset sandi memakai Site URL, jadi sejak sekarang tautan email dari dev (termasuk saat mencoba di `localhost`) menuju situs dev.
2. **SQL Editor:** `update public.app_settings set signups_open = true;` Pendaftaran di dev terbuka, dan test CI butuh ini.
3. **Authentication → Hooks → Before User Created** (boleh, tidak wajib): *Postgres* → `public.before_user_created` → aktifkan. Lakukan **setelah** langkah 2. Untuk mencoba penolakan undangan, ubah `signups_open` ke `false` sebentar, lalu kembalikan ke `true` sebelum CI berjalan lagi.
4. **Google:** di Google Cloud Console, OAuth client yang dipakai proyek dev → *Authorized JavaScript origins*: tambahkan `https://glosa.nuvrastudio.space`.
5. **Email (opsional):** tanpa SMTP sendiri, Supabase hanya mengirim email ke anggota tim proyek, beberapa kali per jam. Cukup untuk mencoba sendiri. Untuk email dari alamat Glosa, lihat 8.3 (Resend) dan pakai kunci `glosa-dev`.

### 4.2 Env Glosa dev di VPS

Di VPS, sebagai `deploy` (`sudo -iu deploy`):

```bash
cd /opt/glosa-dev
nano .env               # isi mengikuti deploy/.env.example di repo
chmod 600 .env
```

- Kunci dari Supabase **dev** → Project Settings → API Keys (publishable dan secret). Nilainya sama dengan `.env.local` di laptop.
- `SITE_URL=https://glosa.nuvrastudio.space`.
- `SENTRY_DSN` boleh kosong, sehingga Sentry mati. Kalau diisi, pakai `SENTRY_ENVIRONMENT=development`.
- `KUMA_PUSH_URL` diisi di 4.4.
- **`SWEEP_DRY_RUN=1`, selamanya di dev.** Proyek dev juga dipakai test CI. Sapuan sungguhan bisa menghapus folder milik test yang sedang berjalan, sehingga test gagal secara acak.

### 4.3 GitHub

Di repo GitHub → **Settings**:

1. **Environments → `dev`** (sudah ada, dipakai job `test`). Jangan beri *Required reviewers*: deploy dev memang tanpa persetujuan.
   - Tambahkan secret:

     | Secret | Nilai |
     |---|---|
     | `VPS_HOST` | IP VPS |
     | `VPS_SSH_KEY` | isi berkas `glosa-deploy` (kunci privat) |
     | `VPS_KNOWN_HOSTS` | keluaran `ssh-keyscan -t ed25519 <IP-VPS>` |

     Cocokkan `VPS_KNOWN_HOSTS` dengan sidik jari di VPS (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`), supaya GitHub tidak pernah tertipu server palsu.
   - Tambahkan *Environment variable* **`APP_URL`** = `https://glosa.nuvrastudio.space`.
2. **Secrets and variables → Actions → Variables → *Repository variables*:** **`DEV_DEPLOY_ENABLED`** = `true`. Tambahkan paling akhir, setelah bagian 3 dan 4.1–4.2 selesai. Sebelum variable ini ada, CI tetap membangun dan mengunggah image, tetapi tidak mencoba deploy.
3. **Sentry (opsional):** *Repository secret* `SENTRY_AUTH_TOKEN` dan *Repository variables* `SENTRY_ORG`, `SENTRY_PROJECT` (lihat 8.4). Tanpanya, image tetap dibangun; hanya source map yang tidak diunggah.

Hapus berkas `glosa-deploy` dari laptop setelah disalin ke GitHub, atau simpan di pengelola sandi.

### 4.4 Monitor Uptime Kuma

Di `https://status.nuvrastudio.space`, tambah tiga monitor:

| Nama | Tipe | Isian |
|---|---|---|
| Glosa dev | HTTP(s) | URL `https://glosa.nuvrastudio.space/api/health`, interval 60 detik, *Certificate Expiry Notification* aktif |
| Supabase dev | HTTP(s) | URL `https://<dev-ref>.supabase.co/auth/v1/health`, interval 300 detik |
| Sapuan dev | Push | *Heartbeat Interval* 3900 detik (65 menit) |

Untuk kedua monitor HTTP(s), isi *Retries* `2`. Di Uptime Kuma v2, monitor baru dibuat dengan *Retries* 0, sehingga satu kali gagal saja langsung mengirim peringatan.

Salin **Push URL** monitor Sapuan dev ke `KUMA_PUSH_URL` di `/opt/glosa-dev/.env`. Monitor Supabase juga menjaga proyek gratis tetap aktif, karena proyek gratis dijeda setelah 7 hari tanpa aktivitas.

Notifikasi email Kuma (Settings → Notifications) butuh SMTP. Isi setelah Resend siap (8.3).

## 5. Deploy dev pertama

### 5.1 Memicu

Push ke `main`, atau jalankan ulang run CI terakhir di `main` (Actions → run → *Re-run all jobs*). Commit yang hanya mengubah `docs/` atau berkas `.md` tidak menjalankan CI, jadi juga tidak deploy. Urutannya:
1. `test` dan `e2e-3d` (test lobi 3D), berjalan bersamaan;
2. `image` (build, smoke test, unggah ke GHCR);
3. `deploy-dev`, langsung tanpa menunggu.

### 5.2 Yang terjadi di `deploy-dev`

1. Input dicek: environment `dev`, tag SHA lengkap, `APP_URL` terisi.
2. `compose.yml` dan `glosa-dev.caddy` disalin ke `/opt/glosa-dev`.
3. `deploy/release.sh dev <sha>` berjalan di VPS:
   - menulis `GLOSA_ENV=dev` dan `GLOSA_TAG=<sha>` ke `release.env`;
   - `docker compose pull` dan `up -d`. Proyek compose bernama `glosa-dev`, sesuai nama foldernya;
   - menyalin `glosa-dev.caddy` ke `/opt/proxy/sites/` dengan cadangan, lalu `caddy validate`. Kalau ditolak, berkas lama dikembalikan dan deploy gagal. Kalau diterima, `caddy reload`;
   - membersihkan image yang tidak dipakai lebih dari seminggu.
4. Smoke check menunggu sampai `https://glosa.nuvrastudio.space/api/health` menjawab versi baru, paling lama 2 menit.

Migrasi **tidak** dijalankan di deploy dev. Migrasi masuk ke proyek dev saat pengembangan (`npm run db:push`), dan test CI yang hijau membuktikan skemanya cocok.

### 5.3 Pemeriksaan setelah deploy pertama

- [ ] **HP Android sungguhan:** buka situsnya, pasang PWA, daftar, simpan buku, lalu baca dalam mode pesawat.
- [ ] **Header cache** (dari laptop):

  ```bash
  curl -sI https://glosa.nuvrastudio.space/sw.js | grep -i cache-control          # no-cache
  curl -sI https://glosa.nuvrastudio.space/_shell.html | grep -i cache-control    # no-cache
  curl -s https://glosa.nuvrastudio.space/ | grep -o '/assets/[^"]*\.js' | head -1
  curl -sI https://glosa.nuvrastudio.space/<path asset tadi> | grep -i cache-control   # public, max-age=31536000, immutable
  ```

- [ ] **Email:** tautan konfirmasi menuju `https://glosa.nuvrastudio.space/auth/confirm…`.
- [ ] **Uji manual 1D di build sungguhan:** profil performa lobi dengan CPU 4× lebih lambat (DevTools), navigasi keyboard, *reduced motion*, serta halaman `/` dan `/login`.
- [ ] **Sentry** (kalau DSN diisi): di DevTools Console jalankan `setTimeout(() => { throw new Error("uji sentry") })`, lalu pastikan error muncul dengan *release* = SHA deploy dan *environment* = `development`.
- [ ] **Monitor:** di VPS jalankan `glosa-dev stop app` (alias di 6.0). Tunggu sampai Kuma menandai merah, lalu `glosa-dev start app`.
- [ ] **Sapuan:** `glosa-dev logs sweep` menampilkan baris JSON `"status":"dry_run"`, dan monitor Sapuan dev hijau.

## 6. Sehari-hari

### 6.0 Alias

Semua perintah di bagian ini dijalankan di VPS sebagai `deploy` (`sudo -iu deploy`). Buat alias sekali di `~/.bashrc` user `deploy`:

```bash
alias glosa-dev='docker compose -f /opt/glosa-dev/compose.yml --env-file /opt/glosa-dev/.env --env-file /opt/glosa-dev/release.env'
alias proxy='docker compose -f /opt/proxy/compose.yml'
```

### 6.1 Melihat keadaan

```bash
glosa-dev ps                       # status container dan health
glosa-dev logs -f app              # log aplikasi (Ctrl+C untuk berhenti)
glosa-dev logs --since 2h sweep    # sapuan dua jam terakhir
proxy logs caddy                   # sertifikat dan error proxy
cat /opt/glosa-dev/release.env     # versi yang sedang berjalan
```

Log dibatasi 10 MB × 5 berkas per container.

### 6.2 Rollback

GitHub → **Actions → Deploy → Run workflow**, pilih environment `dev`, lalu isi `tag` dengan SHA commit lengkap versi yang baik (daftar commit `main`, atau `release.env` di log deploy sebelumnya). Rollback tidak menjalankan migrasi.

### 6.3 Sapuan Storage

Sapuan berjalan saat container naik, lalu tiap jam. Ia merencanakan penghapusan:
1. upload yang tidak selesai lebih dari 1 jam;
2. akun tanpa profil yang lebih tua dari 1 jam;
3. folder milik akun yang sudah tidak punya profil;
4. file yang tidak dirujuk buku mana pun dan lebih tua dari 1 jam.

Di dev rencana itu **hanya dicatat** (`SWEEP_DRY_RUN=1`, lihat 4.2). Membacanya di log tetap berguna untuk melihat sampah apa yang ditinggalkan test.

### 6.4 Restart dan pembaruan sistem

```bash
glosa-dev restart app      # menyalakan ulang aplikasi
proxy restart caddy        # setelah mengubah /opt/proxy/Caddyfile sendiri
sudo reboot                # semua container kembali sendiri (restart: unless-stopped)
```

`unattended-upgrades` memasang update keamanan otomatis. Sesekali jalankan `sudo apt update && sudo apt upgrade`.

### 6.5 Kamus

Arti kata di reader berasal dari English Wiktionary, lewat ekstrak kaikki.org (lisensi CC BY-SA). Selama kamus belum diimpor, semua kata tampil "Belum ada arti untuk kata ini". Skrip impor tidak dijalankan CI. Jalankan dari laptop setiap kali kamus perlu diperbarui, misalnya beberapa bulan sekali.

1. Unduh ekstrak semua kata bahasa Inggris dalam format JSONL dari [kaikki.org/dictionary/English](https://kaikki.org/dictionary/English/). Bagian unduhan ada di bawah halaman. Ukurannya beberapa GB, dan boleh tetap dalam bentuk `.gz`.
2. Pastikan migrasi kamus sudah ada di proyek tujuan (§7).
3. Jalankan, misalnya untuk dev:
   ```bash
   node scripts/import-dictionary.ts ~/Downloads/kaikki.org-dictionary-English.jsonl --env dev --dump-date 2026-10-20
   ```
   - `--env dev` memakai `.env.local`. `--env prod` memakai `.env.prod`, yang berisi `SUPABASE_URL` dan `SUPABASE_SECRET_KEY` proyek prod. File itu tidak boleh di-commit.
   - `--dump-date` adalah tanggal dump Wiktionary yang tertulis di halaman kaikki. Boleh dikosongkan.
4. Skrip mencetak jumlah entri, bentuk kata, dan phrasal verb, lalu menukar kamus dalam satu transaksi. Selama penukaran (beberapa detik), pencarian arti menunggu.
5. Kalau jumlah entri turun lebih dari 20% dari impor sebelumnya, skrip berhenti tanpa mengubah kamus. Periksa file-nya dulu. Kalau memang benar, ulangi dengan `--force`.
6. Cek hasilnya di SQL editor: `select * from dict_meta;`

## 7. Aturan migrasi

- **Dev:** migrasi baru di-push ke proyek dev saat pengembangan (`npm run db:push`), sebelum branch di-push. Kalau lupa, test CI gagal karena skemanya belum ada.
- **Prod (nanti):** migrasi dijalankan pipeline (`migrate: true`) **sebelum** container baru naik. Selama beberapa detik kode lama berjalan di atas skema baru, dan rollback juga menjalankan kode lama di atas skema baru. Karena itu:
  - satu deploy hanya boleh **menambah**: tabel baru, kolom baru dengan default (atau boleh kosong), atau fungsi baru;
  - **menghapus atau mengganti nama** dilakukan dua langkah: deploy kode yang tidak memakainya lagi, baru deploy berikutnya menghapusnya.
- SQL editor dipakai untuk data (`app_settings`, undangan), bukan skema.

## 8. Menambah prod nanti

Saat domain prod sudah ada. Misalnya `<domain-prod>`:

### 8.1 Proyek dan akun

1. **Supabase prod:** proyek baru **glosa-prod**, region Singapore. Simpan *database password*, catat *project ref*, dan buat *Access Token* `github-actions-glosa`.
   - Authentication → URL Configuration: Site URL `https://<domain-prod>`, Redirect URLs `https://<domain-prod>/**`.
   - Provider Email: *Confirm email* ON, sandi minimum 8.
   - Template: *Confirm signup* (subjek **Konfirmasi keanggotaan Glosa**, isi `supabase/templates/confirmation.html`) dan *Reset password* (subjek **Atur ulang kata sandi Glosa**, isi `supabase/templates/recovery.html`).
   - Skema dibuat pipeline saat deploy prod pertama; hook undangan diaktifkan setelahnya.
2. **DNS:** record untuk `<domain-prod>` ke IP VPS.
3. **Resend, Sentry, Google:** lihat 8.3–8.5.

### 8.2 Di repo dan VPS

1. Buat `deploy/sites/glosa-prod.caddy`: salin `glosa-dev.caddy`, ganti host menjadi `<domain-prod>` dan `reverse_proxy glosa-prod-app:3000`.
2. VPS: `/opt/glosa-prod/.env` dengan kunci Supabase **prod**, `SITE_URL=https://<domain-prod>`, `SENTRY_ENVIRONMENT=production`, `SWEEP_DRY_RUN=1` dulu. Setelah beberapa putaran rencananya terlihat wajar, ubah ke `0`.
3. GitHub → Environments → **New environment `prod`**:
   - centang *Required reviewers* dan pilih dirimu;
   - secret `VPS_HOST`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` (nilai sama dengan dev), `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` (prod);
   - variable `APP_URL` = `https://<domain-prod>`.
4. Pemicu prod (misalnya job `deploy-prod` di CI dengan `migrate: true` yang menunggu *Approve*) diputuskan dan ditambahkan saat itu. Sementara itu, prod bisa dideploy manual lewat **Actions → Deploy → Run workflow → prod**, tetapi tanpa migrasi.
5. Setelah deploy prod pertama: aktifkan hook *Before User Created* di Supabase prod (dengan `signups_open = false`), lalu tambahkan undangan:

   ```sql
   insert into public.signup_invites (email, note)
   values (lower('Teman@Contoh.com'), 'teman kantor');
   ```

### 8.3 Resend (email)

1. Buat akun di resend.com. **Domains → Add Domain**: domain pengirim (misalnya `glosa.nuvrastudio.space` untuk dev, `<domain-prod>` untuk prod).
2. Salin **persis** record DNS dari Resend (MX dan TXT untuk SPF dan DKIM). Tunggu sampai status **Verified**.
3. **API Keys:** buat `glosa-dev` dan `glosa-prod` (*Sending access*).
4. Di Supabase, Authentication → Emails → SMTP Settings:

   | Kolom | Nilai |
   |---|---|
   | Sender email | `no-reply@<domain pengirim>` |
   | Sender name | `Glosa` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | kunci API environment itu |

5. Untuk dev: di GitHub → Environments → `dev`, tambahkan secret `E2E_SMTP_EMAIL` = `delivered+{id}@resend.dev`, supaya dua test E2E email sungguhan ikut berjalan.
6. Uptime Kuma → Settings → Notifications: *SMTP* dengan nilai yang sama, To = email-mu, centang *Default enabled*.

### 8.4 Sentry

1. Buat proyek **React** bernama `glosa` di sentry.io. Satu proyek dipakai dev dan prod; keduanya dibedakan oleh `SENTRY_ENVIRONMENT`.
2. **DSN** (Project Settings → Client Keys) masuk ke `SENTRY_DSN` di `/opt/glosa-<env>/.env`.
3. **Organization token** masuk ke *Repository secret* `SENTRY_AUTH_TOKEN`. Slug organisasi dan proyek masuk ke *Repository variables* `SENTRY_ORG` dan `SENTRY_PROJECT`.

### 8.5 Google prod

OAuth client baru `Glosa prod`: origin `https://<domain-prod>`, redirect `https://<prod-ref>.supabase.co/auth/v1/callback`. Biarkan *Testing* dan tambahkan *Test users*. Lalu isi Client ID/Secret di Supabase prod → Providers → Google.

### 8.6 Sebelum dibuka untuk umum

- [ ] Supabase Pro (backup harian, tanpa jeda 7 hari).
- [ ] Verifikasi aplikasi Google (Search Console, layar persetujuan *In production*).
- [ ] Tinjau ulang `/privacy` dan `/terms`.
- [ ] `update public.app_settings set signups_open = true;` di prod.

## 9. Menambah web kedua

Misalnya web baru `catatan`:

1. DNS: record A `catatan.nuvrastudio.space` ke IP VPS.
2. Folder `/opt/catatan` dengan `compose.yml` sendiri. Layanan web-nya bergabung ke jaringan `web` dengan alias berawalan nama web:

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

3. `/opt/proxy/sites/catatan.caddy`:

   ```
   catatan.nuvrastudio.space {
   	encode zstd gzip
   	reverse_proxy catatan-app:3000
   }
   ```

4. `proxy exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`, lalu `proxy exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`.

Alias harus unik di jaringan `web`, itu sebabnya selalu berawalan nama web dan environment (`glosa-dev-app`, `glosa-prod-app`, `catatan-app`). Saat web kedua benar-benar datang, pindahkan `deploy/proxy/` ke repo infra tersendiri.

## 10. Kalau ada masalah

| Gejala | Periksa |
|---|---|
| Browser: "502 Bad Gateway" | `glosa-dev ps`: apakah `app` berjalan dan *healthy*? `glosa-dev logs app` untuk error saat start, misalnya env kurang. |
| Sertifikat tidak terbit | DNS sudah mengarah ke VPS? Port 80 terbuka (`sudo ufw status`)? `proxy logs caddy`. |
| `deploy-dev` tidak muncul atau *skipped* | Variable repositori `DEV_DEPLOY_ENABLED` = `true`? Run dari push ke `main`, bukan PR? |
| Deploy gagal di "Check the inputs" | `APP_URL` belum diisi di environment `dev`. |
| Deploy gagal di "Release on the VPS" | `Caddy rejected glosa-dev.caddy`: blok lama sudah dikembalikan, situs tetap jalan; perbaiki berkasnya. `pull access denied`: ulangi 3.5. `Permission denied (publickey)`: cek `VPS_SSH_KEY` dan `authorized_keys` user `deploy`. |
| Deploy gagal di "Smoke check" | Container baru naik tapi versinya tidak terlihat: `glosa-dev ps` dan `glosa-dev logs app`. Rollback (6.2) kalau perlu. |
| Test CI gagal: `Missing SUPABASE_URL` | Secret Supabase dev harus ada di environment `dev`, dan job `test` memakai `environment: dev`. |
| Pendaftaran dev ditolak "uji coba tertutup" | Hook aktif dengan `signups_open = false`. Kembalikan ke `true` (4.1). |
| Monitor Supabase merah | Proyek dijeda? Buka dashboard Supabase dan *Restore*. |
