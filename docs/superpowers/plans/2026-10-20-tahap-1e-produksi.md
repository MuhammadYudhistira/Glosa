# Glosa Tahap 1E — Produksi: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Glosa berjalan di `https://glosa.nuvrastudio.space` sebagai uji coba tertutup:
- push ke `main` yang lolos CI dideploy ke VPS setelah pemilik menekan *Approve*;
- hanya email undangan yang bisa mendaftar;
- error terlapor ke Sentry;
- file Storage yatim tersapu tiap jam;
- VPS siap menampung web lain berikutnya.

**Architecture:**
- **VPS satu mesin dengan Docker Compose, tanpa Kubernetes dan tanpa dashboard PaaS.** Ada dua stack:
  - `/opt/proxy` (bersama): Caddy (satu-satunya pemakai port 80/443) dan Uptime Kuma;
  - `/opt/glosa`: `app` dan `sweep`.

  Keduanya bertemu di jaringan Docker `web`. Glosa memakai alias `glosa-app`, dan blok situsnya ada di `/opt/proxy/sites/glosa.caddy`.
- **Satu image untuk app dan sapuan:** `ghcr.io/muhammadyudhistira/glosa:<sha>`, tanpa rahasia.
  - `srvx` menjalankan `dist/server/server.js` dan menyajikan `dist/client`.
  - `node dist/sweep.mjs` menjalankan sapuan.
- **CI:** test, lalu image (build, smoke test, dan push dari `main`), lalu deploy. Deploy memakai workflow `deploy.yml` yang bisa dipanggil ulang, di environment `production` yang menunggu *Approve*. Langkahnya: migrasi prod, salin berkas ke VPS, `deploy/release.sh` lewat SSH, lalu smoke check.
- **Undangan** memakai *Before User Created hook* Supabase (fungsi Postgres `public.before_user_created`).
- **Sentry:**
  - browser: dimuat dinamis hanya jika server menyuntikkan DSN lewat `window.__GLOSA_SENTRY__`;
  - server: `logServerError` dan middleware server function.

**Tech Stack:**
- TanStack Start 1.169 + Router, React 19, TypeScript 6, Vite 8, Vitest 5, Playwright, Supabase (Cloud, CLI 2.121.0).
- Paket baru: `srvx` 1.x (sudah ada sebagai dependensi transitif, kini eksplisit), `@sentry/react`, `@sentry/node`, dan `@sentry/cli` (dev).
- Infrastruktur: Docker + Compose plugin, Caddy 2, Uptime Kuma 1, GitHub Actions, GHCR.

**Seri rencana tahap 1** (spec induk: [`docs/superpowers/specs/2026-10-15-epub-reader-tahap-1-design.md`](../specs/2026-10-15-epub-reader-tahap-1-design.md); spec 1E: [`docs/superpowers/specs/2026-10-17-tahap-1e-produksi-design.md`](../specs/2026-10-17-tahap-1e-produksi-design.md)):

| Rencana | Isi | Status |
|---|---|---|
| 1A | Fondasi proyek, `profiles`, auth, kartu anggota, pengaturan, halaman hukum, E2E, CI | Selesai (`main`) |
| 1B | Tabel `books`, Storage, kuota, genre + Troli, Rak Saya, upload | Selesai (`main`) |
| 1C | Reader, setelan baca, sinkronisasi posisi, penyimpanan lokal, rak offline, PWA offline | Selesai (`main`) |
| 1D | Lobi 3D, kerangka navigasi anggota, font reader offline | Selesai (`main`) |
| **1E** | **Produksi: undangan, health, Sentry, sapuan Storage, image + compose + Caddy, skrip VPS, CI/CD, panduan ops** | **Dokumen ini** |

## Keputusan dan penyimpangan dari spec

Semua keputusan berikut disengaja. Reviewer tidak perlu menganggapnya sebagai cacat.

1. **Email undangan bertipe `text` huruf kecil, bukan `citext`.** Fungsi hook memakai `set search_path = ''`, sehingga operator `=` milik `citext` (di skema `extensions`) tidak ditemukan. Kolom `email` dicek `email = lower(btrim(email))`, dan hook membandingkannya dengan `lower(btrim(...))`. Pemilik menambah undangan dengan `lower('...')`.
2. **Fungsi hook juga bisa dieksekusi `service_role`.** Dengan begitu `test:db` bisa memanggilnya langsung (spec §8). `service_role` memang sudah bisa membaca kedua tabel itu. `anon` dan `authenticated` tetap tidak punya akses.
3. **Penolakan hook dikenali dari teks pesannya** (`"uji coba tertutup"`), karena Supabase tidak memberi kode galat khusus untuk penolakan hook.
   - Daftar lewat email mendapat pesan di form daftar.
   - Daftar lewat Google kembali ke `/auth/callback` (bukan `/login`) dan tampil di `LinkFailed` dengan judul "Pendaftaran masih tertutup".
4. **Setelan Sentry untuk build ada di level repositori, bukan environment `production`.** Secret `SENTRY_AUTH_TOKEN` serta variable `SENTRY_ORG` dan `SENTRY_PROJECT` dipakai job `image`, yang berjalan sebelum *Approve*. Source map hanya diunggah dari push ke `main`.
5. **`concurrency: supabase-dev` dipindah ke job `test`.** Kalau tetap di level workflow, deploy yang menunggu *Approve* akan menahan semua run CI lain (termasuk PR). Deploy punya grup sendiri, `production`.
6. **Job deploy hanya berjalan jika variable repositori `DEPLOY_ENABLED` bernilai `true`.** Selama VPS dan secret belum siap, push ke `main` tidak menghasilkan deploy gagal.
7. **Image juga dibangun dan diuji pada PR**, tetapi hanya di-push dari `main`. Docker ikut terverifikasi sebelum merge, walau mesin pengembang tidak punya Docker.
8. **Deploy dipisah ke `.github/workflows/deploy.yml`:**
   - `workflow_call` dari CI dengan migrasi;
   - `workflow_dispatch` dengan input `tag` untuk rollback, tanpa migrasi (spec §5).

   Rollback memakai `compose.yml` dan `glosa.caddy` dari `main`.
9. **Blok situs ditaruh dulu di `/opt/glosa/glosa.caddy`.** `deploy/release.sh` menyalinnya ke `/opt/proxy/sites/` dengan cadangan:
   - kalau `caddy validate` gagal, berkas lama dikembalikan, supaya restart Caddy berikutnya tidak rusak;
   - kalau lolos, baru `caddy reload`.
10. **Caddyfile tanpa email ACME.** Let's Encrypt tidak mewajibkannya, jadi stack proxy tidak butuh env sama sekali.
11. **Sapuan:**
    - Loop berjalan di shell (`while true; do node dist/sweep.mjs; sleep 3600; done`), jadi satu putaran yang gagal tidak menghentikan loop.
    - `dist/sweep.mjs` dibangun oleh `vite.sweep.config.ts` (SSR build, paket eksternal).
    - `SWEEP_MAX_DELETIONS` menaikkan kedua batas (objek dan akun) ke angka yang sama.
    - `runSweep` menerima `onlyUserIds` untuk test.
12. **`_shell.html` (shell offline) tidak memuat DSN**, karena dibuat saat build tanpa env. Sentry browser tidak aktif selama aplikasi dibuka dari shell offline; laporannya memang tidak bisa terkirim saat offline.
13. **Sentry browser mengabaikan `Failed to fetch`, `NetworkError`, dan `Load failed`.** Putus jaringan wajar di aplikasi offline-first (spec §7: galat offline tidak dilaporkan).
14. **Laporan server:**
    - semua `console.error` di `src/server/` diganti `logServerError`, yang tetap menulis ke log dan melapor ke Sentry;
    - error yang dilempar keluar dari server function dilaporkan middleware di `src/start.ts`, kecuali `redirect` dan `notFound`.
15. **`shellcheck` ikut CI** untuk `scripts/vps-setup.sh` dan `deploy/release.sh`, bersama `caddy validate` dan `docker compose config`.
16. **`vps-setup.sh` hanya mematikan login sandi dan login root kalau dijalankan lewat `sudo` dari user pribadi yang sudah punya kunci SSH.** Kalau dijalankan langsung sebagai root, langkah itu dilewati dengan peringatan, supaya pemilik tidak terkunci di luar VPS.
17. **`SWEEP_DRY_RUN=1` di `deploy/.env.example`.** Hari pertama sapuan hanya mencatat rencana. Pemilik mengubahnya ke `0` setelah memeriksa log (langkah belajar di panduan).

## Global Constraints

- Node.js **≥ 24**, npm. Supabase Cloud saja; semua test memakai **proyek dev**.
- Teks UI dalam bahasa Indonesia. Komentar kode dalam bahasa Inggris, seperti kode yang sudah ada. `docs/ops/produksi.md` dalam bahasa Indonesia.
- Alamat (persis): aplikasi `glosa.nuvrastudio.space`, Uptime Kuma `status.nuvrastudio.space`, pengirim email `Glosa <no-reply@glosa.nuvrastudio.space>`.
- Image (persis): `ghcr.io/muhammadyudhistira/glosa:<sha commit 40 karakter>`.
- Nama di VPS (persis):
  - jaringan Docker `web`, alias `glosa-app`, port aplikasi `3000`;
  - folder `/opt/proxy`, `/opt/proxy/sites`, `/opt/glosa`; berkas `/opt/glosa/.env` dan `/opt/glosa/release.env`;
  - blok situs `/opt/proxy/sites/glosa.caddy`; user `deploy`.
