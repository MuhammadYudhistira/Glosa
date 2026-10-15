# Glosa Tahap 1A — Fondasi & Auth: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun kerangka aplikasi Glosa dan alur anggota "datang ke perpustakaan": tamu tiba di halaman sambutan, mengisi buku tamu atau formulir anggota, mengonfirmasi email, menerima kartu anggota, masuk ke lobi sementara, lalu bisa mengatur profil, keluar, atau menghapus akun.

**Architecture:** Kerangka dibuat dari starter shadcn untuk TanStack Start (React 19, SSR). Semua operasi auth berjalan lewat *server functions* yang memakai Supabase SSR client berbasis cookie dan terhubung ke **Supabase Cloud (proyek dev)**. Root route memuat `SessionUser` ke context router, lalu layout `_member` menjaga rute anggota. Adegan perpustakaan memakai satu SVG statis sebagai latar, dengan state per rute (overview/admin) yang dianimasikan lewat CSS.

**Tech Stack:** TanStack Start + Router, React 19, TypeScript 6, Vite 8, Tailwind CSS 4, shadcn/ui (preset `b1D0dv72`, gaya base-mira di atas Base UI, ikon lucide), Supabase Cloud (Auth + Postgres, CLI hanya untuk link/push/gen types), Zod 4, Vitest 5 + Testing Library, Playwright, ESLint (`@tanstack/eslint-config`) + Prettier, Fontsource.

**Seri rencana tahap 1** (spec: [`docs/superpowers/specs/2026-10-15-epub-reader-tahap-1-design.md`](../specs/2026-10-15-epub-reader-tahap-1-design.md)):

| Rencana | Isi | Status |
|---|---|---|
| **1A** | Fondasi proyek, database `profiles`, auth lengkap, kartu anggota, pengaturan, halaman hukum, E2E, CI | **Dokumen ini** |
| 1B | Tabel `books`, Storage, kuota, genre + Troli, Rak Saya, upload, penghapusan file saat hapus akun | Ditulis setelah 1A selesai |
| 1C | Reader foliate-js, sinkronisasi posisi baca, PWA/offline | Ditulis setelah 1B |
| 1D | Lobi isometrik interaktif (hotspot, panel, peta), proyek Supabase prod + SMTP, deploy VPS (Docker, Caddy, GHCR), Sentry | Ditulis setelah 1C |

## Global Constraints

- Node.js **≥ 24**. Package manager: **npm**.
- **Supabase Cloud saja**, tanpa Supabase lokal/Docker. Development dan semua test memakai **proyek dev**. Proyek prod dibuat di rencana 1D.
- Teks UI dalam **bahasa Indonesia**, path URL dalam bahasa Inggris.
- Username: regex `^[a-z0-9_]{3,20}$`. Kata sandi minimal **8** karakter.
- Kuota default `storage_limit_bytes` = **104857600** (100 MB). Plan: `'free' | 'pro'`, default `'free'`.
- Kolom `plan`, `storage_limit_bytes`, dan `member_no` **tidak boleh** bisa diubah client.
- **Secret key Supabase hanya dipakai di server**, di kode test, atau di secret CI. Jangan pernah dipakai di kode client atau diberi prefix `VITE_`.
- Font di-host sendiri via Fontsource: Atkinson Hyperlegible (UI), Libre Caslon Text (judul), Caveat (tulisan tangan dekoratif), Courier Prime (mesin tik). Inter dari preset **dihapus**.
- Glosa memakai satu palet gelap. `<html>` selalu memiliki kelas `dark`.
- Semua animasi dimatikan saat `prefers-reduced-motion: reduce` dan bisa dilewati dengan klik.
- Jangan menampilkan menu atau label untuk fitur tahap berikutnya ("segera hadir", tombol mati, dll.).
- "Pengunjung hari ini" hanya berupa **angka**, tanpa nama user lain.
- Isian form adalah `<input>` biasa dengan atribut `autocomplete` yang benar.
- Gaya kode mengikuti starter: Prettier (kutip ganda, tanpa titik koma), ESLint `@tanstack/eslint-config`, alias `@/*` → `src/*`, `cn` dari `@/lib/utils`. Gunakan `import type` / `type` modifier untuk import tipe (`verbatimModuleSyntax`).
- Gunakan elemen semantik, bukan atribut `role`, jika elemennya ada: `<output>` untuk pesan status, `<figure>` untuk kartu. `role="alert"` tetap dipakai untuk pesan error.
- Semua email user uji berisi `e2e-` atau dibuat dengan `run` unik di `tests/db`, berakhiran `@glosa.test` (kecuali uji SMTP opsional), lalu **dihapus** setelah test selesai.

## Langkah manual pemilik proyek

Langkah-langkah ini butuh akun Supabase pemilik proyek. Agent harus meminta pemilik proyek mengerjakannya di titik yang disebutkan, lalu menunggu konfirmasi.

1. **(Sebelum Task 3)** Buat proyek Supabase **"glosa-dev"** di dashboard (region terdekat, mis. Singapore). Catat *project ref* (dari URL `https://supabase.com/dashboard/project/<ref>`) dan password database.
2. **(Sebelum Task 3)** Isi `.env.local` di root repo. Nilainya diambil dari Project Settings → API Keys:
   ```
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_...
   SITE_URL=http://localhost:3000
   ```
3. **(Task 3, Step 1)** Jalankan `npx supabase login`, lalu `npx supabase link --project-ref <ref>` (masukkan password database).
4. **(Task 6, Step 2)** Atur Auth di dashboard proyek dev:
   - URL Configuration → Site URL `http://localhost:3000`, Redirect URLs `http://localhost:3000/**`.
   - Sign In / Providers → Email: **Confirm email ON**. Password: minimum length **8**.
   - Email Templates → *Confirm signup* dan *Reset password*: isi dengan file `supabase/templates/*.html` beserta subjeknya.
5. **(Opsional, kapan saja)** Login Google: buat OAuth Client di Google Cloud, aktifkan provider Google di dashboard, dan daftarkan redirect `https://<ref>.supabase.co/auth/v1/callback`.
6. **(Opsional)** SMTP kustom (mis. Resend) untuk uji kirim email sungguhan. Lihat Task 14 tentang `E2E_SMTP_EMAIL`.

## Struktur file

```
.github/workflows/ci.yml            CI: lint, typecheck, unit, integrasi DB, E2E
components.json · eslint.config.js · .prettierrc · .prettierignore · tsconfig.json
vite.config.ts · vitest.config.ts · vitest.db.config.ts · playwright.config.ts
.env.example                        daftar env yang dibutuhkan
scripts/extract-lobby-scene.mjs     ambil SVG adegan dari mockup → public/lobby/scene.svg
public/lobby/scene.svg              latar adegan sementara (hasil generate)
supabase/
  config.toml                       dibuat `supabase init` (dipakai untuk link/push)
  migrations/20261015000100_profiles.sql
  templates/confirmation.html · recovery.html   (ditempel ke dashboard)
tests/db/                           test integrasi ke proyek dev
  setup.ts · helpers.ts · profiles.test.ts
src/
  router.tsx · routeTree.gen.ts (digenerate, di-commit) · styles.css
  lib/                              logika murni (diuji Vitest)
    utils.ts (starter) · username.ts · redirects.ts · auth-messages.ts · member.ts
    dates.ts · action-result.ts · session-types.ts · site.ts
  server/                           hanya berjalan di server
    database.types.ts (digenerate) · supabase.ts · session.ts · auth.ts · profile.ts
  components/
    ui/button.tsx (starter, ditambah varian) · input.tsx · label.tsx (shadcn add)
    ui/panel.tsx · ui/logo.tsx
    scene/scene-state.ts · scene/SceneBackdrop.tsx
    auth/LibrarianBubble.tsx · PaperField.tsx · GuestBook.tsx · AdminDesk.tsx
         GoogleButton.tsx · GuestBookRules.tsx · useUsernameCheck.ts · LinkFailed.tsx
    member/MembershipCard.tsx · Stamp.tsx
    legal/LegalPage.tsx
  routes/
    __root.tsx · index.tsx · login.tsx · register.tsx · forgot-password.tsx
    reset-password.tsx · logout.tsx · privacy.tsx · terms.tsx
    auth/callback.tsx · auth/confirm.tsx
    _member.tsx · _member/welcome.tsx · _member/lobby.tsx · _member/settings.tsx
e2e/
  helpers/env.ts · helpers/members.ts · global-teardown.ts · auth.spec.ts
```

---

### Task 1: Kerangka proyek dari starter shadcn

**Files:**
- Create (dari starter): `.npmrc`, `.prettierignore`, `.prettierrc`, `components.json`, `eslint.config.js`, `package.json`, `package-lock.json`, `public/`, `src/`, `tsconfig.json`, `tsr.config.json`, `vite.config.ts`
- Create: `vitest.config.ts`, `src/test/setup.ts`, `.env.example`
- Modify: `.gitignore`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `.prettierignore`, `src/routes/__root.tsx`, `src/routes/index.tsx`
- Delete: `src/logo.svg`

**Interfaces:**
- Produces: proyek TanStack Start + shadcn yang bisa di-build. Skrip npm: `dev`, `build`, `typecheck`, `lint`, `format`, `check`, `test`, `test:watch`, `test:db`, `test:e2e`, `db:push`, `db:types`. `cn` dari `@/lib/utils`. Komponen `Button` dan `buttonVariants` dari `@/components/ui/button`.

- [ ] **Step 1: Generate starter di luar repo**

Jalankan dari folder **induk** repo (mis. `C:\project`):

```bash
npx shadcn@latest init --preset b1D0dv72 --template start --pointer --name glosa-starter --no-monorepo --no-rtl
```

Expected: folder `glosa-starter/` berisi `components.json`, `src/components/ui/button.tsx`, `src/lib/utils.ts`, `src/styles.css`, dan diakhiri pesan "Project initialization completed."

- [ ] **Step 2: Salin starter ke repo**

Dari folder induk:

```bash
cd glosa-starter
cp -r .npmrc .prettierignore .prettierrc components.json eslint.config.js package.json package-lock.json public src tsconfig.json tsr.config.json vite.config.ts ../epub-reader/
cd ../epub-reader
rm -rf ../glosa-starter src/logo.svg
npm pkg set name=glosa
npm install
```

`.gitignore`, `README.md`, `.cta.json`, dan `.git` dari starter sengaja **tidak** disalin. `.gitignore` starter mengabaikan `package-lock.json` dan `.env.example`, padahal keduanya justru dibutuhkan.

Ganti seluruh isi `.gitignore`:

```
node_modules/
dist/
dist-ssr/
.output/
.nitro/
.tanstack/
.vinxi/
*.tsbuildinfo
.DS_Store
.superpowers/
.env
.env.*
!.env.example
playwright-report/
test-results/
supabase/.temp/
```

- [ ] **Step 3: Tambah dependensi dan skrip**

```bash
npm install @supabase/ssr @supabase/supabase-js zod
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @playwright/test supabase
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
npm pkg set scripts.test:db="vitest run --config vitest.db.config.ts"
npm pkg set scripts.test:e2e="playwright test"
npm pkg set scripts.db:push="supabase db push --linked --yes"
npm pkg set scripts.db:types="supabase gen types --linked > src/server/database.types.ts"
```

- [ ] **Step 4: Sesuaikan konfigurasi**

`vite.config.ts` (ganti seluruh isinya):

```ts
import { defineConfig, loadEnv } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig(({ mode }) => {
  // Make .env / .env.local values visible to server code through process.env.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""))
  return {
    resolve: { tsconfigPaths: true },
    plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
  }
})
```

Di `tsconfig.json`, ubah `"types": ["vite/client"]` menjadi `"types": ["vite/client", "node"]`.

`eslint.config.js` (ganti seluruh isinya):

```js
//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"

export default [
  ...tanstackConfig,
  {
    rules: {
      "import/no-cycle": "off",
      "import/order": "off",
      "import/consistent-type-specifier-style": "off",
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/require-await": "off",
      "pnpm/json-enforce-catalog": "off",
    },
  },
  {
    ignores: [
      "eslint.config.js",
      ".prettierrc",
      "src/routeTree.gen.ts",
      "src/server/database.types.ts",
      "docs/**",
      "public/**",
      "dist/**",
      "playwright-report/**",
      "test-results/**",
      "supabase/.temp/**",
    ],
  },
]
```

Tambahkan ke akhir `.prettierignore`:

```
src/routeTree.gen.ts
src/server/database.types.ts
docs
public/lobby
```

`vitest.config.ts`:

```ts
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [viteReact()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    passWithNoTests: true,
  },
})
```

`src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => cleanup())
```

`.env.example`:

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SITE_URL=http://localhost:3000
# Optional: enables real-email E2E tests once custom SMTP is configured, e.g. delivered+{id}@resend.dev
E2E_SMTP_EMAIL=
```

- [ ] **Step 5: Root dan halaman awal dalam bahasa Indonesia**

`src/routes/__root.tsx` (ganti seluruh isinya):

```tsx
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import type { ReactNode } from "react"

import appCss from "@/styles.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Glosa" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1 className="font-heading text-2xl">404</h1>
      <p>Halaman yang kamu cari tidak ada di perpustakaan ini.</p>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[{ name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> }]}
        />
        <Scripts />
      </body>
    </html>
  )
}
```

`src/routes/index.tsx` (ganti seluruh isinya):

```tsx
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: () => (
    <main>
      <h1>Glosa</h1>
    </main>
  ),
})
```

- [ ] **Step 6: Build, typecheck, lint, test**

Run: `npm run build && npm run typecheck && npm run lint && npm run check && npm test`
Expected: semua lulus. Vitest melaporkan "No test files found" dan keluar dengan kode 0 karena `passWithNoTests`. Jika `check` gagal, jalankan `npm run format` lalu ulangi.

- [ ] **Step 7: Cek server dev**

Run: `npm run dev` (biarkan berjalan), lalu di terminal lain: `curl -s http://localhost:3000 | grep -o "<h1>Glosa</h1>"`
Expected: `<h1>Glosa</h1>`. Hentikan dev server.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: scaffold TanStack Start app from shadcn preset with Vitest"
```

---

### Task 2: Tema Glosa, font, dan latar adegan perpustakaan

**Files:**
- Create: `scripts/extract-lobby-scene.mjs`, `public/lobby/scene.svg` (hasil generate)
- Create: `src/components/scene/scene-state.ts`, `src/components/scene/SceneBackdrop.tsx`
- Test: `src/components/scene/scene-state.test.ts`
- Modify: `src/styles.css`, `src/routes/__root.tsx`, `package.json`

**Interfaces:**
- Produces: `type SceneFocus = "overview" | "admin"`, `type SceneState = { focus: SceneFocus; dim: boolean; blur: boolean }`, `sceneStateFor(pathname: string): SceneState | null`, `<SceneBackdrop />`.
- Token Tailwind: kelas shadcn standar (`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `border-border`, `bg-card`) yang diisi palet Glosa, ditambah token khusus `bg-night-950`, `bg-panel`, `text-mint`/`border-mint`, `bg-paper`, `bg-paper-2`, `text-sepia-ink`, `text-sepia-muted`, `bg-maroon`/`text-maroon`, `text-pen`, `text-stamp`, `font-sans`, `font-heading`, `font-serif`, `font-hand`, `font-type`.

- [ ] **Step 1: Tulis test yang gagal untuk `sceneStateFor`**

`src/components/scene/scene-state.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { sceneStateFor } from "./scene-state"

describe("sceneStateFor", () => {
  it("shows the dimmed overview on the welcome page", () => {
    expect(sceneStateFor("/")).toEqual({ focus: "overview", dim: true, blur: false })
  })

  it.each(["/login", "/register", "/forgot-password", "/reset-password", "/auth/confirm"])(
    "zooms to the admin desk on %s",
    (path) => {
      expect(sceneStateFor(path)).toEqual({ focus: "admin", dim: false, blur: false })
    }
  )

  it("blurs the admin desk behind the membership card", () => {
    expect(sceneStateFor("/welcome")).toEqual({ focus: "admin", dim: true, blur: true })
  })

  it("ignores a trailing slash", () => {
    expect(sceneStateFor("/login/")).toEqual({ focus: "admin", dim: false, blur: false })
  })

  it("has no backdrop on other pages", () => {
    expect(sceneStateFor("/lobby")).toBeNull()
    expect(sceneStateFor("/privacy")).toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/components/scene/scene-state.test.ts`
Expected: FAIL, "Failed to resolve import "./scene-state"".

- [ ] **Step 3: Implementasi `scene-state.ts`**

`src/components/scene/scene-state.ts`:

