# Glosa — Deploy Otomatis ke Situs Dev: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setiap push ke `main` yang lolos CI otomatis dideploy ke `https://glosa.nuvrastudio.space`, situs **dev** yang memakai proyek Supabase dev. Berkas dan pipeline deploy disusun per environment, supaya prod (domain lain, VPS yang sama) nanti cukup ditambah tanpa ditulis ulang.

**Architecture:**
- **Satu image, banyak environment.** Image `ghcr.io/muhammadyudhistira/glosa:<sha>` tidak berubah.
- **Penamaan di VPS.** Tiap environment punya stack sendiri, `/opt/glosa-<env>` (sekarang `dev`, nanti `prod`).
  - Nama proyek compose diambil dari nama folder, misalnya `glosa-dev`.
  - Alias di jaringan `web` adalah `glosa-<env>-app`.
  - Blok Caddy ada di `deploy/sites/glosa-<env>.caddy`.
- **Workflow.** `deploy.yml` menerima input `environment`. Secret VPS dan variable `APP_URL` dibaca dari environment GitHub dengan nama yang sama.
- **Pemicu.** CI memanggilnya untuk `dev` tanpa *Approve* dan tanpa migrasi.

**Tech Stack:** GitHub Actions (reusable workflow), Docker Compose plugin, Caddy 2, Bash. Kode aplikasi tidak berubah.

## Keputusan

Disepakati dengan pemilik pada 2026-10-20 dan menggantikan sebagian spec 1E (§3, §5, §9):

1. **`glosa.nuvrastudio.space` adalah situs dev**, memakai proyek Supabase dev. Prod nanti memakai domain lain dan proyek Supabase prod.
2. **Dev dan prod di VPS yang sama**, sebagai dua stack: `/opt/glosa-dev` dan `/opt/glosa-prod`. `/opt/proxy` (Caddy + Uptime Kuma) tetap bersama.
3. **Pendaftaran di dev terbuka** (`app_settings.signups_open = true`). Hook undangan tidak diubah. Pembatasnya adalah email bawaan Supabase (hanya ke anggota tim) dan Google mode *Testing*.
4. **Deploy dev tanpa migrasi dan tanpa *Approve*.**
   - Migrasi tetap masuk ke dev lewat `npm run db:push` selama pengembangan.
   - Test CI yang hijau membuktikan skema dev sudah cocok.
   - Langkah migrasi tetap ada di `deploy.yml` untuk prod (`migrate: true`).
5. **Secret migrasi bernama netral**: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, disimpan di environment yang bersangkutan. Awalan `PROD_` dihapus.
6. **Gerbang deploy dev** adalah variable repositori **`DEV_DEPLOY_ENABLED`**, menggantikan `DEPLOY_ENABLED`. Variable environment tidak bisa dibaca `if:` pada job pemanggil reusable workflow, jadi gerbangnya harus di level repositori.
7. **`COMPOSE_PROJECT_NAME` tidak dipakai.** Tanpa `name:` di `compose.yml`, compose memberi nama proyek dari folder (`/opt/glosa-dev` → `glosa-dev`). Ini sudah diuji.
8. **`release.sh <env> <tag>` menolak** environment selain `dev`/`prod` dan tag selain SHA 40 karakter, **sebelum** menyentuh apa pun (exit 2). CI menguji penolakan ini.
9. **Sapuan di dev selalu `SWEEP_DRY_RUN=1`**, karena proyek dev dipakai bersama test CI. Sapuan sungguhan bisa menghapus data test yang sedang berjalan. Aturan ini ditulis di `.env.example` dan di panduan.
10. **Secret VPS ada di environment `dev`**, yang juga dipakai job `test`. Untuk repo satu pengembang ini wajar, dan PR dari *fork* tidak mendapat secret. Kalau nanti ada kolaborator, pindahkan ke environment tersendiri.
11. **Panduan `docs/ops/produksi.md` diganti nama menjadi `docs/ops/deploy.md`** dan disusun ulang: bagian bersama, dev sekarang, prod nanti.