- Env (persis): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SITE_URL`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `KUMA_PUSH_URL`, `SWEEP_DRY_RUN`, `SWEEP_MAX_DELETIONS`, `GLOSA_TAG`, `APP_VERSION` (dibakar ke image).
- `/api/health` menjawab persis `{ "status": "ok", "version": "<APP_VERSION atau dev>" }` dengan `Cache-Control: no-store`, tanpa menyentuh database.
- Pesan hook (persis): `Glosa sedang dalam uji coba tertutup. Pendaftaran baru dibuka untuk umum segera.`
- Sapuan:
  - batas usia **1 jam** (`PENDING_TTL_MS`);
  - batas aman **50 objek** dan **5 akun** per putaran;
  - heartbeat hanya setelah putaran sukses;
  - daftar yang gagal diambil menghentikan putaran tanpa menghapus apa pun.
- Header cache (persis): `/sw.js` dan `/_shell.html` → `no-cache`; `/assets/*` → `public, max-age=31536000, immutable`.
- Log container: `json-file`, `max-size: 10m`, `max-file: 5`.
- Sentry: `sendDefaultPii: false`, `tracesSampleRate: 0`, tanpa session replay, `user` hanya `{ id }`. `window.__GLOSA_SENTRY__` hanya ada jika `SENTRY_DSN` terisi.
- Berkas shell dan YAML memakai akhir baris LF (sudah dijamin `.gitattributes`: `* text=auto eol=lf`).
- Setiap task diakhiri `npx prettier --write` pada file TS/JS yang diubah, lalu `npm run lint`, `npm run typecheck`, dan `npm test` hijau sebelum commit.

## Peta file

| File | Tugas |
|---|---|
| `supabase/migrations/20261020000100_signup_invites.sql` | Tabel `signup_invites`, `app_settings`, dan fungsi hook (Task 1) |
| `tests/db/signup-invites.test.ts` | Test hook di proyek dev (Task 1) |
| `src/server/database.types.ts` | Digenerate ulang (Task 1) |
| `src/lib/auth-messages.ts` | `signups_closed`, `authErrorCode`, `oauthCallbackError` (Task 2) |
| `src/server/auth.ts`, `src/routes/auth/callback.tsx`, `src/components/auth/LinkFailed.tsx` | Memakai pemetaan di atas (Task 2) |
| `src/server/health.ts`, `src/routes/api/health.ts` | `/api/health` (Task 3) |
| `package.json` | `srvx`, skrip `start` (Task 3); paket Sentry (Task 4–5); build sapuan (Task 7) |
| `src/lib/sentry-env.ts` | `readSentryEnv`, `sentryHeadScripts` (Task 4) |
| `src/lib/sentry-config.ts` | `sentryConfig()` isomorfik (Task 4) |
| `src/lib/sentry-client.ts` | `startBrowserSentry`, `reportError`, `setReportedUser` (Task 4) |
| `src/routes/__root.tsx`, `src/components/RouteError.tsx`, `src/routes/_member/read.$bookId.tsx` | Menyalakan dan memakai Sentry browser (Task 4) |
| `vite.config.ts` | `build.sourcemap: "hidden"` (Task 4) |
| `src/server/monitoring.ts` | `logServerError`, `flushServerErrors`, `isServerFailure` (Task 5) |
| `src/start.ts` | Middleware server function pelapor error (Task 5) |
| `src/server/{books,reading,profile,auth}.ts` | `console.error` → `logServerError` (Task 5) |
| `src/server/sweep/plan-sweep.ts` | Perencana sapuan murni (Task 6) |
| `src/server/book-storage.ts` | `listFolders`, `listFiles` (Task 7) |
| `src/server/sweep/run-sweep.ts`, `src/server/sweep/main.ts` | Menjalankan sapuan (Task 7) |
| `vite.sweep.config.ts` | Build `dist/sweep.mjs` (Task 7) |
| `tests/db/sweep.test.ts`, `tests/db/helpers.ts` | Test sapuan di proyek dev (Task 7) |
| `Dockerfile`, `.dockerignore` | Image (Task 8) |
| `deploy/compose.yml`, `deploy/glosa.caddy`, `deploy/.env.example`, `deploy/release.sh` | Stack Glosa (Task 8) |
| `deploy/proxy/compose.yml`, `deploy/proxy/Caddyfile` | Stack bersama (Task 8) |
| `scripts/check-client-secrets.mjs` | Cek kebocoran kunci (Task 8) |
| `scripts/vps-setup.sh` | Persiapan VPS (Task 9) |
| `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` | CI/CD (Task 10) |
| `src/routes/privacy.tsx` | Sentry, Resend, lokasi data (Task 11) |
| `docs/ops/produksi.md` | Panduan belajar dan langkah pemilik (Task 12) |

## Langkah pemilik selama implementasi

Tidak ada. Semua task bisa dikerjakan dan diuji ke proyek dev. Migrasi Task 1 di-push agent ke proyek dev dengan `npm run db:push` (CLI sudah ter-link sejak 1A). Hook **belum** diaktifkan di dashboard selama implementasi, jadi E2E tidak terpengaruh. Semua langkah akun dan VPS ada di `docs/ops/produksi.md` (Task 12) dan dikerjakan pemilik setelah merge.

---

### Task 1: Undangan — tabel, fungsi hook, dan test DB

**Files:**
- Create: `supabase/migrations/20261020000100_signup_invites.sql`
- Create: `tests/db/signup-invites.test.ts`
- Modify: `src/server/database.types.ts` (digenerate)

**Interfaces:**
- Produces:
  - tabel `public.signup_invites (email text pk, note text, created_at timestamptz)`;
  - tabel `public.app_settings (id boolean pk = true, signups_open boolean)`;
  - RPC `before_user_created({ event: Json }): Json`, yang menjawab `{}` atau `{ error: { http_code: 403, message } }`.

- [ ] **Step 1: Tulis test DB yang gagal**

`tests/db/signup-invites.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { adminClient, anonClient } from "./helpers"

const run = Date.now().toString(36)
const invited = `db-invite-${run}@glosa.test`
const stranger = `db-stranger-${run}@glosa.test`
const CLOSED =
  "Glosa sedang dalam uji coba tertutup. Pendaftaran baru dibuka untuk umum segera."

async function setSignupsOpen(open: boolean) {
  const { error } = await adminClient()
    .from("app_settings")
    .update({ signups_open: open })
    .eq("id", true)
  if (error) throw error
}

async function hook(email: string) {
  const { data, error } = await adminClient().rpc("before_user_created", {
    event: { user: { email } },
  })
  if (error) throw error
  return data
}

describe("before_user_created", () => {
  let wasOpen = false

  beforeAll(async () => {
    const { data, error } = await adminClient()
      .from("app_settings")
      .select("signups_open")
      .eq("id", true)
      .single()
    if (error) throw error
    wasOpen = data.signups_open
    const insert = await adminClient()
      .from("signup_invites")
      .insert({ email: invited, note: "test:db" })
    if (insert.error) throw insert.error
  })

  afterAll(async () => {
    await adminClient().from("signup_invites").delete().eq("email", invited)
    await setSignupsOpen(wasOpen)
  })

  it("rejects an email without an invite while signups are closed", async () => {
    await setSignupsOpen(false)
    expect(await hook(stranger)).toEqual({
      error: { http_code: 403, message: CLOSED },
    })
  })

  it("allows an invited email, whatever its letter case", async () => {
    await setSignupsOpen(false)
    expect(await hook(invited.toUpperCase())).toEqual({})
  })

  it("allows anyone once signups are open", async () => {
    await setSignupsOpen(true)
    expect(await hook(stranger)).toEqual({})
  })

  it("keeps invites and settings away from visitors", async () => {
    const invites = await anonClient().from("signup_invites").select("email")
    const settings = await anonClient().from("app_settings").select("id")
    expect(invites.error).not.toBeNull()
    expect(settings.error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan dan pastikan gagal**

Run: `npx vitest run --config vitest.db.config.ts tests/db/signup-invites.test.ts`
Expected: FAIL. Typecheck Vitest tidak memblokir; galatnya dari Supabase, misalnya `relation "public.app_settings" does not exist` atau `Could not find the table`.

- [ ] **Step 3: Tulis migrasi**

`supabase/migrations/20261020000100_signup_invites.sql`:

```sql
-- Closed trial (spec 1E §4): only invited emails may create an account, by
-- email or Google alike, until app_settings.signups_open is true. Supabase
-- Auth calls before_user_created as its "Before User Created" hook.

-- Emails are stored lowercase and trimmed (plan 1E, decision 1).
create table public.signup_invites (
  email text primary key check (email <> '' and email = lower(btrim(email))),
  note text,
  created_at timestamptz not null default now()
);

-- A single row: its id can only be true.
create table public.app_settings (
  id boolean primary key default true check (id),
  signups_open boolean not null default false
);
insert into public.app_settings (id) values (true);

-- RLS on and no policies: the owner manages both from the SQL editor.
alter table public.signup_invites enable row level security;
alter table public.app_settings enable row level security;
revoke all on table public.signup_invites from anon, authenticated;
revoke all on table public.app_settings from anon, authenticated;

create function public.before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if coalesce((select s.signups_open from public.app_settings s where s.id), false)
    or exists (select 1 from public.signup_invites i where i.email = v_email)
  then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Glosa sedang dalam uji coba tertutup. Pendaftaran baru dibuka untuk umum segera.'
  ));
end;
$$;

-- Supabase Auth runs the hook as supabase_auth_admin; service_role may call it
-- so integration tests can check it directly (plan 1E, decision 2).
revoke execute on function public.before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin, service_role;
grant usage on schema public to supabase_auth_admin;
```

- [ ] **Step 4: Push ke proyek dev dan generate ulang tipe**

Run: `npm run db:push`
Expected: `Applying migration 20261020000100_signup_invites.sql...`, lalu `Finished supabase db push.`

Run: `npm run db:types`
Expected: `src/server/database.types.ts` kini memuat `signup_invites`, `app_settings`, dan `before_user_created: { Args: { event: Json }; Returns: Json }`.

Catatan: proyek dev kini punya `signups_open = false`. Selama hook belum diaktifkan di dashboard, nilai ini tidak berpengaruh. Panduan Task 12 meminta pemilik mengubahnya ke `true` di dev **sebelum** mengaktifkan hook.

- [ ] **Step 5: Jalankan test dan pastikan lolos**

Run: `npx vitest run --config vitest.db.config.ts tests/db/signup-invites.test.ts`
Expected: PASS (4 test).

- [ ] **Step 6: Lint, typecheck, unit test, commit**

```bash
npx prettier --write tests/db/signup-invites.test.ts
npm run lint && npm run typecheck && npm test
git add supabase/migrations/20261020000100_signup_invites.sql tests/db/signup-invites.test.ts src/server/database.types.ts
git commit -m "feat(auth): invite-only signups through the Before User Created hook"
```

---

### Task 2: Pesan uji coba tertutup di form daftar dan alur Google

**Files:**
- Modify: `src/lib/auth-messages.ts`
- Modify: `src/lib/auth-messages.test.ts`
- Modify: `src/server/auth.ts:60-65`
- Modify: `src/routes/auth/callback.tsx:7-20`
- Modify: `src/components/auth/LinkFailed.tsx`
- Modify: `src/components/auth/LinkFailed.test.tsx`

**Interfaces:**
- Produces:
  - `authErrorCode(error: { code?: string; message?: string } | null | undefined): string`;
  - `oauthCallbackError(search: Record<string, unknown>): string` (`""` jika tidak ada galat);
  - kode pesan `signups_closed`.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `src/lib/auth-messages.test.ts`. Ganti baris import, lalu tambahkan blok-blok ini di akhir file:

```ts
import { describe, expect, it } from "vitest"
import { authErrorCode, authMessage, oauthCallbackError } from "./auth-messages"

const CLOSED =
  "Glosa sedang dalam uji coba tertutup. Pendaftaran baru dibuka untuk umum segera."
```

```ts
describe("signups_closed", () => {
  it("tells the visitor the trial is closed", () => {
    expect(authMessage("signups_closed").bubble).toBe(CLOSED)
    expect(authMessage("signups_closed").field).toBe(
      "Pendaftaran masih tertutup."
    )
  })
})

describe("authErrorCode", () => {
  it("recognises the closed-trial hook by its message", () => {
    expect(
      authErrorCode({ code: "unexpected_failure", message: CLOSED })
    ).toBe("signups_closed")
  })

  it("keeps other Supabase codes", () => {
    expect(
      authErrorCode({ code: "user_already_exists", message: "User exists" })
    ).toBe("user_already_exists")
  })

  it("falls back to unknown", () => {
    expect(authErrorCode({ message: "boom" })).toBe("unknown")
    expect(authErrorCode(null)).toBe("unknown")
  })
})

describe("oauthCallbackError", () => {
  it("is empty when the provider sent no error", () => {
    expect(oauthCallbackError({ code: "abc" })).toBe("")
  })

  it("prefers error_code over error", () => {
    expect(
      oauthCallbackError({ error: "access_denied", error_code: "otp_expired" })
    ).toBe("otp_expired")
    expect(oauthCallbackError({ error: "access_denied" })).toBe(
      "access_denied"
    )
  })

  it("maps a Google sign-up refused by the hook", () => {
    expect(
      oauthCallbackError({
        error: "server_error",
        error_description: CLOSED,
      })
    ).toBe("signups_closed")
  })
})
```

Tambahkan ke `src/components/auth/LinkFailed.test.tsx` di dalam `describe("LinkFailed")`:

```tsx
  it("says signups are closed, without a new-letter link", () => {
    render(<LinkFailed code="signups_closed" />)
    expect(
      screen.getByRole("heading", { name: "Pendaftaran masih tertutup" })
    ).toBeInTheDocument()
    expect(screen.getByText(/uji coba tertutup/)).toBeInTheDocument()
    expect(screen.queryByText("Minta surat baru")).toBeNull()
  })
```

- [ ] **Step 2: Jalankan dan pastikan gagal**

Run: `npx vitest run src/lib/auth-messages.test.ts src/components/auth/LinkFailed.test.tsx`
Expected: FAIL. `authErrorCode`/`oauthCallbackError` bukan fungsi, dan heading "Pendaftaran masih tertutup" tidak ditemukan.

- [ ] **Step 3: Implementasi di `auth-messages.ts`**

Tambahkan entri ini ke `MESSAGES`, setelah `not_authenticated`:

```ts
  signups_closed: {
    bubble:
      "Glosa sedang dalam uji coba tertutup. Pendaftaran baru dibuka untuk umum segera.",
    field: "Pendaftaran masih tertutup.",
  },
```

Tambahkan di akhir file:

```ts
// The "Before User Created" hook (spec 1E §4) refuses with its own message and
// no dedicated error code, so it is recognised by that message.
const SIGNUPS_CLOSED_MARK = "uji coba tertutup"

/** The message code for a Supabase Auth error, recognising the closed trial. */
export function authErrorCode(
  error: { code?: string; message?: string } | null | undefined
): string {
  if (error?.message?.includes(SIGNUPS_CLOSED_MARK)) return "signups_closed"
  return error?.code || "unknown"
}