```ts
export type SceneFocus = "overview" | "admin"
export type SceneState = { focus: SceneFocus; dim: boolean; blur: boolean }

const ADMIN_DESK_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"]

export function sceneStateFor(pathname: string): SceneState | null {
  const path = pathname.replace(/\/+$/, "") || "/"
  if (path === "/") return { focus: "overview", dim: true, blur: false }
  if (ADMIN_DESK_PATHS.includes(path) || path.startsWith("/auth/")) {
    return { focus: "admin", dim: false, blur: false }
  }
  if (path === "/welcome") return { focus: "admin", dim: true, blur: true }
  return null
}
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/components/scene/scene-state.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Ekstrak adegan dari mockup**

`scripts/extract-lobby-scene.mjs`:

```js
// Extracts the placeholder lobby scene from the design mockup into a standalone SVG.
// The final illustration (spec §7) will replace public/lobby/scene.svg.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const html = readFileSync("docs/superpowers/specs/mockups/lobi.html", "utf8")
const match = html.match(
  /<svg width="0" height="0" style="position:absolute">([\s\S]*?)<\/svg>\s*<div class="stage">/
)
if (!match) throw new Error("Scene definitions not found in the lobby mockup")

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">${match[1]}<use href="#scene" width="1600" height="900"/></svg>\n`
mkdirSync("public/lobby", { recursive: true })
writeFileSync("public/lobby/scene.svg", svg)
console.log(`public/lobby/scene.svg (${(svg.length / 1024).toFixed(0)} KB)`)
```

Run: `node scripts/extract-lobby-scene.mjs`
Expected: `public/lobby/scene.svg (… KB)` dengan ukuran sekitar 50–60 KB.

- [ ] **Step 6: Ganti font Inter dengan font Glosa**

```bash
npm uninstall @fontsource-variable/inter
npm install @fontsource/atkinson-hyperlegible @fontsource/libre-caslon-text @fontsource-variable/caveat @fontsource/courier-prime
```

- [ ] **Step 7: Tulis tema Glosa**

Ganti seluruh isi `src/styles.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource/atkinson-hyperlegible/400.css";
@import "@fontsource/atkinson-hyperlegible/700.css";
@import "@fontsource/libre-caslon-text/400.css";
@import "@fontsource/libre-caslon-text/400-italic.css";
@import "@fontsource/libre-caslon-text/700.css";
@import "@fontsource-variable/caveat";
@import "@fontsource/courier-prime/400.css";
@import "@fontsource/courier-prime/700.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: "Atkinson Hyperlegible", system-ui, sans-serif;
  --font-heading: "Libre Caslon Text", Georgia, serif;
  --font-serif: "Libre Caslon Text", Georgia, serif;
  --font-hand: "Caveat Variable", cursive;
  --font-type: "Courier Prime", "Courier New", monospace;
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --color-foreground: var(--foreground);
  --color-background: var(--background);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

/* Glosa-only tokens (library night + paper) */
@theme {
  --color-night-950: #081114;
  --color-panel: rgb(10 28 33 / 0.88);
  --color-mint: #2fe0b8;
  --color-paper: #f6eedb;
  --color-paper-2: #efe4c9;
  --color-sepia-ink: #2b2118;
  --color-sepia-muted: #6d5a44;
  --color-maroon: #7a2e2e;
  --color-pen: #1d3a6b;
  --color-stamp: #b3261e;
}

/* Glosa is a night library: one dark palette fills the shadcn variables. */
:root {
  color-scheme: dark;
  --background: #0b1518;
  --foreground: #e8f2f0;
  --card: #0e2227;
  --card-foreground: #e8f2f0;
  --popover: #0e2227;
  --popover-foreground: #e8f2f0;
  --primary: #1fa58a;
  --primary-foreground: #ffffff;
  --secondary: #16303a;
  --secondary-foreground: #e8f2f0;
  --muted: #132a31;
  --muted-foreground: #8fb0ab;
  --accent: #16303a;
  --accent-foreground: #e8f2f0;
  --destructive: #e5484d;
  --border: rgb(120 210 195 / 0.2);
  --input: rgb(120 210 195 / 0.25);
  --ring: #2fe0b8;
  --chart-1: #2fe0b8;
  --chart-2: #1fa58a;
  --chart-3: #c9a35b;
  --chart-4: #7a2e2e;
  --chart-5: #4fa3c7;
  --radius: 0.625rem;
  --sidebar: #0e2227;
  --sidebar-foreground: #e8f2f0;
  --sidebar-primary: #1fa58a;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #16303a;
  --sidebar-accent-foreground: #e8f2f0;
  --sidebar-border: rgb(120 210 195 / 0.2);
  --sidebar-ring: #2fe0b8;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground antialiased;
  }
  button:not(:disabled),
  [role="button"]:not(:disabled) {
    cursor: pointer;
  }
  html {
    @apply font-sans;
  }
}

/* Library scene backdrop. The canvas is always 16:9 and covers the viewport,
   so focus transforms can be expressed as percentages of the canvas. */
.scene-viewport {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: var(--background);
}
.scene-canvas {
  position: absolute;
  left: 50%;
  top: 50%;
  width: max(100vw, 177.78vh);
  height: max(100vh, 56.25vw);
  translate: -50% -50%;
  transform-origin: 0 0;
  transition:
    transform 800ms cubic-bezier(0.2, 0.7, 0.2, 1),
    filter 400ms ease;
}
/* The admin desk sits at (63%, 69%) of the canvas. Desktop: move it to (25%, 50%). */
.scene-canvas[data-focus="admin"] {
  transform: translate(-164%, -157%) scale(3);
}
/* Phone: move it to (50%, 22%) so the guest book sheet fits below. */
@media (max-width: 767px) {
  .scene-canvas[data-focus="admin"] {
    transform: translate(-139%, -185%) scale(3);
  }
}
.scene-canvas[data-blur="true"] {
  filter: blur(3px) brightness(0.55);
}
.scene-image {
  display: block;
  width: 100%;
  height: 100%;
  user-select: none;
}
.scene-pulse {
  position: absolute;
  left: 61.5%;
  top: 70%;
  width: 5%;
  aspect-ratio: 1;
  translate: -50% -50%;
  border-radius: 9999px;
  border: 2px solid var(--color-mint);
  box-shadow:
    0 0 0 6px rgb(47 224 184 / 0.18),
    0 0 24px rgb(47 224 184 / 0.6);
  animation: scene-pulse 1.8s ease-in-out infinite;
}
@keyframes scene-pulse {
  50% {
    scale: 1.15;
    opacity: 0.6;
  }
}
.scene-dim {
  position: absolute;
  inset: 0;
  background: linear-gradient(rgb(5 12 14 / 0.35), rgb(5 12 14 / 0.7));
}

/* Clicking anywhere skips running animations (spec §6). */
:root[data-skip-anim] *,
:root[data-skip-anim] *::before,
:root[data-skip-anim] *::after {
  animation-duration: 0s !important;
  transition-duration: 0s !important;
}

@media (prefers-reduced-motion: reduce) {
  .scene-canvas {
    transition: none;
  }
  .scene-pulse {
    animation: none;
  }
}
```

- [ ] **Step 8: Buat `SceneBackdrop`**

`src/components/scene/SceneBackdrop.tsx`:

```tsx
import { useLocation } from "@tanstack/react-router"
import { useEffect } from "react"
import { sceneStateFor } from "./scene-state"

export function SceneBackdrop() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const state = sceneStateFor(pathname)
  const hasScene = state !== null

  // Clicking anywhere skips running scene animations for a moment (spec §6).
  useEffect(() => {
    if (!hasScene) return
    const root = document.documentElement
    let timer: ReturnType<typeof setTimeout> | undefined
    const skip = () => {
      root.dataset.skipAnim = "true"
      clearTimeout(timer)
      timer = setTimeout(() => {
        delete root.dataset.skipAnim
      }, 1200)
    }
    window.addEventListener("pointerdown", skip)
    return () => {
      window.removeEventListener("pointerdown", skip)
      clearTimeout(timer)
      delete root.dataset.skipAnim
    }
  }, [hasScene])

  if (!state) return null
  return (
    <div aria-hidden="true" className="scene-viewport">
      <div className="scene-canvas" data-focus={state.focus} data-blur={state.blur}>
        <img src="/lobby/scene.svg" alt="" className="scene-image" draggable={false} />
        {state.focus === "overview" && <span className="scene-pulse" />}
      </div>
      {state.dim && <div className="scene-dim" />}
    </div>
  )
}
```

- [ ] **Step 9: Pasang backdrop di root**

Di `src/routes/__root.tsx`:

1. Tambahkan `Outlet` ke import `@tanstack/react-router`, lalu tambahkan `import { SceneBackdrop } from "@/components/scene/SceneBackdrop"`.
2. Tambahkan `{ name: "theme-color", content: "#0b1518" }` ke array `meta`.
3. Tambahkan `component: RootComponent,` tepat di bawah `shellComponent: RootDocument,`.
4. Tambahkan fungsi berikut di atas `RootDocument`:

```tsx
function RootComponent() {
  return (
    <>
      <SceneBackdrop />
      <div className="relative z-10">
        <Outlet />
      </div>
    </>
  )
}
```

- [ ] **Step 10: Verifikasi visual**

Run: `npm run dev`, buka `http://localhost:3000/`.
Expected: adegan perpustakaan memenuhi layar dalam keadaan redup, ada lingkaran berdenyut di Meja Admin, dan teks "Glosa" ditampilkan dengan font Atkinson Hyperlegible (cek di DevTools → Computed → font-family). Pada lebar 390px tidak ada scroll horizontal. Hentikan dev server.

- [ ] **Step 11: Typecheck, lint, test, commit**

Run: `npm run typecheck && npm run lint && npm run check && npm test`

```bash
git add .
git commit -m "feat: add Glosa theme, self-hosted fonts and library scene backdrop"
```

---

### Task 3: Tabel `profiles` di Supabase Cloud (proyek dev)

**Prasyarat:** langkah manual 1–3 sudah selesai (proyek dev ada, `.env.local` terisi, CLI login dan link).

**Files:**
- Create: `supabase/config.toml` (lewat `supabase init`)
- Create: `supabase/migrations/20261015000100_profiles.sql`
- Create: `vitest.db.config.ts`, `tests/db/setup.ts`, `tests/db/helpers.ts`, `tests/db/profiles.test.ts`
- Create: `src/server/database.types.ts` (digenerate)

**Interfaces:**
- Produces (SQL): tabel `public.profiles` (`id, member_no, username, display_name, avatar_url, plan, storage_limit_bytes, reader_settings, onboarded_at, created_at`), fungsi `public.username_available(candidate text) returns boolean` dan `public.visitors_today() returns integer` (dapat dipanggil `anon`/`authenticated`), trigger `on_auth_user_created`.
- Produces (TS): type `Database` di `src/server/database.types.ts`. Helper test `adminClient()`, `createTestMember(opts)`, `signedInClient(email)`, `deleteTestMembers()`.

- [ ] **Step 1: Inisialisasi dan link (manual pemilik proyek)**

```bash
npx supabase init
npx supabase login
npx supabase link --project-ref <ref-proyek-dev>
```

`supabase init`: jawab "N" untuk pertanyaan VS Code/Deno settings.
Expected: `Finished supabase link.`

- [ ] **Step 2: Konfigurasi dan helper test integrasi**

`vitest.db.config.ts`:

```ts
import { defineConfig } from "vitest/config"

// Integration tests against the Supabase dev project (cloud). Run sequentially.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    setupFiles: ["tests/db/setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
```

`tests/db/setup.ts`:

```ts
import { existsSync } from "node:fs"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")
```

`tests/db/helpers.ts`:

```ts
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/server/database.types"

export const TEST_PASSWORD = "rahasia-123"
const createdIds: Array<string> = []

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name} in .env.local`)
  return value
}