## Global Constraints

- **Alamat dev:** `https://glosa.nuvrastudio.space`. **Uptime Kuma:** `status.nuvrastudio.space`.
- **Nama environment** yang diterima: `dev` dan `prod`.
- **Nama di VPS:**
  - folder `/opt/glosa-dev`, `/opt/glosa-prod`, `/opt/proxy`, `/opt/proxy/sites`;
  - berkas `/opt/glosa-<env>/.env` dan `/opt/glosa-<env>/release.env`;
  - blok Caddy `/opt/proxy/sites/glosa-<env>.caddy`;
  - alias `glosa-<env>-app`, port `3000`, jaringan `web`, user `deploy`.
- **Isi `release.env`:** `GLOSA_ENV=<env>` dan `GLOSA_TAG=<sha>`.
- **Environment GitHub `dev`:**
  - secret `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (sudah ada, untuk test);
  - secret `VPS_HOST`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`;
  - variable `APP_URL`.
- **Variable repositori:** `DEV_DEPLOY_ENABLED`.
- Berkas shell dan YAML berakhir baris LF (dijamin `.gitattributes`).
- Teks panduan dalam bahasa Indonesia; komentar kode dalam bahasa Inggris.

## Peta file

| File | Tugas |
|---|---|
| `deploy/compose.yml` | Tanpa `name:`; alias `glosa-${GLOSA_ENV}-app` (Task 1) |
| `deploy/sites/glosa-dev.caddy` | Pindahan `deploy/glosa.caddy`, ke `glosa-dev-app:3000` (Task 1) |
| `deploy/release.sh` | `release.sh <env> <tag>` (Task 1) |
| `deploy/.env.example` | Templat per environment (Task 1) |
| `scripts/vps-setup.sh` | Membuat `/opt/glosa-dev` dan `/opt/glosa-prod` (Task 1) |
| `.github/workflows/deploy.yml` | Input `environment` (Task 2) |
| `.github/workflows/ci.yml` | Job `deploy-dev`; validasi `deploy/sites/` dan argumen `release.sh` (Task 2) |
| `docs/ops/deploy.md` | Pengganti `docs/ops/produksi.md` (Task 3) |
| `docs/superpowers/specs/2026-10-17-tahap-1e-produksi-design.md` | Catatan di awal: bagian yang digantikan (Task 3) |

---

### Task 1: Berkas deploy per environment

**Files:**
- Modify: `deploy/compose.yml`
- Move: `deploy/glosa.caddy` → `deploy/sites/glosa-dev.caddy` (lalu ubah)
- Modify: `deploy/release.sh`
- Modify: `deploy/.env.example`
- Modify: `scripts/vps-setup.sh`

**Interfaces:**
- Produces:
  - `bash release.sh <dev|prod> <sha 40 karakter>`, yang membaca `/opt/glosa-<env>/{.env,compose.yml,glosa-<env>.caddy}`;
  - `release.env` berisi `GLOSA_ENV` dan `GLOSA_TAG`;
  - folder `deploy/sites/` yang dipasang utuh ke `/etc/caddy/sites` saat validasi.

- [ ] **Step 1: Buktikan `release.sh` lama belum menolak argumen salah**

Run (Git Bash): `bash deploy/release.sh staging 0123456789abcdef0123456789abcdef01234567; echo "exit $?"`
Expected: bukan `exit 2`. Skrip lama menganggap `staging` sebagai tag dan gagal di `cd /opt/glosa` (exit 1). Inilah perilaku yang akan diganti.

- [ ] **Step 2: Tulis ulang `deploy/release.sh`**