/**
 * The error code in an OAuth callback's query (?error=…&error_code=…&
 * error_description=…), or "" when the provider sent none.
 */
export function oauthCallbackError(search: Record<string, unknown>): string {
  const text = (value: unknown) => (typeof value === "string" ? value : "")
  const code = text(search.error_code) || text(search.error)
  if (!code) return ""
  return authErrorCode({ code, message: text(search.error_description) })
}
```

- [ ] **Step 4: Pakai di server, callback, dan `LinkFailed`**

`src/server/auth.ts`: tambahkan import `import { authErrorCode } from "@/lib/auth-messages"`. Ganti baris terakhir handler `signUpFn`:

```ts
    return error ? fail(authErrorCode(error)) : { ok: true }
```

`src/routes/auth/callback.tsx`: tambahkan import `import { oauthCallbackError } from "@/lib/auth-messages"`, lalu ganti `validateSearch`:

```ts
  // A cancelled consent or a sign-up refused by the closed-trial hook comes
  // back as ?error=…&error_code=…&error_description=…
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    code: typeof search.code === "string" ? search.code : "",
    error: oauthCallbackError(search),
  }),
```

`src/components/auth/LinkFailed.tsx`: ganti konstanta dan judul.

```tsx
// Codes from the OAuth flow rather than an e-mailed link: a new letter would
// not help, so "Minta surat baru" is not offered for them.
const OAUTH_CODES = new Set(["access_denied", "signups_closed"])

function heading(code: string, fromEmailLink: boolean): string {
  if (code === "signups_closed") return "Pendaftaran masih tertutup"
  return fromEmailLink ? "Tautan tidak berlaku" : "Masuk dibatalkan"
}
```

Lalu di dalam komponen, ganti isi `<h1>`:

```tsx
        <h1 className="font-heading text-2xl font-bold">
          {heading(code, fromEmailLink)}
        </h1>
```

- [ ] **Step 5: Jalankan test dan pastikan lolos**

Run: `npx vitest run src/lib/auth-messages.test.ts src/components/auth/LinkFailed.test.tsx`
Expected: PASS.

- [ ] **Step 6: Lint, typecheck, unit test, commit**

```bash
npx prettier --write src/lib/auth-messages.ts src/lib/auth-messages.test.ts src/server/auth.ts src/routes/auth/callback.tsx src/components/auth/LinkFailed.tsx src/components/auth/LinkFailed.test.tsx
npm run lint && npm run typecheck && npm test
git add src/lib/auth-messages.ts src/lib/auth-messages.test.ts src/server/auth.ts src/routes/auth/callback.tsx src/components/auth/LinkFailed.tsx src/components/auth/LinkFailed.test.tsx
git commit -m "feat(auth): explain the closed trial on sign-up and Google sign-in"
```

---

### Task 3: `/api/health` dan menjalankan build dengan srvx

**Files:**
- Create: `src/server/health.ts`
- Create: `src/server/health.test.ts`
- Create: `src/routes/api/health.ts`
- Modify: `src/routeTree.gen.ts` (digenerate)
- Modify: `package.json` (dependensi `srvx`, skrip `start`)

**Interfaces:**
- Produces:
  - `healthResponse(version: string | undefined): Response`;
  - route `GET /api/health`;
  - skrip `npm start` = `srvx serve --prod --entry dist/server/server.js --static dist/client --port 3000` (dipakai Dockerfile Task 8 dalam bentuk yang sama).

- [ ] **Step 1: Tulis test yang gagal**

`src/server/health.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest"
import { healthResponse } from "./health"

describe("healthResponse", () => {
  it("reports ok with the running version and is never cached", async () => {
    const response = healthResponse("abc123")
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({ status: "ok", version: "abc123" })
  })

  it("says dev when no version was baked in", async () => {
    expect(await healthResponse(undefined).json()).toEqual({
      status: "ok",
      version: "dev",
    })
    expect(await healthResponse("").json()).toEqual({
      status: "ok",
      version: "dev",
    })
  })
})
```

- [ ] **Step 2: Jalankan dan pastikan gagal**

Run: `npx vitest run src/server/health.test.ts`
Expected: FAIL, `Failed to resolve import "./health"`.

- [ ] **Step 3: Implementasi**

`src/server/health.ts`:

```ts
/**
 * Body of GET /api/health (spec 1E §5): the app is up and runs this image.
 * It never touches the database, so the app and Supabase are watched apart.
 */
export function healthResponse(version: string | undefined): Response {
  return Response.json(
    { status: "ok", version: version || "dev" },
    { headers: { "Cache-Control": "no-store" } }
  )
}
```

`src/routes/api/health.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router"
import { healthResponse } from "@/server/health"

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => healthResponse(process.env.APP_VERSION),
    },
  },
})
```

Run: `npm run generate-routes`
Expected: `src/routeTree.gen.ts` memuat `/api/health`.

- [ ] **Step 4: Jadikan `srvx` dependensi eksplisit dan tambah skrip `start`**

Run: `npm install srvx@^1.0.5`

Di `package.json`, tambahkan skrip `start` setelah `preview`:

```json
    "start": "srvx serve --prod --entry dist/server/server.js --static dist/client --port 3000",
```

- [ ] **Step 5: Jalankan test, lalu build sungguhan**

Run: `npx vitest run src/server/health.test.ts`
Expected: PASS.

Run: `npm run build`, lalu `npm start` di latar belakang. Setelah itu (di PowerShell, pakai `curl.exe`):

```bash
curl.exe -s -i http://localhost:3000/api/health
curl.exe -s -o NUL -w "%{http_code}\n" http://localhost:3000/sw.js
```

Expected:
- baris pertama `HTTP/1.1 200 OK` dengan header `cache-control: no-store` dan body `{"status":"ok","version":"dev"}`;
- `sw.js` menjawab `200`.

Hentikan server setelahnya.

- [ ] **Step 6: Lint, typecheck, unit test, commit**

```bash
npx prettier --write src/server/health.ts src/server/health.test.ts src/routes/api/health.ts
npm run lint && npm run typecheck && npm test
git add src/server/health.ts src/server/health.test.ts src/routes/api/health.ts src/routeTree.gen.ts package.json package-lock.json
git commit -m "feat(ops): /api/health and npm start with srvx"
```

---

### Task 4: Sentry di browser

**Files:**
- Create: `src/lib/sentry-env.ts`, `src/lib/sentry-env.test.ts`
- Create: `src/lib/sentry-config.ts`
- Create: `src/lib/sentry-client.ts`, `src/lib/sentry-client.test.ts`
- Create: `src/components/RouteError.test.tsx`
- Modify: `src/routes/__root.tsx`
- Modify: `src/components/RouteError.tsx`
- Modify: `src/routes/_member/read.$bookId.tsx:53-61`
- Modify: `vite.config.ts`
- Modify: `.env.example`
- Modify: `package.json` (`@sentry/react`)

**Interfaces:**
- Produces:
  - `type SentryConfig = { dsn: string; environment: string; release: string }`;
  - `readSentryEnv(env: Record<string, string | undefined>): SentryConfig | null`, dipakai juga di server (Task 5);
  - `sentryHeadScripts(config: SentryConfig | null): Array<{ children: string }>`;
  - `sentryConfig(): SentryConfig | null`;
  - `startBrowserSentry(config)`, `reportError(error: unknown)`, `setReportedUser(id: string | null)`.

- [ ] **Step 1: Pasang paket**

Run: `npm install @sentry/react`

- [ ] **Step 2: Tulis test yang gagal**

`src/lib/sentry-env.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { readSentryEnv, sentryHeadScripts } from "./sentry-env"

const DSN = "https://key@o1.ingest.sentry.io/1"

describe("readSentryEnv", () => {
  it("is off without a DSN", () => {
    expect(readSentryEnv({})).toBeNull()
    expect(readSentryEnv({ SENTRY_DSN: "  " })).toBeNull()
  })

  it("takes the environment and the baked-in version", () => {
    expect(
      readSentryEnv({
        SENTRY_DSN: DSN,
        SENTRY_ENVIRONMENT: "staging",
        APP_VERSION: "abc123",
      })
    ).toEqual({ dsn: DSN, environment: "staging", release: "abc123" })
  })

  it("defaults to production and dev", () => {
    expect(readSentryEnv({ SENTRY_DSN: DSN })).toEqual({
      dsn: DSN,
      environment: "production",
      release: "dev",
    })
  })
})

describe("sentryHeadScripts", () => {
  it("adds no script without a DSN", () => {
    expect(sentryHeadScripts(null)).toEqual([])
  })

  it("hands the settings to the browser and cannot close the script tag", () => {
    const [script] = sentryHeadScripts({
      dsn: DSN,
      environment: "</script>",
      release: "abc123",
    })
    expect(script.children.startsWith("window.__GLOSA_SENTRY__=")).toBe(true)
    expect(script.children).not.toContain("</script>")
    const json = script.children.slice("window.__GLOSA_SENTRY__=".length)
    expect(JSON.parse(json)).toEqual({
      dsn: DSN,
      environment: "</script>",
      release: "abc123",
    })
  })
})
```

`src/lib/sentry-client.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  setUser: vi.fn(),
}))
vi.mock("@sentry/react", () => sentry)

import {
  reportError,
  resetBrowserSentryForTests,
  setReportedUser,
  startBrowserSentry,
} from "./sentry-client"

const config = {
  dsn: "https://key@o1.ingest.sentry.io/1",
  environment: "production",
  release: "abc123",
}

beforeEach(() => {
  resetBrowserSentryForTests()
  vi.clearAllMocks()
})

describe("browser Sentry", () => {
  it("stays off without a DSN", async () => {
    startBrowserSentry(null)
    reportError(new Error("boom"))
    await vi.dynamicImportSettled()
    expect(sentry.init).not.toHaveBeenCalled()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })

  it("starts once, without personal data or tracing", async () => {
    startBrowserSentry(config)
    startBrowserSentry(config)
    await vi.waitFor(() => expect(sentry.init).toHaveBeenCalledTimes(1))
    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: config.dsn,
        environment: "production",
        release: "abc123",
        sendDefaultPii: false,
        tracesSampleRate: 0,
      })
    )
  })

  it("reports errors and tags only the member id", async () => {
    startBrowserSentry(config)
    const error = new Error("boom")
    reportError(error)
    setReportedUser("user-1")
    setReportedUser(null)
    await vi.waitFor(() => expect(sentry.setUser).toHaveBeenCalledTimes(2))
    expect(sentry.captureException).toHaveBeenCalledWith(error)
    expect(sentry.setUser).toHaveBeenNthCalledWith(1, { id: "user-1" })
    expect(sentry.setUser).toHaveBeenNthCalledWith(2, null)
  })
})
```

`src/components/RouteError.test.tsx`:

```tsx
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RouteError } from "./RouteError"

const report = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sentry-client", () => ({ reportError: report }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

describe("RouteError", () => {
  it("reports the error it shows", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const error = new Error("boom")
    render(<RouteError error={error} />)
    expect(report).toHaveBeenCalledWith(error)
  })
})
```

- [ ] **Step 3: Jalankan dan pastikan gagal**

Run: `npx vitest run src/lib/sentry-env.test.ts src/lib/sentry-client.test.ts src/components/RouteError.test.tsx`
Expected: FAIL, karena `./sentry-env` dan `./sentry-client` tidak ada dan `report` tidak dipanggil.

- [ ] **Step 4: Implementasi modul Sentry**

`src/lib/sentry-env.ts`:

```ts
export type SentryConfig = { dsn: string; environment: string; release: string }

/** Sentry settings from the server's environment; null keeps Sentry off (spec 1E §7). */
export function readSentryEnv(
  env: Record<string, string | undefined>
): SentryConfig | null {
  const dsn = env.SENTRY_DSN?.trim()
  if (!dsn) return null
  return {
    dsn,
    environment: env.SENTRY_ENVIRONMENT?.trim() || "production",
    release: env.APP_VERSION?.trim() || "dev",
  }
}