export function adminClient() {
  return createClient<Database>(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function createTestMember(opts: {
  email: string
  metadata?: Record<string, string>
}) {
  const { data, error } = await adminClient().auth.admin.createUser({
    email: opts.email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: opts.metadata ?? {},
  })
  if (error) throw error
  createdIds.push(data.user.id)
  return data.user
}

/** A client signed in as the given member (publishable key, RLS applies). */
export async function signedInClient(email: string) {
  const client = createClient<Database>(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_PUBLISHABLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD })
  if (error) throw error
  return client
}

export async function deleteTestMembers() {
  const admin = adminClient()
  for (const id of createdIds.splice(0)) await admin.auth.admin.deleteUser(id)
}
```

- [ ] **Step 3: Tulis test integrasi yang gagal**

`tests/db/profiles.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { adminClient, createTestMember, deleteTestMembers, signedInClient } from "./helpers"

// Unique per run so tests can share the dev project safely.
const run = Date.now().toString(36)
const aniEmail = `db-ani-${run}@glosa.test`
const budiEmail = `budi.santoso.${run}@glosa.test`
const budiTwinEmail = `Budi.Santoso.${run}@lain.glosa.test`

describe("profiles", () => {
  let aniId = ""
  let budiId = ""
  let budiTwinId = ""

  beforeAll(async () => {
    aniId = (
      await createTestMember({
        email: aniEmail,
        metadata: { username: `ani_${run}`, display_name: "Ani" },
      })
    ).id
    budiId = (await createTestMember({ email: budiEmail, metadata: { full_name: "Budi Santoso" } }))
      .id
    budiTwinId = (await createTestMember({ email: budiTwinEmail })).id
  })

  afterAll(deleteTestMembers)

  async function profileOf(id: string) {
    const { data, error } = await adminClient().from("profiles").select("*").eq("id", id).single()
    if (error) throw error
    return data
  }

  it("takes username and display name from signup metadata", async () => {
    const ani = await profileOf(aniId)
    expect(ani.username).toBe(`ani_${run}`)
    expect(ani.display_name).toBe("Ani")
  })

  it("falls back to the email local part and the Google full_name", async () => {
    const budi = await profileOf(budiId)
    expect(budi.username).toBe(`budisantoso${run}`)
    expect(budi.display_name).toBe("Budi Santoso")
  })

  it("adds a numeric suffix to a taken username", async () => {
    expect((await profileOf(budiTwinId)).username).toBe(`budisantoso${run}1`)
  })

  it("numbers members in signup order and starts them on the free 100 MB plan", async () => {
    const ani = await profileOf(aniId)
    const budi = await profileOf(budiId)
    expect(budi.member_no).toBeGreaterThan(ani.member_no)
    expect(ani.plan).toBe("free")
    expect(ani.storage_limit_bytes).toBe(104857600)
  })

  it("lets a member see and edit only their own profile", async () => {
    const asAni = await signedInClient(aniEmail)
    const { data: visible } = await asAni.from("profiles").select("id")
    expect(visible?.map((row) => row.id)).toEqual([aniId])

    const { error } = await asAni.from("profiles").update({ display_name: "Ani R" }).eq("id", aniId)
    expect(error).toBeNull()
    expect((await profileOf(aniId)).display_name).toBe("Ani R")
  })

  it("does not let a member change their plan or storage limit", async () => {
    const asAni = await signedInClient(aniEmail)
    const plan = await asAni.from("profiles").update({ plan: "pro" }).eq("id", aniId)
    expect(plan.error?.code).toBe("42501")
    const quota = await asAni.from("profiles").update({ storage_limit_bytes: 1 }).eq("id", aniId)
    expect(quota.error?.code).toBe("42501")
    expect((await profileOf(aniId)).plan).toBe("free")
  })

  it("answers whether a username is available", async () => {
    const asAni = await signedInClient(aniEmail)
    const rpc = (candidate: string) => asAni.rpc("username_available", { candidate })
    expect((await rpc(`ani_${run}`)).data).toBe(false)
    expect((await rpc("Bad Name")).data).toBe(false)
    expect((await rpc(`free_${run}`)).data).toBe(true)
  })

  it("counts today's visitors without exposing names", async () => {
    await signedInClient(aniEmail)
    await signedInClient(budiEmail)
    const { data } = await adminClient().rpc("visitors_today")
    expect(data).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 4: Jalankan test dan pastikan gagal**

Supaya import `@/server/database.types` sudah tersedia, buat dulu `src/server/database.types.ts` sementara:

```ts
// Temporary placeholder; replaced by `npm run db:types` in Step 6.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any
```

Run: `npm run test:db`
Expected: FAIL, misalnya pada `profileOf` dengan error "relation "public.profiles" does not exist" atau "Could not find the table 'public.profiles'".

- [ ] **Step 5: Tulis migrasi `profiles`**

`supabase/migrations/20261015000100_profiles.sql`:

```sql
-- Member profiles: one row per auth user, created by a trigger on signup.

create sequence public.member_no_seq start 1;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  member_no bigint not null unique default nextval('public.member_no_seq'),
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  storage_limit_bytes bigint not null default 104857600,
  reader_settings jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

alter sequence public.member_no_seq owned by public.profiles.member_no;

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Members may only touch these columns; plan, quota and member_no stay server-only.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, username, avatar_url, reader_settings, onboarded_at)
  on table public.profiles to authenticated;

create function public.normalize_username(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(regexp_replace(lower(coalesce(raw, '')), '[^a-z0-9_]', '', 'g'), 20)
$$;

create function public.unique_username(base text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  stem text := public.normalize_username(base);
  candidate text;
  suffix int := 0;
begin
  if char_length(stem) < 3 then
    stem := 'pembaca';
  end if;
  candidate := stem;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := left(stem, 20 - char_length(suffix::text)) || suffix::text;
  end loop;
  return candidate;
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  local_part text := split_part(coalesce(new.email, ''), '@', 1);
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    public.unique_username(coalesce(nullif(meta ->> 'username', ''), local_part)),
    left(coalesce(
      nullif(meta ->> 'display_name', ''),
      nullif(meta ->> 'full_name', ''),
      nullif(meta ->> 'name', ''),
      nullif(local_part, ''),
      'Pembaca'
    ), 60),
    nullif(meta ->> 'avatar_url', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate ~ '^[a-z0-9_]{3,20}$'
    and not exists (select 1 from public.profiles where username = candidate)
$$;

-- "Pengunjung hari ini": a bare count, never names (spec §6).
create function public.visitors_today()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from auth.users
  where last_sign_in_at >= (date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta')
$$;

revoke execute on function public.normalize_username(text) from public, anon, authenticated;
revoke execute on function public.unique_username(text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.username_available(text) from public;
revoke execute on function public.visitors_today() from public;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.visitors_today() to anon, authenticated;
```

- [ ] **Step 6: Push migrasi, generate type, jalankan test**

Run: `npm run db:push && npm run db:types && npm run test:db`
Expected: `db push` menerapkan `20261015000100_profiles.sql`. `src/server/database.types.ts` (sekarang hasil generate) memuat `profiles`, `username_available`, dan `visitors_today`. Test: PASS (8 tests), dan user uji terhapus di `afterAll`.

Jika ada test yang gagal karena SQL, **perbaiki dengan migrasi baru** (jangan mengedit migrasi yang sudah di-push), lalu push lagi.

- [ ] **Step 7: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint && npm run check`

```bash
git add supabase vitest.db.config.ts tests src/server/database.types.ts
git commit -m "feat(db): add member profiles with RLS, username helpers and visitor count"
```

---

### Task 4: Logika murni untuk auth dan kartu anggota

**Files:**
- Create: `src/lib/username.ts`, `src/lib/redirects.ts`, `src/lib/auth-messages.ts`, `src/lib/member.ts`, `src/lib/dates.ts`, `src/lib/action-result.ts`, `src/lib/session-types.ts`, `src/lib/site.ts`
- Test: `src/lib/username.test.ts`, `src/lib/redirects.test.ts`, `src/lib/auth-messages.test.ts`, `src/lib/member.test.ts`, `src/lib/dates.test.ts`

**Interfaces:**
- Produces:
  - `USERNAME_MAX = 20`, `type UsernameProblem = "too_short" | "too_long" | "invalid_chars"`, `normalizeUsername(raw: string): string`, `validateUsername(value: string): UsernameProblem | null`, `USERNAME_PROBLEM_TEXT: Record<UsernameProblem, string>`
  - `DEFAULT_MEMBER_PATH = "/lobby"`, `safeNext(next: unknown): string`, `guestRedirect(user: { onboarded: boolean } | null): string | null`, `memberRedirect(user: { onboarded: boolean } | null, pathname: string): string | null`
  - `type AuthMessage = { bubble: string; field: string }`, `authMessage(code: string | null | undefined): AuthMessage`
  - `formatMemberNo(n: number): string`, `formatMemberSince(iso: string): string`, `formatBytes(bytes: number): string`, `planLabel(plan: Plan): string`
  - `formatLongDate(date: Date): string`
  - `type ActionResult = { ok: true } | { ok: false; code: string }`
  - `type Plan = "free" | "pro"`, `toPlan(value: string): Plan`, `type SessionUser`
  - `SITE_NAME`, `SITE_TAGLINE`, `LEGAL_CONTACT_EMAIL`

- [ ] **Step 1: Tulis test yang gagal**

`src/lib/username.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { normalizeUsername, validateUsername } from "./username"

describe("normalizeUsername", () => {
  it("lowercases and strips characters outside a-z, 0-9 and _", () => {
    expect(normalizeUsername("@Yudhis.Dev")).toBe("yudhisdev")
    expect(normalizeUsername("ani_baca 2")).toBe("ani_baca2")
  })

  it("cuts to 20 characters", () => {
    expect(normalizeUsername("a".repeat(25))).toBe("a".repeat(20))
  })
})

describe("validateUsername", () => {
  it("accepts 3-20 lowercase letters, digits and underscores", () => {
    expect(validateUsername("ani_baca2")).toBeNull()
  })

  it("reports each problem", () => {
    expect(validateUsername("ab")).toBe("too_short")
    expect(validateUsername("a".repeat(21))).toBe("too_long")
    expect(validateUsername("Ani")).toBe("invalid_chars")
    expect(validateUsername("ani baca")).toBe("invalid_chars")
  })
})
```

`src/lib/redirects.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { guestRedirect, memberRedirect, safeNext } from "./redirects"

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/settings")).toBe("/settings")
    expect(safeNext("/shelf?genre=anak_remaja")).toBe("/shelf?genre=anak_remaja")
  })

  it("falls back to the lobby for anything else", () => {
    expect(safeNext(undefined)).toBe("/lobby")
    expect(safeNext("https://evil.example")).toBe("/lobby")
    expect(safeNext("//evil.example")).toBe("/lobby")
    expect(safeNext("/\\evil.example")).toBe("/lobby")
    expect(safeNext(42)).toBe("/lobby")
  })
})

describe("guestRedirect", () => {
  it("lets guests stay", () => {
    expect(guestRedirect(null)).toBeNull()
  })

  it("sends onboarded members to the lobby with a welcome-back flag", () => {
    expect(guestRedirect({ onboarded: true })).toBe("/lobby?kembali=1")
  })

  it("sends new members to their membership card", () => {
    expect(guestRedirect({ onboarded: false })).toBe("/welcome")
  })
})

describe("memberRedirect", () => {
  it("sends guests to the guest book, remembering where they were going", () => {
    expect(memberRedirect(null, "/settings")).toBe("/login?next=%2Fsettings")
  })

  it("sends members without a card to /welcome first", () => {
    expect(memberRedirect({ onboarded: false }, "/lobby")).toBe("/welcome")
    expect(memberRedirect({ onboarded: false }, "/welcome")).toBeNull()
  })

  it("keeps onboarded members away from /welcome", () => {
    expect(memberRedirect({ onboarded: true }, "/welcome")).toBe("/lobby")
    expect(memberRedirect({ onboarded: true }, "/settings")).toBeNull()
  })
})
```

`src/lib/auth-messages.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { authMessage } from "./auth-messages"

describe("authMessage", () => {
  it("speaks as the librarian for known codes", () => {
    expect(authMessage("invalid_credentials").bubble).toContain("belum cocok")
    expect(authMessage("invalid_credentials").field).toBe("Email atau kata sandi salah.")
  })

  it("falls back to a generic message", () => {
    expect(authMessage("something_new").field).toBe("Terjadi kesalahan. Coba lagi.")
    expect(authMessage(undefined).field).toBe("Terjadi kesalahan. Coba lagi.")
  })
})
```

`src/lib/member.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { formatBytes, formatMemberNo, formatMemberSince, planLabel } from "./member"

describe("member formatting", () => {
  it("pads member numbers to six digits", () => {
    expect(formatMemberNo(342)).toBe("000342")
    expect(formatMemberNo(1234567)).toBe("1234567")
  })

  it("shows the month and year in Indonesian, Jakarta time", () => {
    expect(formatMemberSince("2026-10-15T03:00:00Z")).toBe("Okt 2026")
    expect(formatMemberSince("2026-10-31T20:00:00Z")).toBe("Nov 2026")
  })

  it("formats storage sizes", () => {
    expect(formatBytes(104857600)).toBe("100 MB")
    expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe("5 GB")
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB")
  })

  it("labels plans", () => {
    expect(planLabel("free")).toBe("GRATIS")
    expect(planLabel("pro")).toBe("PRO")
  })
})
```

`src/lib/dates.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { formatLongDate } from "./dates"

describe("formatLongDate", () => {
  it("writes the date the way a guest book would, in Jakarta time", () => {
    expect(formatLongDate(new Date("2026-10-15T03:00:00Z"))).toBe("Kamis, 15 Oktober 2026")
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/lib`
Expected: FAIL. Lima file test gagal karena modulnya belum ada.

- [ ] **Step 3: Implementasi modul-modul**

`src/lib/username.ts`:

```ts
export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

export type UsernameProblem = "too_short" | "too_long" | "invalid_chars"

export function normalizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, USERNAME_MAX)
}

export function validateUsername(value: string): UsernameProblem | null {
  if (/[^a-z0-9_]/.test(value)) return "invalid_chars"
  if (value.length < USERNAME_MIN) return "too_short"
  if (value.length > USERNAME_MAX) return "too_long"
  return null
}

export const USERNAME_PROBLEM_TEXT: Record<UsernameProblem, string> = {
  too_short: "Minimal 3 karakter.",
  too_long: "Maksimal 20 karakter.",
  invalid_chars: "Hanya huruf kecil, angka, dan garis bawah (_).",
}
```

`src/lib/redirects.ts`:

```ts
export const DEFAULT_MEMBER_PATH = "/lobby"

type AuthState = { onboarded: boolean } | null

/** Only same-site absolute paths are allowed as post-login destinations. */
export function safeNext(next: unknown): string {
  if (typeof next !== "string") return DEFAULT_MEMBER_PATH
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_MEMBER_PATH
  }
  return next
}

/** For guest-only pages (/, /login, /register, /forgot-password). */
export function guestRedirect(user: AuthState): string | null {
  if (!user) return null
  return user.onboarded ? `${DEFAULT_MEMBER_PATH}?kembali=1` : "/welcome"
}

/** For pages under the _member layout. */
export function memberRedirect(user: AuthState, pathname: string): string | null {
  if (!user) return `/login?next=${encodeURIComponent(pathname)}`
  if (!user.onboarded && pathname !== "/welcome") return "/welcome"
  if (user.onboarded && pathname === "/welcome") return DEFAULT_MEMBER_PATH
  return null
}
```

`src/lib/auth-messages.ts`:

```ts
export type AuthMessage = { bubble: string; field: string }

const MESSAGES: Record<string, AuthMessage> = {
  invalid_credentials: {
    bubble: "Hmm, email atau kata sandinya belum cocok. Coba lagi, ya.",
    field: "Email atau kata sandi salah.",
  },
  email_not_confirmed: {
    bubble: "Surat konfirmasimu belum dibuka. Cek kotak masuk emailmu dulu, ya.",
    field: "Email belum dikonfirmasi.",
  },
  user_already_exists: {
    bubble: "Sepertinya email ini sudah terdaftar. Coba masuk saja.",
    field: "Email sudah terdaftar.",
  },
  email_address_invalid: {
    bubble: "Alamat email itu sepertinya keliru.",
    field: "Format email tidak valid.",
  },
  email_address_not_authorized: {
    bubble: "Meja admin belum bisa mengirim surat ke alamat itu. Coba alamat lain, ya.",
    field: "Email belum bisa menerima surat dari kami.",
  },
  weak_password: {
    bubble: "Kata sandinya terlalu mudah ditebak. Pakai minimal 8 karakter, ya.",
    field: "Kata sandi minimal 8 karakter.",
  },
  same_password: {
    bubble: "Kata sandi baru harus berbeda dari yang lama.",
    field: "Gunakan kata sandi yang berbeda.",
  },
  password_mismatch: {
    bubble: "Dua kata sandi yang kamu tulis belum sama.",
    field: "Kata sandi tidak sama.",
  },
  over_email_send_rate_limit: {
    bubble: "Terlalu banyak surat terkirim. Tunggu sebentar sebelum mencoba lagi.",
    field: "Coba lagi beberapa menit lagi.",
  },
  over_request_rate_limit: {
    bubble: "Meja admin sedang ramai. Tunggu sebentar, ya.",
    field: "Coba lagi beberapa menit lagi.",
  },
  otp_expired: {
    bubble: "Tautan di suratmu sudah kedaluwarsa atau sudah dipakai. Minta surat baru, ya.",
    field: "Tautan kedaluwarsa.",
  },
  username_taken: {
    bubble: "Nama pengguna itu sudah dipakai anggota lain.",
    field: "Nama pengguna sudah dipakai.",
  },
  username_invalid: {
    bubble: "Nama pengguna hanya boleh huruf kecil, angka, dan garis bawah (3–20 karakter).",
    field: "3–20 karakter: huruf kecil, angka, _",
  },
  display_name_invalid: {
    bubble: "Tulis namamu dulu, maksimal 60 karakter.",
    field: "Nama wajib diisi (maks. 60 karakter).",
  },
  terms_required: {
    bubble: "Sebelum jadi anggota, setujui tata tertib perpustakaan dulu, ya.",
    field: "Centang persetujuan tata tertib.",
  },
  confirm_mismatch: {
    bubble: "Nama pengguna yang kamu ketik belum sama.",
    field: "Ketik nama penggunamu persis.",
  },
  not_authenticated: {
    bubble: "Sesimu sudah berakhir. Silakan isi buku tamu lagi.",
    field: "Silakan masuk lagi.",
  },
}

const FALLBACK: AuthMessage = {
  bubble: "Maaf, ada gangguan di meja admin. Coba lagi sebentar lagi.",
  field: "Terjadi kesalahan. Coba lagi.",
}

export function authMessage(code: string | null | undefined): AuthMessage {
  return (code && MESSAGES[code]) || FALLBACK
}
```

`src/lib/session-types.ts`:

```ts
export type Plan = "free" | "pro"

export function toPlan(value: string): Plan {
  return value === "pro" ? "pro" : "free"
}

export type SessionUser = {
  id: string
  email: string
  /** "email" or an OAuth provider such as "google". */
  provider: string
  username: string
  displayName: string
  memberNo: number
  plan: Plan
  storageLimitBytes: number
  memberSince: string
  onboarded: boolean
}
```

`src/lib/member.ts`:

```ts
import type { Plan } from "./session-types"

export function formatMemberNo(n: number): string {
  return String(n).padStart(6, "0")
}

const MONTH_YEAR = new Intl.DateTimeFormat("id-ID", {
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
})

export function formatMemberSince(iso: string): string {
  return MONTH_YEAR.format(new Date(iso)).replace(".", "")
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return `${Number((mb / 1024).toFixed(1))} GB`
  return `${Math.round(mb)} MB`
}

export function planLabel(plan: Plan): string {
  return plan === "pro" ? "PRO" : "GRATIS"
}
```

`src/lib/dates.ts`:

```ts
const LONG_DATE = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
})

export function formatLongDate(date: Date): string {
  return LONG_DATE.format(date)
}
```

`src/lib/action-result.ts`:

```ts
/** Result of a server action. `code` is looked up with authMessage(). */
export type ActionResult = { ok: true } | { ok: false; code: string }
```

`src/lib/site.ts`:

```ts
export const SITE_NAME = "Glosa"
export const SITE_TAGLINE = "Baca buku aslinya, pahami setiap katanya."
/** Contact address shown on legal pages. Update once the domain is registered (spec §15). */
export const LEGAL_CONTACT_EMAIL = "halo@glosa.app"
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/lib`
Expected: PASS untuk semua file di `src/lib`.

- [ ] **Step 5: Lint dan commit**

Run: `npm run typecheck && npm run lint && npm run check`

```bash
git add src/lib
git commit -m "feat: add username, redirect, auth message and member formatting helpers"
```

---

### Task 5: Klien Supabase, sesi, dan kerangka rute

**Files:**
- Create: `src/server/supabase.ts`, `src/server/session.ts`
- Create (kerangka sederhana, diisi penuh di task berikutnya): `src/routes/login.tsx`, `src/routes/register.tsx`, `src/routes/forgot-password.tsx`, `src/routes/reset-password.tsx`, `src/routes/logout.tsx`, `src/routes/privacy.tsx`, `src/routes/terms.tsx`, `src/routes/auth/callback.tsx`, `src/routes/auth/confirm.tsx`, `src/routes/_member.tsx`, `src/routes/_member/welcome.tsx`, `src/routes/_member/lobby.tsx`, `src/routes/_member/settings.tsx`
- Modify: `src/routes/__root.tsx`, `src/routes/index.tsx`

**Interfaces:**
- Consumes: `Database` (Task 3), `SessionUser`, `toPlan`, `guestRedirect`, `memberRedirect` (Task 4).
- Produces: `getSupabaseServerClient()`, `getSupabaseAdminClient()`, `siteUrl(): string`, `getSessionUserFn` (server fn GET → `SessionUser | null`). Context router: `context.user: SessionUser | null` di semua rute, dan `context.user: SessionUser` (non-null) di bawah `_member`.

- [ ] **Step 1: Klien Supabase server**

`src/server/supabase.ts`:

```ts
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { getCookies, setCookie } from "@tanstack/react-start/server"
import type { Database } from "./database.types"

type ServerEnvName =
  | "SUPABASE_URL"
  | "SUPABASE_PUBLISHABLE_KEY"
  | "SUPABASE_SECRET_KEY"
  | "SITE_URL"

function requireEnv(name: ServerEnvName): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

export function siteUrl(): string {
  return requireEnv("SITE_URL").replace(/\/+$/, "")
}

/** Per-request client acting as the signed-in member (cookie session, RLS applies). */
export function getSupabaseServerClient() {
  return createServerClient<Database>(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll() {
          return Object.entries(getCookies()).map(([name, value]) => ({ name, value }))
        },
        setAll(cookies) {
          for (const cookie of cookies) {
            // Options (path, maxAge, sameSite…) must be forwarded, otherwise the
            // session cookie is scoped to the current path only.
            setCookie(cookie.name, cookie.value, cookie.options as Parameters<typeof setCookie>[2])
          }
        },
      },
    }
  )
}