```bash
#!/usr/bin/env bash
# Runs on the VPS as user "deploy": switches Glosa's environment $1 (dev or
# prod) to the image tag $2, then hands its site block to the shared Caddy.
# The workflow first copies compose.yml and glosa-<env>.caddy into
# /opt/glosa-<env>.
set -euo pipefail

usage() {
  echo "usage: release.sh <dev|prod> <full commit sha>" >&2
  exit 2
}

env="${1:-}"
tag="${2:-}"
case "$env" in
  dev | prod) ;;
  *) usage ;;
esac
[[ "$tag" =~ ^[0-9a-f]{40}$ ]] || usage

block="glosa-$env.caddy"
site="/opt/proxy/sites/$block"

# The folder names the compose project: /opt/glosa-dev runs as "glosa-dev".
cd "/opt/glosa-$env"
printf 'GLOSA_ENV=%s\nGLOSA_TAG=%s\n' "$env" "$tag" > release.env
docker compose --env-file .env --env-file release.env pull
docker compose --env-file .env --env-file release.env up -d --remove-orphans

# Swap in the new site block, keeping the old one until Caddy accepts it, so a
# broken block never stays on disk for the next Caddy restart.
proxy() { docker compose -f /opt/proxy/compose.yml "$@"; }
backup=""
if [ -f "$site" ]; then
  backup="$(mktemp)"
  cp "$site" "$backup"
fi
cp "$block" "$site"
if ! proxy exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
  echo "Caddy rejected $block; the previous site block is back." >&2
  if [ -n "$backup" ]; then cp "$backup" "$site"; else rm -f "$site"; fi
  exit 1
fi
proxy exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
if [ -n "$backup" ]; then rm -f "$backup"; fi

# Keep a week of unused images for quick rollbacks; older ones are pulled again.
docker image prune -af --filter "until=168h"
```

- [ ] **Step 3: Pastikan argumen salah kini ditolak sebelum apa pun**

Run (Git Bash):

```bash
bash deploy/release.sh staging 0123456789abcdef0123456789abcdef01234567; echo "exit $?"
bash deploy/release.sh dev not-a-sha; echo "exit $?"
bash deploy/release.sh; echo "exit $?"
```

Expected: tiga kali `usage: release.sh <dev|prod> <full commit sha>` lalu `exit 2`.

- [ ] **Step 4: `deploy/compose.yml` untuk semua environment**

```yaml
# Glosa's stack on the VPS, one per environment: /opt/glosa-dev now,
# /opt/glosa-prod later. The folder names the compose project (glosa-dev);
# release.env sets GLOSA_ENV and GLOSA_TAG. Caddy and Uptime Kuma live in the
# shared stack /opt/proxy and reach the app as glosa-<env>-app:3000.
# Run: docker compose --env-file .env --env-file release.env up -d

x-logging: &logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"

services:
  app:
    image: ghcr.io/muhammadyudhistira/glosa:${GLOSA_TAG:?GLOSA_TAG is not set}
    restart: unless-stopped
    init: true
    env_file: .env
    networks:
      web:
        aliases: ["glosa-${GLOSA_ENV:?GLOSA_ENV is not set}-app"]
    logging: *logging

  sweep:
    image: ghcr.io/muhammadyudhistira/glosa:${GLOSA_TAG:?GLOSA_TAG is not set}
    restart: unless-stopped
    init: true
    env_file: .env
    # One round when the container starts, then one every hour (spec 1E §6).
    command: ["sh", "-c", "while true; do node dist/sweep.mjs; sleep 3600; done"]
    # The image's healthcheck is for the web server.
    healthcheck:
      disable: true
    logging: *logging

networks:
  web:
    external: true
```

- [ ] **Step 5: Pindahkan dan ubah blok Caddy**

Run: `git mv deploy/glosa.caddy deploy/sites/glosa-dev.caddy`

Isi `deploy/sites/glosa-dev.caddy` (indentasi tab):

```
# Glosa dev (Supabase dev project). deploy/release.sh copies it to
# /opt/proxy/sites/glosa-dev.caddy.

glosa.nuvrastudio.space {
	encode zstd gzip

	# A new service worker and app shell are picked up straight away.
	@fresh path /sw.js /_shell.html
	header @fresh >Cache-Control "no-cache"

	# Built assets have hashed names and never change.
	@assets path /assets/*
	header @assets >Cache-Control "public, max-age=31536000, immutable"

	reverse_proxy glosa-dev-app:3000
}
```