/** Inline script handing the browser its Sentry settings; none without a DSN. */
export function sentryHeadScripts(
  config: SentryConfig | null
): Array<{ children: string }> {
  if (!config) return []
  // "<" is escaped so no value can ever close the script element.
  const json = JSON.stringify(config).replace(/</g, "\\u003c")
  return [{ children: `window.__GLOSA_SENTRY__=${json}` }]
}
```

`src/lib/sentry-config.ts`:

```ts
import { createIsomorphicFn } from "@tanstack/react-start"
import { type SentryConfig, readSentryEnv } from "./sentry-env"

declare global {
  interface Window {
    __GLOSA_SENTRY__?: SentryConfig
  }
}

/**
 * The server reads its environment; the browser reads what the server injected
 * into the page head, so one image serves every environment (spec 1E §7).
 */
export const sentryConfig = createIsomorphicFn()
  .server((): SentryConfig | null => readSentryEnv(process.env))
  .client((): SentryConfig | null => window.__GLOSA_SENTRY__ ?? null)
```

`src/lib/sentry-client.ts`:

```ts
import type { SentryConfig } from "./sentry-env"

type BrowserSentry = typeof import("@sentry/react")

let sentry: Promise<BrowserSentry | null> | null = null

/** Loads and starts browser error reporting, only when the server sent a DSN. */
export function startBrowserSentry(config: SentryConfig | null): void {
  if (!config || sentry) return
  sentry = import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn: config.dsn,
        environment: config.environment,
        release: config.release,
        sendDefaultPii: false,
        tracesSampleRate: 0,
        // Losing the connection is expected in an offline-first app.
        ignoreErrors: ["Failed to fetch", "NetworkError", "Load failed"],
      })
      return Sentry
    })
    .catch(() => null)
}

/** Reports an unexpected error; does nothing while Sentry is off. */
export function reportError(error: unknown): void {
  void sentry?.then((Sentry) => Sentry?.captureException(error))
}

/** Tags later reports with the member's id only, never their email. */
export function setReportedUser(id: string | null): void {
  void sentry?.then((Sentry) => Sentry?.setUser(id ? { id } : null))
}

export function resetBrowserSentryForTests(): void {
  sentry = null
}
```

- [ ] **Step 5: Sambungkan ke aplikasi**

`src/components/RouteError.tsx`: tambahkan import `import { reportError } from "@/lib/sentry-client"`, lalu ganti efeknya:

```tsx
  useEffect(() => {
    console.error(error)
    reportError(error)
  }, [error])
```

`src/routes/_member/read.$bookId.tsx`: tambahkan import `import { reportError } from "@/lib/sentry-client"`, lalu ganti `ReaderError`:

```tsx
function ReaderError({ error }: { error: unknown }) {
  const router = useRouter()
  // A missing or broken book already has its own message (spec 1E §7).
  useEffect(() => {
    if (!(error instanceof BookLoadError) && !(error instanceof EpubError))
      reportError(error)
  }, [error])
  return (
    <ReaderProblem
      message={bookMessage(error instanceof BookLoadError ? error.code : null)}
      onRetry={() => void router.invalidate()}
    />
  )
}
```

`src/routes/__root.tsx`:
- tambahkan import:

```tsx
import { sentryConfig } from "@/lib/sentry-config"
import { setReportedUser, startBrowserSentry } from "@/lib/sentry-client"
import { sentryHeadScripts } from "@/lib/sentry-env"
```

- di `head`, tambahkan `scripts` setelah `links`:

```tsx
    scripts: sentryHeadScripts(sentryConfig()),
```

- ganti dua efek di `RootComponent`:

```tsx
  // First, so Sentry exists by the time the member effect below tags it.
  useEffect(() => {
    registerServiceWorker()
    startBrowserSentry(sentryConfig())
  }, [])

  // Keep the last member seen online, so the app can still open offline.
  useEffect(() => {
    if (user) rememberUser(user)
    else if (user === null) forgetUser()
    if (user !== undefined) setReportedUser(user?.id ?? null)
  }, [user])
```

`vite.config.ts`: di objek yang dikembalikan, tambahkan sebelum `plugins`:

```ts
    // Maps for Sentry only: no sourceMappingURL in the files; the image build
    // uploads them, then deletes them (spec 1E §5).
    build: { sourcemap: "hidden" },
```

`.env.example`: tambahkan di akhir:

```
# Optional: error reporting (spec 1E §7). Empty keeps Sentry off.
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
```

- [ ] **Step 6: Jalankan test dan pastikan lolos**

Run: `npx vitest run src/lib/sentry-env.test.ts src/lib/sentry-client.test.ts src/components/RouteError.test.tsx`
Expected: PASS.

- [ ] **Step 7: Periksa build**

Run: `npm run build`

Lalu (PowerShell):

```powershell
Select-String -Path dist/client/_shell.html -Pattern "__GLOSA_SENTRY__"
(Get-ChildItem dist/client/assets -Filter *.map).Count
```

Expected:
- tidak ada baris yang cocok, karena shell dibuat tanpa DSN (keputusan 12);
- jumlah `.map` lebih dari 0. Peta dibuat; Task 8 menghapusnya di image.

- [ ] **Step 8: Lint, typecheck, unit test, commit**

```bash
npx prettier --write src/lib/sentry-env.ts src/lib/sentry-env.test.ts src/lib/sentry-config.ts src/lib/sentry-client.ts src/lib/sentry-client.test.ts src/components/RouteError.tsx src/components/RouteError.test.tsx 'src/routes/_member/read.$bookId.tsx' src/routes/__root.tsx vite.config.ts
npm run lint && npm run typecheck && npm test
git add src/lib/sentry-env.ts src/lib/sentry-env.test.ts src/lib/sentry-config.ts src/lib/sentry-client.ts src/lib/sentry-client.test.ts src/components/RouteError.tsx src/components/RouteError.test.tsx 'src/routes/_member/read.$bookId.tsx' src/routes/__root.tsx vite.config.ts .env.example package.json package-lock.json
git commit -m "feat(ops): report browser errors to Sentry when a DSN is set"
```

---

### Task 5: Sentry di server

**Files:**
- Create: `src/server/monitoring.ts`, `src/server/monitoring.test.ts`
- Create: `src/start.ts`
- Modify: `src/server/books.ts`, `src/server/reading.ts`, `src/server/profile.ts`, `src/server/auth.ts`
- Modify: `package.json` (`@sentry/node`)

**Interfaces:**
- Consumes: `readSentryEnv` (Task 4).
- Produces:
  - `logServerError(message: string, error: unknown): void`;
  - `flushServerErrors(timeoutMs?: number): Promise<void>`;
  - `isServerFailure(error: unknown): boolean`.

  Ketiganya dipakai sapuan (Task 7).

- [ ] **Step 1: Pasang paket**

Run: `npm install @sentry/node`

- [ ] **Step 2: Tulis test yang gagal**

`src/server/monitoring.test.ts`:

```ts
// @vitest-environment node
import { notFound, redirect } from "@tanstack/react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  flush: vi.fn(() => Promise.resolve(true)),
}))
vi.mock("@sentry/node", () => sentry)

import {
  flushServerErrors,
  isServerFailure,
  logServerError,
  resetServerSentryForTests,
} from "./monitoring"

beforeEach(() => {
  resetServerSentryForTests()
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("logServerError", () => {
  it("only logs while Sentry is off", async () => {
    vi.stubEnv("SENTRY_DSN", "")
    const error = new Error("boom")
    logServerError("lookup failed", error)
    await flushServerErrors()
    expect(console.error).toHaveBeenCalledWith("lookup failed", error)
    expect(sentry.init).not.toHaveBeenCalled()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })

  it("logs and reports with the message, without personal data", async () => {
    vi.stubEnv("SENTRY_DSN", "https://key@o1.ingest.sentry.io/1")
    vi.stubEnv("APP_VERSION", "abc123")
    const error = new Error("boom")
    logServerError("lookup failed", error)
    await flushServerErrors()
    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        release: "abc123",
        sendDefaultPii: false,
        tracesSampleRate: 0,
      })
    )
    expect(sentry.captureException).toHaveBeenCalledWith(error, {
      extra: { message: "lookup failed" },
    })
    expect(sentry.flush).toHaveBeenCalled()
  })
})

describe("isServerFailure", () => {
  it("ignores redirects and not-found, which are control flow", () => {
    expect(isServerFailure(redirect({ href: "/" }))).toBe(false)
    expect(isServerFailure(notFound())).toBe(false)
    expect(isServerFailure(new Error("boom"))).toBe(true)
  })
})
```

- [ ] **Step 3: Jalankan dan pastikan gagal**

Run: `npx vitest run src/server/monitoring.test.ts`
Expected: FAIL, `Failed to resolve import "./monitoring"`.

- [ ] **Step 4: Implementasi**

`src/server/monitoring.ts`:

```ts
import { isNotFound, isRedirect } from "@tanstack/react-router"
import { readSentryEnv } from "@/lib/sentry-env"

type NodeSentry = typeof import("@sentry/node")

let sentry: Promise<NodeSentry | null> | undefined

async function startServerSentry(): Promise<NodeSentry | null> {
  const config = readSentryEnv(process.env)
  if (!config) return null
  try {
    const Sentry = await import("@sentry/node")
    Sentry.init({ ...config, sendDefaultPii: false, tracesSampleRate: 0 })
    return Sentry
  } catch (error) {
    console.error("starting Sentry failed", error)
    return null
  }
}

function serverSentry(): Promise<NodeSentry | null> {
  sentry ??= startServerSentry()
  return sentry
}

/** Logs an unexpected server failure and reports it when Sentry is on (spec 1E §7). */
export function logServerError(message: string, error: unknown): void {
  console.error(message, error)
  void serverSentry().then((Sentry) =>
    Sentry?.captureException(error, { extra: { message } })
  )
}

/** Waits for queued reports; call before a short-lived process exits. */
export async function flushServerErrors(timeoutMs = 2000): Promise<void> {
  const Sentry = await serverSentry()
  await Sentry?.flush(timeoutMs)
}

/** Redirects and not-found are control flow, not failures. */
export function isServerFailure(error: unknown): boolean {
  return !isRedirect(error) && !isNotFound(error)
}

export function resetServerSentryForTests(): void {
  sentry = undefined
}
```

`src/start.ts`:

```ts
import { createMiddleware, createStart } from "@tanstack/react-start"
import { isServerFailure, logServerError } from "@/server/monitoring"

// Server functions that throw instead of returning a failure code are reported
// here; caught failures go through logServerError where they happen.
const reportServerFnErrors = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    try {
      return await next()
    } catch (error) {
      if (isServerFailure(error))
        logServerError("server function failed", error)
      throw error
    }
  }
)