/** Service-role client. Bypasses RLS — server-only, never expose to the client. */
export function getSupabaseAdminClient() {
  return createClient<Database>(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

- [ ] **Step 2: Server function sesi**

`src/server/session.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import { type SessionUser, toPlan } from "@/lib/session-types"
import { getSupabaseServerClient } from "./supabase"

export const getSessionUserFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "username, display_name, member_no, plan, storage_limit_bytes, created_at, onboarded_at"
      )
      .eq("id", user.id)
      .single()
    if (!profile) return null

    return {
      id: user.id,
      email: user.email ?? "",
      provider: (user.app_metadata.provider as string | undefined) ?? "email",
      username: profile.username,
      displayName: profile.display_name,
      memberNo: profile.member_no,
      plan: toPlan(profile.plan),
      storageLimitBytes: profile.storage_limit_bytes,
      memberSince: profile.created_at,
      onboarded: profile.onboarded_at !== null,
    }
  }
)
```

- [ ] **Step 3: Muat sesi di root route**

Di `src/routes/__root.tsx`, tambahkan `import { getSessionUserFn } from "@/server/session"`, lalu tambahkan baris berikut sebagai properti pertama di `createRootRoute({ … })`:

```tsx
  beforeLoad: async () => ({ user: await getSessionUserFn() }),
```

- [ ] **Step 4: Layout penjaga anggota**

`src/routes/_member.tsx`:

```tsx
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { memberRedirect } from "@/lib/redirects"

export const Route = createFileRoute("/_member")({
  beforeLoad: ({ context, location }) => {
    const target = memberRedirect(context.user, location.pathname)
    if (target || !context.user) throw redirect({ href: target ?? "/login" })
    return { user: context.user }
  },
  component: Outlet,
})
```

- [ ] **Step 5: Kerangka rute**

`src/routes/index.tsx` (ganti seluruh isinya):

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router"
import { guestRedirect } from "@/lib/redirects"

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    const target = guestRedirect(context.user)
    if (target) throw redirect({ href: target })
  },
  component: () => (
    <main>
      <h1>Selamat datang di Glosa</h1>
    </main>
  ),
})
```

Buat file-file berikut. Semuanya memakai bentuk yang sama, hanya path dan judulnya yang berbeda:

```tsx
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("<PATH>")({
  component: () => (
    <main>
      <h1><JUDUL></h1>
    </main>
  ),
})
```

| File | `<PATH>` | `<JUDUL>` |
|---|---|---|
| `src/routes/login.tsx` | `/login` | Buku Tamu |
| `src/routes/register.tsx` | `/register` | Formulir Anggota |
| `src/routes/forgot-password.tsx` | `/forgot-password` | Lupa Kata Sandi |
| `src/routes/reset-password.tsx` | `/reset-password` | Kata Sandi Baru |
| `src/routes/logout.tsx` | `/logout` | Keluar |
| `src/routes/privacy.tsx` | `/privacy` | Kebijakan Privasi |
| `src/routes/terms.tsx` | `/terms` | Syarat Layanan |
| `src/routes/auth/callback.tsx` | `/auth/callback` | Memproses… |
| `src/routes/auth/confirm.tsx` | `/auth/confirm` | Memproses… |
| `src/routes/_member/welcome.tsx` | `/_member/welcome` | Kartu Anggota |
| `src/routes/_member/lobby.tsx` | `/_member/lobby` | Lobi |
| `src/routes/_member/settings.tsx` | `/_member/settings` | Pengaturan |

- [ ] **Step 6: Verifikasi penjaga rute**

Run: `npm run dev`, lalu `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/lobby`
Expected: kode 3xx dengan redirect ke `http://localhost:3000/login?next=%2Flobby`. Hentikan dev server.

- [ ] **Step 7: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint && npm run check`

```bash
git add src
git commit -m "feat: load member session into router context and guard member routes"
```

---

### Task 6: Server function auth, template email, dan rute tautan

**Files:**
- Create: `src/server/auth.ts`, `src/server/profile.ts`, `src/components/auth/LinkFailed.tsx`
- Create: `supabase/templates/confirmation.html`, `supabase/templates/recovery.html`
- Modify: `src/routes/auth/callback.tsx`, `src/routes/auth/confirm.tsx`, `src/routes/logout.tsx`

**Interfaces:**
- Consumes: `getSupabaseServerClient`, `getSupabaseAdminClient`, `siteUrl` (Task 5), `ActionResult`, `validateUsername`, `UsernameProblem`, `authMessage` (Task 4).
- Produces (semua `createServerFn`, dipanggil `fn({ data })`):
  - `type ConfirmType = "email" | "signup" | "magiclink" | "recovery"`
  - `signInFn({ email, password }) → ActionResult`
  - `signUpFn({ email, password, username, displayName, acceptedTerms }) → ActionResult`
  - `googleSignInFn() → { ok: true; url: string } | { ok: false; code: string }`
  - `requestPasswordResetFn({ email }) → ActionResult`
  - `updatePasswordFn({ password }) → ActionResult`
  - `exchangeCodeFn({ code }) → ActionResult`
  - `verifyOtpFn({ tokenHash, type: ConfirmType }) → ActionResult`
  - `signOutFn()` (melempar redirect ke `/`)
  - `checkUsernameFn({ username }) → { available: boolean; problem: UsernameProblem | null }`
  - `visitorsTodayFn() → number`
  - `completeOnboardingFn({ username?: string }) → ActionResult`
  - `updateProfileFn({ displayName, username }) → ActionResult`
  - `deleteAccountFn({ confirmUsername }) → ActionResult`

- [ ] **Step 1: Template email (bahasa Indonesia)**

`supabase/templates/confirmation.html` (subjek: **Konfirmasi keanggotaan Glosa**):

```html
<h2>Selamat datang di Glosa</h2>
<p>Terima kasih sudah mengisi formulir anggota. Satu langkah lagi untuk menerima kartu anggotamu:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Konfirmasi keanggotaan</a></p>
<p>Jika kamu tidak merasa mendaftar, abaikan surat ini.</p>
```

`supabase/templates/recovery.html` (subjek: **Atur ulang kata sandi Glosa**):

```html
<h2>Atur ulang kata sandi Glosa</h2>
<p>Seseorang meminta untuk mengatur ulang kata sandi akunmu. Jika itu kamu, buka tautan berikut:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Buat kata sandi baru</a></p>
<p>Jika bukan kamu, abaikan surat ini. Kata sandimu tidak berubah.</p>
```

- [ ] **Step 2: Pengaturan Auth di dashboard (manual pemilik proyek)**

Minta pemilik proyek mengerjakan **langkah manual 4** (URL, Confirm email, panjang sandi minimal 8, dan dua template di atas). Tunggu konfirmasi sebelum lanjut.

- [ ] **Step 3: `src/server/auth.ts`**

```ts
import { redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { ActionResult } from "@/lib/action-result"
import { validateUsername } from "@/lib/username"
import { getSupabaseServerClient, siteUrl } from "./supabase"

export type ConfirmType = "email" | "signup" | "magiclink" | "recovery"

const Email = z.email()

function fail(code: string | undefined): ActionResult {
  return { ok: false, code: code ?? "unknown" }
}

export const signInFn = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!Email.safeParse(data.email).success || data.password.length === 0) {
      return fail("invalid_credentials")
    }
    const { error } = await getSupabaseServerClient().auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    return error ? fail(error.code) : { ok: true }
  })

export const signUpFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      email: string
      password: string
      username: string
      displayName: string
      acceptedTerms: boolean
    }) => data
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const displayName = data.displayName.trim()
    if (displayName.length === 0 || displayName.length > 60) return fail("display_name_invalid")
    if (validateUsername(data.username)) return fail("username_invalid")
    if (!Email.safeParse(data.email).success) return fail("email_address_invalid")
    if (data.password.length < 8) return fail("weak_password")
    if (!data.acceptedTerms) return fail("terms_required")

    const supabase = getSupabaseServerClient()
    const { data: available } = await supabase.rpc("username_available", {
      candidate: data.username,
    })
    if (!available) return fail("username_taken")

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { username: data.username, display_name: displayName } },
    })
    return error ? fail(error.code) : { ok: true }
  })

