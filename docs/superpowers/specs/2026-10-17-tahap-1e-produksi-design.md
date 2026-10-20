# Glosa Tahap 1E — Produksi: Desain

> **Diperbarui 2026-10-20** ([rencana deploy dev](../plans/2026-10-20-deploy-dev.md)): `glosa.nuvrastudio.space` kini situs **dev** dengan proyek Supabase dev, dideploy otomatis tanpa *Approve*. Prod menyusul di domain lain pada VPS yang sama (`/opt/glosa-prod`). Bagian spec ini tentang alamat, stack VPS, dan pipeline deploy digantikan rencana itu; panduannya kini `docs/ops/deploy.md`.

Tanggal: 2026-10-17
Spec induk: [`2026-10-15-epub-reader-tahap-1-design.md`](2026-10-15-epub-reader-tahap-1-design.md) §11 (offline), §12 (error), §14 (deploy)
Spec sebelumnya: [`2026-10-17-tahap-1d-lobi-3d-design.md`](2026-10-17-tahap-1d-lobi-3d-design.md) (tabel rencana 1D/1E)

## 1. Ringkasan

Glosa berjalan di `https://glosa.nuvrastudio.space` sebagai **uji coba tertutup**:
- semuanya disiapkan seperti produksi: Supabase prod, email Resend, HTTPS, deploy otomatis, dan pemantauan;
- hanya email yang diundang yang bisa menjadi anggota.

Untuk membuka ke umum cukup mengubah satu setelan setelah daftar periksa §10 selesai.

**Selesai berarti:**
- push ke `main` yang lolos CI dideploy ke VPS setelah pemilik menyetujuinya;
- anggota undangan bisa mendaftar lewat email (dari Resend) atau Google, membaca, dan memasang PWA di HP Android;
- error terlapor ke Sentry;
- situs mati, Supabase terjeda, sertifikat hampir habis, dan sapuan yang berhenti semuanya memicu notifikasi;
- file Storage yatim tersapu tiap jam.

## 2. Keputusan

Diambil bersama pemilik proyek selama brainstorming 2026-10-17:

1. **Alamat:**
   - aplikasi di `glosa.nuvrastudio.space`;
   - Uptime Kuma di `status.nuvrastudio.space`;
   - email dikirim dari `no-reply@glosa.nuvrastudio.space`.

   Domain utama tetap bebas untuk situs studio.
2. **VPS kosong** (Ubuntu baru) disiapkan untuk **banyak web**, Glosa yang pertama (diputuskan 2026-10-20). Caddy dan Uptime Kuma menjadi stack bersama di `/opt/proxy`, terpisah dari Glosa. Setiap web punya stack sendiri dan bergabung lewat satu jaringan Docker bersama. Tanpa Kubernetes dan tanpa dashboard PaaS: satu VPS belum butuh orkestrasi, dan pemilik ingin belajar dan memegang setiap langkah deploy sendiri.
3. **Uji coba tertutup dulu.** Pendaftaran dibatasi daftar undangan lewat *Before User Created hook* Supabase, sehingga berlaku untuk daftar lewat email maupun Google. Dibuka dengan `signups_open = true`, tanpa deploy ulang.
4. **SMTP: Resend**, dengan domain `glosa.nuvrastudio.space` diverifikasi. (Sebelum domain ada, pilihannya "tunggu domain"; domain kini tersedia.)
5. **Supabase prod paket gratis** selama uji coba. Risiko jeda 7 hari ditekan oleh cek Uptime Kuma tiap 5 menit. Naik ke Pro sebelum dibuka untuk umum (§10).
6. **Deploy otomatis dengan persetujuan:** lolos CI di `main`, lalu menunggu *Approve* di environment GitHub `production`, lalu migrasi prod dan deploy.
7. **Sapuan Storage** berjalan sebagai container cron di VPS, memakai image aplikasi yang sama.
8. **Pemantauan uptime:** Uptime Kuma di VPS untuk detail, ditambah satu cek luar gratis (UptimeRobot) untuk kasus VPS mati total.
9. **`docs/ops/produksi.md` adalah panduan belajar**, bukan sekadar daftar perintah. Setiap langkah menjelaskan apa yang dikerjakan dan kenapa, dan langkah di VPS dijalankan pemilik sendiri.

## 3. Susunan di VPS

```
                 /opt/proxy (stack bersama)          /opt/glosa (stack Glosa)
Internet ─443/80─▶ caddy ──(jaringan "web")──▶ glosa-app:3000   (app)
                     │                      ──▶ web lain nanti
                     └──▶ uptime-kuma:3001
                                                    sweep (cron tiap jam) ──▶ Supabase prod
                                                                          ──▶ Kuma (push, lewat URL publik)
```