export const startInstance = createStart(() => ({
  functionMiddleware: [reportServerFnErrors],
}))
```

- [ ] **Step 5: Ganti `console.error` di kode server**

Di keempat file berikut, tambahkan `import { logServerError } from "./monitoring"`, lalu ganti setiap `console.error(` dengan `logServerError(`:
- `src/server/books.ts`: 15 tempat;
- `src/server/reading.ts`: 6;
- `src/server/profile.ts`: 5;
- `src/server/auth.ts`: 2.

Semua pemanggilan sudah berbentuk `(pesan, error)`, jadi argumennya tidak berubah.

Run: `npx prettier --write src/server/books.ts src/server/reading.ts src/server/profile.ts src/server/auth.ts`, lalu Grep `console\.error` di `src/server`.
Expected: tidak ada lagi, kecuali dua di `src/server/monitoring.ts`.

- [ ] **Step 6: Jalankan test dan periksa build**

Run: `npx vitest run src/server/monitoring.test.ts`
Expected: PASS.

Run: `npm run build`, lalu (PowerShell) `Select-String -Path dist/client/assets/*.js -Pattern "@sentry/node" -List`.
Expected: build sukses dan tidak ada hasil. Kode server Sentry tidak masuk bundle browser.

- [ ] **Step 7: Lint, typecheck, unit test, commit**

```bash
npx prettier --write src/server/monitoring.ts src/server/monitoring.test.ts src/start.ts
npm run lint && npm run typecheck && npm test
git add src/server/monitoring.ts src/server/monitoring.test.ts src/start.ts src/server/books.ts src/server/reading.ts src/server/profile.ts src/server/auth.ts package.json package-lock.json
git commit -m "feat(ops): report server failures to Sentry"
```

---

### Task 6: Perencana sapuan (fungsi murni)

**Files:**
- Create: `src/server/sweep/plan-sweep.ts`
- Create: `src/server/sweep/plan-sweep.test.ts`

**Interfaces:**
- Consumes: `isAbandoned` (`@/lib/quota`), `PENDING_TTL_MS` (`@/lib/upload-rules`), `objectPaths` (`@/server/book-storage`).
- Produces:

```ts
type StoredObject = { path: string; createdAt: string | null }
type SweepBook = { id: string; userId: string; status: string; createdAt: string; filePath: string; coverPath: string | null }
type SweepUser = { id: string; createdAt: string }
type SweepInput = { now: number; objects: ReadonlyArray<StoredObject>; books: ReadonlyArray<SweepBook>; profileIds: ReadonlyArray<string>; users: ReadonlyArray<SweepUser> }
type ObjectReason = "folder_without_profile" | "unreferenced"
type SweepPlan = { pendingBooks: Array<{ id: string; paths: Array<string> }>; objects: Array<{ path: string; reason: ObjectReason }>; users: Array<string> }
planSweep(input: SweepInput): SweepPlan
deletionCounts(plan: SweepPlan): { objects: number; users: number }
```

`StoredObject` diekspor dari `plan-sweep.ts`. Di Task 7, `book-storage.ts` mengimpornya dari sini sebagai `import type`.

- [ ] **Step 1: Tulis test yang gagal**

`src/server/sweep/plan-sweep.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  type SweepBook,
  type SweepInput,
  deletionCounts,
  planSweep,
} from "./plan-sweep"

const NOW = Date.parse("2026-10-20T12:00:00Z")
const ago = (minutes: number) =>
  new Date(NOW - minutes * 60_000).toISOString()

const member = "11111111-1111-4111-8111-111111111111"
const gone = "22222222-2222-4222-8222-222222222222"

function book(overrides: Partial<SweepBook>): SweepBook {
  return {
    id: "b-ready",
    userId: member,
    status: "ready",
    createdAt: ago(600),
    filePath: `${member}/b-ready.epub`,
    coverPath: `${member}/b-ready-cover.webp`,
    ...overrides,
  }
}

function input(overrides: Partial<SweepInput>): SweepInput {
  return {
    now: NOW,
    objects: [],
    books: [],
    profileIds: [member],
    users: [{ id: member, createdAt: ago(10_000) }],
    ...overrides,
  }
}

describe("planSweep", () => {
  it("never touches a ready book or its objects", () => {
    const plan = planSweep(
      input({
        books: [book({})],
        objects: [
          { path: `${member}/b-ready.epub`, createdAt: ago(600) },
          { path: `${member}/b-ready-cover.webp`, createdAt: ago(600) },
        ],
      })
    )
    expect(plan).toEqual({ pendingBooks: [], objects: [], users: [] })
  })

  it("removes pending books older than an hour with their objects", () => {
    const old = book({
      id: "b-old",
      status: "pending",
      createdAt: ago(61),
      filePath: `${member}/b-old.epub`,
      coverPath: null,
    })
    const fresh = book({
      id: "b-fresh",
      status: "pending",
      createdAt: ago(59),
      filePath: `${member}/b-fresh.epub`,
      coverPath: null,
    })
    const plan = planSweep(
      input({
        books: [old, fresh],
        objects: [
          { path: `${member}/b-old.epub`, createdAt: ago(61) },
          { path: `${member}/b-fresh.epub`, createdAt: ago(59) },
        ],
      })
    )
    expect(plan.pendingBooks).toEqual([
      { id: "b-old", paths: [`${member}/b-old.epub`] },
    ])
    expect(plan.objects).toEqual([])
  })

  it("removes accounts without a profile once older than an hour", () => {
    const plan = planSweep(
      input({
        users: [
          { id: member, createdAt: ago(10_000) },
          { id: gone, createdAt: ago(61) },
          { id: "fresh-user", createdAt: ago(59) },
        ],
      })
    )
    expect(plan.users).toEqual([gone])
  })

  it("empties folders whose member has no profile, whatever their age", () => {
    const plan = planSweep(
      input({
        objects: [
          { path: `${gone}/x.epub`, createdAt: ago(1) },
          { path: `${gone}/x-cover.jpg`, createdAt: null },
        ],
      })
    )
    expect(plan.objects).toEqual([
      { path: `${gone}/x.epub`, reason: "folder_without_profile" },
      { path: `${gone}/x-cover.jpg`, reason: "folder_without_profile" },
    ])
  })

  it("removes unreferenced objects only once older than an hour", () => {
    const plan = planSweep(
      input({
        objects: [
          { path: `${member}/stray-old.epub`, createdAt: ago(61) },
          { path: `${member}/stray-new.epub`, createdAt: ago(59) },
          { path: `${member}/stray-unknown.epub`, createdAt: null },
        ],
      })
    )
    expect(plan.objects).toEqual([
      { path: `${member}/stray-old.epub`, reason: "unreferenced" },
    ])
  })
})

describe("deletionCounts", () => {
  it("counts every object, pending books' included, and accounts", () => {
    expect(
      deletionCounts({
        pendingBooks: [{ id: "b", paths: ["u/b.epub", "u/b-cover.webp"] }],
        objects: [{ path: "u/x.epub", reason: "unreferenced" }],
        users: ["gone"],
      })
    ).toEqual({ objects: 3, users: 1 })
  })
})
```

- [ ] **Step 2: Jalankan dan pastikan gagal**

Run: `npx vitest run src/server/sweep/plan-sweep.test.ts`
Expected: FAIL, `Failed to resolve import "./plan-sweep"`.

- [ ] **Step 3: Implementasi**

`src/server/sweep/plan-sweep.ts`:

```ts
import { isAbandoned } from "@/lib/quota"
import { PENDING_TTL_MS } from "@/lib/upload-rules"
import { objectPaths } from "@/server/book-storage"

export type StoredObject = { path: string; createdAt: string | null }

export type SweepBook = {
  id: string
  userId: string
  status: string
  createdAt: string
  filePath: string
  coverPath: string | null
}

export type SweepUser = { id: string; createdAt: string }

export type SweepInput = {
  now: number
  objects: ReadonlyArray<StoredObject>
  books: ReadonlyArray<SweepBook>
  profileIds: ReadonlyArray<string>
  users: ReadonlyArray<SweepUser>
}

export type ObjectReason = "folder_without_profile" | "unreferenced"

export type SweepPlan = {
  pendingBooks: Array<{ id: string; paths: Array<string> }>
  objects: Array<{ path: string; reason: ObjectReason }>
  users: Array<string>
}

const olderThanTtl = (createdAt: string, now: number) =>
  now - Date.parse(createdAt) >= PENDING_TTL_MS

/**
 * What one sweep round removes (spec 1E §6), decided from lists alone:
 * abandoned pending books with their objects, accounts left without a profile,
 * folders of members without a profile, and objects no book row refers to.
 */
export function planSweep(input: SweepInput): SweepPlan {
  const { now } = input
  const profiles = new Set(input.profileIds)
  const pathsOf = (book: SweepBook) =>
    objectPaths({ file_path: book.filePath, cover_path: book.coverPath })

  const pendingBooks = input.books
    .filter(
      (book) =>
        book.status === "pending" &&
        isAbandoned({ status: "pending", createdAt: book.createdAt }, now)
    )
    .map((book) => ({ id: book.id, paths: pathsOf(book) }))

  // Objects of every row, pending ones included: those leave with their row.
  const referenced = new Set(input.books.flatMap(pathsOf))
  const objects: SweepPlan["objects"] = []
  for (const object of input.objects) {
    if (referenced.has(object.path)) continue
    const owner = object.path.split("/")[0]
    if (!profiles.has(owner)) {
      objects.push({ path: object.path, reason: "folder_without_profile" })
    } else if (object.createdAt && olderThanTtl(object.createdAt, now)) {
      objects.push({ path: object.path, reason: "unreferenced" })
    }
  }

  // The profile is created in the same transaction as the account, so an
  // account without one was broken outside the app.
  const users = input.users
    .filter((user) => !profiles.has(user.id) && olderThanTtl(user.createdAt, now))
    .map((user) => user.id)

  return { pendingBooks, objects, users }
}

export function deletionCounts(plan: SweepPlan): {
  objects: number
  users: number
} {
  return {
    objects:
      plan.objects.length +
      plan.pendingBooks.reduce((sum, book) => sum + book.paths.length, 0),
    users: plan.users.length,
  }
}
```

- [ ] **Step 4: Jalankan test dan pastikan lolos**

Run: `npx vitest run src/server/sweep/plan-sweep.test.ts`
Expected: PASS (6 test).

- [ ] **Step 5: Lint, typecheck, unit test, commit**

```bash
npx prettier --write src/server/sweep/plan-sweep.ts src/server/sweep/plan-sweep.test.ts
npm run lint && npm run typecheck && npm test
git add src/server/sweep/plan-sweep.ts src/server/sweep/plan-sweep.test.ts
git commit -m "feat(sweep): pure planner for the hourly Storage sweep"
```

---

### Task 7: Menjalankan sapuan, entry point, build, dan test DB

**Files:**
- Modify: `src/server/book-storage.ts`
- Create: `src/server/sweep/run-sweep.ts`
- Create: `src/server/sweep/main.ts`
- Create: `vite.sweep.config.ts`
- Modify: `package.json` (skrip `build`)
- Modify: `tests/db/helpers.ts` (`forgetTestMember`)
- Create: `tests/db/sweep.test.ts`

**Interfaces:**
- Consumes: `planSweep`, `deletionCounts`, `StoredObject` (Task 6); `logServerError`, `flushServerErrors` (Task 5).
- Produces:
  - `bookStorage(client).listFolders(): Promise<string[]>`;
  - `bookStorage(client).listFiles(folder): Promise<StoredObject[]>`;
  - `SWEEP_LIMITS = { objects: 50, users: 5 }`;
  - `runSweep(options: SweepOptions): Promise<SweepResult>`, dengan `SweepResult = { status: "done" | "dry_run" | "too_many"; plan: SweepPlan }`;
  - `summarize(result): { status; books; objects; users }`;
  - berkas build `dist/sweep.mjs`.

- [ ] **Step 1: Tambahkan `forgetTestMember` di helper test**

Di `tests/db/helpers.ts`, tambahkan setelah `createTestMember`:

```ts
/** For a member a test already deleted, so the clean-up does not retry it. */
export function forgetTestMember(id: string) {
  const index = createdIds.indexOf(id)
  if (index >= 0) createdIds.splice(index, 1)
}
```

- [ ] **Step 2: Tulis test DB yang gagal**

`tests/db/sweep.test.ts`:

```ts
import { createHash, randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { bookStorage } from "@/server/book-storage"
import { runSweep } from "@/server/sweep/run-sweep"
import {
  adminClient,
  createTestMember,
  deleteTestMembers,
  forgetTestMember,
} from "./helpers"

const run = Date.now().toString(36)
const HOUR = 60 * 60 * 1000
const sha = (n: number) =>
  createHash("sha256").update(`${run}-${n}`).digest("hex")

async function put(path: string) {
  const { error } = await adminClient()
    .storage.from("books")
    .upload(path, new Blob([new Uint8Array(64)]), {
      contentType: "application/epub+zip",
    })
  if (error) throw error
}

async function present(path: string) {
  return (await bookStorage(adminClient()).statObject(path)) !== null
}

async function bookExists(id: string) {
  const { data, error } = await adminClient()
    .from("books")
    .select("id")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data !== null
}

describe("runSweep (limited to test members)", () => {
  let keeper = ""
  let gone = ""
  const readyId = randomUUID()
  const pendingId = randomUUID()
  let readyPath = ""
  let pendingPath = ""
  let strayPath = ""
  let gonePath = ""
  // Two hours ahead, so objects uploaded just now count as older than an hour.
  const later = () => Date.now() + 2 * HOUR

  beforeAll(async () => {
    keeper = (await createTestMember({ email: `db-sweep-${run}@glosa.test` }))
      .id
    gone = (await createTestMember({ email: `db-sweep-gone-${run}@glosa.test` }))
      .id
    readyPath = `${keeper}/${readyId}.epub`
    pendingPath = `${keeper}/${pendingId}.epub`
    strayPath = `${keeper}/${randomUUID()}.epub`
    gonePath = `${gone}/${randomUUID()}.epub`

    const { error } = await adminClient()
      .from("books")
      .insert([
        {
          id: readyId,
          user_id: keeper,
          title: "Siap",
          file_path: readyPath,
          size_bytes: 64,
          sha256: sha(1),
          status: "ready",
        },
        {
          id: pendingId,
          user_id: keeper,
          title: "Tertinggal",
          file_path: pendingPath,
          size_bytes: 64,
          sha256: sha(2),
          status: "pending",
          created_at: new Date(Date.now() - 2 * HOUR).toISOString(),
        },
      ])
    if (error) throw error
    for (const path of [readyPath, pendingPath, strayPath, gonePath])
      await put(path)

    // A profile removed outside the app leaves an account and a folder behind.
    const removed = await adminClient().from("profiles").delete().eq("id", gone)
    if (removed.error) throw removed.error
  })

  afterAll(async () => {
    await adminClient()
      .storage.from("books")
      .remove([readyPath, pendingPath, strayPath, gonePath])
    await deleteTestMembers()
  })

  it("stops without deleting when the plan exceeds the limits", async () => {
    const result = await runSweep({
      admin: adminClient(),
      now: later(),
      onlyUserIds: [keeper, gone],
      limits: { objects: 1, users: 5 },
    })
    expect(result.status).toBe("too_many")
    expect(await present(strayPath)).toBe(true)
    expect(await bookExists(pendingId)).toBe(true)
  })

  it("only plans in a dry run", async () => {
    const result = await runSweep({
      admin: adminClient(),
      now: later(),
      onlyUserIds: [keeper, gone],
      dryRun: true,
    })
    expect(result.status).toBe("dry_run")
    expect(result.plan.pendingBooks.map((book) => book.id)).toEqual([pendingId])
    expect(result.plan.users).toEqual([gone])
    expect(result.plan.objects.map((object) => object.path).sort()).toEqual(
      [gonePath, strayPath].sort()
    )
    expect(await present(gonePath)).toBe(true)
  })

  it("removes what the plan lists and leaves ready books alone", async () => {
    const result = await runSweep({
      admin: adminClient(),
      now: later(),
      onlyUserIds: [keeper, gone],
    })
    expect(result.status).toBe("done")

    expect(await bookExists(pendingId)).toBe(false)
    expect(await present(pendingPath)).toBe(false)
    expect(await present(strayPath)).toBe(false)
    expect(await present(gonePath)).toBe(false)

    const { data } = await adminClient().auth.admin.getUserById(gone)
    expect(data.user).toBeNull()
    forgetTestMember(gone)

    expect(await bookExists(readyId)).toBe(true)
    expect(await present(readyPath)).toBe(true)
  })
})
```

- [ ] **Step 3: Jalankan dan pastikan gagal**

Run: `npx vitest run --config vitest.db.config.ts tests/db/sweep.test.ts`
Expected: FAIL, `Failed to resolve import "@/server/sweep/run-sweep"`.

- [ ] **Step 4: Tambah fungsi daftar di `book-storage.ts`**

Di `src/server/book-storage.ts`:
- tambahkan `import type { StoredObject } from "./sweep/plan-sweep"`;
- tambahkan fungsi pembantu sebelum `bookStorage`:

```ts
type Bucket = ReturnType<SupabaseClient<Database>["storage"]["from"]>

/** Every entry directly under a prefix, page by page. */
async function listAll(bucket: Bucket, prefix: string) {
  const entries = []
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await bucket.list(prefix, {
      limit: LIST_PAGE,
      offset,
    })
    if (error) throw error
    entries.push(...data)
    if (data.length < LIST_PAGE) return entries
  }
}
```

- ganti `listFolder`, lalu tambahkan dua metode di objek yang dikembalikan:

```ts
    /** Paths of every object directly inside a member's folder. */
    async listFolder(folder: string): Promise<Array<string>> {
      const entries = await listAll(bucket(), folder)
      return entries.map((object) => `${folder}/${object.name}`)
    },

    /** Top-level folders: one per member who ever uploaded (Storage lists folders with a null id). */
    async listFolders(): Promise<Array<string>> {
      const entries = await listAll(bucket(), "")
      return entries
        .filter((entry) => entry.id === null)
        .map((entry) => entry.name)
    },

    /** Files directly inside a folder, with their upload time. */
    async listFiles(folder: string): Promise<Array<StoredObject>> {
      const entries = await listAll(bucket(), folder)
      return entries
        .filter((entry) => entry.id !== null)
        .map((entry) => ({
          path: `${folder}/${entry.name}`,
          createdAt: entry.created_at ?? null,
        }))
    },
```

- [ ] **Step 5: Tulis `run-sweep.ts`**

`src/server/sweep/run-sweep.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js"
import { PENDING_TTL_MS } from "@/lib/upload-rules"
import { bookStorage, objectPaths } from "@/server/book-storage"
import type { Database } from "@/server/database.types"
import {
  type StoredObject,
  type SweepPlan,
  type SweepUser,
  deletionCounts,
  planSweep,
} from "./plan-sweep"

type Admin = SupabaseClient<Database>

const PAGE = 1000

/** A round that would delete more stops and reports instead (spec 1E §6). */
export const SWEEP_LIMITS = { objects: 50, users: 5 }

export type SweepOptions = {
  admin: Admin
  now?: number
  dryRun?: boolean
  limits?: { objects: number; users: number }
  /** Limits the round to these members (integration tests). */
  onlyUserIds?: ReadonlyArray<string>
}

export type SweepResult = {
  status: "done" | "dry_run" | "too_many"
  plan: SweepPlan
}

async function allRows<T>(
  page: (
    from: number,
    to: number
  ) => PromiseLike<{ data: Array<T> | null; error: unknown }>
): Promise<Array<T>> {
  const rows: Array<T> = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

async function allUsers(admin: Admin): Promise<Array<SweepUser>> {
  const users: Array<SweepUser> = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PAGE,
    })
    if (error) throw error
    users.push(
      ...data.users.map((user) => ({ id: user.id, createdAt: user.created_at }))
    )
    if (data.users.length < PAGE) return users
  }
}