export const googleSignInFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true; url: string } | { ok: false; code: string }> => {
    const { data, error } = await getSupabaseServerClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${siteUrl()}/auth/callback` },
    })
    if (error || !data.url) return { ok: false, code: error?.code ?? "unknown" }
    return { ok: true, url: data.url }
  }
)

export const requestPasswordResetFn = createServerFn({ method: "POST" })
  .validator((data: { email: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!Email.safeParse(data.email).success) return fail("email_address_invalid")
    const { error } = await getSupabaseServerClient().auth.resetPasswordForEmail(data.email)
    // Never reveal whether the address is registered; only surface rate limits.
    if (error?.code?.startsWith("over_")) return fail(error.code)
    return { ok: true }
  })

export const updatePasswordFn = createServerFn({ method: "POST" })
  .validator((data: { password: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    if (data.password.length < 8) return fail("weak_password")
    const { error } = await getSupabaseServerClient().auth.updateUser({ password: data.password })
    return error ? fail(error.code) : { ok: true }
  })

export const exchangeCodeFn = createServerFn({ method: "POST" })
  .validator((data: { code: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!data.code) return fail("otp_expired")
    const { error } = await getSupabaseServerClient().auth.exchangeCodeForSession(data.code)
    return error ? fail(error.code ?? "otp_expired") : { ok: true }
  })

export const verifyOtpFn = createServerFn({ method: "POST" })
  .validator((data: { tokenHash: string; type: ConfirmType }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!data.tokenHash) return fail("otp_expired")
    const { error } = await getSupabaseServerClient().auth.verifyOtp({
      type: data.type,
      token_hash: data.tokenHash,
    })
    return error ? fail(error.code ?? "otp_expired") : { ok: true }
  })

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  await getSupabaseServerClient().auth.signOut()
  throw redirect({ href: "/" })
})
```

- [ ] **Step 4: `src/server/profile.ts`**

```ts
import { createServerFn } from "@tanstack/react-start"
import type { ActionResult } from "@/lib/action-result"
import { type UsernameProblem, validateUsername } from "@/lib/username"
import { getSupabaseAdminClient, getSupabaseServerClient } from "./supabase"

const UNIQUE_VIOLATION = "23505"

export const checkUsernameFn = createServerFn({ method: "GET" })
  .validator((data: { username: string }) => data)
  .handler(async ({ data }): Promise<{ available: boolean; problem: UsernameProblem | null }> => {
    const problem = validateUsername(data.username)
    if (problem) return { available: false, problem }
    const { data: available } = await getSupabaseServerClient().rpc("username_available", {
      candidate: data.username,
    })
    return { available: available === true, problem: null }
  })

export const visitorsTodayFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<number> => {
    const { data } = await getSupabaseServerClient().rpc("visitors_today")
    return data ?? 0
  }
)

export const completeOnboardingFn = createServerFn({ method: "POST" })
  .validator((data: { username?: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, code: "not_authenticated" }

    const patch: { onboarded_at: string; username?: string } = {
      onboarded_at: new Date().toISOString(),
    }
    if (data.username !== undefined) {
      if (validateUsername(data.username)) return { ok: false, code: "username_invalid" }
      patch.username = data.username
    }
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id)
    if (error) {
      return { ok: false, code: error.code === UNIQUE_VIOLATION ? "username_taken" : "unknown" }
    }
    return { ok: true }
  })

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator((data: { displayName: string; username: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    const displayName = data.displayName.trim()
    if (displayName.length === 0 || displayName.length > 60) {
      return { ok: false, code: "display_name_invalid" }
    }
    if (validateUsername(data.username)) return { ok: false, code: "username_invalid" }

    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, code: "not_authenticated" }

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, username: data.username })
      .eq("id", user.id)
    if (error) {
      return { ok: false, code: error.code === UNIQUE_VIOLATION ? "username_taken" : "unknown" }
    }
    return { ok: true }
  })

export const deleteAccountFn = createServerFn({ method: "POST" })
  .validator((data: { confirmUsername: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, code: "not_authenticated" }

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single()
    if (!profile || profile.username !== data.confirmUsername.trim()) {
      return { ok: false, code: "confirm_mismatch" }
    }

    // Plan 1B adds: remove the member's Storage objects before deleting the user.
    const { error } = await getSupabaseAdminClient().auth.admin.deleteUser(user.id)
    if (error) return { ok: false, code: "unknown" }

    // The user no longer exists server-side; just clear the session cookies.
    await supabase.auth.signOut({ scope: "local" })
    return { ok: true }
  })
```

- [ ] **Step 5: Panel "tautan tidak berlaku" dan rute tautan**

`src/components/auth/LinkFailed.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import { authMessage } from "@/lib/auth-messages"

export function LinkFailed({ code }: { code: string }) {
  const message = authMessage(code)
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl border bg-panel p-6 text-center backdrop-blur-md">
        <h1 className="font-heading text-2xl font-bold">Tautan tidak berlaku</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message.bubble}</p>
        <div className="mt-6 flex justify-center gap-4 text-sm">
          <Link to="/login" className="text-mint underline">
            Ke buku tamu
          </Link>
          <Link to="/forgot-password" className="text-mint underline">
            Minta surat baru
          </Link>
        </div>
      </div>
    </main>
  )
}
```

`src/routes/auth/confirm.tsx` (ganti seluruh isinya):

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router"
import { LinkFailed } from "@/components/auth/LinkFailed"
import { type ConfirmType, verifyOtpFn } from "@/server/auth"

const CONFIRM_TYPES: Array<ConfirmType> = ["email", "signup", "magiclink", "recovery"]

type ConfirmSearch = { token_hash: string; type: ConfirmType }

export const Route = createFileRoute("/auth/confirm")({
  validateSearch: (search: Record<string, unknown>): ConfirmSearch => ({
    token_hash: typeof search.token_hash === "string" ? search.token_hash : "",
    type: CONFIRM_TYPES.find((type) => type === search.type) ?? "email",
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const result = await verifyOtpFn({ data: { tokenHash: deps.token_hash, type: deps.type } })
    if (result.ok) {
      throw redirect({ href: deps.type === "recovery" ? "/reset-password" : "/welcome" })
    }
    return result
  },
  component: ConfirmFailed,
})

function ConfirmFailed() {
  const result = Route.useLoaderData()
  return <LinkFailed code={result.ok ? "unknown" : result.code} />
}
```

`src/routes/auth/callback.tsx` (ganti seluruh isinya):

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router"
import { LinkFailed } from "@/components/auth/LinkFailed"
import { exchangeCodeFn } from "@/server/auth"

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>): { code: string } => ({
    code: typeof search.code === "string" ? search.code : "",
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const result = await exchangeCodeFn({ data: { code: deps.code } })
    // The _member guard sends already-onboarded members on to the lobby.
    if (result.ok) throw redirect({ href: "/welcome" })
    return result
  },
  component: CallbackFailed,
})

function CallbackFailed() {
  const result = Route.useLoaderData()
  return <LinkFailed code={result.ok ? "unknown" : result.code} />
}
```

`src/routes/logout.tsx` (ganti seluruh isinya):

```tsx
import { createFileRoute } from "@tanstack/react-router"
import { signOutFn } from "@/server/auth"

export const Route = createFileRoute("/logout")({
  preload: false,
  loader: () => signOutFn(),
})
```

- [ ] **Step 6: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint && npm run check`
Expected: semua lulus. Alur ini diuji end-to-end di Task 14.

```bash
git add src supabase/templates
git commit -m "feat(auth): add auth and profile server functions, email templates and link routes"
```

---

### Task 7: Komponen UI dasar dan komponen buku tamu

**Files:**
- Modify: `src/components/ui/button.tsx` (tambah varian `ink`, `paper` dan ukuran `block`), `src/styles.css`
- Create: `src/components/ui/panel.tsx`, `src/components/ui/logo.tsx`
- Create: `src/components/auth/LibrarianBubble.tsx`, `src/components/auth/PaperField.tsx`, `src/components/auth/GuestBook.tsx`, `src/components/auth/AdminDesk.tsx`, `src/components/auth/GoogleButton.tsx`
- Test: `src/components/ui/button.test.tsx`, `src/components/auth/PaperField.test.tsx`, `src/components/auth/LibrarianBubble.test.tsx`

**Interfaces:**
- Consumes: `cn` dari `@/lib/utils`, `googleSignInFn` (Task 6).
- Produces:
  - `buttonVariants({ variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link" | "ink" | "paper", size?: … | "block" })`, `<Button variant? size? …/>`
  - `<Panel className? …divProps />`, `<Logo className? />`
  - `<LibrarianBubble tone?: "info" | "error">children</LibrarianBubble>` (info → `<output>`, error → `role="alert"`)
  - `<PaperField label error? hint? …inputProps />`
  - `<GuestBook aside?>children</GuestBook>`, `<PaperDivider>children</PaperDivider>`
  - `<AdminDesk bubble>children</AdminDesk>`
  - `<GoogleButton label />`

- [ ] **Step 1: Tulis test yang gagal**

`src/components/ui/button.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Button } from "./button"

describe("Button", () => {
  it("has a guest-book ink variant and a full-width block size", () => {
    render(
      <Button variant="ink" size="block">
        Tanda tangan & masuk
      </Button>
    )
    const button = screen.getByRole("button", { name: "Tanda tangan & masuk" })
    expect(button.className).toContain("bg-maroon")
    expect(button.className).toContain("w-full")
  })
})
```

`src/components/auth/PaperField.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PaperField } from "./PaperField"

describe("PaperField", () => {
  it("labels its input", () => {
    render(<PaperField label="Email" name="email" type="email" autoComplete="email" />)
    const input = screen.getByLabelText("Email")
    expect(input).toHaveAttribute("autocomplete", "email")
    expect(input).not.toHaveAttribute("aria-invalid")
  })

  it("links the error message to the input", () => {
    render(<PaperField label="Email" name="email" error="Format email tidak valid." />)
    const input = screen.getByLabelText("Email")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAccessibleDescription("Format email tidak valid.")
  })

  it("shows a hint when there is no error", () => {
    render(<PaperField label="Nama pengguna" name="username" hint="Nama pengguna tersedia ✓" />)
    expect(screen.getByLabelText("Nama pengguna")).toHaveAccessibleDescription(
      "Nama pengguna tersedia ✓"
    )
  })
})
```

`src/components/auth/LibrarianBubble.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { LibrarianBubble } from "./LibrarianBubble"

describe("LibrarianBubble", () => {
  it("is a polite status by default", () => {
    render(<LibrarianBubble>Silakan isi buku tamu, ya.</LibrarianBubble>)
    expect(screen.getByRole("status")).toHaveTextContent("Petugas perpustakaan")
  })

  it("becomes an alert for errors", () => {
    render(<LibrarianBubble tone="error">Kata sandinya belum cocok.</LibrarianBubble>)
    expect(screen.getByRole("alert")).toHaveTextContent("Kata sandinya belum cocok.")
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/components`
Expected: FAIL. `button.test.tsx` gagal karena varian `ink` belum ada, dan dua test lain gagal karena modulnya belum ada.

- [ ] **Step 3: Tambah varian tombol**

Di `src/components/ui/button.tsx`, objek `variant` di dalam `cva(...)`: tambahkan dua baris ini tepat setelah baris `link: "text-primary underline-offset-4 hover:underline",`:

```ts
        ink: "bg-maroon text-paper tracking-wide hover:bg-maroon/90",
        paper: "border-[#d9cba9] bg-white text-sepia-ink hover:bg-paper",
```

Di objek `size`, tambahkan baris ini tepat setelah baris `"icon-lg": …`:

```ts
        block:
          "h-10 w-full gap-2 px-4 text-sm font-bold [&_svg:not([class*='size-'])]:size-4",
```

- [ ] **Step 4: Implementasi komponen**

`src/components/ui/panel.tsx`:

```tsx
import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function Panel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-2xl border bg-panel shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md",
        className
      )}
    />
  )
}
```

`src/components/ui/logo.tsx`:

```tsx
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path
        d="M20 6 L34 12 V30 L20 36 L6 30 V12 Z"
        fill="#0f3a36"
        stroke="#2fe0b8"
        strokeWidth="1.5"
      />
      <path d="M12 15 h7 v14 h-7 z M21 15 h7 v14 h-7 z" fill="#e8f1f0" />
    </svg>
  )
}
```

`src/components/auth/LibrarianBubble.tsx`:

```tsx
import type { ReactNode } from "react"

export function LibrarianBubble({
  children,
  tone = "info",
}: {
  children: ReactNode
  tone?: "info" | "error"
}) {
  const content = (
    <>
      <b className="block text-[11px] text-[#1f6f63]">Petugas perpustakaan</b>
      {children}
    </>
  )
  if (tone === "error") {
    return (
      <div role="alert" className="librarian-bubble">
        {content}
      </div>
    )
  }
  // <output> carries the implicit "status" role (polite live region).
  return <output className="librarian-bubble block">{content}</output>
}
```

`src/components/auth/PaperField.tsx`:

```tsx
import { type ComponentProps, useId } from "react"
import { cn } from "@/lib/utils"

type Props = ComponentProps<"input"> & { label: string; error?: string; hint?: string }

export function PaperField({ label, error, hint, id, className, ...props }: Props) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const noteId = `${inputId}-note`
  const note = error ?? hint

  return (
    <div className={cn("mb-3", className)}>
      <label htmlFor={inputId} className="block text-xs text-sepia-muted">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className="w-full border-0 border-b-[1.5px] border-[#8b7556] bg-transparent px-0.5 pt-0.5 font-hand text-xl text-pen outline-none placeholder:text-[#b9a983] focus:border-pen"
        {...props}
      />
      {note && (
        <p id={noteId} className={cn("mt-1 text-xs", error ? "text-stamp" : "text-sepia-muted")}>
          {note}
        </p>
      )}
    </div>
  )
}
```

`src/components/auth/GuestBook.tsx`:

```tsx
import type { ReactNode } from "react"

export function GuestBook({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="guestbook">
      {aside && <section className="guestbook-page guestbook-left hidden md:block">{aside}</section>}
      <section className="guestbook-page guestbook-right">{children}</section>
    </div>
  )
}

export function PaperDivider({ children }: { children: ReactNode }) {
  return (
    <div className="my-2 flex items-center gap-2 text-xs text-[#8b7556] before:h-px before:flex-1 before:bg-[#cdb991] after:h-px after:flex-1 after:bg-[#cdb991]">
      {children}
    </div>
  )
}
```

`src/components/auth/AdminDesk.tsx`:

```tsx
import type { ReactNode } from "react"

/** Lays a page out in front of the zoomed-in admin desk (see .scene-canvas[data-focus="admin"]). */
export function AdminDesk({ bubble, children }: { bubble: ReactNode; children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col justify-end p-3 pt-28 md:flex-row md:items-center md:justify-end md:p-8">
      <div className="absolute top-4 left-4 max-w-[17rem] md:top-[14%] md:left-[6%]">{bubble}</div>
      <div className="w-full md:w-[min(62vw,52rem)]">{children}</div>
    </main>
  )
}
```

`src/components/auth/GoogleButton.tsx`:

```tsx
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { googleSignInFn } from "@/server/auth"

export function GoogleButton({ label }: { label: string }) {
  const startGoogle = useServerFn(googleSignInFn)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function onClick() {
    setPending(true)
    setFailed(false)
    const result = await startGoogle()
    if (result.ok) {
      window.location.assign(result.url)
      return
    }
    setPending(false)
    setFailed(true)
  }

  return (
    <>
      <Button type="button" variant="paper" size="block" onClick={onClick} disabled={pending}>
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#FFC107"
            d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
          />
          <path
            fill="#FF3D00"
            d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"
          />
        </svg>
        {label}
      </Button>
      {failed && (
        <p role="alert" className="mt-1 text-xs text-stamp">
          Login Google belum bisa dipakai. Coba lagi nanti.
        </p>
      )}
    </>
  )
}
```

Tambahkan ke akhir `src/styles.css`:

```css
/* Librarian speech bubble */
.librarian-bubble {
  position: relative;
  border-radius: 0.75rem;
  background: #fffaf0;
  color: var(--color-sepia-ink);
  padding: 0.6rem 0.8rem;
  font-size: 0.85rem;
  line-height: 1.4;
  box-shadow: 0 6px 16px rgb(0 0 0 / 0.4);
}
.librarian-bubble::after {
  content: "";
  position: absolute;
  left: 1.1rem;
  bottom: -0.5rem;
  border: 0.5rem solid transparent;
  border-top-color: #fffaf0;
  border-bottom: 0;
}

/* Guest book: two lined paper pages (one on phones) */
.guestbook {
  display: flex;
  filter: drop-shadow(0 14px 22px rgb(0 0 0 / 0.55));
}
.guestbook-page {
  flex: 1;
  padding: 1.25rem 1.4rem;
  color: var(--color-sepia-ink);
  background-color: var(--color-paper);
  background-image: repeating-linear-gradient(transparent 0 27px, #e2d4b4 27px 28px);
}
.guestbook-left {
  border-radius: 0.75rem 0 0 0.75rem;
  box-shadow: inset -14px 0 18px -10px rgb(0 0 0 / 0.35);
}
.guestbook-right {
  border-radius: 0.75rem;
  background-color: var(--color-paper-2);
}
@media (min-width: 768px) {
  .guestbook-right {
    border-radius: 0 0.75rem 0.75rem 0;
    box-shadow: inset 14px 0 18px -10px rgb(0 0 0 / 0.35);
  }
}
```

- [ ] **Step 5: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/components`
Expected: PASS (15 tests, termasuk `scene-state`).

- [ ] **Step 6: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint && npm run check`

```bash
git add src
git commit -m "feat(ui): add guest book button variants, panel, librarian bubble and paper fields"
```

---

### Task 8: Halaman sambutan (`/`) dan buku tamu (`/login`)

**Files:**
- Create: `src/components/auth/GuestBookRules.tsx`
- Modify: `src/routes/index.tsx`, `src/routes/login.tsx`

**Interfaces:**
- Consumes: `Panel`, `Logo`, `Button`, `buttonVariants` (Task 7). `AdminDesk`, `GuestBook`, `PaperDivider`, `PaperField`, `LibrarianBubble`, `GoogleButton` (Task 7). `signInFn`, `visitorsTodayFn` (Task 6). `authMessage`, `safeNext`, `guestRedirect`, `formatLongDate`, `SITE_TAGLINE` (Task 4).
- Produces: `<GuestBookRules visitors={number} />`.

- [ ] **Step 1: Halaman sambutan**

`src/routes/index.tsx` (ganti seluruh isinya):

```tsx
import { Link, createFileRoute, redirect } from "@tanstack/react-router"
import { buttonVariants } from "@/components/ui/button"
import { Logo } from "@/components/ui/logo"
import { Panel } from "@/components/ui/panel"
import { guestRedirect } from "@/lib/redirects"
import { SITE_TAGLINE } from "@/lib/site"

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    const target = guestRedirect(context.user)
    if (target) throw redirect({ href: target })
  },
  head: () => ({
    meta: [
      { title: `Glosa — ${SITE_TAGLINE}` },
      {
        name: "description",
        content:
          "Glosa adalah perpustakaan pribadimu untuk belajar bahasa Inggris lewat buku: unggah EPUB, baca dengan nyaman, dan pahami setiap kata.",
      },
    ],
  }),
  component: WelcomePage,
})

function WelcomePage() {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Panel className="w-full max-w-md p-6 text-center sm:p-8">
        <Logo className="mx-auto size-11" />
        <h1 className="mt-3 font-heading text-2xl font-bold sm:text-3xl">
          Selamat datang di Glosa
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Perpustakaan pribadimu untuk belajar bahasa Inggris lewat buku.
        </p>
        <div className="mt-6 grid gap-2.5">
          <Link to="/login" className={buttonVariants({ size: "block" })}>
            Masuk
          </Link>
          <Link to="/register" className={buttonVariants({ variant: "outline", size: "block" })}>
            Daftar jadi anggota
          </Link>
        </div>
      </Panel>
    </main>
  )
}
```

- [ ] **Step 2: Halaman kiri buku tamu**

`src/components/auth/GuestBookRules.tsx`:

```tsx
import { formatLongDate } from "@/lib/dates"

export function GuestBookRules({ visitors }: { visitors: number }) {
  return (
    <div className="flex h-full flex-col">
      <h1 className="font-hand text-3xl leading-none font-bold text-maroon">Buku Tamu</h1>
      <p className="mt-1 mb-4 font-type text-xs text-sepia-muted">{formatLongDate(new Date())}</p>
      <h2 className="text-sm font-bold">Tata tertib perpustakaan</h2>
      <ol className="mt-1 list-decimal space-y-1 pl-4 text-[13px] leading-snug">
        <li>Buku yang kamu bawa hanya bisa dibaca olehmu.</li>
        <li>Bagikan ulasan, bukan file.</li>
        <li>Ketuk kata yang sulit — kami bantu artikan.</li>
      </ol>
      <p className="mt-auto pt-6 text-xs text-sepia-muted">
        Pengunjung hari ini: <b>{visitors}</b>
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Halaman buku tamu**

`src/routes/login.tsx` (ganti seluruh isinya):

```tsx
import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { type FormEvent, useState } from "react"
import { AdminDesk } from "@/components/auth/AdminDesk"
import { GoogleButton } from "@/components/auth/GoogleButton"
import { GuestBook, PaperDivider } from "@/components/auth/GuestBook"
import { GuestBookRules } from "@/components/auth/GuestBookRules"
import { LibrarianBubble } from "@/components/auth/LibrarianBubble"
import { PaperField } from "@/components/auth/PaperField"
import { Button } from "@/components/ui/button"
import { authMessage } from "@/lib/auth-messages"
import { guestRedirect, safeNext } from "@/lib/redirects"
import { signInFn } from "@/server/auth"
import { visitorsTodayFn } from "@/server/profile"

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  beforeLoad: ({ context }) => {
    const target = guestRedirect(context.user)
    if (target) throw redirect({ href: target })
  },
  loader: () => visitorsTodayFn(),
  head: () => ({ meta: [{ title: "Buku Tamu — Glosa" }] }),
  component: LoginPage,
})

function LoginPage() {
  const { next } = Route.useSearch()
  const visitors = Route.useLoaderData()
  const router = useRouter()
  const signIn = useServerFn(signInFn)
  const [pending, setPending] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const message = errorCode ? authMessage(errorCode) : null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setErrorCode(null)
    const result = await signIn({
      data: {
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      },
    })
    if (!result.ok) {
      setPending(false)
      setErrorCode(result.code)
      return
    }
    await router.invalidate()
    router.history.push(safeNext(next))
  }

  return (
    <AdminDesk
      bubble={
        <LibrarianBubble tone={message ? "error" : "info"}>
          {message ? message.bubble : "Selamat datang! Silakan isi buku tamu, ya."}
        </LibrarianBubble>
      }
    >
      <GuestBook aside={<GuestBookRules visitors={visitors} />}>
        <h1 className="mb-3 font-hand text-3xl font-bold text-maroon md:hidden">Buku Tamu</h1>
        <form onSubmit={onSubmit}>
          <PaperField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            error={message?.field}
          />
          <PaperField
            label="Kata sandi"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <Button type="submit" variant="ink" size="block" disabled={pending} className="mt-1">
            {pending ? "Menandatangani…" : "Tanda tangan & masuk"}
          </Button>
        </form>
        <PaperDivider>atau</PaperDivider>
        <GoogleButton label="Masuk dengan Google" />
        <div className="mt-3 flex justify-between gap-3 text-xs text-sepia-muted">
          <span>
            Belum jadi anggota?{" "}
            <Link to="/register" className="underline">
              Daftar
            </Link>
          </span>
          <Link to="/forgot-password" className="underline">
            Lupa kata sandi?
          </Link>
        </div>
      </GuestBook>
    </AdminDesk>
  )
}
```

- [ ] **Step 4: Verifikasi visual**

Run: `npm run dev`. Buka `http://localhost:3000/`, klik **Masuk**.
Expected:
- Kamera zoom ke Meja Admin (±0,8 detik).
- Desktop: balon petugas di kiri atas dan buku tamu dua halaman di kanan.
- HP (390px): balon di atas dan halaman kanan berbentuk lembar di bawah.
- Login dengan email asal memunculkan balon "Hmm, email atau kata sandinya belum cocok…" dan pesan di bawah isian Email.
- Dengan "prefers-reduced-motion: reduce", zoom terjadi tanpa animasi.

- [ ] **Step 5: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint && npm run check`

```bash
git add src
git commit -m "feat(auth): add welcome page and guest book sign-in"
```

---

### Task 9: Formulir anggota (`/register`)

**Files:**
- Create: `src/components/auth/useUsernameCheck.ts`
- Test: `src/components/auth/useUsernameCheck.test.ts`
- Modify: `src/routes/register.tsx`

**Interfaces:**
- Consumes: `validateUsername`, `normalizeUsername`, `USERNAME_PROBLEM_TEXT`, `UsernameProblem` (Task 4), `signUpFn`, `checkUsernameFn` (Task 6), komponen Task 7.
- Produces: `type UsernameStatus = { state: "idle" } | { state: "checking" } | { state: "available" } | { state: "taken" } | { state: "invalid"; problem: UsernameProblem }`, `type UsernameChecker = (username: string) => Promise<{ available: boolean; problem: UsernameProblem | null }>`, `useUsernameCheck(value: string, check: UsernameChecker, delayMs?: number): UsernameStatus`, `usernameStatusText(status: UsernameStatus): string | undefined`.

- [ ] **Step 1: Tulis test yang gagal**

`src/components/auth/useUsernameCheck.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type UsernameChecker, useUsernameCheck } from "./useUsernameCheck"