- [ ] **Step 6: `deploy/.env.example`**

```
# Template for /opt/glosa-<env>/.env on the VPS (mode 600, owner deploy).
# Real values live only on the VPS: never commit them.
# dev: keys of the Supabase dev project. prod: keys of the prod project.
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
# dev: https://glosa.nuvrastudio.space
SITE_URL=https://glosa.nuvrastudio.space
# Empty keeps Sentry off.
SENTRY_DSN=
# dev: development. prod: production.
SENTRY_ENVIRONMENT=development
# Push URL of this environment's sweep monitor in Uptime Kuma.
KUMA_PUSH_URL=
# 1 = only log what the sweep would delete.
# dev: always 1. The dev project is shared with CI tests, and a real sweep
# could delete the data of a test that is running.
# prod: set to 0 once the logged plans look right.
SWEEP_DRY_RUN=1
# prod only: raise for one supervised run when a round stops at its limits.
# SWEEP_MAX_DELETIONS=200
```

- [ ] **Step 7: Folder di `scripts/vps-setup.sh`**

Ganti dua baris terakhir skrip:

```bash
echo "==> Shared Docker network and folders"
docker network inspect web >/dev/null 2>&1 || docker network create web
install -d -o deploy -g deploy /opt/proxy /opt/proxy/sites /opt/glosa-dev /opt/glosa-prod

echo "Done. Next: docs/ops/deploy.md, section 3.4."
```

Di komentar kepala skrip, ganti `docs/ops/produksi.md` dengan `docs/ops/deploy.md`.

- [ ] **Step 8: Validasi dengan Docker (Docker Desktop harus berjalan)**

Run (Git Bash):

```bash
export MSYS_NO_PATHCONV=1
docker run --rm \
  -v "$PWD/deploy/proxy/Caddyfile:/etc/caddy/Caddyfile:ro" \
  -v "$PWD/deploy/sites:/etc/caddy/sites:ro" \
  caddy:2 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1 | tail -1
docker run --rm -v "$PWD:/mnt" -w /mnt koalaman/shellcheck:stable scripts/vps-setup.sh deploy/release.sh; echo "shellcheck $?"
d="$TEMP/compose-check/glosa-dev"; mkdir -p "$d"
cp deploy/compose.yml "$d/"; : > "$d/.env"
printf 'GLOSA_ENV=dev\nGLOSA_TAG=abc\n' > "$d/release.env"
docker compose -f "$d/compose.yml" --env-file "$d/.env" --env-file "$d/release.env" config | grep -E "^name:|glosa-dev-app"
rm -rf "$TEMP/compose-check"
```

Expected:
- `Valid configuration`;
- `shellcheck 0`;
- `name: glosa-dev` dan `- glosa-dev-app`.

- [ ] **Step 9: Commit**

```bash
git add deploy scripts/vps-setup.sh
git commit -m "feat(ops): deploy files per environment, starting with dev"
```

---

### Task 2: CI/CD — deploy otomatis ke dev

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `release.sh <env> <tag>` dan `deploy/sites/glosa-<env>.caddy` (Task 1).
- Produces:
  - workflow `Deploy` dengan input `environment`, `tag`, dan `migrate` (`workflow_call`), serta `environment` (pilihan) dan `tag` (`workflow_dispatch`);
  - job CI `deploy-dev`.

- [ ] **Step 1: Tulis ulang `.github/workflows/deploy.yml`**