async function allObjects(
  admin: Admin,
  onlyUserIds: ReadonlyArray<string> | undefined
): Promise<Array<StoredObject>> {
  const storage = bookStorage(admin)
  const folders = onlyUserIds ?? (await storage.listFolders())
  const objects: Array<StoredObject> = []
  for (const folder of folders) objects.push(...(await storage.listFiles(folder)))
  return objects
}

async function applyPlan(admin: Admin, plan: SweepPlan, now: number) {
  const storage = bookStorage(admin)
  if (plan.pendingBooks.length > 0) {
    // Only rows that are still pending and still old leave.
    const { data, error } = await admin
      .from("books")
      .delete()
      .in(
        "id",
        plan.pendingBooks.map((book) => book.id)
      )
      .eq("status", "pending")
      .lt("created_at", new Date(now - PENDING_TTL_MS).toISOString())
      .select("file_path, cover_path")
    if (error) throw error
    await storage.remove(data.flatMap(objectPaths))
  }
  await storage.remove(plan.objects.map((object) => object.path))
  for (const id of plan.users) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw error
  }
}

/**
 * One sweep round (spec 1E §6). Every list is read before anything is
 * deleted, and a failed list throws: it is never taken as empty.
 */
export async function runSweep(options: SweepOptions): Promise<SweepResult> {
  const { admin, dryRun = false, limits = SWEEP_LIMITS, onlyUserIds } = options
  const now = options.now ?? Date.now()
  const only = onlyUserIds ? [...onlyUserIds] : undefined

  // Objects first: every object listed here belongs to a member whose profile
  // and book row already existed, so the lists read after cannot miss them.
  const objects = await allObjects(admin, only)
  const books = await allRows((from, to) => {
    const query = admin
      .from("books")
      .select("id, user_id, status, created_at, file_path, cover_path")
    return (only ? query.in("user_id", only) : query)
      .order("id")
      .range(from, to)
  })
  const profiles = await allRows((from, to) => {
    const query = admin.from("profiles").select("id")
    return (only ? query.in("id", only) : query).order("id").range(from, to)
  })
  const users = (await allUsers(admin)).filter(
    (user) => !only || only.includes(user.id)
  )

  const plan = planSweep({
    now,
    objects,
    books: books.map((row) => ({
      id: row.id,
      userId: row.user_id,
      status: row.status,
      createdAt: row.created_at,
      filePath: row.file_path,
      coverPath: row.cover_path,
    })),
    profileIds: profiles.map((row) => row.id),
    users,
  })

  const counts = deletionCounts(plan)
  if (counts.objects > limits.objects || counts.users > limits.users)
    return { status: "too_many", plan }
  if (dryRun) return { status: "dry_run", plan }
  await applyPlan(admin, plan, now)
  return { status: "done", plan }
}

export function summarize(result: SweepResult) {
  const counts = deletionCounts(result.plan)
  return {
    status: result.status,
    books: result.plan.pendingBooks.length,
    objects: counts.objects,
    users: counts.users,
  }
}
```

- [ ] **Step 6: Jalankan test DB dan pastikan lolos**

Run: `npx vitest run --config vitest.db.config.ts tests/db/sweep.test.ts`
Expected: PASS (3 test).

- [ ] **Step 7: Entry point dan build**

`src/server/sweep/main.ts`:

```ts
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/server/database.types"
import { flushServerErrors, logServerError } from "@/server/monitoring"
import { SWEEP_LIMITS, runSweep, summarize } from "./run-sweep"

// Entry of the sweep container (spec 1E §6): one round, then exit. The
// container's shell loop runs it again an hour later.

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

/** SWEEP_MAX_DELETIONS raises both limits for one supervised run. */
function limitsFromEnv() {
  const max = Number(process.env.SWEEP_MAX_DELETIONS)
  return Number.isInteger(max) && max > 0
    ? { objects: max, users: max }
    : SWEEP_LIMITS
}

/** Tells Uptime Kuma the round succeeded; Kuma alerts when pushes stop. */
async function sendHeartbeat(message: string) {
  const pushUrl = process.env.KUMA_PUSH_URL
  if (!pushUrl) return
  const url = new URL(pushUrl)
  url.searchParams.set("status", "up")
  url.searchParams.set("msg", message)
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) console.error(`heartbeat answered ${response.status}`)
  } catch (error) {
    console.error("heartbeat failed", error)
  }
}

async function main(): Promise<number> {
  try {
    const admin = createClient<Database>(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SECRET_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const result = await runSweep({
      admin,
      dryRun: process.env.SWEEP_DRY_RUN === "1",
      limits: limitsFromEnv(),
    })
    const summary = summarize(result)
    console.log(JSON.stringify({ sweep: summary, plan: result.plan }))
    if (result.status === "too_many") {
      logServerError(
        "sweep stopped: too many deletions",
        new Error(
          `sweep would delete ${summary.objects} objects and ${summary.users} accounts`
        )
      )
      return 1
    }
    await sendHeartbeat(
      `${summary.status}: ${summary.books} books, ${summary.objects} objects, ${summary.users} accounts`
    )
    return 0
  } catch (error) {
    logServerError("sweep failed", error)
    return 1
  }
}

const code = await main()
await flushServerErrors()
process.exit(code)
```

`vite.sweep.config.ts`:

```ts
import { defineConfig } from "vite"

// Builds the Storage sweep (spec 1E §6) into dist/sweep.mjs. Packages stay
// external: the image ships the app's production node_modules.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  build: {
    ssr: "src/server/sweep/main.ts",
    outDir: "dist",
    emptyOutDir: false,
    target: "node24",
    sourcemap: "hidden",
    rolldownOptions: { output: { entryFileNames: "sweep.mjs" } },
  },
})
```

Di `package.json`, ganti skrip `build`:

```json
    "build": "vite build && vite build --config vite.sweep.config.ts && node scripts/build-sw.mjs",