describe("useUsernameCheck", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("stays idle for an empty value", () => {
    const check = vi.fn<UsernameChecker>()
    const { result } = renderHook(() => useUsernameCheck("", check))
    expect(result.current).toEqual({ state: "idle" })
    expect(check).not.toHaveBeenCalled()
  })

  it("reports local problems without asking the server", () => {
    const check = vi.fn<UsernameChecker>()
    const { result } = renderHook(() => useUsernameCheck("ab", check))
    expect(result.current).toEqual({ state: "invalid", problem: "too_short" })
    expect(check).not.toHaveBeenCalled()
  })

  it("checks availability after the debounce delay", async () => {
    const check = vi.fn<UsernameChecker>().mockResolvedValue({ available: true, problem: null })
    const { result } = renderHook(() => useUsernameCheck("ani_baca", check, 400))
    expect(result.current).toEqual({ state: "checking" })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(check).toHaveBeenCalledWith("ani_baca")
    expect(result.current).toEqual({ state: "available" })
  })

  it("reports a taken username", async () => {
    const check = vi.fn<UsernameChecker>().mockResolvedValue({ available: false, problem: null })
    const { result } = renderHook(() => useUsernameCheck("ani_baca", check, 400))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(result.current).toEqual({ state: "taken" })
  })

  it("only checks the last value while typing", async () => {
    const check = vi.fn<UsernameChecker>().mockResolvedValue({ available: true, problem: null })
    const { rerender } = renderHook(({ value }) => useUsernameCheck(value, check, 400), {
      initialProps: { value: "ani" },
    })
    rerender({ value: "ani_" })
    rerender({ value: "ani_b" })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(check).toHaveBeenCalledTimes(1)
    expect(check).toHaveBeenCalledWith("ani_b")
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/components/auth/useUsernameCheck.test.ts`
Expected: FAIL, modul belum ada.

- [ ] **Step 3: Implementasi hook**

`src/components/auth/useUsernameCheck.ts`:

```ts
import { useEffect, useRef, useState } from "react"
import { USERNAME_PROBLEM_TEXT, type UsernameProblem, validateUsername } from "@/lib/username"

export type UsernameStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken" }
  | { state: "invalid"; problem: UsernameProblem }

export type UsernameChecker = (
  username: string
) => Promise<{ available: boolean; problem: UsernameProblem | null }>

export function useUsernameCheck(
  value: string,
  check: UsernameChecker,
  delayMs = 400
): UsernameStatus {
  const [status, setStatus] = useState<UsernameStatus>({ state: "idle" })
  // Keep the latest checker without restarting the debounce when its identity changes.
  const checkRef = useRef(check)
  checkRef.current = check

  useEffect(() => {
    if (value === "") {
      setStatus({ state: "idle" })
      return
    }
    const problem = validateUsername(value)
    if (problem) {
      setStatus({ state: "invalid", problem })
      return
    }
    setStatus({ state: "checking" })
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const result = await checkRef.current(value)
        if (cancelled) return
        if (result.available) setStatus({ state: "available" })
        else if (result.problem) setStatus({ state: "invalid", problem: result.problem })
        else setStatus({ state: "taken" })
      } catch {
        if (!cancelled) setStatus({ state: "idle" })
      }
    }, delayMs)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [value, delayMs])

  return status
}

export function usernameStatusText(status: UsernameStatus): string | undefined {
  switch (status.state) {
    case "checking":
      return "Sedang mengecek…"
    case "available":
      return "Nama pengguna tersedia ✓"
    case "taken":
      return "Sudah dipakai anggota lain."
    case "invalid":
      return USERNAME_PROBLEM_TEXT[status.problem]
    default:
      return undefined
  }
}
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/components/auth/useUsernameCheck.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Halaman formulir anggota**

`src/routes/register.tsx` (ganti seluruh isinya):

```tsx
import { Link, createFileRoute, redirect } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { type FormEvent, useCallback, useState } from "react"
import { AdminDesk } from "@/components/auth/AdminDesk"
import { GoogleButton } from "@/components/auth/GoogleButton"
import { LibrarianBubble } from "@/components/auth/LibrarianBubble"
import { PaperField } from "@/components/auth/PaperField"
import { useUsernameCheck, usernameStatusText } from "@/components/auth/useUsernameCheck"
import { Button } from "@/components/ui/button"
import { authMessage } from "@/lib/auth-messages"
import { guestRedirect } from "@/lib/redirects"
import { normalizeUsername } from "@/lib/username"
import { signUpFn } from "@/server/auth"
import { checkUsernameFn } from "@/server/profile"

export const Route = createFileRoute("/register")({
  beforeLoad: ({ context }) => {
    const target = guestRedirect(context.user)
    if (target) throw redirect({ href: target })
  },
  head: () => ({ meta: [{ title: "Formulir Anggota — Glosa" }] }),
  component: RegisterPage,
})

function RegisterPage() {
  const signUp = useServerFn(signUpFn)
  const checkUsername = useServerFn(checkUsernameFn)
  const checker = useCallback(
    (username: string) => checkUsername({ data: { username } }),
    [checkUsername]
  )
  const [username, setUsername] = useState("")
  const usernameStatus = useUsernameCheck(username, checker)
  const [pending, setPending] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const message = errorCode ? authMessage(errorCode) : null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (usernameStatus.state === "checking") return
    if (usernameStatus.state !== "available") {
      setErrorCode(usernameStatus.state === "taken" ? "username_taken" : "username_invalid")
      return
    }
    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "").trim()
    setPending(true)
    setErrorCode(null)
    const result = await signUp({
      data: {
        email,
        password: String(form.get("password") ?? ""),
        username,
        displayName: String(form.get("displayName") ?? ""),
        acceptedTerms: form.get("acceptedTerms") === "on",
      },
    })
    setPending(false)
    if (!result.ok) {
      setErrorCode(result.code)
      return
    }
    setSentTo(email)
  }

  const bubble = sentTo
    ? `Kami kirim surat konfirmasi ke ${sentTo}. Buka tautannya untuk menerima kartu anggotamu.`
    : (message?.bubble ?? "Anggota baru? Isi satu formulir ini, kartumu langsung jadi.")

  return (
    <AdminDesk
      bubble={<LibrarianBubble tone={message ? "error" : "info"}>{bubble}</LibrarianBubble>}
    >
      <div className="rotate-[1.2deg] border-t-[6px] border-[#1f5e45] bg-[#fbf5e6] p-5 text-sepia-ink shadow-[0_14px_26px_rgba(0,0,0,0.55)]">
        <div className="mb-3 flex justify-between font-type text-xs font-bold tracking-wide text-[#1f5e45]">
          <h1>FORMULIR PENDAFTARAN ANGGOTA</h1>
          <span className="font-normal text-[#8b7556]">No. ______</span>
        </div>
        {sentTo ? (
          <p className="font-hand text-2xl text-pen">
            Kami kirim surat konfirmasi ke {sentTo}. Sampai jumpa di meja admin!
          </p>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="grid gap-x-5 sm:grid-cols-2">
              <PaperField
                label="Nama lengkap"
                name="displayName"
                autoComplete="name"
                maxLength={60}
                required
                error={errorCode === "display_name_invalid" ? message?.field : undefined}
              />
              <PaperField
                label="Nama pengguna"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(normalizeUsername(event.target.value))}
                required
                error={
                  usernameStatus.state === "taken" || usernameStatus.state === "invalid"
                    ? usernameStatusText(usernameStatus)
                    : undefined
                }
                hint={usernameStatusText(usernameStatus)}
              />
              <PaperField
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
                error={
                  errorCode === "email_address_invalid" ||
                  errorCode === "email_address_not_authorized"
                    ? message?.field
                    : undefined
                }
              />
              <PaperField
                label="Kata sandi"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                error={errorCode === "weak_password" ? message?.field : undefined}
              />
            </div>
            <label className="my-3 flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                name="acceptedTerms"
                required
                className="mt-0.5 accent-[#1f5e45]"
              />
              <span>
                Saya setuju dengan tata tertib (
                <Link to="/terms" target="_blank" className="underline">
                  Syarat Layanan
                </Link>{" "}
                &amp;{" "}
                <Link to="/privacy" target="_blank" className="underline">
                  Kebijakan Privasi
                </Link>
                )
              </span>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="submit" variant="ink" size="block" disabled={pending}>
                {pending ? "Mengirim…" : "Ajukan keanggotaan"}
              </Button>
              <div>
                <GoogleButton label="Daftar dengan Google" />
              </div>
            </div>
          </form>
        )}
        <p className="mt-3 text-xs text-sepia-muted">
          Sudah jadi anggota?{" "}
          <Link to="/login" className="underline">
            Isi buku tamu
          </Link>
        </p>
      </div>
    </AdminDesk>
  )
}
```

Catatan: teks label persetujuan lengkapnya adalah "Saya setuju dengan tata tertib (Syarat Layanan & Kebijakan Privasi)". Test E2E mencarinya dengan `getByLabel("Saya setuju dengan tata tertib")`.

- [ ] **Step 6: Verifikasi manual**

Run: `npm run dev`, buka `/register`.
Expected:
- Ketik "Ani Baca!" di Nama pengguna: isinya berubah menjadi `anibaca`, lalu muncul "Sedang mengecek…" yang berganti menjadi "Nama pengguna tersedia ✓".
- Kirim formulir memakai **email pemilik proyek** (email anggota tim Supabase bisa menerima surat walaupun SMTP masih bawaan): muncul "Kami kirim surat konfirmasi ke …". Surat "Konfirmasi keanggotaan Glosa" masuk ke inbox.
- Hapus user uji ini dari dashboard (Authentication → Users) setelah selesai dicoba di Task 11.

- [ ] **Step 7: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint && npm run check`

```bash
git add src
git commit -m "feat(auth): add membership form with live username check"
```

---

### Task 10: Lupa dan atur ulang kata sandi

**Files:**
- Modify: `src/routes/forgot-password.tsx`, `src/routes/reset-password.tsx`

**Interfaces:**
- Consumes: `requestPasswordResetFn`, `updatePasswordFn` (Task 6), `AdminDesk`, `GuestBook`, `PaperField`, `LibrarianBubble`, `Button` (Task 7), `authMessage`, `guestRedirect`, `DEFAULT_MEMBER_PATH` (Task 4).

- [ ] **Step 1: Halaman lupa kata sandi**

`src/routes/forgot-password.tsx` (ganti seluruh isinya):

```tsx
import { Link, createFileRoute, redirect } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { type FormEvent, useState } from "react"
import { AdminDesk } from "@/components/auth/AdminDesk"
import { GuestBook } from "@/components/auth/GuestBook"
import { LibrarianBubble } from "@/components/auth/LibrarianBubble"
import { PaperField } from "@/components/auth/PaperField"
import { Button } from "@/components/ui/button"
import { authMessage } from "@/lib/auth-messages"
import { guestRedirect } from "@/lib/redirects"
import { requestPasswordResetFn } from "@/server/auth"

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: ({ context }) => {
    const target = guestRedirect(context.user)
    if (target) throw redirect({ href: target })
  },
  head: () => ({ meta: [{ title: "Lupa Kata Sandi — Glosa" }] }),
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const requestReset = useServerFn(requestPasswordResetFn)
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const message = errorCode ? authMessage(errorCode) : null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setErrorCode(null)
    const result = await requestReset({ data: { email: String(form.get("email") ?? "").trim() } })
    setPending(false)
    if (!result.ok) {
      setErrorCode(result.code)
      return
    }
    setSent(true)
  }

  return (
    <AdminDesk
      bubble={
        <LibrarianBubble tone={message ? "error" : "info"}>
          {sent
            ? "Jika email itu terdaftar, surat untuk membuat kata sandi baru sudah kami kirim."
            : (message?.bubble ?? "Lupa kata sandi? Tulis emailmu, nanti kami kirim surat.")}
        </LibrarianBubble>
      }
    >
      <GuestBook>
        <h1 className="mb-3 font-hand text-3xl font-bold text-maroon">Lupa Kata Sandi</h1>
        {sent ? (
          <p className="font-hand text-2xl text-pen">Cek kotak masuk emailmu, ya.</p>
        ) : (
          <form onSubmit={onSubmit}>
            <PaperField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              error={message?.field}
            />
            <Button type="submit" variant="ink" size="block" disabled={pending}>
              {pending ? "Mengirim…" : "Kirim surat atur ulang"}
            </Button>
          </form>
        )}
        <p className="mt-3 text-xs text-sepia-muted">
          <Link to="/login" className="underline">
            Kembali ke buku tamu
          </Link>
        </p>
      </GuestBook>
    </AdminDesk>
  )
}
```

- [ ] **Step 2: Halaman kata sandi baru**

`src/routes/reset-password.tsx` (ganti seluruh isinya):

```tsx
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { type FormEvent, useState } from "react"
import { AdminDesk } from "@/components/auth/AdminDesk"
import { GuestBook } from "@/components/auth/GuestBook"
import { LibrarianBubble } from "@/components/auth/LibrarianBubble"
import { PaperField } from "@/components/auth/PaperField"
import { Button } from "@/components/ui/button"
import { authMessage } from "@/lib/auth-messages"
import { DEFAULT_MEMBER_PATH } from "@/lib/redirects"
import { updatePasswordFn } from "@/server/auth"

export const Route = createFileRoute("/reset-password")({
  // Reached through the recovery link, which signs the member in first.
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ href: "/forgot-password" })
  },
  head: () => ({ meta: [{ title: "Kata Sandi Baru — Glosa" }] }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const router = useRouter()
  const updatePassword = useServerFn(updatePasswordFn)
  const [pending, setPending] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const message = errorCode ? authMessage(errorCode) : null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") ?? "")
    if (password !== String(form.get("confirm") ?? "")) {
      setErrorCode("password_mismatch")
      return
    }
    setPending(true)
    setErrorCode(null)
    const result = await updatePassword({ data: { password } })
    if (!result.ok) {
      setPending(false)
      setErrorCode(result.code)
      return
    }
    await router.invalidate()
    router.history.push(DEFAULT_MEMBER_PATH)
  }

  return (
    <AdminDesk
      bubble={
        <LibrarianBubble tone={message ? "error" : "info"}>
          {message?.bubble ?? "Silakan tulis kata sandi barumu."}
        </LibrarianBubble>
      }
    >
      <GuestBook>
        <h1 className="mb-3 font-hand text-3xl font-bold text-maroon">Kata Sandi Baru</h1>
        <form onSubmit={onSubmit}>
          <PaperField
            label="Kata sandi baru"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            error={errorCode === "password_mismatch" ? undefined : message?.field}
          />
          <PaperField
            label="Ulangi kata sandi baru"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            error={errorCode === "password_mismatch" ? message?.field : undefined}
          />
          <Button type="submit" variant="ink" size="block" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan kata sandi"}
          </Button>
        </form>
      </GuestBook>
    </AdminDesk>
  )
}
```

- [ ] **Step 3: Verifikasi manual**

Run: `npm run dev`. Di `/forgot-password`, kirim email pemilik proyek (akun dari Task 9 yang sudah dikonfirmasi), lalu buka tautan "Buat kata sandi baru" dari inbox.
Expected: halaman pindah ke `/reset-password`. Setelah disimpan, halaman pindah ke `/welcome` (belum onboarding) atau `/lobby`.

- [ ] **Step 4: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint && npm run check`

```bash
git add src
git commit -m "feat(auth): add forgot and reset password pages"
```

---

### Task 11: Kartu anggota (`/welcome`)

**Files:**
- Create: `src/components/member/MembershipCard.tsx`, `src/components/member/Stamp.tsx`
- Test: `src/components/member/MembershipCard.test.tsx`
- Modify: `src/routes/_member/welcome.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `SessionUser` (Task 4), `formatMemberNo`, `formatMemberSince`, `formatBytes`, `planLabel` (Task 4), `completeOnboardingFn`, `checkUsernameFn` (Task 6), `useUsernameCheck`, `usernameStatusText` (Task 9), `Button`, `LibrarianBubble`, `Logo` (Task 7).
- Produces: `<MembershipCard member={SessionUser} className? animate? />` (dirender sebagai `<figure aria-label="Kartu anggota Glosa">`), `<Stamp>children</Stamp>`.

- [ ] **Step 1: Tulis test yang gagal**

`src/components/member/MembershipCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { SessionUser } from "@/lib/session-types"
import { MembershipCard } from "./MembershipCard"

const member: SessionUser = {
  id: "u1",
  email: "yudhis@contoh.com",
  provider: "email",
  username: "yudhis",
  displayName: "Yudhis",
  memberNo: 342,
  plan: "free",
  storageLimitBytes: 104857600,
  memberSince: "2026-10-15T03:00:00Z",
  onboarded: false,
}