**Stack bersama `/opt/proxy`.** Berkasnya ada di repo ini di `deploy/proxy/` sampai web kedua datang; saat itu dipindah ke repo infra sendiri.

| Layanan | Image | Isi |
|---|---|---|
| `caddy` | `caddy:2` | Satu-satunya yang memakai port 80/443. HTTPS otomatis (Let's Encrypt), reverse proxy, kompresi zstd/gzip. |
| `uptime-kuma` | `louislam/uptime-kuma:1` | Data di volume `kuma-data`. Host `status.nuvrastudio.space`. |

`deploy/proxy/Caddyfile` hanya berisi opsi global (email ACME), blok `status.nuvrastudio.space`, dan `import /etc/caddy/sites/*.caddy`. Folder `/opt/proxy/sites` di-mount ke container itu. **Setiap web memiliki satu berkas di folder itu**, sehingga menambah atau mengubah web tidak menyentuh berkas web lain.

**Jaringan `web`:** jaringan Docker bersama yang dibuat `vps-setup.sh` (`docker network create web`). Setiap stack mendeklarasikannya sebagai `external: true`. Nama layanan seperti `app` bisa bentrok antar-stack, jadi setiap web memakai alias jaringan berawalan nama web (`glosa-app`) dan Caddy menuju alias itu.

**Stack Glosa `/opt/glosa`:** berkas `deploy/compose.yml` dengan dua layanan.

| Layanan | Image | Isi |
|---|---|---|
| `app` | `ghcr.io/<pemilik>/glosa:<sha>` | Hasil `npm run build` dijalankan dengan `srvx` di Node 24: SSR, server functions, dan file statis `dist/client`. Bergabung ke jaringan `web` dengan alias `glosa-app`; port 3000 tidak dibuka ke host. Ada healthcheck ke `/api/health`. |
| `sweep` | image yang sama | Menjalankan sapuan (§6) tiap jam. Tidak bergabung ke `web`, karena hanya butuh akses keluar. |

**Blok situs Glosa:** `deploy/glosa.caddy` menuju `glosa-app:3000` dan berisi header cache di bawah. Workflow deploy menyalinnya ke `/opt/proxy/sites/glosa.caddy` (§5). Nama host ditulis langsung di berkas ini dan versinya ikut repo; pindah domain berarti mengubah berkas ini dan `SITE_URL`.

**Header cache dari blok situs Glosa:**

| Path | `Cache-Control` | Alasan |
|---|---|---|
| `/sw.js`, `/_shell.html` | `no-cache` | Versi baru service worker dan app shell langsung terambil |
| `/assets/*` | `public, max-age=31536000, immutable` | Nama file ber-hash |
| lainnya | bawaan aplikasi | |

**Image tanpa rahasia.** Kunci Supabase hanya dipakai di server; browser selalu lewat server functions. Semua env dibaca saat container jalan, dari `deploy/.env` di VPS (mode `600`, milik user `deploy`):

| Env | Dipakai oleh | Isi |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | app, sweep | Proyek prod. Kunci rahasia prod **hanya** ada di VPS, tidak di GitHub. |
| `SITE_URL` | app | `https://glosa.nuvrastudio.space` |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | app, sweep | Kosong berarti Sentry mati |
| `KUMA_PUSH_URL` | sweep | URL push monitor sapuan |
| `SWEEP_DRY_RUN` | sweep | `1` berarti hanya mencatat rencana |
| `GLOSA_TAG` | compose | SHA image yang berjalan. Ditulis workflow deploy ke `/opt/glosa/release.env` (terpisah dari `.env` milik pemilik); compose dijalankan dengan `--env-file .env --env-file release.env`. |

Stack proxy tidak butuh rahasia; nama host ada di berkas Caddy.

SHA versi dibakar ke image sebagai build arg `APP_VERSION`, karena versi memang milik image.

**Log:** driver `json-file` dengan `max-size: 10m` dan `max-file: 5` per layanan.

**Persiapan VPS sekali jalan:** `scripts/vps-setup.sh` untuk Ubuntu kosong, dijalankan pemilik sebagai root.
- Memasang Docker Engine dan plugin compose.
- Membuat user `deploy` (grup `docker`) dengan kunci publik SSH khusus GitHub Actions.
- Firewall `ufw`: hanya 22, 80, dan 443.
- SSH tanpa login sandi dan tanpa login root.
- Swap 2 GB dan `unattended-upgrades`.
- Jaringan Docker `web`.
- Folder `/opt/proxy`, `/opt/proxy/sites`, dan `/opt/glosa`, milik user `deploy`.

Skrip ini aman dijalankan ulang. Skrip ini tidak menjalankan stack apa pun: pemilik menyalin `deploy/proxy/` ke `/opt/proxy` dan menyalakannya sendiri dengan `docker compose up -d`, sebagai langkah belajar yang dijelaskan di `docs/ops/produksi.md`.

## 4. Supabase prod, undangan, dan email

**Proyek prod:**
- **Proyek:** paket gratis, region Singapura (`ap-southeast-1`).
- **Skema database:** hanya dari migrasi di `supabase/migrations`, lewat pipeline (§5).
- **Setelan yang tidak ikut migrasi:** Site URL, redirect URL, SMTP, template email, provider Google, dan aktivasi hook. Langkahnya ditulis di `docs/ops/produksi.md`, termasuk nilai yang harus diisi.

**Undangan (migrasi baru):**
- tabel `signup_invites (email citext primary key, note text, created_at timestamptz)`;
- tabel satu baris `app_settings (signups_open boolean not null default false)`;
- fungsi `public.before_user_created(event jsonb) returns jsonb`.

Fungsi itu mengembalikan `{}` (izinkan) kalau `signups_open` atau email ada di `signup_invites`. Kalau tidak, ia mengembalikan error HTTP 403 dengan pesan Indonesia: "Glosa sedang dalam uji coba tertutup. Pendaftaran baru dibuka untuk umum segera."

**Hak akses fungsi dan tabel:**
- Eksekusi fungsi hanya untuk `supabase_auth_admin`.
- Kedua tabel tanpa akses `anon` dan `authenticated` (RLS aktif, tanpa policy).
- Undangan dikelola pemilik lewat SQL editor dashboard.

**Hook dan pesan galat:**
- **Dev:** hook diaktifkan dengan `signups_open = true`, supaya E2E dan test DB tetap jalan.
- **Prod:** dimulai dengan `false`.
- **Pesan di halaman:** galat hook muncul di form daftar sebagai pesan dari Supabase. `auth-messages.ts` memetakannya ke teks yang sama di atas, termasuk untuk alur Google yang kembali ke `/login` dengan error.

**Resend:**
- Domain `glosa.nuvrastudio.space` diverifikasi lewat record DNS dari Resend (MX/SPF/DKIM).
- Supabase prod memakai SMTP Resend dengan pengirim `Glosa <no-reply@glosa.nuvrastudio.space>`.
- Template diambil dari `supabase/templates`.
- Proyek dev juga memakai Resend dengan kunci API terpisah. `E2E_SMTP_EMAIL` diisi, sehingga dua test E2E email sungguhan ikut berjalan di CI.

**Google:**
- OAuth client prod di Google Cloud, layar persetujuan dalam mode *testing*.
- Penguji didaftarkan di Google, dan emailnya juga dimasukkan ke `signup_invites`.
- Domain resmi: `nuvrastudio.space`.

**Halaman `/privacy`:** diperbarui supaya menyebut Sentry (laporan error, tanpa email), Resend (pengiriman email), dan lokasi data (Supabase Singapura, VPS).

## 5. Alur deploy

Tambahan pada `.github/workflows/ci.yml`:

```
push ke main
 └─ test        (sudah ada) lint, check, typecheck, unit, build, test DB, E2E ke proyek dev
                + cek kebocoran: build gagal kalau nilai SUPABASE_SECRET_KEY
                  atau pola "sb_secret_" ada di dist/client
                + caddy validate untuk deploy/proxy/Caddyfile bersama
                  deploy/glosa.caddy (diimpor seperti di VPS)
 └─ image       (needs test, hanya push ke main)
                docker build --build-arg APP_VERSION=<sha>
                unggah source map ke Sentry, lalu hapus .map dari image
                nyalakan container sekali, cek /api/health menjawab <sha>
                push ghcr.io/<pemilik>/glosa:<sha>
 └─ deploy      (needs image, environment: production → menunggu Approve)
                supabase link + supabase db push ke proyek prod
                scp deploy/compose.yml ke /opt/glosa
                ssh: tulis GLOSA_TAG=<sha> ke release.env, docker compose pull && up -d
                scp deploy/glosa.caddy ke /opt/proxy/sites/glosa.caddy
                ssh: caddy validate lalu caddy reload di container caddy
                smoke check: https://glosa.nuvrastudio.space/api/health menjawab <sha> (ulang ≤ 2 menit)
```

**Urutan dan blok situs:**
- Container baru naik dulu, baru Caddy dimuat ulang, supaya alias `glosa-app` sudah ada saat blok situs dibaca.
- `caddy reload` bersifat atomik: kalau konfigurasi baru gagal, Caddy tetap memakai yang lama dan web lain tidak terganggu. Langkah ini gagal kalau `validate` gagal, dan deploy dianggap gagal.
- Workflow Glosa hanya menulis `sites/glosa.caddy`. Berkas stack proxy (`compose.yml`, `Caddyfile`) diubah pemilik sendiri, tidak lewat pipeline web mana pun.

**Secret di environment `production`:**
- `SUPABASE_ACCESS_TOKEN`, `PROD_SUPABASE_PROJECT_REF`, `PROD_SUPABASE_DB_PASSWORD`;
- `VPS_HOST`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`;
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

Image di GHCR privat, dan VPS login ke GHCR sekali saat persiapan dengan token `read:packages`.

**Rollback:** workflow `deploy` bisa dijalankan manual (`workflow_dispatch`) dengan input `tag`. Rollback dengan cara ini melewatkan migrasi.

**Aturan migrasi:** migrasi berjalan sebelum container baru naik, jadi versi lama sempat berjalan di atas skema baru. Karena itu, satu deploy hanya **menambah**: tabel, kolom dengan default, atau fungsi baru. Penghapusan dan penggantian nama dilakukan di deploy berikutnya, setelah kode lama tidak dipakai lagi. Aturan ini ditulis di `docs/ops/produksi.md`.

**`/api/health`:** server route `GET` yang menjawab `{ "status": "ok", "version": "<sha>" }` dengan `Cache-Control: no-store`. Route ini tidak menyentuh database, supaya kesehatan aplikasi dan Supabase dipantau terpisah.

## 6. Sapuan Storage

Skrip `src/server/sweep/` dibangun menjadi `dist/sweep.mjs` saat build. Layanan `sweep` menjalankannya tiap jam dengan loop `sleep` sederhana di container; putaran pertama berjalan saat container naik.

**Yang disapu, dengan batas usia 1 jam:**
1. Baris `books` berstatus `pending` yang lebih tua dari 1 jam, beserta objek EPUB dan sampulnya.
2. Akun auth tanpa baris `profiles` dan dibuat lebih dari 1 jam lalu. Profil dibuat trigger dalam transaksi yang sama dengan akun, jadi akun seperti ini pasti rusak (profilnya dihapus di luar aplikasi). Akun dihapus lewat Admin API.
3. Folder `books/<uid>/` yang `uid`-nya tidak punya profil lagi: semua objek di dalamnya.
4. Objek yang tidak dirujuk baris `books` mana pun dan lebih tua dari 1 jam.

**Susunan:**
- **`plan-sweep.ts`:** fungsi murni yang menerima daftar objek, baris buku, profil, dan akun beserta waktu sekarang, lalu mengembalikan daftar aksi dan alasannya.
- **`run-sweep.ts`:** mengambil daftar (dengan paginasi), memanggil perencana, menjalankan aksi, mencatat ringkasan ke stdout, dan mengirim heartbeat.

**Pengaman:**
- Kalau mengambil daftar mana pun gagal, putaran **berhenti tanpa menghapus apa pun** dan melapor ke Sentry. Daftar yang gagal tidak pernah dianggap kosong.
- Kalau satu putaran akan menghapus lebih dari 50 objek atau 5 akun, putaran berhenti dan melapor ke Sentry. Pemilik bisa menjalankannya sekali dengan `SWEEP_MAX_DELETIONS` yang lebih besar setelah memeriksa rencananya.
- `SWEEP_DRY_RUN=1` hanya mencatat rencana.
- Heartbeat ke `KUMA_PUSH_URL` hanya dikirim setelah putaran sukses, termasuk putaran tanpa aksi.

## 7. Pemantauan

**Sentry (paket gratis):**
- **Browser** `@sentry/react` dan **server** `@sentry/node`, keduanya aktif hanya kalau `SENTRY_DSN` diisi.
- **DSN browser** disuntikkan server lewat `head` route root saat render (`window.__GLOSA_SENTRY__`), supaya image sama di semua lingkungan.
- **Yang terlapor:** error dari error boundary per route, server functions yang gagal tak terduga, dan kegagalan sapuan.
- **Setelan:** `release` = SHA dan `environment` dari env. `sendDefaultPii: false`, dengan `user.id` saja (tanpa email). Tanpa session replay. `tracesSampleRate: 0`.
- **Galat yang sudah ditangani** dengan pesan untuk anggota (kuota penuh, EPUB rusak, offline) tidak dilaporkan.

**Uptime Kuma (`status.nuvrastudio.space`), dengan notifikasi email lewat SMTP Resend ke pemilik:**

| Monitor | Interval | Catatan |
|---|---|---|
| `https://glosa.nuvrastudio.space/api/health` | 60 dtk | Termasuk peringatan sertifikat < 14 hari |
| `https://<ref>.supabase.co/auth/v1/health` | 5 mnt | Sekaligus menjaga proyek gratis tetap aktif |
| Push "sapuan" | batas 65 mnt | Dari §6 |

**Cek luar:** UptimeRobot gratis ke `/api/health` tiap 5 menit, dengan notifikasi email.

## 8. Pengujian

| Jenis | Cakupan |
|---|---|
| Unit (Vitest) | `plan-sweep`: setiap jenis sapuan, batas usia 1 jam, batas aman, dan objek milik buku `ready` yang tidak pernah disentuh. `/api/health`. Pemetaan pesan galat undangan. Penyuntikan DSN: tanpa `SENTRY_DSN` tidak ada skrip. |
| Database (`test:db`, proyek dev) | Hook undangan: ditolak saat tertutup tanpa undangan, diizinkan dengan undangan, diizinkan saat terbuka (memanggil fungsinya langsung dengan event JSON). `run-sweep` dibatasi ke UID uji: baris pending tua dan objeknya hilang, objek yatim hilang, folder UID tanpa profil hilang, akun tanpa profil hilang, buku `ready` utuh. |
| CI | Cek kebocoran kunci, `caddy validate` (Caddyfile bersama dengan `glosa.caddy` diimpor), dan container image dinyalakan sekali dengan `/api/health` dicek sebelum push. |
| E2E | Tetap ke proyek dev. Dua test email sungguhan kini berjalan karena SMTP dev memakai Resend. |
| Manual setelah deploy pertama | HP Android sungguhan: pasang PWA, daftar dengan email undangan, simpan buku, baca offline. `curl -I` untuk header `sw.js`, `_shell.html`, dan `/assets/*`. Email konfirmasi dan reset sampai dari `no-reply@glosa.nuvrastudio.space`. Email di luar undangan ditolak dengan pesan uji coba tertutup. Uji manual 1D di build produksi: profil performa dengan CPU 4×, keyboard, reduced motion, serta `/` dan `/login`. Satu error uji muncul di Sentry dengan release yang benar. Kuma dan UptimeRobot mengabari saat `app` dihentikan sebentar. |

## 9. Langkah pemilik

Hal yang butuh akun atau akses pemilik, ditulis berurutan di `docs/ops/produksi.md`:

1. **DNS `nuvrastudio.space`:** record A `glosa` dan `status` ke IP VPS, ditambah record Resend.
2. **VPS:**
   - jalankan `scripts/vps-setup.sh`;
   - salin `deploy/proxy/` ke `/opt/proxy` lalu `docker compose up -d` di sana, dan pastikan `status.nuvrastudio.space` sudah HTTPS;
   - isi `/opt/glosa/.env`;
   - `docker login ghcr.io` dengan token `read:packages`.
3. **Supabase:** buat proyek prod (Singapura), lalu buat access token pribadi.
4. **Resend:** buat akun, tambahkan domain, dan buat kunci API (prod dan dev) dan SMTP.
5. **Sentry:** buat akun dan proyek, lalu ambil DSN dan auth token.
6. **Google Cloud:** buat OAuth client prod, lalu daftarkan penguji.
7. **GitHub:** buat environment `production` dengan pemilik sebagai *required reviewer*, lalu isi secret-nya (§5).
8. **UptimeRobot:** buat akun dan satu monitor.

## 10. Sebelum dibuka untuk umum

Bukan bagian 1E; dicatat di `docs/ops/produksi.md`:
- naik ke Supabase Pro (backup harian, tanpa jeda);
- verifikasi aplikasi Google: domain `nuvrastudio.space` di Search Console, lalu layar persetujuan *In production*;
- tinjau ulang `/privacy` dan `/terms`;
- `update app_settings set signups_open = true`.

## 11. Di luar cakupan

- Staging terpisah.
- CDN.
- Pengumpulan log terpusat.
- Backup mandiri (`pg_dump`) selama paket gratis.
- Penskalaan ke lebih dari satu VPS.
- Situs studio di domain utama.
- Repo infra terpisah untuk stack proxy (saat web kedua datang).
- Kubernetes. Kalau nanti dibutuhkan atau ingin dipelajari: coba k3s di VPS terpisah atau di laptop (k3d/kind) dengan image GHCR yang sama, tanpa menyentuh produksi.