```

- [ ] **Step 8: Periksa build sapuan sungguhan (dry run ke proyek dev)**

Run: `npm run build`
Expected: ada `dist/sweep.mjs`, dan `dist/client/sw.js` tetap terbentuk.

Jalankan sekali sebagai dry run dengan env dari `.env.local`. Di PowerShell:

```powershell
$env:SWEEP_DRY_RUN = "1"; node --env-file=.env.local dist/sweep.mjs; "exit $LASTEXITCODE"; Remove-Item Env:SWEEP_DRY_RUN
```

Expected:
- satu baris JSON `{"sweep":{"status":"dry_run",...},"plan":{...}}` lalu `exit 0`; atau
- `"status":"too_many"` lalu `exit 1`, kalau proyek dev menyimpan lebih dari 50 objek yatim dari test lama.

Keduanya berarti build berjalan. **Jangan** menjalankannya tanpa `SWEEP_DRY_RUN=1` di proyek dev.

- [ ] **Step 9: Lint, typecheck, unit test, commit**

```bash
npx prettier --write src/server/book-storage.ts src/server/sweep/run-sweep.ts src/server/sweep/main.ts vite.sweep.config.ts tests/db/helpers.ts tests/db/sweep.test.ts
npm run lint && npm run typecheck && npm test
git add src/server/book-storage.ts src/server/sweep/run-sweep.ts src/server/sweep/main.ts vite.sweep.config.ts tests/db/helpers.ts tests/db/sweep.test.ts package.json
git commit -m "feat(sweep): hourly Storage sweep with safety limits and heartbeat"
```

---

### Task 8: Image, stack compose, Caddy, dan cek kebocoran kunci

**Files:**
- Create: `Dockerfile`, `.dockerignore`
- Create: `deploy/compose.yml`, `deploy/glosa.caddy`, `deploy/.env.example`, `deploy/release.sh`
- Create: `deploy/proxy/compose.yml`, `deploy/proxy/Caddyfile`
- Create: `scripts/check-client-secrets.mjs`
- Modify: `package.json` (`@sentry/cli` dev)

**Interfaces:**
- Consumes: skrip `start` (Task 3), `dist/sweep.mjs` (Task 7), `/api/health` (Task 3).
- Produces:
  - build arg `APP_VERSION`, `SENTRY_ORG`, `SENTRY_PROJECT`; secret build `sentry_auth_token`;
  - `deploy/release.sh <tag>` (dipanggil Task 10);
  - `node scripts/check-client-secrets.mjs` (dipanggil Task 10).

- [ ] **Step 1: Pasang `@sentry/cli`**

Run: `npm install -D @sentry/cli`

- [ ] **Step 2: Cek kebocoran kunci**

`scripts/check-client-secrets.mjs`:

```js
// Fails when a server secret reaches the browser bundle (spec 1E §5): the
// Supabase secret key prefix always, and the key itself when it is given.
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"

const CLIENT_DIR = "dist/client"
const needles = [{ label: 'the "sb_secret_" prefix', value: "sb_secret_" }]
if (process.env.SUPABASE_SECRET_KEY) {
  needles.push({
    label: "the value of SUPABASE_SECRET_KEY",
    value: process.env.SUPABASE_SECRET_KEY,
  })
}

async function filesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name)
      return entry.isDirectory() ? filesIn(path) : [path]
    })
  )
  return nested.flat()
}

const leaks = []
for (const path of await filesIn(CLIENT_DIR)) {
  const text = (await readFile(path)).toString("latin1")
  for (const needle of needles) {
    if (text.includes(needle.value)) leaks.push(`${path}: ${needle.label}`)
  }
}

if (leaks.length > 0) {
  console.error(`Server secrets in the browser bundle:\n${leaks.join("\n")}`)
  process.exit(1)
}
console.log(`No server secrets in ${CLIENT_DIR}.`)
```

Run: `npm run build`, lalu `node scripts/check-client-secrets.mjs`
Expected: `No server secrets in dist/client.`

Uji bahwa cek ini benar-benar menangkap kebocoran (PowerShell):

```powershell
Add-Content dist/client/leak-test.js "const k = 'sb_secret_test'"; node scripts/check-client-secrets.mjs; "exit $LASTEXITCODE"; Remove-Item dist/client/leak-test.js
```

Expected: `Server secrets in the browser bundle:` dengan `dist\client\leak-test.js: the "sb_secret_" prefix`, lalu `exit 1`.

- [ ] **Step 3: Dockerfile dan `.dockerignore`**

`Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1

# Glosa's image (spec 1E §3): the app server and the Storage sweep. It holds
# no secrets; every setting is read from the environment at start.

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
RUN npm run build
# Source maps go to Sentry when a token is given, then leave the image.
ARG SENTRY_ORG
ARG SENTRY_PROJECT
RUN --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
    if [ -n "${SENTRY_AUTH_TOKEN:-}" ]; then \
      npx sentry-cli sourcemaps inject dist && \
      npx sentry-cli sourcemaps upload --release "$APP_VERSION" dist; \
    else \
      echo "SENTRY_AUTH_TOKEN not set: source maps are not uploaded"; \
    fi \
    && find dist -name '*.map' -delete
RUN npm prune --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node_modules/.bin/srvx", "serve", "--prod", "--entry", "dist/server/server.js", "--static", "dist/client", "--port", "3000"]
```

`.dockerignore`:

```
.git
.github
node_modules
dist
.env
.env.*
!.env.example
deploy
docs
e2e
tests
playwright-report
test-results
supabase/.temp
*.log
```

- [ ] **Step 4: Stack bersama `deploy/proxy/`**

`deploy/proxy/compose.yml`:

```yaml
# Shared stack on the VPS (/opt/proxy, spec 1E §3): the only service holding
# ports 80/443. Each site drops one file into ./sites and Caddy imports them.
# After editing ./Caddyfile itself, run: docker compose restart caddy
name: proxy

x-logging: &logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"

services:
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./sites:/etc/caddy/sites:ro
      - caddy-data:/data
      - caddy-config:/config
    networks: [web]
    logging: *logging

  uptime-kuma:
    image: louislam/uptime-kuma:1
    restart: unless-stopped
    volumes:
      - kuma-data:/app/data
    networks: [web]
    logging: *logging

volumes:
  caddy-data:
  caddy-config:
  kuma-data:

networks:
  web:
    external: true
```

`deploy/proxy/Caddyfile`:

```
# Shared Caddy for every site on this VPS (spec 1E §3). Only shared hosts live
# here; each site keeps its own block in sites/<name>.caddy.

status.nuvrastudio.space {
	encode zstd gzip
	reverse_proxy uptime-kuma:3001
}