describe("MembershipCard", () => {
  it("shows the member details printed on the card", () => {
    render(<MembershipCard member={member} />)
    const card = screen.getByRole("figure", { name: "Kartu anggota Glosa" })
    expect(card).toHaveTextContent("Yudhis")
    expect(card).toHaveTextContent("@yudhis")
    expect(card).toHaveTextContent("000342")
    expect(card).toHaveTextContent("Okt 2026")
    expect(card).toHaveTextContent("GRATIS · 100 MB")
  })

  it("never prints the email address", () => {
    render(<MembershipCard member={member} />)
    expect(screen.queryByText(/yudhis@contoh\.com/)).toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/components/member`
Expected: FAIL, modul belum ada.

- [ ] **Step 3: Implementasi kartu dan cap**

`src/components/member/MembershipCard.tsx`:

```tsx
import { Logo } from "@/components/ui/logo"
import { formatBytes, formatMemberNo, formatMemberSince, planLabel } from "@/lib/member"
import type { SessionUser } from "@/lib/session-types"
import { cn } from "@/lib/utils"

export function MembershipCard({
  member,
  className,
  animate = false,
}: {
  member: SessionUser
  className?: string
  animate?: boolean
}) {
  return (
    <figure
      aria-label="Kartu anggota Glosa"
      className={cn("member-card m-0", animate && "member-card-enter", className)}
    >
      <div className="flex items-center gap-2.5">
        <Logo className="size-7" />
        <div>
          <b className="block font-heading text-sm tracking-[0.2em]">GLOSA</b>
          <small className="text-[8px] tracking-[0.15em] text-[#9cc9bf]">
            KARTU ANGGOTA PERPUSTAKAAN
          </small>
        </div>
      </div>
      <div className="mt-3 flex flex-1 gap-3.5">
        <div className="grid h-[74px] w-[62px] place-items-center rounded-md border-2 border-white/25 bg-gradient-to-br from-[#c68e63] to-[#7a4a2e] font-heading text-2xl font-bold">
          {member.displayName.charAt(0).toUpperCase()}
        </div>
        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-2.5 gap-y-0.5 text-[9px]">
          <dt className="text-[#8fb9b0]">Nama</dt>
          <dd className="text-xs font-bold">{member.displayName}</dd>
          <dt className="text-[#8fb9b0]">Pengguna</dt>
          <dd className="text-xs font-bold">@{member.username}</dd>
          <dt className="text-[#8fb9b0]">No. anggota</dt>
          <dd className="font-type text-xs font-bold tracking-wider">
            {formatMemberNo(member.memberNo)}
          </dd>
          <dt className="text-[#8fb9b0]">Anggota sejak</dt>
          <dd className="text-xs font-bold">{formatMemberSince(member.memberSince)}</dd>
        </dl>
      </div>
      <div className="flex items-end justify-between">
        <span className="rounded-full border border-mint/50 px-2 py-0.5 text-[9px] tracking-[0.15em] text-mint">
          {planLabel(member.plan)} · {formatBytes(member.storageLimitBytes)}
        </span>
        <span aria-hidden="true" className="member-card-barcode" />
      </div>
    </figure>
  )
}
```

`src/components/member/Stamp.tsx`:

```tsx
import type { ReactNode } from "react"

export function Stamp({ children }: { children: ReactNode }) {
  return <span className="stamp">{children}</span>
}
```

Tambahkan ke akhir `src/styles.css`:

```css
/* Membership card */
.member-card {
  display: flex;
  flex-direction: column;
  width: min(300px, 86vw);
  aspect-ratio: 1.586;
  border-radius: 14px;
  padding: 14px 16px;
  color: #eaf6f2;
  background:
    radial-gradient(circle at 85% 15%, rgb(47 224 184 / 0.35), transparent 45%),
    linear-gradient(135deg, #123a35, #0a1f22 60%, #13302c);
  border: 1px solid rgb(47 224 184 / 0.45);
  box-shadow:
    0 18px 40px rgb(0 0 0 / 0.6),
    inset 0 1px 0 rgb(255 255 255 / 0.12);
}
.member-card-barcode {
  width: 90px;
  height: 22px;
  background: repeating-linear-gradient(
    90deg,
    #d8efe9 0 2px,
    transparent 2px 4px,
    #d8efe9 4px 5px,
    transparent 5px 8px,
    #d8efe9 8px 11px,
    transparent 11px 12px
  );
}
.member-card-enter {
  rotate: -3deg;
  animation: member-card-in 700ms 350ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
@keyframes member-card-in {
  from {
    translate: 0 40px;
    rotate: 6deg;
    opacity: 0;
  }
  to {
    translate: 0 0;
    rotate: -3deg;
    opacity: 1;
  }
}

/* "DITERIMA" rubber stamp */
.stamp {
  display: inline-block;
  border: 4px solid var(--color-stamp);
  border-radius: 0.5rem;
  padding: 0.1rem 0.75rem;
  color: var(--color-stamp);
  font: 700 1.9rem/1.2 var(--font-type);
  letter-spacing: 0.2em;
  rotate: -14deg;
  opacity: 0.9;
  animation: stamp-in 450ms cubic-bezier(0.3, 1.6, 0.5, 1) both;
}
@keyframes stamp-in {
  from {
    scale: 2.4;
    opacity: 0;
  }
  to {
    scale: 1;
    opacity: 0.9;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stamp,
  .member-card-enter {
    animation: none;
  }
}
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/components/member`
Expected: PASS (2 tests).

- [ ] **Step 5: Halaman kartu anggota**

`src/routes/_member/welcome.tsx` (ganti seluruh isinya):

```tsx
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useCallback, useState } from "react"
import { LibrarianBubble } from "@/components/auth/LibrarianBubble"
import { useUsernameCheck, usernameStatusText } from "@/components/auth/useUsernameCheck"
import { MembershipCard } from "@/components/member/MembershipCard"
import { Stamp } from "@/components/member/Stamp"
import { Button } from "@/components/ui/button"
import { authMessage } from "@/lib/auth-messages"
import { DEFAULT_MEMBER_PATH } from "@/lib/redirects"
import { normalizeUsername } from "@/lib/username"
import { checkUsernameFn, completeOnboardingFn } from "@/server/profile"

export const Route = createFileRoute("/_member/welcome")({
  head: () => ({ meta: [{ title: "Kartu Anggota — Glosa" }] }),
  component: WelcomeCardPage,
})

function WelcomeCardPage() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const completeOnboarding = useServerFn(completeOnboardingFn)
  const checkUsername = useServerFn(checkUsernameFn)
  // Email members chose their username on the form; OAuth members got a generated one.
  const canEditUsername = user.provider !== "email"
  const [username, setUsername] = useState(user.username)
  const checker = useCallback(
    async (candidate: string) =>
      candidate === user.username
        ? { available: true, problem: null }
        : checkUsername({ data: { username: candidate } }),
    [checkUsername, user.username]
  )
  const usernameStatus = useUsernameCheck(canEditUsername ? username : "", checker)
  const [pending, setPending] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  async function enterLibrary() {
    setPending(true)
    setErrorCode(null)
    const result = await completeOnboarding({
      data: canEditUsername && username !== user.username ? { username } : {},
    })
    if (!result.ok) {
      setPending(false)
      setErrorCode(result.code)
      return
    }
    await router.invalidate()
    router.history.push(DEFAULT_MEMBER_PATH)
  }

  const blocked =
    canEditUsername && (usernameStatus.state === "taken" || usernameStatus.state === "invalid")

  return (
    <main className="relative grid min-h-dvh place-items-center p-4">
      <div className="absolute top-[10%] left-[8%] md:left-[58%]">
        <Stamp>DITERIMA</Stamp>
      </div>
      <div className="flex w-full max-w-sm flex-col items-center gap-5">
        <h1 className="sr-only">Kartu anggotamu sudah jadi</h1>
        <MembershipCard
          member={{ ...user, username: canEditUsername ? username || user.username : user.username }}
          animate
        />
        {canEditUsername && (
          <div className="w-full rounded-xl border bg-panel p-3 text-sm backdrop-blur-md">
            <label htmlFor="username" className="block text-xs text-muted-foreground">
              Nama pengguna (bisa diubah sekarang)
            </label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(normalizeUsername(event.target.value))}
              autoComplete="username"
              aria-describedby="username-note"
              className="mt-1 w-full rounded-md border bg-night-950 px-3 py-2 text-foreground outline-none focus:border-mint"
            />
            <p id="username-note" className="mt-1 text-xs text-muted-foreground">
              {usernameStatusText(usernameStatus)}
            </p>
          </div>
        )}
        {errorCode && (
          <LibrarianBubble tone="error">{authMessage(errorCode).bubble}</LibrarianBubble>
        )}
        <Button size="block" onClick={enterLibrary} disabled={pending || blocked}>
          {pending ? "Membuka pintu…" : "Masuk ke perpustakaan →"}
        </Button>
      </div>
    </main>
  )
}
```

Catatan: nama aksesibel tombol ini adalah "Masuk ke perpustakaan →". Test E2E mencarinya dengan `getByRole("button", { name: /Masuk ke perpustakaan/ })`.

- [ ] **Step 6: Verifikasi manual**

Buka tautan "Konfirmasi keanggotaan" dari surat di Task 9.
Expected: halaman pindah ke `/welcome`. Latar meja admin terlihat kabur dan gelap, cap "DITERIMA" dihentakkan, lalu kartu meluncur masuk dengan nama, @username, nomor 6 digit, bulan dan tahun, serta "GRATIS · 100 MB". Klik tombol untuk pindah ke `/lobby`. Buka `/welcome` lagi: Anda dialihkan ke `/lobby`.

- [ ] **Step 7: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint && npm run check`

```bash
git add src
git commit -m "feat(member): add membership card welcome step"
```

---

### Task 12: Lobi sementara, pengaturan, dan hapus akun

**Files:**
- Create (via shadcn): `src/components/ui/input.tsx`, `src/components/ui/label.tsx`
- Modify: `src/routes/_member/lobby.tsx`, `src/routes/_member/settings.tsx`

**Interfaces:**
- Consumes: `MembershipCard` (Task 11), `Panel`, `Button`, `buttonVariants` (Task 7), `updateProfileFn`, `deleteAccountFn` (Task 6), `authMessage`, `normalizeUsername` (Task 4). `Input` dan `Label` dari shadcn.

Lobi di task ini adalah halaman **sementara**. Lobi isometrik penuh dibangun di rencana 1D, sebelum rilis.

- [ ] **Step 1: Tambah komponen shadcn**

Run: `npx shadcn@latest add input label`
Expected: `src/components/ui/input.tsx` dan `src/components/ui/label.tsx` dibuat, masing-masing mengekspor `Input` dan `Label`.

- [ ] **Step 2: Lobi sementara**

`src/routes/_member/lobby.tsx` (ganti seluruh isinya):

```tsx
import { Link, createFileRoute } from "@tanstack/react-router"
import { MembershipCard } from "@/components/member/MembershipCard"
import { buttonVariants } from "@/components/ui/button"
import { Panel } from "@/components/ui/panel"

export const Route = createFileRoute("/_member/lobby")({
  // Keep the value as the number 1 so the URL stays `?kembali=1` after validation.
  validateSearch: (search: Record<string, unknown>): { kembali?: 1 } => ({
    kembali: search.kembali === 1 || search.kembali === "1" ? 1 : undefined,
  }),
  head: () => ({ meta: [{ title: "Lobi — Glosa" }] }),
  component: LobbyPage,
})

function LobbyPage() {
  const { user } = Route.useRouteContext()
  const { kembali } = Route.useSearch()
  const linkClass = buttonVariants({ variant: "outline", size: "block" })

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-8">
      {kembali === 1 && (
        <output className="block rounded-lg border bg-panel px-4 py-2 text-sm">
          Selamat datang kembali, {user.displayName}!
        </output>
      )}
      <h1 className="font-heading text-3xl font-bold">Lobi</h1>
      <Panel className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
        <MembershipCard member={user} />
        <div className="flex w-full flex-col gap-2.5 sm:max-w-48">
          <Link to="/settings" className={linkClass}>
            Pengaturan
          </Link>
          <Link to="/logout" className={linkClass}>
            Keluar
          </Link>
        </div>
      </Panel>
    </main>
  )
}
```

- [ ] **Step 3: Halaman pengaturan**

`src/routes/_member/settings.tsx` (ganti seluruh isinya):

```tsx
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { type FormEvent, useState } from "react"
import { MembershipCard } from "@/components/member/MembershipCard"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Panel } from "@/components/ui/panel"
import { authMessage } from "@/lib/auth-messages"
import { normalizeUsername } from "@/lib/username"
import { deleteAccountFn, updateProfileFn } from "@/server/profile"

export const Route = createFileRoute("/_member/settings")({
  head: () => ({ meta: [{ title: "Pengaturan — Glosa" }] }),
  component: SettingsPage,
})

function SettingsPage() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const updateProfile = useServerFn(updateProfileFn)
  const deleteAccount = useServerFn(deleteAccountFn)

  const [username, setUsername] = useState(user.username)
  const [profileState, setProfileState] = useState<
    { kind: "idle" } | { kind: "saved" } | { kind: "error"; code: string }
  >({ kind: "idle" })
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const result = await updateProfile({
      data: { displayName: String(form.get("displayName") ?? ""), username },
    })
    if (!result.ok) {
      setProfileState({ kind: "error", code: result.code })
      return
    }
    setProfileState({ kind: "saved" })
    await router.invalidate()
  }

  async function onDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteAccount({
      data: { confirmUsername: String(form.get("confirmUsername") ?? "") },
    })
    if (!result.ok) {
      setDeleting(false)
      setDeleteError(result.code)
      return
    }
    await router.invalidate()
    router.history.push("/")
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-bold">Pengaturan</h1>
        <Link to="/lobby" className="text-sm text-mint underline">
          ← Lobi
        </Link>
      </div>

      <Panel className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
        <MembershipCard member={user} />
        <form onSubmit={onSaveProfile} className="w-full space-y-3 text-sm">
          <h2 className="font-bold">Profil</h2>
          <div className="space-y-1">
            <Label htmlFor="displayName">Nama</Label>
            <Input
              id="displayName"
              name="displayName"
              defaultValue={user.displayName}
              maxLength={60}
              required
              autoComplete="name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="username">Nama pengguna</Label>
            <Input
              id="username"
              name="username"
              value={username}
              onChange={(event) => setUsername(normalizeUsername(event.target.value))}
              required
              autoComplete="username"
            />
          </div>
          {profileState.kind === "error" && (
            <p role="alert" className="text-xs text-destructive">
              {authMessage(profileState.code).field}
            </p>
          )}
          {profileState.kind === "saved" && (
            <output className="block text-xs text-mint">Profil tersimpan.</output>
          )}
          <Button type="submit" size="lg">
            Simpan profil
          </Button>
        </form>
      </Panel>

      <Panel className="p-6">
        <Link to="/logout" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Keluar
        </Link>
      </Panel>

      <Panel className="border-destructive/50 p-6 text-sm">
        <h2 className="font-bold text-destructive">Hapus akun</h2>
        <p className="mt-1 text-muted-foreground">
          Semua data milikmu akan dihapus permanen dan tidak bisa dikembalikan.
        </p>
        <form onSubmit={onDelete} className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="confirmUsername">
              Ketik nama penggunamu untuk konfirmasi ({user.username})
            </Label>
            <Input id="confirmUsername" name="confirmUsername" autoComplete="off" required />
          </div>
          {deleteError && (
            <p role="alert" className="text-xs text-destructive">
              {authMessage(deleteError).field}
            </p>
          )}
          <Button type="submit" variant="destructive" size="lg" disabled={deleting}>
            {deleting ? "Menghapus…" : "Hapus akun saya permanen"}
          </Button>
        </form>
      </Panel>
    </main>
  )
}
```

- [ ] **Step 4: Verifikasi manual**

Run: `npm run dev`. Masuk sebagai anggota, lalu buka `/settings`.
Expected:
- Ubah nama dan simpan: "Profil tersimpan." muncul, dan kartu di atas ikut berubah.
- Hapus akun dengan nama pengguna yang salah: muncul "Ketik nama penggunamu persis."
- Hapus dengan nama pengguna yang benar: kembali ke `/`, dan user hilang dari dashboard Supabase.

- [ ] **Step 5: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint && npm run check`

```bash
git add src
git commit -m "feat(member): add interim lobby, profile settings and account deletion"
```

---

### Task 13: Halaman Kebijakan Privasi dan Syarat Layanan

**Files:**
- Create: `src/components/legal/LegalPage.tsx`
- Modify: `src/routes/privacy.tsx`, `src/routes/terms.tsx`

**Interfaces:**
- Consumes: `LEGAL_CONTACT_EMAIL` (Task 4).
- Produces: `<LegalPage title updated>children</LegalPage>`.

Kedua teks berikut adalah **draf** yang harus ditinjau ahli hukum sebelum rilis publik. Kalimat ini juga dicantumkan di halaman.

- [ ] **Step 1: Layout halaman hukum**

`src/components/legal/LegalPage.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto max-w-2xl p-4 py-10 sm:p-8">
      <Link to="/" className="text-sm text-mint underline">
        ← Glosa
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Terakhir diperbarui: {updated} · Draf, akan ditinjau sebelum rilis publik.
      </p>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-foreground/90 [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Kebijakan privasi**

`src/routes/privacy.tsx` (ganti seluruh isinya):

```tsx
import { createFileRoute } from "@tanstack/react-router"
import { LegalPage } from "@/components/legal/LegalPage"
import { LEGAL_CONTACT_EMAIL } from "@/lib/site"

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Kebijakan Privasi — Glosa" }] }),
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <LegalPage title="Kebijakan Privasi" updated="15 Oktober 2026">
      <p>
        Glosa menghormati privasimu. Halaman ini menjelaskan data apa yang kami kumpulkan, untuk
        apa, dan apa hakmu sesuai Undang-Undang Pelindungan Data Pribadi (UU PDP).
      </p>
      <h2>Data yang kami kumpulkan</h2>
      <ul>
        <li>Data akun: email, nama, nama pengguna, dan foto profil (jika masuk dengan Google).</li>
        <li>File EPUB yang kamu unggah beserta judul, penulis, dan sampul buku.</li>
        <li>Data membaca: posisi baca, pengaturan tampilan, dan aktivitas belajar.</li>
        <li>Data teknis: waktu masuk terakhir dan laporan error untuk memperbaiki aplikasi.</li>
      </ul>
      <h2>Untuk apa data dipakai</h2>
      <ul>
        <li>Menyediakan perpustakaan pribadimu dan menyinkronkannya antar perangkat.</li>
        <li>Mengirim email yang diperlukan, seperti konfirmasi akun dan atur ulang kata sandi.</li>
        <li>Menjaga keamanan layanan dan memperbaiki masalah.</li>
      </ul>
      <p>Kami tidak menjual data pribadimu dan tidak memakainya untuk iklan.</p>
      <h2>Siapa yang bisa melihat bukumu</h2>
      <p>
        File EPUB yang kamu unggah bersifat pribadi dan hanya bisa dibaca olehmu. Jumlah
        "pengunjung hari ini" di buku tamu hanya berupa angka tanpa nama.
      </p>
      <h2>Tempat penyimpanan</h2>
      <p>
        Data disimpan di layanan Supabase dan server aplikasi kami. Penyedia layanan tersebut hanya
        memproses data atas instruksi kami.
      </p>
      <h2>Hakmu</h2>
      <ul>
        <li>Melihat dan memperbarui data profilmu di halaman Pengaturan.</li>
        <li>Menghapus akun beserta seluruh datamu kapan saja dari halaman Pengaturan.</li>
        <li>Meminta salinan data atau mengajukan pertanyaan lewat email di bawah.</li>
      </ul>
      <h2>Kontak</h2>
      <p>
        Hubungi kami di <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
```

- [ ] **Step 3: Syarat layanan**

`src/routes/terms.tsx` (ganti seluruh isinya):

```tsx
import { createFileRoute } from "@tanstack/react-router"
import { LegalPage } from "@/components/legal/LegalPage"
import { LEGAL_CONTACT_EMAIL } from "@/lib/site"

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Syarat Layanan — Glosa" }] }),
  component: TermsPage,
})

function TermsPage() {
  return (
    <LegalPage title="Syarat Layanan (Tata Tertib Perpustakaan)" updated="15 Oktober 2026">
      <p>Dengan menjadi anggota Glosa, kamu setuju dengan tata tertib berikut.</p>
      <h2>1. Buku yang kamu bawa</h2>
      <ul>
        <li>Unggah hanya file EPUB yang kamu miliki secara sah atau yang berlisensi bebas.</li>
        <li>Buku yang kamu unggah hanya bisa dibaca olehmu. Glosa bukan tempat berbagi file.</li>
        <li>Kami dapat menghapus file yang dilaporkan melanggar hak cipta.</li>
      </ul>
      <h2>2. Ulasan dan perilaku</h2>
      <ul>
        <li>Bagikan ulasan, bukan file. Jangan mengunggah konten yang melanggar hukum.</li>
        <li>Hormati anggota lain. Ujaran kebencian dan spam akan dihapus.</li>
      </ul>
      <h2>3. Akun</h2>
      <ul>
        <li>Jaga kerahasiaan kata sandimu. Kamu bertanggung jawab atas aktivitas di akunmu.</li>
        <li>Kamu boleh menghapus akunmu kapan saja dari halaman Pengaturan.</li>
      </ul>
      <h2>4. Paket dan penyimpanan</h2>
      <p>
        Paket Gratis mendapat 100 MB penyimpanan. Ketentuan paket berbayar akan diumumkan sebelum
        tersedia.
      </p>
      <h2>5. Perubahan layanan</h2>
      <p>
        Kami dapat mengubah tata tertib ini. Perubahan penting akan diberitahukan lewat aplikasi
        atau email.
      </p>
      <h2>Kontak</h2>
      <p>
        Pertanyaan atau laporan pelanggaran:{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
```

- [ ] **Step 4: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint && npm run check`

```bash
git add src
git commit -m "feat: add draft privacy policy and terms pages"
```

---

### Task 14: Test end-to-end alur anggota (proyek dev)

**Files:**
- Create: `playwright.config.ts`, `e2e/helpers/env.ts`, `e2e/helpers/members.ts`, `e2e/global-teardown.ts`, `e2e/auth.spec.ts`

**Interfaces:**
- Consumes: semua rute dari Task 5–13. Label UI: "Email", "Kata sandi", "Nama lengkap", "Nama pengguna", "Kata sandi baru", "Ulangi kata sandi baru", "Ketik nama penggunamu untuk konfirmasi". Tombol: "Tanda tangan & masuk", "Ajukan keanggotaan", "Kirim surat atur ulang", "Simpan kata sandi", "Masuk ke perpustakaan →", "Hapus akun saya permanen".
- Produces: `npm run test:e2e` yang hijau.

Strategi tanpa inbox: tautan konfirmasi dan atur ulang dibuat dengan `auth.admin.generateLink`, yang tidak mengirim email. Uji yang benar-benar mengirim email (submit formulir daftar dan lupa sandi) hanya berjalan jika `E2E_SMTP_EMAIL` diisi. Variabel ini diisi setelah SMTP kustom aktif, misalnya `delivered+{id}@resend.dev`. Semua user uji dihapus di global teardown.

- [ ] **Step 1: Konfigurasi Playwright dan helper**

Run: `npx playwright install chromium`

`playwright.config.ts`:

```ts
import { existsSync } from "node:fs"
import { defineConfig, devices } from "@playwright/test"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalTeardown: "./e2e/global-teardown.ts",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

`e2e/helpers/env.ts`:

```ts
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name} in .env.local`)
  return value
}
```

`e2e/helpers/members.ts`:

```ts
import { createClient } from "@supabase/supabase-js"
import { expect, type Page } from "@playwright/test"
import { requireEnv } from "./env"

export type TestMember = { email: string; username: string; name: string; password: string }

/** Every E2E email contains "e2e-" so global teardown can find and delete it. */
export const E2E_MARKER = "e2e-"

export function admin() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function newMember(emailFor?: (id: string) => string): TestMember {
  const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
  return {
    email: emailFor ? emailFor(`${E2E_MARKER}${id}`) : `${E2E_MARKER}${id}@glosa.test`,
    username: `e2e_${id}`.slice(0, 20),
    name: "Anggota Uji",
    password: "rahasia-123",
  }
}

/** A confirmed member created directly through the admin API (no email sent). */
export async function createConfirmedMember(member = newMember()): Promise<TestMember> {
  const { error } = await admin().auth.admin.createUser({
    email: member.email,
    password: member.password,
    email_confirm: true,
    user_metadata: { username: member.username, display_name: member.name },
  })
  if (error) throw error
  return member
}

/** Registers an unconfirmed member and returns their confirmation link path (no email sent). */
export async function signupConfirmPath(member: TestMember): Promise<string> {
  const { data, error } = await admin().auth.admin.generateLink({
    type: "signup",
    email: member.email,
    password: member.password,
    options: { data: { username: member.username, display_name: member.name } },
  })
  if (error) throw error
  return `/auth/confirm?token_hash=${data.properties.hashed_token}&type=signup`
}

export async function recoveryPath(email: string): Promise<string> {
  const { data, error } = await admin().auth.admin.generateLink({ type: "recovery", email })
  if (error) throw error
  return `/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery`
}

export async function signIn(page: Page, member: TestMember, password = member.password) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(member.email)
  await page.getByLabel("Kata sandi", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Tanda tangan & masuk" }).click()
}

export async function signInAndOnboard(page: Page, member: TestMember) {
  await signIn(page, member)
  await expect(page).toHaveURL(/\/welcome$/)
  await page.getByRole("button", { name: /Masuk ke perpustakaan/ }).click()
  await expect(page).toHaveURL(/\/lobby$/)
}
```

`e2e/global-teardown.ts`:

```ts
import { existsSync } from "node:fs"
import { E2E_MARKER, admin } from "./helpers/members"

/** Deletes every user created by E2E runs (their emails contain the E2E marker). */
export default async function globalTeardown() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local")
  const client = admin()
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const stale = data.users.filter((user) => user.email?.includes(E2E_MARKER))
    for (const user of stale) await client.auth.admin.deleteUser(user.id)
    if (data.users.length < 1000) break
  }
}
```

- [ ] **Step 2: Tulis spesifikasi E2E**

`e2e/auth.spec.ts`:

```ts
import { expect, test } from "@playwright/test"
import {
  createConfirmedMember,
  newMember,
  recoveryPath,
  signIn,
  signInAndOnboard,
  signupConfirmPath,
} from "./helpers/members"

test("a guest opening the lobby is sent to the guest book", async ({ page }) => {
  await page.goto("/lobby")
  await expect(page).toHaveURL(/\/login\?next=%2Flobby$/)
  await expect(page.getByRole("status")).toContainText("Silakan isi buku tamu")
})

test("the membership form checks usernames as they are typed", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("link", { name: "Daftar jadi anggota" }).click()
  await expect(page).toHaveURL(/\/register$/)
  const usernameField = page.getByLabel("Nama pengguna")
  await usernameField.fill("Ani Baca!")
  await expect(usernameField).toHaveValue("anibaca")
  await usernameField.fill(newMember().username)
  await expect(page.getByText("Nama pengguna tersedia ✓")).toBeVisible()
})