```yaml
name: Deploy

# Called by CI for every green main (dev, no migrations), or run by hand from
# the Actions tab with an older tag to roll back (migrations skipped). The
# GitHub environment of the same name holds the VPS secrets and APP_URL.
on:
  workflow_call:
    inputs:
      environment:
        type: string
        required: true
      tag:
        type: string
        required: true
      migrate:
        type: boolean
        required: true
  workflow_dispatch:
    inputs:
      environment:
        description: "Where to deploy"
        type: choice
        options: [dev, prod]
        required: true
      tag:
        description: "Full commit SHA of the image to run. Migrations are skipped."
        type: string
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    environment: ${{ inputs.environment }}
    concurrency:
      group: deploy-${{ inputs.environment }}
      cancel-in-progress: false
    env:
      DEPLOY_ENV: ${{ inputs.environment }}
      TAG: ${{ inputs.tag }}
    steps:
      - name: Check the inputs
        env:
          APP_URL: ${{ vars.APP_URL }}
        run: |
          [[ "$DEPLOY_ENV" =~ ^(dev|prod)$ ]] || { echo "environment must be dev or prod"; exit 1; }
          [[ "$TAG" =~ ^[0-9a-f]{40}$ ]] || { echo "tag must be a full commit SHA"; exit 1; }
          [ -n "$APP_URL" ] || { echo "Set the APP_URL variable in the $DEPLOY_ENV environment"; exit 1; }
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        if: inputs.migrate
        with:
          version: 2.121.0
      - name: Apply database migrations
        if: inputs.migrate
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
        run: |
          supabase link --project-ref "${{ secrets.SUPABASE_PROJECT_REF }}"
          supabase db push --yes
      - name: Prepare SSH
        env:
          VPS_SSH_KEY: ${{ secrets.VPS_SSH_KEY }}
          VPS_KNOWN_HOSTS: ${{ secrets.VPS_KNOWN_HOSTS }}
        run: |
          install -m 700 -d ~/.ssh
          printf '%s\n' "$VPS_SSH_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          printf '%s\n' "$VPS_KNOWN_HOSTS" > ~/.ssh/known_hosts
      - name: Release on the VPS
        env:
          VPS_HOST: ${{ secrets.VPS_HOST }}
        run: |
          scp deploy/compose.yml "deploy/sites/glosa-$DEPLOY_ENV.caddy" "deploy@$VPS_HOST:/opt/glosa-$DEPLOY_ENV/"
          # Both values were checked above, so they are safe on the remote shell.
          ssh "deploy@$VPS_HOST" bash -s -- "$DEPLOY_ENV" "$TAG" < deploy/release.sh
      - name: Smoke check
        env:
          APP_URL: ${{ vars.APP_URL }}
        run: |
          for _ in $(seq 1 24); do
            version=$(curl -fsS "$APP_URL/api/health" | jq -r .version) \
              && [ "$version" = "$TAG" ] && exit 0
            sleep 5
          done
          echo "$APP_URL/api/health never reported $TAG"
          exit 1
```

- [ ] **Step 2: Ubah `.github/workflows/ci.yml`**

Di job `test`, ganti isi langkah `Validate deploy files`:

```yaml
      - name: Validate deploy files
        run: |
          shellcheck scripts/vps-setup.sh deploy/release.sh
          docker run --rm \
            -v "$PWD/deploy/proxy/Caddyfile:/etc/caddy/Caddyfile:ro" \
            -v "$PWD/deploy/sites:/etc/caddy/sites:ro" \
            caddy:2 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
          docker compose -f deploy/proxy/compose.yml config --quiet
          : > deploy/.env
          GLOSA_ENV=ci GLOSA_TAG=ci docker compose -f deploy/compose.yml config --quiet
          rm deploy/.env
          # release.sh must refuse a wrong environment or tag before touching anything.
          if bash deploy/release.sh staging "$GITHUB_SHA"; then exit 1; fi
          if bash deploy/release.sh dev not-a-sha; then exit 1; fi
```

Ganti komentar `concurrency` di job `test`:

```yaml
    # Integration and E2E tests share the Supabase dev project; avoid overlapping
    # runs. Job-level, so a running deploy never holds other runs.
```

Ganti job `deploy` di akhir file:

```yaml
  # Every green main goes to the dev site, without approval or migrations
  # (migrations reach the dev project during development: npm run db:push).
  deploy-dev:
    needs: image
    if: github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.DEV_DEPLOY_ENABLED == 'true'
    uses: ./.github/workflows/deploy.yml
    with:
      environment: dev
      tag: ${{ github.sha }}
      migrate: false
    secrets: inherit
```