import /etc/caddy/sites/*.caddy
```

- [ ] **Step 5: Stack Glosa `deploy/`**

`deploy/compose.yml`:

```yaml
# Glosa's stack on the VPS (/opt/glosa, spec 1E §3). Caddy and Uptime Kuma live
# in the shared stack /opt/proxy; the app joins the shared "web" network, where
# Caddy reaches it as glosa-app:3000.
# Run: docker compose --env-file .env --env-file release.env up -d
name: glosa

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
        aliases: [glosa-app]
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

`deploy/glosa.caddy`:

```
# Glosa's site block. deploy/release.sh copies it to /opt/proxy/sites/glosa.caddy.

glosa.nuvrastudio.space {
	encode zstd gzip

	# A new service worker and app shell are picked up straight away.
	@fresh path /sw.js /_shell.html
	header @fresh >Cache-Control "no-cache"

	# Built assets have hashed names and never change.
	@assets path /assets/*
	header @assets >Cache-Control "public, max-age=31536000, immutable"

	reverse_proxy glosa-app:3000
}
```

`deploy/.env.example`:

```
# Template for /opt/glosa/.env on the VPS (mode 600, owner deploy).
# Real values live only on the VPS: never commit them.
SUPABASE_URL=https://<prod-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
SITE_URL=https://glosa.nuvrastudio.space
# Empty keeps Sentry off.
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
# Push URL of the "sapuan" monitor in Uptime Kuma.
KUMA_PUSH_URL=
# 1 = only log what the sweep would delete. Set to 0 once the plans look right.
SWEEP_DRY_RUN=1
# Raise for one supervised run when a round stops at its limits.
# SWEEP_MAX_DELETIONS=200
```

`deploy/release.sh`:

```bash
#!/usr/bin/env bash
# Runs on the VPS as user "deploy" (spec 1E §5): switches Glosa to the image
# tag given as $1, then hands Glosa's site block to the shared Caddy.
# The workflow copies compose.yml and glosa.caddy into /opt/glosa first.
set -euo pipefail

tag="${1:?usage: release.sh <image tag>}"
site=/opt/proxy/sites/glosa.caddy

cd /opt/glosa
printf 'GLOSA_TAG=%s\n' "$tag" > release.env
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
cp glosa.caddy "$site"
if ! proxy exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
  echo "Caddy rejected glosa.caddy; the previous site block is back." >&2
  if [ -n "$backup" ]; then cp "$backup" "$site"; else rm -f "$site"; fi
  exit 1
fi
proxy exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
if [ -n "$backup" ]; then rm -f "$backup"; fi

# Keep a week of unused images for quick rollbacks; older ones are pulled again.
docker image prune -af --filter "until=168h"
```

- [ ] **Step 6: Validasi berkas deploy**

Jika `docker` tersedia di mesin, jalankan di Git Bash. `MSYS_NO_PATHCONV=1` mencegah Git Bash mengubah path `/etc/...` menjadi path Windows:

```bash
export MSYS_NO_PATHCONV=1
docker run --rm \
  -v "$PWD/deploy/proxy/Caddyfile:/etc/caddy/Caddyfile:ro" \
  -v "$PWD/deploy/glosa.caddy:/etc/caddy/sites/glosa.caddy:ro" \
  caddy:2 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose -f deploy/proxy/compose.yml config --quiet
: > deploy/.env && GLOSA_TAG=test docker compose -f deploy/compose.yml config --quiet; rm deploy/.env
docker build --build-arg APP_VERSION=local-test -t glosa:local-test .
docker run -d --rm --name glosa-local -p 3000:3000 glosa:local-test
sleep 5 && curl -s http://localhost:3000/api/health && docker stop glosa-local
docker run --rm glosa:local-test sh -c 'find dist -name "*.map" | wc -l'
```

Expected:
- `Valid configuration`;
- kedua `config --quiet` diam;
- build sukses;
- health menjawab `{"status":"ok","version":"local-test"}`;
- jumlah `.map` = `0`.

Jika Docker tidak tersedia, catat di laporan task bahwa validasi ini dijalankan job CI (`test` dan `image`) di Task 10, dan lanjutkan.

- [ ] **Step 7: Lint, typecheck, unit test, commit**

```bash
npx prettier --write scripts/check-client-secrets.mjs
npm run lint && npm run typecheck && npm test
git add Dockerfile .dockerignore deploy scripts/check-client-secrets.mjs package.json package-lock.json
git commit -m "feat(ops): image, compose stacks, shared Caddy and the release script"
```

---

### Task 9: Skrip persiapan VPS

**Files:**
- Create: `scripts/vps-setup.sh`

**Interfaces:**
- Produces: `sudo bash vps-setup.sh "<kunci publik SSH GitHub Actions>"`. Hasilnya:
  - Docker dan compose plugin;
  - user `deploy` (grup `docker`) dengan kunci publik di `authorized_keys`;
  - `ufw` (22/80/443), SSH tanpa sandi dan tanpa root (jika aman), swap 2 GB, `unattended-upgrades`;
  - jaringan `web`, dan folder `/opt/proxy`, `/opt/proxy/sites`, `/opt/glosa` milik `deploy`.

- [ ] **Step 1: Tulis skrip**

`scripts/vps-setup.sh`:

```bash
#!/usr/bin/env bash
# One-time preparation of a fresh Ubuntu VPS for Glosa and the sites that come
# after it (spec 1E §3). Safe to run again. It starts no stack: the owner does
# that by hand (docs/ops/produksi.md).
#
# Usage, from your own sudo user (not root):
#   sudo bash vps-setup.sh "ssh-ed25519 AAAA... github-actions-glosa"
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo bash vps-setup.sh \"<public key>\"" >&2
  exit 1
fi
deploy_key="${1:?Give the GitHub Actions public key as the first argument}"

echo "==> Docker Engine and the compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "==> User deploy (for GitHub Actions)"
if ! id deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
fi
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
if ! grep -qxF "$deploy_key" /home/deploy/.ssh/authorized_keys; then
  echo "$deploy_key" >> /home/deploy/.ssh/authorized_keys
fi
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

echo "==> SSH: keys only, no root login"
admin="${SUDO_USER:-}"
if [ -n "$admin" ] && [ "$admin" != "root" ] && [ -s "/home/$admin/.ssh/authorized_keys" ]; then
  cat > /etc/ssh/sshd_config.d/10-glosa.conf <<'EOF'
# Written by vps-setup.sh. Sorts before 50-cloud-init.conf, so it wins.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
  sshd -t
  systemctl reload ssh
else
  echo "    Skipped: run this script with sudo from your own user that logs in with an SSH key," >&2
  echo "    otherwise turning off passwords and root could lock you out." >&2
fi

echo "==> Firewall: only 22, 80 and 443"
apt-get install -y ufw
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Swap 2 GB"
if ! swapon --show | grep -q '^/swapfile'; then
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

echo "==> Automatic security updates"
apt-get install -y unattended-upgrades
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

echo "==> Shared Docker network and folders"
docker network inspect web >/dev/null 2>&1 || docker network create web
install -d -o deploy -g deploy /opt/proxy /opt/proxy/sites /opt/glosa

echo "Done. Next: docs/ops/produksi.md, section 4.3."
```

- [ ] **Step 2: Periksa dengan shellcheck**

Jika `shellcheck` tersedia (atau lewat Docker: `docker run --rm -v "$PWD:/mnt" koalaman/shellcheck:stable scripts/vps-setup.sh deploy/release.sh`), jalankan `shellcheck scripts/vps-setup.sh deploy/release.sh`.
Expected: tanpa keluaran. Jika keduanya tidak tersedia, job CI Task 10 menjalankannya.

Periksa juga akhir baris: `git diff --cached --stat` sesudah `git add` tidak boleh memunculkan peringatan CRLF (`.gitattributes` memaksa LF).

- [ ] **Step 3: Commit**

```bash
git add scripts/vps-setup.sh
git commit -m "feat(ops): one-time VPS setup script"
```

---

### Task 10: CI/CD — validasi, image, dan deploy dengan persetujuan

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `scripts/check-client-secrets.mjs`, `Dockerfile`, `deploy/*`, `scripts/vps-setup.sh` (Task 8–9).
- Produces:
  - job `test`, `image`, `deploy`;
  - workflow `Deploy` (`workflow_call` dengan input `tag`, `migrate`; `workflow_dispatch` dengan input `tag`).
- Secret dan variable yang dibaca:
  - repositori: secret `SENTRY_AUTH_TOKEN`; variable `SENTRY_ORG`, `SENTRY_PROJECT`, `DEPLOY_ENABLED`;
  - environment `production`: `SUPABASE_ACCESS_TOKEN`, `PROD_SUPABASE_PROJECT_REF`, `PROD_SUPABASE_DB_PASSWORD`, `VPS_HOST`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`.

- [ ] **Step 1: Tulis ulang `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

env:
  IMAGE: ghcr.io/muhammadyudhistira/glosa

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 50
    # Integration and E2E tests share the Supabase dev project; avoid overlapping
    # runs. Job-level, so a deploy waiting for approval never holds other runs.
    concurrency:
      group: supabase-dev
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run check
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - name: Check the browser bundle for server secrets
        run: node scripts/check-client-secrets.mjs
        env:
          SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
      - name: Validate deploy files
        run: |
          shellcheck scripts/vps-setup.sh deploy/release.sh
          docker run --rm \
            -v "$PWD/deploy/proxy/Caddyfile:/etc/caddy/Caddyfile:ro" \
            -v "$PWD/deploy/glosa.caddy:/etc/caddy/sites/glosa.caddy:ro" \
            caddy:2 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
          docker compose -f deploy/proxy/compose.yml config --quiet
          : > deploy/.env
          GLOSA_TAG=ci docker compose -f deploy/compose.yml config --quiet
          rm deploy/.env
      - name: Write .env.local from secrets
        run: |
          {
            echo "SUPABASE_URL=${{ secrets.SUPABASE_URL }}"
            echo "SUPABASE_PUBLISHABLE_KEY=${{ secrets.SUPABASE_PUBLISHABLE_KEY }}"
            echo "SUPABASE_SECRET_KEY=${{ secrets.SUPABASE_SECRET_KEY }}"
            echo "SITE_URL=http://localhost:3000"
            echo "E2E_SMTP_EMAIL=${{ secrets.E2E_SMTP_EMAIL }}"
          } > .env.local
      - run: npm run test:db
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env:
          CI: "true"
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 7

  # Built and smoke-tested on every run; pushed to GHCR only from main.
  image:
    needs: test
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: Build the image
        uses: docker/build-push-action@v6
        with:
          context: .
          load: true
          tags: ${{ env.IMAGE }}:${{ github.sha }}
          build-args: |
            APP_VERSION=${{ github.sha }}
            SENTRY_ORG=${{ vars.SENTRY_ORG }}
            SENTRY_PROJECT=${{ vars.SENTRY_PROJECT }}
          # Source maps are uploaded for main only.
          secrets: |
            sentry_auth_token=${{ github.event_name == 'push' && secrets.SENTRY_AUTH_TOKEN || '' }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Smoke test the image
        run: |
          docker run -d --name glosa-smoke -p 3000:3000 "$IMAGE:$GITHUB_SHA"
          for _ in $(seq 1 30); do
            version=$(curl -fsS http://localhost:3000/api/health | jq -r .version) \
              && [ "$version" = "$GITHUB_SHA" ] && exit 0
            sleep 2
          done
          docker logs glosa-smoke
          exit 1
      - name: Check that no source maps are left
        run: test "$(docker run --rm "$IMAGE:$GITHUB_SHA" sh -c 'find dist -name "*.map" | wc -l')" = 0
      - name: Push the image
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: |
          echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u "${{ github.actor }}" --password-stdin
          docker push "$IMAGE:$GITHUB_SHA"

  # Waits for the owner's Approve in the "production" environment.
  deploy:
    needs: image
    if: github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.DEPLOY_ENABLED == 'true'
    uses: ./.github/workflows/deploy.yml
    with:
      tag: ${{ github.sha }}
      migrate: true
    secrets: inherit
```

- [ ] **Step 2: Tulis `.github/workflows/deploy.yml`**

```yaml
name: Deploy

# Called by CI after the image is pushed (with migrations), or run by hand from
# the Actions tab with an older tag to roll back (migrations skipped).
on:
  workflow_call:
    inputs:
      tag:
        type: string
        required: true
      migrate:
        type: boolean
        required: true
  workflow_dispatch:
    inputs:
      tag:
        description: "Full commit SHA of the image to run. Migrations are skipped."
        type: string
        required: true

env:
  APP_URL: https://glosa.nuvrastudio.space

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    environment: production
    concurrency:
      group: production
      cancel-in-progress: false
    env:
      TAG: ${{ inputs.tag }}
    steps:
      - name: Check the tag
        run: |
          [[ "$TAG" =~ ^[0-9a-f]{40}$ ]] || { echo "tag must be a full commit SHA"; exit 1; }
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        if: inputs.migrate
        with:
          version: 2.121.0
      - name: Apply database migrations to production
        if: inputs.migrate
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.PROD_SUPABASE_DB_PASSWORD }}
        run: |
          supabase link --project-ref "${{ secrets.PROD_SUPABASE_PROJECT_REF }}"
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
          scp deploy/compose.yml deploy/glosa.caddy "deploy@$VPS_HOST:/opt/glosa/"
          ssh "deploy@$VPS_HOST" "bash -s -- $TAG" < deploy/release.sh
      - name: Smoke check
        run: |
          for _ in $(seq 1 24); do
            version=$(curl -fsS "$APP_URL/api/health" | jq -r .version) \
              && [ "$version" = "$TAG" ] && exit 0
            sleep 5
          done
          echo "$APP_URL/api/health never reported $TAG"
          exit 1
```

- [ ] **Step 3: Periksa sintaks workflow**

Jika `actionlint` tersedia (atau `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest`), jalankan `actionlint .github/workflows/ci.yml .github/workflows/deploy.yml`.
Expected: tanpa keluaran. Jika tidak tersedia, periksa YAML-nya dengan:

```bash
node -e "const fs=require('fs');for (const f of ['ci','deploy']) { const t=fs.readFileSync('.github/workflows/'+f+'.yml','utf8'); if (/\t/.test(t)) throw new Error(f+' has tabs'); } console.log('ok')"
```

Validasi penuh terjadi saat branch di-push: job `test` dan `image` harus hijau di PR. Job `deploy` tidak berjalan di PR maupun selama `DEPLOY_ENABLED` belum `true`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/deploy.yml
git commit -m "ci: build the image, then deploy to the VPS after approval"
```

---

### Task 11: Halaman privasi menyebut Sentry, Resend, dan lokasi data

**Files:**
- Modify: `src/routes/privacy.tsx`

- [ ] **Step 1: Ubah teks**

Di `src/routes/privacy.tsx`:
- ganti `updated="15 Oktober 2026"` menjadi `updated="20 Oktober 2026"`;
- ganti butir data teknis:

```tsx
        <li>
          Data teknis: waktu masuk terakhir dan laporan error untuk memperbaiki
          aplikasi. Laporan error hanya memuat ID akunmu, tanpa email atau nama.
        </li>
```

- ganti bagian "Tempat penyimpanan":

```tsx
      <h2>Tempat penyimpanan</h2>
      <p>
        Akun, data membaca, dan file bukumu disimpan di Supabase, di pusat data
        Singapura. Aplikasi berjalan di server sewaan (VPS) kami. Email akun
        dikirim lewat Resend, dan laporan error disimpan di Sentry. Penyedia
        layanan tersebut hanya memproses data atas instruksi kami.
      </p>
```

- [ ] **Step 2: Periksa dan commit**

```bash
npx prettier --write src/routes/privacy.tsx
npm run lint && npm run typecheck && npm test
git add src/routes/privacy.tsx
git commit -m "docs(legal): privacy page names Sentry, Resend and where data lives"
```

---

### Task 12: Panduan produksi `docs/ops/produksi.md`

**Files:**
- Create: `docs/ops/produksi.md`

Panduan ini sekaligus tempat belajar pemilik (keputusan 9 di spec). Tulis persis seperti di bawah.

- [ ] **Step 1: Tulis panduan**

`docs/ops/produksi.md`:

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add docs/ops/produksi.md
git commit -m "docs(ops): production guide for the owner, written to learn from"
```

---

### Task 13: Verifikasi akhir

- [ ] **Step 1: Seluruh pemeriksaan lokal**

```bash
npm run lint && npm run check && npm run typecheck && npm test
npm run build && node scripts/check-client-secrets.mjs
npm run test:db
npm run test:e2e
```

Expected: semuanya hijau. `test:db` kini memuat `signup-invites` dan `sweep`. E2E tidak berubah, karena hook dev belum aktif selama implementasi; kalau pemilik sudah mengaktifkannya, `signups_open` dev harus `true` (panduan 3.6).

- [ ] **Step 2: Cocokkan dengan spec**

Periksa setiap bagian spec 1E dan tunjuk task-nya:
- §3: Task 8 dan 9;
- §4: Task 1, 2, dan 11, serta panduan 3.2–3.6;
- §5: Task 8 dan 10;
- §6: Task 6 dan 7;
- §7: Task 4 dan 5, serta panduan 4.6;
- §8: test di Task 1–8 dan pemeriksaan manual di panduan bagian 7;
- §9: panduan bagian 3–5;
- §10: panduan bagian 11.

- [ ] **Step 3: Push branch dan pastikan CI hijau**

Push branch, buka PR, dan pastikan job `test` dan `image` hijau. Job `deploy` dilewati di PR. Setelah merge ke `main`, `deploy` tetap dilewati sampai pemilik menambahkan `DEPLOY_ENABLED=true` (panduan bagian 5).

## Setelah merge: langkah pemilik

Ikuti `docs/ops/produksi.md` bagian 3 sampai 7, berurutan. Pemeriksaan manual 1C (HP Android) dan 1D (performa, keyboard) yang tertunda kini ada di panduan bagian 7.