test("a confirmed new member receives a card and enters the lobby", async ({ page }) => {
  const member = newMember()
  await page.goto(await signupConfirmPath(member))
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByText("DITERIMA")).toBeVisible()
  const card = page.getByRole("figure", { name: "Kartu anggota Glosa" })
  await expect(card).toContainText(`@${member.username}`)
  await expect(card).toContainText("GRATIS · 100 MB")

  await page.getByRole("button", { name: /Masuk ke perpustakaan/ }).click()
  await expect(page).toHaveURL(/\/lobby$/)
  await expect(page.getByRole("heading", { name: "Lobi" })).toBeVisible()
})

test("the librarian flags a wrong password, then a returning member goes straight to the lobby", async ({
  page,
}) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await page.goto("/logout")
  await expect(page).toHaveURL(/\/$/)

  await signIn(page, member, "salah-sandi-1")
  await expect(page.getByRole("alert").first()).toContainText("belum cocok")

  await page.getByLabel("Kata sandi", { exact: true }).fill(member.password)
  await page.getByRole("button", { name: "Tanda tangan & masuk" }).click()
  await expect(page).toHaveURL(/\/lobby$/)

  await page.goto("/")
  await expect(page).toHaveURL(/\/lobby\?kembali=1$/)
  await expect(page.getByRole("status")).toContainText("Selamat datang kembali")
})

test("a member sets a new password from a recovery link", async ({ page }) => {
  const member = await createConfirmedMember()
  await page.goto(await recoveryPath(member.email))
  await expect(page).toHaveURL(/\/reset-password$/)
  await page.getByLabel("Kata sandi baru", { exact: true }).fill("sandi-baru-456")
  await page.getByLabel("Ulangi kata sandi baru").fill("sandi-baru-456")
  await page.getByRole("button", { name: "Simpan kata sandi" }).click()
  await expect(page).toHaveURL(/\/welcome$/)

  await page.goto("/logout")
  await signIn(page, member, "sandi-baru-456")
  await expect(page).toHaveURL(/\/welcome$/)
})

test("a member deletes their account", async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await page.goto("/settings")

  const confirmField = page.getByLabel(/Ketik nama penggunamu untuk konfirmasi/)
  await confirmField.fill("bukan-saya")
  await page.getByRole("button", { name: "Hapus akun saya permanen" }).click()
  await expect(page.getByRole("alert")).toContainText("Ketik nama penggunamu persis.")

  await confirmField.fill(member.username)
  await page.getByRole("button", { name: "Hapus akun saya permanen" }).click()
  await expect(page).toHaveURL(/\/$/)

  await signIn(page, member)
  await expect(page.getByRole("alert").first()).toContainText("belum cocok")
})

test.describe("with custom SMTP", () => {
  const template = process.env.E2E_SMTP_EMAIL
  test.skip(!template, "Set E2E_SMTP_EMAIL (e.g. delivered+{id}@resend.dev) once custom SMTP is on")
  const emailFor = (id: string) => (template ?? "").replace("{id}", id)

  test("the membership form sends a confirmation email", async ({ page }) => {
    const member = newMember(emailFor)
    await page.goto("/register")
    await page.getByLabel("Nama lengkap").fill(member.name)
    await page.getByLabel("Nama pengguna").fill(member.username)
    await expect(page.getByText("Nama pengguna tersedia ✓")).toBeVisible()
    await page.getByLabel("Email").fill(member.email)
    await page.getByLabel("Kata sandi", { exact: true }).fill(member.password)
    await page.getByLabel("Saya setuju dengan tata tertib").check()
    await page.getByRole("button", { name: "Ajukan keanggotaan" }).click()
    await expect(page.getByRole("status")).toContainText("Kami kirim surat konfirmasi")
  })

  test("the forgotten-password form sends a reset email", async ({ page }) => {
    const member = await createConfirmedMember(newMember(emailFor))
    await page.goto("/forgot-password")
    await page.getByLabel("Email").fill(member.email)
    await page.getByRole("button", { name: "Kirim surat atur ulang" }).click()
    await expect(page.getByRole("status")).toContainText("sudah kami kirim")
  })
})
```

- [ ] **Step 3: Jalankan E2E**

Run: `npm run test:e2e`
Expected: 12 tests passed dan 4 skipped (6 test × proyek `desktop`/`mobile`, sedangkan 2 test SMTP di-skip tanpa `E2E_SMTP_EMAIL`). Setelah selesai, cek dashboard (Authentication → Users): tidak ada user `e2e-…` yang tersisa.

Jika ada yang gagal, buka trace dengan `npx playwright show-trace test-results/<folder>/trace.zip`. Perbaiki **kode aplikasi**, bukan melemahkan assertion. Pengecualian: jika label atau teks di test berbeda dari teks UI yang ditetapkan di task sebelumnya, ikuti teks UI dari task tersebut. Jika Supabase menolak domain `@glosa.test` saat `createUser`/`generateLink`, ganti domainnya di `newMember` dan `tests/db/profiles.test.ts` dengan domain lain yang tidak dipakai (misalnya `@e2e.glosa.app`) dan catat perubahannya.

- [ ] **Step 4: Lint dan commit**

Run: `npm run typecheck && npm run lint && npm run check`

```bash
git add playwright.config.ts e2e
git commit -m "test(e2e): cover membership, sign-in, password reset and account deletion against the dev project"
```

---

### Task 15: Continuous integration

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: skrip npm dari Task 1. Secret repo GitHub (diisi pemilik proyek saat repo sudah ada di GitHub): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (semuanya dari proyek **dev**), dan opsional `E2E_SMTP_EMAIL`.

- [ ] **Step 1: Workflow CI**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

# Integration and E2E tests share the Supabase dev project; avoid overlapping runs.
concurrency:
  group: supabase-dev
  cancel-in-progress: false

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 30
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
```

- [ ] **Step 2: Validasi seluruh rangkaian secara lokal**

Run: `npm run lint && npm run check && npm run typecheck && npm test && npm run test:db && npm run test:e2e`
Expected: semua lulus. CI baru berjalan setelah repo di-push ke GitHub dan secret diisi. Push dilakukan hanya jika pemilik repo memintanya.

- [ ] **Step 3: Commit**

```bash
git add .github
git commit -m "ci: run lint, typecheck, unit, database and e2e tests against the dev project"
```

---

## Cakupan terhadap spec (untuk reviewer)

| Spec | Task |
|---|---|
| §3 Arsitektur, keputusan teknis (starter shadcn, Supabase Cloud dev/prod, Fontsource) | 1, 2, 5 |
| §4 Model data `profiles`, RLS, kolom server-only | 3 |
| §6 Alur "datang ke perpustakaan" (/, /login, /register, /welcome), callback, lupa/atur ulang sandi, aturan redirect, username otomatis, error lewat petugas, animasi bisa dilewati/reduced motion, hapus akun | 2, 4, 6–12 |
| §6 SMTP kustom produksi | Rencana 1D (uji SMTP di Task 14 sudah disiapkan lewat `E2E_SMTP_EMAIL`) |
| §7 Lobi isometrik penuh | Rencana 1D (Task 12 hanya lobi sementara) |
| §4 `books`, §5 upload/kuota/genre, §8 Rak Saya | Rencana 1B |
| §9–§11 Reader, sinkronisasi, offline | Rencana 1C |
| §13 Testing (unit, integrasi DB/RLS ke proyek dev, E2E) | 1–4, 7, 9, 11, 14 |
| §14 CI | 15 (deploy di rencana 1D) |
| Halaman `/privacy` dan `/terms` | 13 |