- [ ] **Step 3: Periksa sintaks workflow**

Run (Git Bash):

```bash
export MSYS_NO_PATHCONV=1
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest .github/workflows/ci.yml .github/workflows/deploy.yml; echo "actionlint $?"
```

Expected: `actionlint 0` tanpa keluaran lain.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/deploy.yml
git commit -m "ci: deploy every green main to the dev site"
```

---

### Task 3: Panduan `docs/ops/deploy.md`

**Files:**
- Move: `docs/ops/produksi.md` → `docs/ops/deploy.md` (isi ditulis ulang)
- Modify: `docs/superpowers/specs/2026-10-17-tahap-1e-produksi-design.md` (catatan di awal)

- [ ] **Step 1: Pindahkan berkas**

Run: `git mv docs/ops/produksi.md docs/ops/deploy.md`

- [ ] **Step 2: Tulis ulang `docs/ops/deploy.md` persis seperti ini**

````markdown
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

Salin **Push URL** monitor Sapuan dev ke `KUMA_PUSH_URL` di `/opt/glosa-dev/.env`. Monitor Supabase juga menjaga proyek gratis tetap aktif, karena proyek gratis dijeda setelah 7 hari tanpa aktivitas.

Notifikasi email Kuma (Settings → Notifications) butuh SMTP. Isi setelah Resend siap (8.3).

## 5. Deploy dev pertama

### 5.1 Memicu

Push ke `main`, atau jalankan ulang run CI terakhir di `main` (Actions → run → *Re-run all jobs*). Urutannya:
1. `test`;
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
````

- [ ] **Step 3: Catatan di spec 1E**

Di `docs/superpowers/specs/2026-10-17-tahap-1e-produksi-design.md`, tepat setelah judul (baris pertama), sisipkan:

```markdown

> **Diperbarui 2026-10-20** ([rencana deploy dev](../plans/2026-10-20-deploy-dev.md)): `glosa.nuvrastudio.space` kini situs **dev** dengan proyek Supabase dev, dideploy otomatis tanpa *Approve*. Prod menyusul di domain lain pada VPS yang sama (`/opt/glosa-prod`). Bagian spec ini tentang alamat, stack VPS, dan pipeline deploy digantikan rencana itu; panduannya kini `docs/ops/deploy.md`.
```

- [ ] **Step 4: Cari rujukan lama**

Run: Grep `produksi\.md|deploy/glosa\.caddy|/opt/glosa[^-]|glosa-app|DEPLOY_ENABLED|PROD_SUPABASE` di seluruh repo, kecuali `docs/superpowers/` (riwayat plan dan spec 1E dibiarkan).
Expected: tidak ada hasil, selain `DEV_DEPLOY_ENABLED`. Perbaiki yang masih tersisa.

- [ ] **Step 5: Commit**

```bash
git add docs/ops/deploy.md docs/superpowers/specs/2026-10-17-tahap-1e-produksi-design.md
git commit -m "docs(ops): deploy guide for the dev site, with prod as a later step"
```

---

### Task 4: Verifikasi akhir dan PR

- [ ] **Step 1: Pemeriksaan lokal**

```bash
npm run lint && npm run check && npm run typecheck && npm test
```

Expected: semuanya hijau. Kode aplikasi tidak berubah; ini memastikan tidak ada yang ikut tersentuh.

Ulangi juga Task 1 Step 3 dan Step 8, serta Task 2 Step 3.

- [ ] **Step 2: Push branch dan buka PR**

Push branch `deploy-dev`, lalu buka PR ke `main` (lewat GitHub, karena `gh` tidak terpasang). Di PR, job `test` (termasuk *Validate deploy files* yang baru) dan `image` harus hijau. Job `deploy-dev` dilewati di PR.

- [ ] **Step 3: Setelah merge**

Pemilik mengikuti `docs/ops/deploy.md` bagian 3–5. Tanda selesai: run CI `main` hijau sampai `deploy-dev`, dan `https://glosa.nuvrastudio.space/api/health` menjawab SHA commit itu.
