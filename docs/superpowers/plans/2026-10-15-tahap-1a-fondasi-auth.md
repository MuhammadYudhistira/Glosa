# Glosa Tahap 1A — Fondasi & Auth: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun kerangka aplikasi Glosa dan alur anggota "datang ke perpustakaan": tamu tiba di halaman sambutan, mengisi buku tamu atau formulir anggota, mengonfirmasi email, menerima kartu anggota, masuk ke lobi sementara, lalu bisa mengatur profil, keluar, atau menghapus akun.

**Architecture:** TanStack Start (React 19, SSR) menjadi server sekaligus client. Semua operasi auth berjalan lewat *server functions* yang memakai Supabase SSR client berbasis cookie. Root route memuat `SessionUser` ke context router, lalu layout `_member` menjaga rute anggota. Adegan perpustakaan memakai satu SVG statis sebagai latar, dengan state per rute (overview/admin) yang dianimasikan lewat CSS.

**Tech Stack:** TanStack Start + Router, React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Supabase (Auth + Postgres, CLI lokal via Docker), Zod 4, Vitest 5 + Testing Library, Playwright, pgTAP, Biome.

**Seri rencana tahap 1** (spec: [`docs/superpowers/specs/2026-10-15-epub-reader-tahap-1-design.md`](../specs/2026-10-15-epub-reader-tahap-1-design.md)):

| Rencana | Isi | Status |
|---|---|---|
| **1A** | Fondasi proyek, database `profiles`, auth lengkap, kartu anggota, pengaturan, halaman hukum, E2E, CI | **Dokumen ini** |
| 1B | Tabel `books`, Storage, kuota, genre + Troli, Rak Saya, upload, penghapusan file saat hapus akun | Ditulis setelah 1A selesai |
| 1C | Reader foliate-js, sinkronisasi posisi baca, PWA/offline | Ditulis setelah 1B |
| 1D | Lobi isometrik interaktif (hotspot, panel, peta), deploy VPS (Docker, Caddy, GHCR), Sentry | Ditulis setelah 1C |

## Global Constraints

- Node.js **≥ 24**. Package manager: **npm**.
- Teks UI dalam **bahasa Indonesia**, path URL dalam bahasa Inggris.
- Username: regex `^[a-z0-9_]{3,20}$`.
- Kata sandi minimal **8** karakter.
- Kuota default `storage_limit_bytes` = **104857600** (100 MB). Plan: `'free' | 'pro'`, default `'free'`.
- Kolom `plan`, `storage_limit_bytes`, dan `member_no` **tidak boleh** bisa diubah client.
- **Secret key Supabase hanya dipakai di server.** Jangan pernah dipakai di kode client atau diberi prefix `VITE_`.
- Font: Atkinson Hyperlegible (UI), Libre Caslon Text (judul), Caveat (tulisan tangan dekoratif), Courier Prime (mesin tik).
- Semua animasi dimatikan saat `prefers-reduced-motion: reduce` dan bisa dilewati dengan klik.
- Jangan menampilkan menu atau label untuk fitur tahap berikutnya ("segera hadir", tombol mati, dll.).
- "Pengunjung hari ini" hanya berupa **angka**, tanpa nama user lain.
- Isian form adalah `<input>` biasa dengan atribut `autocomplete` yang benar, supaya password manager tetap berfungsi.
- Gaya kode: Biome (2 spasi, kutip tunggal, tanpa titik koma). Import alias `~/*` → `src/*`.
- Gunakan elemen semantik, bukan atribut `role`, jika elemennya ada: `<output>` untuk pesan status, `<figure>` untuk kartu. `role="alert"` tetap dipakai untuk pesan error.

## Struktur file

```
.github/workflows/ci.yml            CI: lint, typecheck, unit, pgTAP, E2E
biome.json · vite.config.ts · vitest.config.ts · playwright.config.ts · tsconfig.json
.env.example                        daftar env yang dibutuhkan
scripts/
  extract-lobby-scene.mjs           ambil SVG adegan dari mockup → public/lobby/scene.svg
  supabase-env.mjs                  tulis .env.local dari `supabase status`
public/lobby/scene.svg              latar adegan sementara (hasil generate)
supabase/
  config.toml                       konfigurasi Supabase lokal
  migrations/20261015000100_profiles.sql
  templates/confirmation.html · recovery.html
  tests/profiles.test.sql           pgTAP
src/
  router.tsx · routeTree.gen.ts (digenerate, di-commit)
  styles/app.css                    token tema Tailwind + CSS adegan/kertas/kartu
  lib/                              logika murni (diuji Vitest)
    cn.ts · username.ts · redirects.ts · auth-messages.ts · member.ts · dates.ts
    action-result.ts · session-types.ts · site.ts
  server/                           hanya berjalan di server
    database.types.ts (digenerate) · supabase.ts · session.ts · auth.ts · profile.ts
  components/
    scene/scene-state.ts · SceneBackdrop.tsx
    ui/Button.tsx · Panel.tsx · Logo.tsx
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
  helpers/env.ts · helpers/mailpit.ts · helpers/members.ts
  auth.spec.ts
```

---

### Task 1: Kerangka proyek

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `biome.json`, `.env.example`
- Create: `src/router.tsx`, `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/styles/app.css`, `src/test/setup.ts`
- Create: `src/lib/cn.ts`
- Test: `src/lib/cn.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `cn(...parts: Array<string | false | null | undefined>): string`. Skrip npm `dev`, `build`, `start`, `typecheck`, `lint`, `format`, `test`, `test:db`, `test:e2e`, `db:start`, `db:stop`, `db:reset`, `db:types`, `env:local`.

- [ ] **Step 1: Buat `package.json`**

```json
{
  "name": "glosa",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "start": "srvx --prod -s ../client dist/server/server.js",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "format": "biome check --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:db": "supabase test db",
    "test:e2e": "playwright test",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:types": "supabase gen types typescript --local > src/server/database.types.ts",
    "env:local": "node scripts/supabase-env.mjs"
  }
}
```

- [ ] **Step 2: Install dependensi**

```bash
npm install @tanstack/react-start @tanstack/react-router react react-dom @supabase/ssr @supabase/supabase-js zod srvx
npm install -D typescript@^6 vite @vitejs/plugin-react tailwindcss @tailwindcss/vite @types/react @types/react-dom @types/node vitest jsdom @testing-library/react @testing-library/jest-dom @playwright/test supabase @biomejs/biome
```

Expected: tidak ada error. `package.json` berisi `dependencies` dan `devDependencies`.

- [ ] **Step 3: Buat file konfigurasi**

`tsconfig.json`:

```json
{
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", "dist"],
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "types": ["node", "vite/client"],
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "target": "ES2022",
    "forceConsistentCasingInFileNames": true,
    "paths": { "~/*": ["./src/*"] },
    "noEmit": true
  }
}
```

`vite.config.ts`:

```ts
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Make .env / .env.local values visible to server code through process.env.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    server: { port: 3000 },
    resolve: { tsconfigPaths: true },
    plugins: [tailwindcss(), tanstackStart(), viteReact()],
  }
})
```

`vitest.config.ts`:

```ts
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [viteReact()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
})
```

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())
```

`biome.json`:

```json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "files": {
    "includes": [
      "**",
      "!src/routeTree.gen.ts",
      "!src/server/database.types.ts",
      "!dist",
      "!docs",
      "!public/lobby",
      "!playwright-report",
      "!test-results",
      "!supabase/.temp"
    ]
  },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "asNeeded" } },
  "linter": { "enabled": true, "rules": { "recommended": true } }
}
```

`.env.example`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SITE_URL=http://localhost:3000
MAILPIT_URL=http://127.0.0.1:54324
```

Tambahkan ke akhir `.gitignore`:

```
dist/
.output/
.tanstack/
playwright-report/
test-results/
supabase/.temp/
```

- [ ] **Step 4: Tulis test yang gagal untuk `cn`**

`src/lib/cn.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('joins truthy class names with a space', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops false, null, undefined and empty strings', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
  })
})
```

- [ ] **Step 5: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/lib/cn.test.ts`
Expected: FAIL, "Failed to resolve import './cn'".

- [ ] **Step 6: Implementasi `cn`**

`src/lib/cn.ts`:

```ts
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
```

- [ ] **Step 7: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/lib/cn.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Buat router, root route, dan halaman awal minimal**

`src/router.tsx`:

```tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
```

`src/styles/app.css`:

```css
@import 'tailwindcss';
```

`src/routes/__root.tsx`:

```tsx
/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from '~/styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Glosa' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

`src/routes/index.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => (
    <main>
      <h1>Glosa</h1>
    </main>
  ),
})
```

- [ ] **Step 9: Build, typecheck, dan lint**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: build berhasil (membuat `dist/` dan `src/routeTree.gen.ts`), typecheck tanpa error, dan Biome tanpa error. Jika Biome hanya melaporkan masalah format, jalankan `npm run format` lalu ulangi.

- [ ] **Step 10: Cek server produksi**

Run: `npm run start` (biarkan berjalan), lalu di terminal lain: `curl -s http://localhost:3000 | grep -o "<h1>Glosa</h1>"`
Expected: `<h1>Glosa</h1>`. Hentikan server dengan Ctrl+C.

- [ ] **Step 11: Commit**

```bash
git add .
git commit -m "chore: scaffold TanStack Start app with Vitest and Biome"
```

---

### Task 2: Tema visual dan latar adegan perpustakaan

**Files:**
- Create: `scripts/extract-lobby-scene.mjs`, `public/lobby/scene.svg` (hasil generate)
- Create: `src/components/scene/scene-state.ts`, `src/components/scene/SceneBackdrop.tsx`
- Test: `src/components/scene/scene-state.test.ts`
- Modify: `src/styles/app.css`, `src/routes/__root.tsx`

**Interfaces:**
- Produces: `type SceneFocus = 'overview' | 'admin'`, `type SceneState = { focus: SceneFocus; dim: boolean; blur: boolean }`, `sceneStateFor(pathname: string): SceneState | null`, komponen `<SceneBackdrop />`. Token Tailwind: `bg-night-900`, `bg-night-950`, `bg-panel`, `border-line`, `text-ink`, `text-muted`, `bg-teal`, `text-mint`, `bg-paper`, `bg-paper-2`, `text-sepia-ink`, `text-sepia-muted`, `bg-maroon`/`text-maroon`, `text-pen`, `text-stamp`, `font-serif`, `font-hand`, `font-type`.

- [ ] **Step 1: Tulis test yang gagal untuk `sceneStateFor`**

`src/components/scene/scene-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { sceneStateFor } from './scene-state'

describe('sceneStateFor', () => {
  it('shows the dimmed overview on the welcome page', () => {
    expect(sceneStateFor('/')).toEqual({ focus: 'overview', dim: true, blur: false })
  })

  it.each(['/login', '/register', '/forgot-password', '/reset-password', '/auth/confirm'])(
    'zooms to the admin desk on %s',
    (path) => {
      expect(sceneStateFor(path)).toEqual({ focus: 'admin', dim: false, blur: false })
    },
  )

  it('blurs the admin desk behind the membership card', () => {
    expect(sceneStateFor('/welcome')).toEqual({ focus: 'admin', dim: true, blur: true })
  })

  it('ignores a trailing slash', () => {
    expect(sceneStateFor('/login/')).toEqual({ focus: 'admin', dim: false, blur: false })
  })

  it('has no backdrop on other pages', () => {
    expect(sceneStateFor('/lobby')).toBeNull()
    expect(sceneStateFor('/privacy')).toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/components/scene/scene-state.test.ts`
Expected: FAIL, "Failed to resolve import './scene-state'".

- [ ] **Step 3: Implementasi `scene-state.ts`**

`src/components/scene/scene-state.ts`:

```ts
export type SceneFocus = 'overview' | 'admin'
export type SceneState = { focus: SceneFocus; dim: boolean; blur: boolean }

const ADMIN_DESK_PATHS = ['/login', '/register', '/forgot-password', '/reset-password']

export function sceneStateFor(pathname: string): SceneState | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return { focus: 'overview', dim: true, blur: false }
  if (ADMIN_DESK_PATHS.includes(path) || path.startsWith('/auth/')) {
    return { focus: 'admin', dim: false, blur: false }
  }
  if (path === '/welcome') return { focus: 'admin', dim: true, blur: true }
  return null
}
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/components/scene/scene-state.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Buat skrip ekstraksi adegan, lalu jalankan**

`scripts/extract-lobby-scene.mjs`:

```js
// Extracts the placeholder lobby scene from the design mockup into a standalone SVG.
// The final illustration (spec §7) will replace public/lobby/scene.svg.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync('docs/superpowers/specs/mockups/lobi.html', 'utf8')
const match = html.match(
  /<svg width="0" height="0" style="position:absolute">([\s\S]*?)<\/svg>\s*<div class="stage">/,
)
if (!match) throw new Error('Scene definitions not found in the lobby mockup')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">${match[1]}<use href="#scene" width="1600" height="900"/></svg>\n`
mkdirSync('public/lobby', { recursive: true })
writeFileSync('public/lobby/scene.svg', svg)
console.log(`public/lobby/scene.svg (${(svg.length / 1024).toFixed(0)} KB)`)
```

Run: `node scripts/extract-lobby-scene.mjs`
Expected: `public/lobby/scene.svg (… KB)` dengan ukuran sekitar 50–60 KB.

- [ ] **Step 6: Tulis token tema dan CSS adegan**

Ganti seluruh isi `src/styles/app.css`:

```css
@import 'tailwindcss';

@theme {
  --font-sans: 'Atkinson Hyperlegible', system-ui, sans-serif;
  --font-serif: 'Libre Caslon Text', Georgia, serif;
  --font-hand: 'Caveat', cursive;
  --font-type: 'Courier Prime', 'Courier New', monospace;

  --color-night-950: #081114;
  --color-night-900: #0b1518;
  --color-panel: rgb(10 28 33 / 0.88);
  --color-line: rgb(120 210 195 / 0.2);
  --color-ink: #e8f2f0;
  --color-muted: #8fb0ab;
  --color-teal: #1fa58a;
  --color-mint: #2fe0b8;

  --color-paper: #f6eedb;
  --color-paper-2: #efe4c9;
  --color-sepia-ink: #2b2118;
  --color-sepia-muted: #6d5a44;
  --color-maroon: #7a2e2e;
  --color-pen: #1d3a6b;
  --color-stamp: #b3261e;
}

@layer base {
  html {
    color-scheme: dark;
  }
  body {
    background: var(--color-night-900);
    color: var(--color-ink);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }
}

/* Library scene backdrop. The canvas is always 16:9 and covers the viewport,
   so focus transforms can be expressed as percentages of the canvas. */
.scene-viewport {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: var(--color-night-900);
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
/* Admin desk sits at (63%, 69%) of the canvas. Desktop: move it to (25%, 50%). */
.scene-canvas[data-focus='admin'] {
  transform: translate(-164%, -157%) scale(3);
}
/* Phone: move it to (50%, 22%) so the guest book sheet fits below. */
@media (max-width: 767px) {
  .scene-canvas[data-focus='admin'] {
    transform: translate(-139%, -185%) scale(3);
  }
}
.scene-canvas[data-blur='true'] {
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

- [ ] **Step 7: Buat `SceneBackdrop`**

`src/components/scene/SceneBackdrop.tsx`:

```tsx
import { useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { sceneStateFor } from './scene-state'

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
      root.dataset.skipAnim = 'true'
      clearTimeout(timer)
      timer = setTimeout(() => {
        delete root.dataset.skipAnim
      }, 1200)
    }
    window.addEventListener('pointerdown', skip)
    return () => {
      window.removeEventListener('pointerdown', skip)
      clearTimeout(timer)
      delete root.dataset.skipAnim
    }
  }, [hasScene])

  if (!state) return null
  return (
    <div aria-hidden="true" className="scene-viewport">
      <div className="scene-canvas" data-focus={state.focus} data-blur={state.blur}>
        <img src="/lobby/scene.svg" alt="" className="scene-image" draggable={false} />
        {state.focus === 'overview' && <span className="scene-pulse" />}
      </div>
      {state.dim && <div className="scene-dim" />}
    </div>
  )
}
```

- [ ] **Step 8: Pasang font dan backdrop di root**

Ganti seluruh isi `src/routes/__root.tsx`:

```tsx
/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { SceneBackdrop } from '~/components/scene/SceneBackdrop'
import appCss from '~/styles/app.css?url'

const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Caveat:wght@500;700&family=Courier+Prime&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&display=swap'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'theme-color', content: '#0b1518' },
      { title: 'Glosa' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: FONTS_URL },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <SceneBackdrop />
      <div className="relative z-10">
        <Outlet />
      </div>
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

- [ ] **Step 9: Verifikasi visual**

Run: `npm run dev`, lalu buka `http://localhost:3000/` di browser.
Expected: adegan perpustakaan memenuhi layar dalam keadaan redup, ada lingkaran berdenyut di Meja Admin, dan teks "Glosa" di atasnya. Ubah lebar jendela ke ukuran HP (DevTools, 390px): adegan tetap menutup layar tanpa scroll horizontal. Hentikan dev server.

- [ ] **Step 10: Jalankan semua test, typecheck, lint, lalu commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: semua lulus.

```bash
git add .
git commit -m "feat: add library theme tokens and scene backdrop"
```

---

### Task 3: Supabase lokal dan tabel `profiles`

**Files:**
- Create: `supabase/config.toml` (lewat `supabase init`, lalu diedit)
- Create: `supabase/migrations/20261015000100_profiles.sql`
- Create: `supabase/tests/profiles.test.sql`
- Create: `scripts/supabase-env.mjs`, `src/server/database.types.ts` (digenerate)

**Interfaces:**
- Produces (SQL): tabel `public.profiles` (`id, member_no, username, display_name, avatar_url, plan, storage_limit_bytes, reader_settings, onboarded_at, created_at`). Fungsi `public.username_available(candidate text) returns boolean` dan `public.visitors_today() returns integer` (dapat dipanggil `anon`/`authenticated`). Trigger `on_auth_user_created`.
- Produces (TS): type `Database` di `src/server/database.types.ts`. File `.env.local` dengan `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SITE_URL`, `MAILPIT_URL`.

- [ ] **Step 1: Inisialisasi Supabase**

Run: `npx supabase init` (jawab "N" untuk pertanyaan VS Code/Deno settings)
Expected: folder `supabase/` berisi `config.toml`.

- [ ] **Step 2: Sesuaikan `supabase/config.toml`**

Ubah atau tambahkan nilai berikut, sesuai nama seksinya masing-masing:

```toml
[auth]
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/auth/callback"]
minimum_password_length = 8

[auth.rate_limit]
email_sent = 100

[auth.email]
enable_confirmations = true
```

- [ ] **Step 3: Tulis test pgTAP yang gagal**

`supabase/tests/profiles.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Arrange: three new members, two of whom signed in today.
insert into auth.users (id, email, raw_user_meta_data, last_sign_in_at) values
  ('11111111-1111-1111-1111-111111111111', 'ani@contoh.com',
   '{"username":"ani_baca","display_name":"Ani"}', now()),
  ('22222222-2222-2222-2222-222222222222', 'budi.santoso@contoh.com',
   '{"full_name":"Budi Santoso"}', now()),
  ('33333333-3333-3333-3333-333333333333', 'Budi.Santoso@lain.com', '{}', null);

select is((select username from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'ani_baca', 'username comes from signup metadata');
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Ani', 'display name comes from signup metadata');
select is((select username from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'budisantoso', 'username falls back to the normalized email local part');
select is((select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'Budi Santoso', 'display name falls back to the Google full_name');
select is((select username from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  'budisantoso1', 'a taken username gets a numeric suffix');
select ok(
  (select member_no from public.profiles where id = '22222222-2222-2222-2222-222222222222') >
  (select member_no from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'member numbers increase');
select is((select plan from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'free', 'new members start on the free plan');
select is((select storage_limit_bytes from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  104857600::bigint, 'new members get 100 MB');
select is(public.visitors_today(), 2, 'visitors_today counts members who signed in today');

-- Act as Ani.
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select count(*) from public.profiles)::int, 1, 'a member only sees their own profile');
select lives_ok(
  $$ update public.profiles set display_name = 'Ani R'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'a member can change their display name');
select throws_ok(
  $$ update public.profiles set plan = 'pro'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'a member cannot change their plan');
select throws_ok(
  $$ update public.profiles set storage_limit_bytes = 1
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'a member cannot change their storage limit');
select is(public.username_available('ani_baca'), false, 'a taken username is unavailable');
select is(public.username_available('Bad Name'), false, 'an invalid username is unavailable');
select is(public.username_available('pembaca_baru'), true, 'a free username is available');

select * from finish();
rollback;
```

- [ ] **Step 4: Jalankan Supabase dan test, pastikan gagal**

Run: `npm run db:start` (pertama kali akan mengunduh image Docker, beberapa menit), lalu `npm run test:db`
Expected: FAIL, misalnya `relation "public.profiles" does not exist`.

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

- [ ] **Step 6: Terapkan migrasi dan jalankan test**

Run: `npm run db:reset && npm run test:db`
Expected: `profiles.test.sql .. ok` dan `All tests successful.` (16 tests).

- [ ] **Step 7: Generate type database dan file env lokal**

`scripts/supabase-env.mjs`:

```js
// Writes .env.local from the running local Supabase stack.
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }))
const pick = (...keys) => {
  for (const key of keys) if (status[key]) return status[key]
  throw new Error(`supabase status has none of: ${keys.join(', ')}`)
}

const env = {
  SUPABASE_URL: pick('API_URL'),
  SUPABASE_PUBLISHABLE_KEY: pick('PUBLISHABLE_KEY', 'ANON_KEY'),
  SUPABASE_SECRET_KEY: pick('SECRET_KEY', 'SERVICE_ROLE_KEY'),
  SITE_URL: 'http://localhost:3000',
  MAILPIT_URL: pick('MAILPIT_URL', 'INBUCKET_URL'),
}
writeFileSync(
  '.env.local',
  `${Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`,
)
console.log('Wrote .env.local')
```

Run: `npm run env:local && npm run db:types`
Expected: `Wrote .env.local`. File `src/server/database.types.ts` terisi dan memuat `profiles`, `username_available`, dan `visitors_today`. Pastikan `.env.local` **tidak** muncul di `git status`.

- [ ] **Step 8: Commit**

```bash
git add supabase scripts/supabase-env.mjs src/server/database.types.ts
git commit -m "feat(db): add member profiles with RLS, username helpers and visitor count"
```

---

### Task 4: Logika murni untuk auth dan kartu anggota

**Files:**
- Create: `src/lib/username.ts`, `src/lib/redirects.ts`, `src/lib/auth-messages.ts`, `src/lib/member.ts`, `src/lib/dates.ts`, `src/lib/action-result.ts`, `src/lib/session-types.ts`, `src/lib/site.ts`
- Test: `src/lib/username.test.ts`, `src/lib/redirects.test.ts`, `src/lib/auth-messages.test.ts`, `src/lib/member.test.ts`, `src/lib/dates.test.ts`

**Interfaces:**
- Produces:
  - `USERNAME_MAX = 20`, `type UsernameProblem = 'too_short' | 'too_long' | 'invalid_chars'`, `normalizeUsername(raw: string): string`, `validateUsername(value: string): UsernameProblem | null`, `USERNAME_PROBLEM_TEXT: Record<UsernameProblem, string>`
  - `DEFAULT_MEMBER_PATH = '/lobby'`, `safeNext(next: unknown): string`, `guestRedirect(user: { onboarded: boolean } | null): string | null`, `memberRedirect(user: { onboarded: boolean } | null, pathname: string): string | null`
  - `type AuthMessage = { bubble: string; field: string }`, `authMessage(code: string | null | undefined): AuthMessage`
  - `formatMemberNo(n: number): string`, `formatMemberSince(iso: string): string`, `formatBytes(bytes: number): string`, `planLabel(plan: Plan): string`
  - `formatLongDate(date: Date): string`
  - `type ActionResult = { ok: true } | { ok: false; code: string }`
  - `type Plan = 'free' | 'pro'`, `toPlan(value: string): Plan`, `type SessionUser = { id; email; provider; username; displayName; memberNo; plan; storageLimitBytes; memberSince; onboarded }`
  - `SITE_NAME = 'Glosa'`, `SITE_TAGLINE`, `LEGAL_CONTACT_EMAIL`

- [ ] **Step 1: Tulis test yang gagal**

`src/lib/username.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeUsername, validateUsername } from './username'

describe('normalizeUsername', () => {
  it('lowercases and strips characters outside a-z, 0-9 and _', () => {
    expect(normalizeUsername('@Yudhis.Dev')).toBe('yudhisdev')
    expect(normalizeUsername('ani_baca 2')).toBe('ani_baca2')
  })

  it('cuts to 20 characters', () => {
    expect(normalizeUsername('a'.repeat(25))).toBe('a'.repeat(20))
  })
})

describe('validateUsername', () => {
  it('accepts 3-20 lowercase letters, digits and underscores', () => {
    expect(validateUsername('ani_baca2')).toBeNull()
  })

  it('reports each problem', () => {
    expect(validateUsername('ab')).toBe('too_short')
    expect(validateUsername('a'.repeat(21))).toBe('too_long')
    expect(validateUsername('Ani')).toBe('invalid_chars')
    expect(validateUsername('ani baca')).toBe('invalid_chars')
  })
})
```

`src/lib/redirects.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { guestRedirect, memberRedirect, safeNext } from './redirects'

describe('safeNext', () => {
  it('keeps same-site paths', () => {
    expect(safeNext('/settings')).toBe('/settings')
    expect(safeNext('/shelf?genre=anak_remaja')).toBe('/shelf?genre=anak_remaja')
  })

  it('falls back to the lobby for anything else', () => {
    expect(safeNext(undefined)).toBe('/lobby')
    expect(safeNext('https://evil.example')).toBe('/lobby')
    expect(safeNext('//evil.example')).toBe('/lobby')
    expect(safeNext('/\\evil.example')).toBe('/lobby')
    expect(safeNext(42)).toBe('/lobby')
  })
})

describe('guestRedirect', () => {
  it('lets guests stay', () => {
    expect(guestRedirect(null)).toBeNull()
  })

  it('sends onboarded members to the lobby with a welcome-back flag', () => {
    expect(guestRedirect({ onboarded: true })).toBe('/lobby?kembali=1')
  })

  it('sends new members to their membership card', () => {
    expect(guestRedirect({ onboarded: false })).toBe('/welcome')
  })
})

describe('memberRedirect', () => {
  it('sends guests to the guest book, remembering where they were going', () => {
    expect(memberRedirect(null, '/settings')).toBe('/login?next=%2Fsettings')
  })

  it('sends members without a card to /welcome first', () => {
    expect(memberRedirect({ onboarded: false }, '/lobby')).toBe('/welcome')
    expect(memberRedirect({ onboarded: false }, '/welcome')).toBeNull()
  })

  it('keeps onboarded members away from /welcome', () => {
    expect(memberRedirect({ onboarded: true }, '/welcome')).toBe('/lobby')
    expect(memberRedirect({ onboarded: true }, '/settings')).toBeNull()
  })
})
```

`src/lib/auth-messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { authMessage } from './auth-messages'

describe('authMessage', () => {
  it('speaks as the librarian for known codes', () => {
    expect(authMessage('invalid_credentials').bubble).toContain('belum cocok')
    expect(authMessage('invalid_credentials').field).toBe('Email atau kata sandi salah.')
  })

  it('falls back to a generic message', () => {
    expect(authMessage('something_new').field).toBe('Terjadi kesalahan. Coba lagi.')
    expect(authMessage(undefined).field).toBe('Terjadi kesalahan. Coba lagi.')
  })
})
```

`src/lib/member.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatBytes, formatMemberNo, formatMemberSince, planLabel } from './member'

describe('member formatting', () => {
  it('pads member numbers to six digits', () => {
    expect(formatMemberNo(342)).toBe('000342')
    expect(formatMemberNo(1234567)).toBe('1234567')
  })

  it('shows the month and year in Indonesian, Jakarta time', () => {
    expect(formatMemberSince('2026-10-15T03:00:00Z')).toBe('Okt 2026')
    expect(formatMemberSince('2026-10-31T20:00:00Z')).toBe('Nov 2026')
  })

  it('formats storage sizes', () => {
    expect(formatBytes(104857600)).toBe('100 MB')
    expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe('5 GB')
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
  })

  it('labels plans', () => {
    expect(planLabel('free')).toBe('GRATIS')
    expect(planLabel('pro')).toBe('PRO')
  })
})
```

`src/lib/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatLongDate } from './dates'

describe('formatLongDate', () => {
  it('writes the date the way a guest book would, in Jakarta time', () => {
    expect(formatLongDate(new Date('2026-10-15T03:00:00Z'))).toBe('Rabu, 15 Oktober 2026')
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

export type UsernameProblem = 'too_short' | 'too_long' | 'invalid_chars'

export function normalizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, USERNAME_MAX)
}

export function validateUsername(value: string): UsernameProblem | null {
  if (/[^a-z0-9_]/.test(value)) return 'invalid_chars'
  if (value.length < USERNAME_MIN) return 'too_short'
  if (value.length > USERNAME_MAX) return 'too_long'
  return null
}

export const USERNAME_PROBLEM_TEXT: Record<UsernameProblem, string> = {
  too_short: 'Minimal 3 karakter.',
  too_long: 'Maksimal 20 karakter.',
  invalid_chars: 'Hanya huruf kecil, angka, dan garis bawah (_).',
}
```

`src/lib/redirects.ts`:

```ts
export const DEFAULT_MEMBER_PATH = '/lobby'

type AuthState = { onboarded: boolean } | null

/** Only same-site absolute paths are allowed as post-login destinations. */
export function safeNext(next: unknown): string {
  if (typeof next !== 'string') return DEFAULT_MEMBER_PATH
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return DEFAULT_MEMBER_PATH
  }
  return next
}

/** For guest-only pages (/, /login, /register, /forgot-password). */
export function guestRedirect(user: AuthState): string | null {
  if (!user) return null
  return user.onboarded ? `${DEFAULT_MEMBER_PATH}?kembali=1` : '/welcome'
}

/** For pages under the _member layout. */
export function memberRedirect(user: AuthState, pathname: string): string | null {
  if (!user) return `/login?next=${encodeURIComponent(pathname)}`
  if (!user.onboarded && pathname !== '/welcome') return '/welcome'
  if (user.onboarded && pathname === '/welcome') return DEFAULT_MEMBER_PATH
  return null
}
```

`src/lib/auth-messages.ts`:

```ts
export type AuthMessage = { bubble: string; field: string }

const MESSAGES: Record<string, AuthMessage> = {
  invalid_credentials: {
    bubble: 'Hmm, email atau kata sandinya belum cocok. Coba lagi, ya.',
    field: 'Email atau kata sandi salah.',
  },
  email_not_confirmed: {
    bubble: 'Surat konfirmasimu belum dibuka. Cek kotak masuk emailmu dulu, ya.',
    field: 'Email belum dikonfirmasi.',
  },
  user_already_exists: {
    bubble: 'Sepertinya email ini sudah terdaftar. Coba masuk saja.',
    field: 'Email sudah terdaftar.',
  },
  email_address_invalid: {
    bubble: 'Alamat email itu sepertinya keliru.',
    field: 'Format email tidak valid.',
  },
  weak_password: {
    bubble: 'Kata sandinya terlalu mudah ditebak. Pakai minimal 8 karakter, ya.',
    field: 'Kata sandi minimal 8 karakter.',
  },
  same_password: {
    bubble: 'Kata sandi baru harus berbeda dari yang lama.',
    field: 'Gunakan kata sandi yang berbeda.',
  },
  password_mismatch: {
    bubble: 'Dua kata sandi yang kamu tulis belum sama.',
    field: 'Kata sandi tidak sama.',
  },
  over_email_send_rate_limit: {
    bubble: 'Terlalu banyak surat terkirim. Tunggu sebentar sebelum mencoba lagi.',
    field: 'Coba lagi beberapa menit lagi.',
  },
  over_request_rate_limit: {
    bubble: 'Meja admin sedang ramai. Tunggu sebentar, ya.',
    field: 'Coba lagi beberapa menit lagi.',
  },
  otp_expired: {
    bubble: 'Tautan di suratmu sudah kedaluwarsa atau sudah dipakai. Minta surat baru, ya.',
    field: 'Tautan kedaluwarsa.',
  },
  username_taken: {
    bubble: 'Nama pengguna itu sudah dipakai anggota lain.',
    field: 'Nama pengguna sudah dipakai.',
  },
  username_invalid: {
    bubble: 'Nama pengguna hanya boleh huruf kecil, angka, dan garis bawah (3–20 karakter).',
    field: '3–20 karakter: huruf kecil, angka, _',
  },
  display_name_invalid: {
    bubble: 'Tulis namamu dulu, maksimal 60 karakter.',
    field: 'Nama wajib diisi (maks. 60 karakter).',
  },
  terms_required: {
    bubble: 'Sebelum jadi anggota, setujui tata tertib perpustakaan dulu, ya.',
    field: 'Centang persetujuan tata tertib.',
  },
  confirm_mismatch: {
    bubble: 'Nama pengguna yang kamu ketik belum sama.',
    field: 'Ketik nama penggunamu persis.',
  },
  not_authenticated: {
    bubble: 'Sesimu sudah berakhir. Silakan isi buku tamu lagi.',
    field: 'Silakan masuk lagi.',
  },
}

const FALLBACK: AuthMessage = {
  bubble: 'Maaf, ada gangguan di meja admin. Coba lagi sebentar lagi.',
  field: 'Terjadi kesalahan. Coba lagi.',
}

export function authMessage(code: string | null | undefined): AuthMessage {
  return (code && MESSAGES[code]) || FALLBACK
}
```

`src/lib/session-types.ts`:

```ts
export type Plan = 'free' | 'pro'

export function toPlan(value: string): Plan {
  return value === 'pro' ? 'pro' : 'free'
}

export type SessionUser = {
  id: string
  email: string
  /** 'email' or an OAuth provider such as 'google'. */
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
import type { Plan } from './session-types'

export function formatMemberNo(n: number): string {
  return String(n).padStart(6, '0')
}

const MONTH_YEAR = new Intl.DateTimeFormat('id-ID', {
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
})

export function formatMemberSince(iso: string): string {
  return MONTH_YEAR.format(new Date(iso))
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return `${Number((mb / 1024).toFixed(1))} GB`
  return `${Math.round(mb)} MB`
}

export function planLabel(plan: Plan): string {
  return plan === 'pro' ? 'PRO' : 'GRATIS'
}
```

`src/lib/dates.ts`:

```ts
const LONG_DATE = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
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
export const SITE_NAME = 'Glosa'
export const SITE_TAGLINE = 'Baca buku aslinya, pahami setiap katanya.'
/** Contact address shown on legal pages. Update once the domain is registered (spec §15). */
export const LEGAL_CONTACT_EMAIL = 'halo@glosa.app'
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/lib`
Expected: PASS untuk semua file di `src/lib`. Jika `formatMemberSince` menghasilkan `Okt 2026` dengan titik (misalnya "Okt. 2026"), sesuaikan implementasi dengan `.replace('.', '')`, bukan mengubah test.

- [ ] **Step 5: Commit**

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
- Consumes: `Database` (Task 3), `SessionUser`, `toPlan` (Task 4), `guestRedirect`, `memberRedirect` (Task 4).
- Produces: `getSupabaseServerClient()`, `getSupabaseAdminClient()`, `siteUrl(): string`, `getSessionUserFn` (server fn GET → `SessionUser | null`). Context router: `context.user: SessionUser | null` di semua rute, dan `context.user: SessionUser` (non-null) di bawah `_member`.

- [ ] **Step 1: Klien Supabase server**

`src/server/supabase.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { getCookies, setCookie } from '@tanstack/react-start/server'
import type { Database } from './database.types'

type ServerEnvName = 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY' | 'SUPABASE_SECRET_KEY' | 'SITE_URL'

function requireEnv(name: ServerEnvName): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

export function siteUrl(): string {
  return requireEnv('SITE_URL').replace(/\/+$/, '')
}

/** Per-request client acting as the signed-in member (cookie session, RLS applies). */
export function getSupabaseServerClient() {
  return createServerClient<Database>(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_PUBLISHABLE_KEY'),
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
    },
  )
}

/** Service-role client. Bypasses RLS — server-only, never expose to the client. */
export function getSupabaseAdminClient() {
  return createClient<Database>(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

- [ ] **Step 2: Server function sesi**

`src/server/session.ts`:

```ts
import { createServerFn } from '@tanstack/react-start'
import { type SessionUser, toPlan } from '~/lib/session-types'
import { getSupabaseServerClient } from './supabase'

export const getSessionUserFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'username, display_name, member_no, plan, storage_limit_bytes, created_at, onboarded_at',
      )
      .eq('id', user.id)
      .single()
    if (!profile) return null

    return {
      id: user.id,
      email: user.email ?? '',
      provider: (user.app_metadata.provider as string | undefined) ?? 'email',
      username: profile.username,
      displayName: profile.display_name,
      memberNo: profile.member_no,
      plan: toPlan(profile.plan),
      storageLimitBytes: profile.storage_limit_bytes,
      memberSince: profile.created_at,
      onboarded: profile.onboarded_at !== null,
    }
  },
)
```

- [ ] **Step 3: Muat sesi di root route**

Di `src/routes/__root.tsx`, tambahkan import `getSessionUserFn`, lalu tambahkan `beforeLoad` ke `createRootRoute`. Hasil bagian atas file:

```tsx
/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { SceneBackdrop } from '~/components/scene/SceneBackdrop'
import { getSessionUserFn } from '~/server/session'
import appCss from '~/styles/app.css?url'

const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Caveat:wght@500;700&family=Courier+Prime&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&display=swap'

export const Route = createRootRoute({
  beforeLoad: async () => ({ user: await getSessionUserFn() }),
  head: () => ({
```

(Bagian `head`, `RootComponent`, dan `RootDocument` tidak berubah.)

- [ ] **Step 4: Layout penjaga anggota**

`src/routes/_member.tsx`:

```tsx
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { memberRedirect } from '~/lib/redirects'

export const Route = createFileRoute('/_member')({
  beforeLoad: ({ context, location }) => {
    const target = memberRedirect(context.user, location.pathname)
    if (target || !context.user) throw redirect({ href: target ?? '/login' })
    return { user: context.user }
  },
  component: Outlet,
})
```

- [ ] **Step 5: Kerangka rute**

Setiap file berikut berisi komponen minimal. Isi lengkapnya ditulis di task-task berikutnya.

`src/routes/index.tsx` (ganti seluruh isinya):

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { guestRedirect } from '~/lib/redirects'

export const Route = createFileRoute('/')({
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

`src/routes/login.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/login')({
  component: () => (
    <main>
      <h1>Buku Tamu</h1>
    </main>
  ),
})
```

`src/routes/register.tsx`, `src/routes/forgot-password.tsx`, `src/routes/reset-password.tsx`, `src/routes/privacy.tsx`, dan `src/routes/terms.tsx` memakai pola yang sama dengan `login.tsx`. Ganti path di `createFileRoute(…)` dan judul `<h1>` berturut-turut menjadi: `'/register'` → "Formulir Anggota", `'/forgot-password'` → "Lupa Kata Sandi", `'/reset-password'` → "Kata Sandi Baru", `'/privacy'` → "Kebijakan Privasi", `'/terms'` → "Syarat Layanan".

`src/routes/logout.tsx`, `src/routes/auth/callback.tsx`, `src/routes/auth/confirm.tsx` juga memakai pola yang sama dengan path `'/logout'`, `'/auth/callback'`, `'/auth/confirm'` dan judul "Keluar", "Memproses…", "Memproses…".

`src/routes/_member/welcome.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_member/welcome')({
  component: () => (
    <main>
      <h1>Kartu Anggota</h1>
    </main>
  ),
})
```

`src/routes/_member/lobby.tsx` dan `src/routes/_member/settings.tsx` memakai pola yang sama dengan path `'/_member/lobby'` → "Lobi" dan `'/_member/settings'` → "Pengaturan".

- [ ] **Step 6: Verifikasi penjaga rute secara manual**

Pastikan Supabase lokal berjalan (`npm run db:start`) dan `.env.local` sudah ada. Run: `npm run dev`, lalu `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/lobby`
Expected: kode 3xx dengan redirect ke `http://localhost:3000/login?next=%2Flobby`. Hentikan dev server.

- [ ] **Step 7: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint`
Expected: semua lulus.

```bash
git add src
git commit -m "feat: load member session into router context and guard member routes"
```

---

### Task 6: Server function auth, template email, dan rute callback

**Files:**
- Create: `src/server/auth.ts`, `src/server/profile.ts`, `src/components/auth/LinkFailed.tsx`
- Create: `supabase/templates/confirmation.html`, `supabase/templates/recovery.html`
- Modify: `supabase/config.toml`
- Modify: `src/routes/auth/callback.tsx`, `src/routes/auth/confirm.tsx`, `src/routes/logout.tsx`

**Interfaces:**
- Consumes: `getSupabaseServerClient`, `getSupabaseAdminClient`, `siteUrl` (Task 5), `ActionResult`, `validateUsername`, `UsernameProblem`, `authMessage` (Task 4).
- Produces (semua `createServerFn`, dipanggil `fn({ data })`):
  - `signInFn({ email, password }) → ActionResult`
  - `signUpFn({ email, password, username, displayName, acceptedTerms }) → ActionResult`
  - `googleSignInFn() → { ok: true; url: string } | { ok: false; code: string }`
  - `requestPasswordResetFn({ email }) → ActionResult`
  - `updatePasswordFn({ password }) → ActionResult`
  - `exchangeCodeFn({ code }) → ActionResult`
  - `verifyOtpFn({ tokenHash, type: 'email' | 'recovery' }) → ActionResult`
  - `signOutFn() → void` (melempar redirect ke `/`)
  - `checkUsernameFn({ username }) → { available: boolean; problem: UsernameProblem | null }`
  - `visitorsTodayFn() → number`
  - `completeOnboardingFn({ username?: string }) → ActionResult`
  - `updateProfileFn({ displayName, username }) → ActionResult`
  - `deleteAccountFn({ confirmUsername }) → ActionResult`

- [ ] **Step 1: Template email (bahasa Indonesia)**

`supabase/templates/confirmation.html`:

```html
<h2>Selamat datang di Glosa</h2>
<p>Terima kasih sudah mengisi formulir anggota. Satu langkah lagi untuk menerima kartu anggotamu:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Konfirmasi keanggotaan</a></p>
<p>Jika kamu tidak merasa mendaftar, abaikan surat ini.</p>
```

`supabase/templates/recovery.html`:

```html
<h2>Atur ulang kata sandi Glosa</h2>
<p>Seseorang meminta untuk mengatur ulang kata sandi akunmu. Jika itu kamu, buka tautan berikut:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Buat kata sandi baru</a></p>
<p>Jika bukan kamu, abaikan surat ini. Kata sandimu tidak berubah.</p>
```

Tambahkan ke `supabase/config.toml`:

```toml
[auth.email.template.confirmation]
subject = "Konfirmasi keanggotaan Glosa"
content_path = "./supabase/templates/confirmation.html"

[auth.email.template.recovery]
subject = "Atur ulang kata sandi Glosa"
content_path = "./supabase/templates/recovery.html"
```

Login Google **tidak** diaktifkan secara lokal. Untuk mencobanya, tambahkan seksi `[auth.external.google]` dengan `enabled = true`, `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"`, `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"`, lalu isi kedua env itu sebelum `supabase start`. Jangan meng-commit perubahan tersebut.

Run: `npm run db:stop && npm run db:start`
Expected: Supabase berjalan lagi tanpa error konfigurasi.

- [ ] **Step 2: `src/server/auth.ts`**

```ts
import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { ActionResult } from '~/lib/action-result'
import { validateUsername } from '~/lib/username'
import { getSupabaseServerClient, siteUrl } from './supabase'

const Email = z.email()

function fail(code: string | undefined): ActionResult {
  return { ok: false, code: code ?? 'unknown' }
}

export const signInFn = createServerFn({ method: 'POST' })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!Email.safeParse(data.email).success || data.password.length === 0) {
      return fail('invalid_credentials')
    }
    const { error } = await getSupabaseServerClient().auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    return error ? fail(error.code) : { ok: true }
  })

export const signUpFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      email: string
      password: string
      username: string
      displayName: string
      acceptedTerms: boolean
    }) => data,
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const displayName = data.displayName.trim()
    if (displayName.length === 0 || displayName.length > 60) return fail('display_name_invalid')
    if (validateUsername(data.username)) return fail('username_invalid')
    if (!Email.safeParse(data.email).success) return fail('email_address_invalid')
    if (data.password.length < 8) return fail('weak_password')
    if (!data.acceptedTerms) return fail('terms_required')

    const supabase = getSupabaseServerClient()
    const { data: available } = await supabase.rpc('username_available', {
      candidate: data.username,
    })
    if (!available) return fail('username_taken')

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { username: data.username, display_name: displayName } },
    })
    return error ? fail(error.code) : { ok: true }
  })

export const googleSignInFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<{ ok: true; url: string } | { ok: false; code: string }> => {
    const { data, error } = await getSupabaseServerClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${siteUrl()}/auth/callback` },
    })
    if (error || !data.url) return { ok: false, code: error?.code ?? 'unknown' }
    return { ok: true, url: data.url }
  },
)

export const requestPasswordResetFn = createServerFn({ method: 'POST' })
  .validator((data: { email: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!Email.safeParse(data.email).success) return fail('email_address_invalid')
    const { error } = await getSupabaseServerClient().auth.resetPasswordForEmail(data.email)
    // Never reveal whether the address is registered; only surface rate limits.
    if (error?.code?.startsWith('over_')) return fail(error.code)
    return { ok: true }
  })

export const updatePasswordFn = createServerFn({ method: 'POST' })
  .validator((data: { password: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    if (data.password.length < 8) return fail('weak_password')
    const { error } = await getSupabaseServerClient().auth.updateUser({ password: data.password })
    return error ? fail(error.code) : { ok: true }
  })

export const exchangeCodeFn = createServerFn({ method: 'POST' })
  .validator((data: { code: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!data.code) return fail('otp_expired')
    const { error } = await getSupabaseServerClient().auth.exchangeCodeForSession(data.code)
    return error ? fail(error.code ?? 'otp_expired') : { ok: true }
  })

export const verifyOtpFn = createServerFn({ method: 'POST' })
  .validator((data: { tokenHash: string; type: 'email' | 'recovery' }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!data.tokenHash) return fail('otp_expired')
    const { error } = await getSupabaseServerClient().auth.verifyOtp({
      type: data.type,
      token_hash: data.tokenHash,
    })
    return error ? fail(error.code ?? 'otp_expired') : { ok: true }
  })

export const signOutFn = createServerFn({ method: 'POST' }).handler(async () => {
  await getSupabaseServerClient().auth.signOut()
  throw redirect({ href: '/' })
})
```

- [ ] **Step 3: `src/server/profile.ts`**

```ts
import { createServerFn } from '@tanstack/react-start'
import type { ActionResult } from '~/lib/action-result'
import { type UsernameProblem, validateUsername } from '~/lib/username'
import { getSupabaseAdminClient, getSupabaseServerClient } from './supabase'

const UNIQUE_VIOLATION = '23505'

export const checkUsernameFn = createServerFn({ method: 'GET' })
  .validator((data: { username: string }) => data)
  .handler(async ({ data }): Promise<{ available: boolean; problem: UsernameProblem | null }> => {
    const problem = validateUsername(data.username)
    if (problem) return { available: false, problem }
    const { data: available } = await getSupabaseServerClient().rpc('username_available', {
      candidate: data.username,
    })
    return { available: available === true, problem: null }
  })

export const visitorsTodayFn = createServerFn({ method: 'GET' }).handler(async (): Promise<number> => {
  const { data } = await getSupabaseServerClient().rpc('visitors_today')
  return data ?? 0
})

export const completeOnboardingFn = createServerFn({ method: 'POST' })
  .validator((data: { username?: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, code: 'not_authenticated' }

    const patch: { onboarded_at: string; username?: string } = {
      onboarded_at: new Date().toISOString(),
    }
    if (data.username !== undefined) {
      if (validateUsername(data.username)) return { ok: false, code: 'username_invalid' }
      patch.username = data.username
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    if (error) {
      return { ok: false, code: error.code === UNIQUE_VIOLATION ? 'username_taken' : 'unknown' }
    }
    return { ok: true }
  })

export const updateProfileFn = createServerFn({ method: 'POST' })
  .validator((data: { displayName: string; username: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    const displayName = data.displayName.trim()
    if (displayName.length === 0 || displayName.length > 60) {
      return { ok: false, code: 'display_name_invalid' }
    }
    if (validateUsername(data.username)) return { ok: false, code: 'username_invalid' }

    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, code: 'not_authenticated' }

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName, username: data.username })
      .eq('id', user.id)
    if (error) {
      return { ok: false, code: error.code === UNIQUE_VIOLATION ? 'username_taken' : 'unknown' }
    }
    return { ok: true }
  })

export const deleteAccountFn = createServerFn({ method: 'POST' })
  .validator((data: { confirmUsername: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, code: 'not_authenticated' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
    if (!profile || profile.username !== data.confirmUsername.trim()) {
      return { ok: false, code: 'confirm_mismatch' }
    }

    // Plan 1B adds: remove the member's Storage objects before deleting the user.
    const { error } = await getSupabaseAdminClient().auth.admin.deleteUser(user.id)
    if (error) return { ok: false, code: 'unknown' }

    // The user no longer exists server-side; just clear the session cookies.
    await supabase.auth.signOut({ scope: 'local' })
    return { ok: true }
  })
```

- [ ] **Step 4: Rute `/auth/confirm` dan `/auth/callback`**

Kedua rute menampilkan panel kegagalan yang sama, sehingga komponennya diletakkan di file tersendiri: `src/components/auth/LinkFailed.tsx`.

```tsx
import { Link } from '@tanstack/react-router'
import { authMessage } from '~/lib/auth-messages'

export function LinkFailed({ code }: { code: string }) {
  const message = authMessage(code)
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 text-center backdrop-blur-md">
        <h1 className="font-serif text-2xl font-bold">Tautan tidak berlaku</h1>
        <p className="mt-2 text-sm text-muted">{message.bubble}</p>
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
import { createFileRoute, redirect } from '@tanstack/react-router'
import { LinkFailed } from '~/components/auth/LinkFailed'
import { verifyOtpFn } from '~/server/auth'

type ConfirmSearch = { token_hash: string; type: 'email' | 'recovery' }

export const Route = createFileRoute('/auth/confirm')({
  validateSearch: (search: Record<string, unknown>): ConfirmSearch => ({
    token_hash: typeof search.token_hash === 'string' ? search.token_hash : '',
    type: search.type === 'recovery' ? 'recovery' : 'email',
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const result = await verifyOtpFn({ data: { tokenHash: deps.token_hash, type: deps.type } })
    if (result.ok) {
      throw redirect({ href: deps.type === 'recovery' ? '/reset-password' : '/welcome' })
    }
    return result
  },
  component: ConfirmFailed,
})

function ConfirmFailed() {
  const result = Route.useLoaderData()
  return <LinkFailed code={result.ok ? 'unknown' : result.code} />
}
```

`src/routes/auth/callback.tsx` (ganti seluruh isinya):

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { LinkFailed } from '~/components/auth/LinkFailed'
import { exchangeCodeFn } from '~/server/auth'

export const Route = createFileRoute('/auth/callback')({
  validateSearch: (search: Record<string, unknown>): { code: string } => ({
    code: typeof search.code === 'string' ? search.code : '',
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const result = await exchangeCodeFn({ data: { code: deps.code } })
    // The _member guard sends already-onboarded members on to the lobby.
    if (result.ok) throw redirect({ href: '/welcome' })
    return result
  },
  component: CallbackFailed,
})

function CallbackFailed() {
  const result = Route.useLoaderData()
  return <LinkFailed code={result.ok ? 'unknown' : result.code} />
}
```

`src/routes/logout.tsx` (ganti seluruh isinya):

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { signOutFn } from '~/server/auth'

export const Route = createFileRoute('/logout')({
  preload: false,
  loader: () => signOutFn(),
})
```

- [ ] **Step 5: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint`
Expected: semua lulus. Alur ini diuji end-to-end di Task 14.

```bash
git add src supabase
git commit -m "feat(auth): add auth and profile server functions, email templates and link routes"
```

---

### Task 7: Komponen UI dasar dan komponen buku tamu

**Files:**
- Create: `src/components/ui/Button.tsx`, `src/components/ui/Panel.tsx`, `src/components/ui/Logo.tsx`
- Create: `src/components/auth/LibrarianBubble.tsx`, `src/components/auth/PaperField.tsx`, `src/components/auth/GuestBook.tsx`, `src/components/auth/AdminDesk.tsx`, `src/components/auth/GoogleButton.tsx`
- Test: `src/components/auth/PaperField.test.tsx`, `src/components/auth/LibrarianBubble.test.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `cn` (Task 1), `googleSignInFn` (Task 6).
- Produces:
  - `type ButtonVariant = 'primary' | 'secondary' | 'ink' | 'paper'`, `buttonClass(variant?: ButtonVariant, extra?: string): string`, `<Button variant? …buttonProps />`
  - `<Panel className? …divProps />`, `<Logo className? />`
  - `<LibrarianBubble tone?: 'info' | 'error'>children</LibrarianBubble>`
  - `<PaperField label error? hint? …inputProps />`
  - `<GuestBook aside?>children</GuestBook>`, `<PaperDivider>children</PaperDivider>`
  - `<AdminDesk bubble>children</AdminDesk>`
  - `<GoogleButton label />`

- [ ] **Step 1: Tulis test yang gagal**

`src/components/auth/PaperField.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PaperField } from './PaperField'

describe('PaperField', () => {
  it('labels its input', () => {
    render(<PaperField label="Email" name="email" type="email" autoComplete="email" />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('autocomplete', 'email')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('links the error message to the input', () => {
    render(<PaperField label="Email" name="email" error="Format email tidak valid." />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Format email tidak valid.')
  })

  it('shows a hint when there is no error', () => {
    render(<PaperField label="Nama pengguna" name="username" hint="Nama pengguna tersedia ✓" />)
    expect(screen.getByLabelText('Nama pengguna')).toHaveAccessibleDescription(
      'Nama pengguna tersedia ✓',
    )
  })
})
```

`src/components/auth/LibrarianBubble.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LibrarianBubble } from './LibrarianBubble'

describe('LibrarianBubble', () => {
  it('is a polite status by default', () => {
    render(<LibrarianBubble>Silakan isi buku tamu, ya.</LibrarianBubble>)
    expect(screen.getByRole('status')).toHaveTextContent('Petugas perpustakaan')
  })

  it('becomes an alert for errors', () => {
    render(<LibrarianBubble tone="error">Kata sandinya belum cocok.</LibrarianBubble>)
    expect(screen.getByRole('alert')).toHaveTextContent('Kata sandinya belum cocok.')
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/components/auth`
Expected: FAIL, modul belum ada.

- [ ] **Step 3: Implementasi komponen**

`src/components/ui/Button.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { cn } from '~/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ink' | 'paper'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-teal text-white hover:bg-teal/90',
  secondary: 'border border-line text-ink hover:bg-white/5',
  ink: 'bg-maroon text-paper tracking-wide hover:bg-maroon/90',
  paper: 'border border-[#d9cba9] bg-white text-sepia-ink hover:bg-paper',
}

export function buttonClass(variant: ButtonVariant = 'primary', extra?: string): string {
  return cn(
    'inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    extra,
  )
}

export function Button({
  variant,
  className,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant }) {
  return <button type="button" {...props} className={buttonClass(variant, className)} />
}
```

`src/components/ui/Panel.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { cn } from '~/lib/cn'

export function Panel({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cn(
        'rounded-2xl border border-line bg-panel shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md',
        className,
      )}
    />
  )
}
```

`src/components/ui/Logo.tsx`:

```tsx
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M20 6 L34 12 V30 L20 36 L6 30 V12 Z" fill="#0f3a36" stroke="#2fe0b8" strokeWidth="1.5" />
      <path d="M12 15 h7 v14 h-7 z M21 15 h7 v14 h-7 z" fill="#e8f1f0" />
    </svg>
  )
}
```

`src/components/auth/LibrarianBubble.tsx`:

```tsx
import type { ReactNode } from 'react'

export function LibrarianBubble({
  children,
  tone = 'info',
}: {
  children: ReactNode
  tone?: 'info' | 'error'
}) {
  return (
    tone === 'error' ? (
      <div role="alert" className="librarian-bubble">
        <b className="block text-[11px] text-[#1f6f63]">Petugas perpustakaan</b>
        {children}
      </div>
    ) : (
      // <output> carries the implicit "status" role (polite live region).
      <output className="librarian-bubble block">
        <b className="block text-[11px] text-[#1f6f63]">Petugas perpustakaan</b>
        {children}
      </output>
    )
  )
}
```

`src/components/auth/PaperField.tsx`:

```tsx
import { type ComponentProps, useId } from 'react'
import { cn } from '~/lib/cn'

type Props = ComponentProps<'input'> & { label: string; error?: string; hint?: string }

export function PaperField({ label, error, hint, id, className, ...props }: Props) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const noteId = `${inputId}-note`
  const note = error ?? hint

  return (
    <div className={cn('mb-3', className)}>
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
        <p id={noteId} className={cn('mt-1 text-xs', error ? 'text-stamp' : 'text-sepia-muted')}>
          {note}
        </p>
      )}
    </div>
  )
}
```

`src/components/auth/GuestBook.tsx`:

```tsx
import type { ReactNode } from 'react'

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
import type { ReactNode } from 'react'

/** Lays a page out in front of the zoomed-in admin desk (see .scene-canvas[data-focus='admin']). */
export function AdminDesk({ bubble, children }: { bubble: ReactNode; children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col justify-end p-3 pt-28 md:flex-row md:items-center md:justify-end md:p-8">
      <div className="absolute left-4 top-4 max-w-[17rem] md:left-[6%] md:top-[14%]">{bubble}</div>
      <div className="w-full md:w-[min(62vw,52rem)]">{children}</div>
    </main>
  )
}
```

`src/components/auth/GoogleButton.tsx`:

```tsx
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { Button } from '~/components/ui/Button'
import { googleSignInFn } from '~/server/auth'

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
      <Button variant="paper" onClick={onClick} disabled={pending}>
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
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

Tambahkan ke akhir `src/styles/app.css`:

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
  content: '';
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

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `npx vitest run src/components/auth`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint`

```bash
git add src
git commit -m "feat(ui): add base buttons, panel, librarian bubble and guest book components"
```

---

### Task 8: Halaman sambutan (`/`) dan buku tamu (`/login`)

**Files:**
- Create: `src/components/auth/GuestBookRules.tsx`
- Modify: `src/routes/index.tsx`, `src/routes/login.tsx`

**Interfaces:**
- Consumes: `Panel`, `Logo`, `buttonClass`, `Button` (Task 7). `AdminDesk`, `GuestBook`, `PaperDivider`, `PaperField`, `LibrarianBubble`, `GoogleButton` (Task 7). `signInFn` (Task 6), `visitorsTodayFn` (Task 6), `authMessage`, `safeNext`, `guestRedirect`, `formatLongDate`, `SITE_TAGLINE` (Task 4).
- Produces: `<GuestBookRules visitors={number} />`.

- [ ] **Step 1: Halaman sambutan**

`src/routes/index.tsx` (ganti seluruh isinya):

```tsx
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { buttonClass } from '~/components/ui/Button'
import { Logo } from '~/components/ui/Logo'
import { Panel } from '~/components/ui/Panel'
import { guestRedirect } from '~/lib/redirects'
import { SITE_TAGLINE } from '~/lib/site'

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    const target = guestRedirect(context.user)
    if (target) throw redirect({ href: target })
  },
  head: () => ({
    meta: [
      { title: `Glosa — ${SITE_TAGLINE}` },
      {
        name: 'description',
        content:
          'Glosa adalah perpustakaan pribadimu untuk belajar bahasa Inggris lewat buku: unggah EPUB, baca dengan nyaman, dan pahami setiap kata.',
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
        <h1 className="mt-3 font-serif text-2xl font-bold sm:text-3xl">Selamat datang di Glosa</h1>
        <p className="mt-2 text-sm text-muted">
          Perpustakaan pribadimu untuk belajar bahasa Inggris lewat buku.
        </p>
        <div className="mt-6 grid gap-2.5">
          <Link to="/login" className={buttonClass('primary')}>
            Masuk
          </Link>
          <Link to="/register" className={buttonClass('secondary')}>
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
import { formatLongDate } from '~/lib/dates'

export function GuestBookRules({ visitors }: { visitors: number }) {
  return (
    <div className="flex h-full flex-col">
      <h1 className="font-hand text-3xl font-bold leading-none text-maroon">Buku Tamu</h1>
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
import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { type FormEvent, useState } from 'react'
import { AdminDesk } from '~/components/auth/AdminDesk'
import { GoogleButton } from '~/components/auth/GoogleButton'
import { GuestBook, PaperDivider } from '~/components/auth/GuestBook'
import { GuestBookRules } from '~/components/auth/GuestBookRules'
import { LibrarianBubble } from '~/components/auth/LibrarianBubble'
import { PaperField } from '~/components/auth/PaperField'
import { Button } from '~/components/ui/Button'
import { authMessage } from '~/lib/auth-messages'
import { guestRedirect, safeNext } from '~/lib/redirects'
import { signInFn } from '~/server/auth'
import { visitorsTodayFn } from '~/server/profile'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: typeof search.next === 'string' ? search.next : undefined,
  }),
  beforeLoad: ({ context }) => {
    const target = guestRedirect(context.user)
    if (target) throw redirect({ href: target })
  },
  loader: () => visitorsTodayFn(),
  head: () => ({ meta: [{ title: 'Buku Tamu — Glosa' }] }),
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
        email: String(form.get('email') ?? '').trim(),
        password: String(form.get('password') ?? ''),
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
        <LibrarianBubble tone={message ? 'error' : 'info'}>
          {message ? message.bubble : 'Selamat datang! Silakan isi buku tamu, ya.'}
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
          <Button type="submit" variant="ink" disabled={pending} className="mt-1">
            {pending ? 'Menandatangani…' : 'Tanda tangan & masuk'}
          </Button>
        </form>
        <PaperDivider>atau</PaperDivider>
        <GoogleButton label="Masuk dengan Google" />
        <div className="mt-3 flex justify-between gap-3 text-xs text-sepia-muted">
          <span>
            Belum jadi anggota?{' '}
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
- Kamera zoom ke Meja Admin dalam ±0,8 detik.
- Desktop: balon petugas di kiri atas dan buku tamu dua halaman di kanan.
- HP (390px): balon di atas dan halaman kanan berbentuk lembar di bawah.
- Login dengan email asal memunculkan balon "Hmm, email atau kata sandinya belum cocok…" dan pesan di bawah isian Email.
- Dengan DevTools → Rendering → "prefers-reduced-motion: reduce", zoom terjadi tanpa animasi.

- [ ] **Step 5: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint`

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
- Consumes: `validateUsername`, `normalizeUsername`, `USERNAME_PROBLEM_TEXT`, `UsernameProblem` (Task 4), `signUpFn` (Task 6), `checkUsernameFn` (Task 6), komponen Task 7.
- Produces: `type UsernameStatus = { state: 'idle' } | { state: 'checking' } | { state: 'available' } | { state: 'taken' } | { state: 'invalid'; problem: UsernameProblem }`, `type UsernameChecker = (username: string) => Promise<{ available: boolean; problem: UsernameProblem | null }>`, `useUsernameCheck(value: string, check: UsernameChecker, delayMs?: number): UsernameStatus`, `usernameStatusText(status: UsernameStatus): string | undefined`.

- [ ] **Step 1: Tulis test yang gagal**

`src/components/auth/useUsernameCheck.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type UsernameChecker, useUsernameCheck } from './useUsernameCheck'

describe('useUsernameCheck', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('stays idle for an empty value', () => {
    const check = vi.fn<UsernameChecker>()
    const { result } = renderHook(() => useUsernameCheck('', check))
    expect(result.current).toEqual({ state: 'idle' })
    expect(check).not.toHaveBeenCalled()
  })

  it('reports local problems without asking the server', () => {
    const check = vi.fn<UsernameChecker>()
    const { result } = renderHook(() => useUsernameCheck('ab', check))
    expect(result.current).toEqual({ state: 'invalid', problem: 'too_short' })
    expect(check).not.toHaveBeenCalled()
  })

  it('checks availability after the debounce delay', async () => {
    const check = vi.fn<UsernameChecker>().mockResolvedValue({ available: true, problem: null })
    const { result } = renderHook(() => useUsernameCheck('ani_baca', check, 400))
    expect(result.current).toEqual({ state: 'checking' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(check).toHaveBeenCalledWith('ani_baca')
    expect(result.current).toEqual({ state: 'available' })
  })

  it('reports a taken username', async () => {
    const check = vi.fn<UsernameChecker>().mockResolvedValue({ available: false, problem: null })
    const { result } = renderHook(() => useUsernameCheck('ani_baca', check, 400))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(result.current).toEqual({ state: 'taken' })
  })

  it('only checks the last value while typing', async () => {
    const check = vi.fn<UsernameChecker>().mockResolvedValue({ available: true, problem: null })
    const { rerender } = renderHook(({ value }) => useUsernameCheck(value, check, 400), {
      initialProps: { value: 'ani' },
    })
    rerender({ value: 'ani_' })
    rerender({ value: 'ani_b' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(check).toHaveBeenCalledTimes(1)
    expect(check).toHaveBeenCalledWith('ani_b')
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/components/auth/useUsernameCheck.test.ts`
Expected: FAIL, modul belum ada.

- [ ] **Step 3: Implementasi hook**

`src/components/auth/useUsernameCheck.ts`:

```ts
import { useEffect, useRef, useState } from 'react'
import { USERNAME_PROBLEM_TEXT, type UsernameProblem, validateUsername } from '~/lib/username'

export type UsernameStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available' }
  | { state: 'taken' }
  | { state: 'invalid'; problem: UsernameProblem }

export type UsernameChecker = (
  username: string,
) => Promise<{ available: boolean; problem: UsernameProblem | null }>

export function useUsernameCheck(
  value: string,
  check: UsernameChecker,
  delayMs = 400,
): UsernameStatus {
  const [status, setStatus] = useState<UsernameStatus>({ state: 'idle' })
  // Keep the latest checker without restarting the debounce when its identity changes.
  const checkRef = useRef(check)
  checkRef.current = check

  useEffect(() => {
    if (value === '') {
      setStatus({ state: 'idle' })
      return
    }
    const problem = validateUsername(value)
    if (problem) {
      setStatus({ state: 'invalid', problem })
      return
    }
    setStatus({ state: 'checking' })
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const result = await checkRef.current(value)
        if (cancelled) return
        if (result.available) setStatus({ state: 'available' })
        else if (result.problem) setStatus({ state: 'invalid', problem: result.problem })
        else setStatus({ state: 'taken' })
      } catch {
        if (!cancelled) setStatus({ state: 'idle' })
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
    case 'checking':
      return 'Sedang mengecek…'
    case 'available':
      return 'Nama pengguna tersedia ✓'
    case 'taken':
      return 'Sudah dipakai anggota lain.'
    case 'invalid':
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
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { type FormEvent, useCallback, useState } from 'react'
import { AdminDesk } from '~/components/auth/AdminDesk'
import { GoogleButton } from '~/components/auth/GoogleButton'
import { LibrarianBubble } from '~/components/auth/LibrarianBubble'
import { PaperField } from '~/components/auth/PaperField'
import { useUsernameCheck, usernameStatusText } from '~/components/auth/useUsernameCheck'
import { Button } from '~/components/ui/Button'
import { authMessage } from '~/lib/auth-messages'
import { guestRedirect } from '~/lib/redirects'
import { normalizeUsername } from '~/lib/username'
import { signUpFn } from '~/server/auth'
import { checkUsernameFn } from '~/server/profile'

export const Route = createFileRoute('/register')({
  beforeLoad: ({ context }) => {
    const target = guestRedirect(context.user)
    if (target) throw redirect({ href: target })
  },
  head: () => ({ meta: [{ title: 'Formulir Anggota — Glosa' }] }),
  component: RegisterPage,
})

function RegisterPage() {
  const signUp = useServerFn(signUpFn)
  const checkUsername = useServerFn(checkUsernameFn)
  const checker = useCallback(
    (username: string) => checkUsername({ data: { username } }),
    [checkUsername],
  )
  const [username, setUsername] = useState('')
  const usernameStatus = useUsernameCheck(username, checker)
  const [pending, setPending] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const message = errorCode ? authMessage(errorCode) : null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (usernameStatus.state === 'checking') return
    if (usernameStatus.state !== 'available') {
      setErrorCode(usernameStatus.state === 'taken' ? 'username_taken' : 'username_invalid')
      return
    }
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    setPending(true)
    setErrorCode(null)
    const result = await signUp({
      data: {
        email,
        password: String(form.get('password') ?? ''),
        username,
        displayName: String(form.get('displayName') ?? ''),
        acceptedTerms: form.get('acceptedTerms') === 'on',
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
    : (message?.bubble ?? 'Anggota baru? Isi satu formulir ini, kartumu langsung jadi.')

  return (
    <AdminDesk
      bubble={<LibrarianBubble tone={message ? 'error' : 'info'}>{bubble}</LibrarianBubble>}
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
                error={errorCode === 'display_name_invalid' ? message?.field : undefined}
              />
              <PaperField
                label="Nama pengguna"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(normalizeUsername(event.target.value))}
                required
                error={
                  usernameStatus.state === 'taken' || usernameStatus.state === 'invalid'
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
                error={errorCode === 'email_address_invalid' ? message?.field : undefined}
              />
              <PaperField
                label="Kata sandi"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                error={errorCode === 'weak_password' ? message?.field : undefined}
              />
            </div>
            <label className="my-3 flex items-start gap-2 text-xs">
              <input type="checkbox" name="acceptedTerms" required className="mt-0.5 accent-[#1f5e45]" />
              <span>
                Saya setuju dengan tata tertib (
                <Link to="/terms" target="_blank" className="underline">
                  Syarat Layanan
                </Link>{' '}
                &amp;{' '}
                <Link to="/privacy" target="_blank" className="underline">
                  Kebijakan Privasi
                </Link>
                )
              </span>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="submit" variant="ink" disabled={pending}>
                {pending ? 'Mengirim…' : 'Ajukan keanggotaan'}
              </Button>
              <GoogleButton label="Daftar dengan Google" />
            </div>
          </form>
        )}
        <p className="mt-3 text-xs text-sepia-muted">
          Sudah jadi anggota?{' '}
          <Link to="/login" className="underline">
            Isi buku tamu
          </Link>
        </p>
      </div>
    </AdminDesk>
  )
}
```

Catatan: label persetujuan berisi tautan, sehingga teks label lengkapnya adalah "Saya setuju dengan tata tertib (Syarat Layanan & Kebijakan Privasi)". Test E2E mencarinya dengan `getByLabel('Saya setuju dengan tata tertib')`.

- [ ] **Step 6: Verifikasi manual**

Run: `npm run dev`, buka `/register`.
Expected:
- Ketik "Ani Baca!" di Nama pengguna: isinya berubah menjadi `anibaca`, lalu muncul "Sedang mengecek…" yang berganti menjadi "Nama pengguna tersedia ✓".
- Kirim form lengkap: balon dan lembar formulir menampilkan "Kami kirim surat konfirmasi ke …".
- Buka Mailpit di `http://127.0.0.1:54324`: ada surat berjudul "Konfirmasi keanggotaan Glosa".

- [ ] **Step 7: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint`

```bash
git add src
git commit -m "feat(auth): add membership form with live username check"
```

---

### Task 10: Lupa dan atur ulang kata sandi

**Files:**
- Modify: `src/routes/forgot-password.tsx`, `src/routes/reset-password.tsx`

**Interfaces:**
- Consumes: `requestPasswordResetFn`, `updatePasswordFn` (Task 6), `AdminDesk`, `GuestBook`, `PaperField`, `LibrarianBubble`, `Button` (Task 7), `authMessage`, `guestRedirect` (Task 4).

- [ ] **Step 1: Halaman lupa kata sandi**

`src/routes/forgot-password.tsx` (ganti seluruh isinya):

```tsx
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { type FormEvent, useState } from 'react'
import { AdminDesk } from '~/components/auth/AdminDesk'
import { GuestBook } from '~/components/auth/GuestBook'
import { LibrarianBubble } from '~/components/auth/LibrarianBubble'
import { PaperField } from '~/components/auth/PaperField'
import { Button } from '~/components/ui/Button'
import { authMessage } from '~/lib/auth-messages'
import { guestRedirect } from '~/lib/redirects'
import { requestPasswordResetFn } from '~/server/auth'

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: ({ context }) => {
    const target = guestRedirect(context.user)
    if (target) throw redirect({ href: target })
  },
  head: () => ({ meta: [{ title: 'Lupa Kata Sandi — Glosa' }] }),
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
    const result = await requestReset({ data: { email: String(form.get('email') ?? '').trim() } })
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
        <LibrarianBubble tone={message ? 'error' : 'info'}>
          {sent
            ? 'Jika email itu terdaftar, surat untuk membuat kata sandi baru sudah kami kirim.'
            : (message?.bubble ?? 'Lupa kata sandi? Tulis emailmu, nanti kami kirim surat.')}
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
            <Button type="submit" variant="ink" disabled={pending}>
              {pending ? 'Mengirim…' : 'Kirim surat atur ulang'}
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
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { type FormEvent, useState } from 'react'
import { AdminDesk } from '~/components/auth/AdminDesk'
import { GuestBook } from '~/components/auth/GuestBook'
import { LibrarianBubble } from '~/components/auth/LibrarianBubble'
import { PaperField } from '~/components/auth/PaperField'
import { Button } from '~/components/ui/Button'
import { authMessage } from '~/lib/auth-messages'
import { DEFAULT_MEMBER_PATH } from '~/lib/redirects'
import { updatePasswordFn } from '~/server/auth'

export const Route = createFileRoute('/reset-password')({
  // Reached through the recovery link, which signs the member in first.
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ href: '/forgot-password' })
  },
  head: () => ({ meta: [{ title: 'Kata Sandi Baru — Glosa' }] }),
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
    const password = String(form.get('password') ?? '')
    if (password !== String(form.get('confirm') ?? '')) {
      setErrorCode('password_mismatch')
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
        <LibrarianBubble tone={message ? 'error' : 'info'}>
          {message?.bubble ?? 'Silakan tulis kata sandi barumu.'}
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
            error={errorCode === 'password_mismatch' ? undefined : message?.field}
          />
          <PaperField
            label="Ulangi kata sandi baru"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            error={errorCode === 'password_mismatch' ? message?.field : undefined}
          />
          <Button type="submit" variant="ink" disabled={pending}>
            {pending ? 'Menyimpan…' : 'Simpan kata sandi'}
          </Button>
        </form>
      </GuestBook>
    </AdminDesk>
  )
}
```

- [ ] **Step 3: Verifikasi manual**

Run: `npm run dev`. Buka `/forgot-password` dan kirim email anggota yang sudah dibuat di Task 9. Buka surat "Atur ulang kata sandi Glosa" di Mailpit, lalu klik tautannya.
Expected: halaman pindah ke `/reset-password`. Setelah kata sandi baru disimpan, halaman pindah ke `/welcome` (anggota belum onboarding) atau `/lobby`.

- [ ] **Step 4: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint`

```bash
git add src
git commit -m "feat(auth): add forgot and reset password pages"
```

---

### Task 11: Kartu anggota (`/welcome`)

**Files:**
- Create: `src/components/member/MembershipCard.tsx`, `src/components/member/Stamp.tsx`
- Test: `src/components/member/MembershipCard.test.tsx`
- Modify: `src/routes/_member/welcome.tsx`, `src/styles/app.css`

**Interfaces:**
- Consumes: `SessionUser` (Task 4), `formatMemberNo`, `formatMemberSince`, `formatBytes`, `planLabel` (Task 4), `completeOnboardingFn`, `checkUsernameFn` (Task 6), `useUsernameCheck`, `usernameStatusText` (Task 9), `Button`, `LibrarianBubble` (Task 7).
- Produces: `<MembershipCard member={SessionUser} className? animate? />` (dirender sebagai `<figure aria-label="Kartu anggota Glosa">`), `<Stamp>children</Stamp>`.

- [ ] **Step 1: Tulis test yang gagal**

`src/components/member/MembershipCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SessionUser } from '~/lib/session-types'
import { MembershipCard } from './MembershipCard'

const member: SessionUser = {
  id: 'u1',
  email: 'yudhis@contoh.com',
  provider: 'email',
  username: 'yudhis',
  displayName: 'Yudhis',
  memberNo: 342,
  plan: 'free',
  storageLimitBytes: 104857600,
  memberSince: '2026-10-15T03:00:00Z',
  onboarded: false,
}

describe('MembershipCard', () => {
  it('shows the member details printed on the card', () => {
    render(<MembershipCard member={member} />)
    const card = screen.getByRole('figure', { name: 'Kartu anggota Glosa' })
    expect(card).toHaveTextContent('Yudhis')
    expect(card).toHaveTextContent('@yudhis')
    expect(card).toHaveTextContent('000342')
    expect(card).toHaveTextContent('Okt 2026')
    expect(card).toHaveTextContent('GRATIS · 100 MB')
  })

  it('never prints the email address', () => {
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
import { Logo } from '~/components/ui/Logo'
import { cn } from '~/lib/cn'
import { formatBytes, formatMemberNo, formatMemberSince, planLabel } from '~/lib/member'
import type { SessionUser } from '~/lib/session-types'

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
      className={cn('member-card m-0', animate && 'member-card-enter', className)}
    >
      <div className="flex items-center gap-2.5">
        <Logo className="size-7" />
        <div>
          <b className="block font-serif text-sm tracking-[0.2em]">GLOSA</b>
          <small className="text-[8px] tracking-[0.15em] text-[#9cc9bf]">
            KARTU ANGGOTA PERPUSTAKAAN
          </small>
        </div>
      </div>
      <div className="mt-3 flex flex-1 gap-3.5">
        <div className="grid h-[74px] w-[62px] place-items-center rounded-md border-2 border-white/25 bg-gradient-to-br from-[#c68e63] to-[#7a4a2e] font-serif text-2xl font-bold">
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
import type { ReactNode } from 'react'

export function Stamp({ children }: { children: ReactNode }) {
  return <span className="stamp">{children}</span>
}
```

Tambahkan ke akhir `src/styles/app.css`:

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
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useCallback, useState } from 'react'
import { LibrarianBubble } from '~/components/auth/LibrarianBubble'
import { useUsernameCheck, usernameStatusText } from '~/components/auth/useUsernameCheck'
import { MembershipCard } from '~/components/member/MembershipCard'
import { Stamp } from '~/components/member/Stamp'
import { Button } from '~/components/ui/Button'
import { authMessage } from '~/lib/auth-messages'
import { DEFAULT_MEMBER_PATH } from '~/lib/redirects'
import { normalizeUsername } from '~/lib/username'
import { checkUsernameFn, completeOnboardingFn } from '~/server/profile'

export const Route = createFileRoute('/_member/welcome')({
  head: () => ({ meta: [{ title: 'Kartu Anggota — Glosa' }] }),
  component: WelcomeCardPage,
})

function WelcomeCardPage() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const completeOnboarding = useServerFn(completeOnboardingFn)
  const checkUsername = useServerFn(checkUsernameFn)
  // Email members chose their username on the form; OAuth members got a generated one.
  const canEditUsername = user.provider !== 'email'
  const [username, setUsername] = useState(user.username)
  const checker = useCallback(
    async (candidate: string) =>
      candidate === user.username
        ? { available: true, problem: null }
        : checkUsername({ data: { username: candidate } }),
    [checkUsername, user.username],
  )
  const usernameStatus = useUsernameCheck(canEditUsername ? username : '', checker)
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
    canEditUsername && (usernameStatus.state === 'taken' || usernameStatus.state === 'invalid')

  return (
    <main className="relative grid min-h-dvh place-items-center p-4">
      <div className="absolute left-[8%] top-[10%] md:left-[58%]">
        <Stamp>DITERIMA</Stamp>
      </div>
      <div className="flex w-full max-w-sm flex-col items-center gap-5">
        <h1 className="sr-only">Kartu anggotamu sudah jadi</h1>
        <MembershipCard
          member={{ ...user, username: canEditUsername ? username || user.username : user.username }}
          animate
        />
        {canEditUsername && (
          <div className="w-full rounded-xl border border-line bg-panel p-3 text-sm backdrop-blur-md">
            <label htmlFor="username" className="block text-xs text-muted">
              Nama pengguna (bisa diubah sekarang)
            </label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(normalizeUsername(event.target.value))}
              autoComplete="username"
              aria-describedby="username-note"
              className="mt-1 w-full rounded-md border border-line bg-night-950 px-3 py-2 text-ink outline-none focus:border-mint"
            />
            <p id="username-note" className="mt-1 text-xs text-muted">
              {usernameStatusText(usernameStatus)}
            </p>
          </div>
        )}
        {errorCode && <LibrarianBubble tone="error">{authMessage(errorCode).bubble}</LibrarianBubble>}
        <Button onClick={enterLibrary} disabled={pending || blocked}>
          {pending ? 'Membuka pintu…' : 'Masuk ke perpustakaan →'}
        </Button>
      </div>
    </main>
  )
}
```

Catatan: nama aksesibel tombol ini adalah "Masuk ke perpustakaan →". Test E2E mencarinya dengan `getByRole('button', { name: /Masuk ke perpustakaan/ })`.

- [ ] **Step 6: Verifikasi manual**

Konfirmasi akun yang didaftarkan di Task 9 lewat tautan di Mailpit.
Expected: halaman pindah ke `/welcome`. Latar meja admin terlihat kabur dan gelap, cap "DITERIMA" dihentakkan, lalu kartu meluncur masuk dengan nama, @username, nomor 6 digit, bulan dan tahun, serta "GRATIS · 100 MB". Klik tombol untuk pindah ke `/lobby` (masih berupa kerangka). Buka `/welcome` lagi: Anda dialihkan ke `/lobby`.

- [ ] **Step 7: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint`

```bash
git add src
git commit -m "feat(member): add membership card welcome step"
```

---

### Task 12: Lobi sementara, pengaturan, dan hapus akun

**Files:**
- Modify: `src/routes/_member/lobby.tsx`, `src/routes/_member/settings.tsx`

**Interfaces:**
- Consumes: `MembershipCard` (Task 11), `Panel`, `Button`, `buttonClass` (Task 7), `updateProfileFn`, `deleteAccountFn` (Task 6), `authMessage` (Task 4), `normalizeUsername` (Task 4).

Lobi di task ini adalah halaman **sementara**. Lobi isometrik penuh dibangun di rencana 1D, sebelum rilis.

- [ ] **Step 1: Lobi sementara**

`src/routes/_member/lobby.tsx` (ganti seluruh isinya):

```tsx
import { Link, createFileRoute } from '@tanstack/react-router'
import { MembershipCard } from '~/components/member/MembershipCard'
import { buttonClass } from '~/components/ui/Button'
import { Panel } from '~/components/ui/Panel'

export const Route = createFileRoute('/_member/lobby')({
  // Keep the value as the number 1 so the URL stays `?kembali=1` after validation.
  validateSearch: (search: Record<string, unknown>): { kembali?: 1 } => ({
    kembali: search.kembali === 1 || search.kembali === '1' ? 1 : undefined,
  }),
  head: () => ({ meta: [{ title: 'Lobi — Glosa' }] }),
  component: LobbyPage,
})

function LobbyPage() {
  const { user } = Route.useRouteContext()
  const { kembali } = Route.useSearch()

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-8">
      {kembali === 1 && (
        <output className="block rounded-lg border border-line bg-panel px-4 py-2 text-sm">
          Selamat datang kembali, {user.displayName}!
        </output>
      )}
      <h1 className="font-serif text-3xl font-bold">Lobi</h1>
      <Panel className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
        <MembershipCard member={user} />
        <div className="flex w-full flex-col gap-2.5 sm:max-w-48">
          <Link to="/settings" className={buttonClass('secondary')}>
            Pengaturan
          </Link>
          <Link to="/logout" className={buttonClass('secondary')}>
            Keluar
          </Link>
        </div>
      </Panel>
    </main>
  )
}
```

- [ ] **Step 2: Halaman pengaturan**

`src/routes/_member/settings.tsx` (ganti seluruh isinya):

```tsx
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { type FormEvent, useState } from 'react'
import { MembershipCard } from '~/components/member/MembershipCard'
import { Button, buttonClass } from '~/components/ui/Button'
import { Panel } from '~/components/ui/Panel'
import { authMessage } from '~/lib/auth-messages'
import { normalizeUsername } from '~/lib/username'
import { deleteAccountFn, updateProfileFn } from '~/server/profile'

export const Route = createFileRoute('/_member/settings')({
  head: () => ({ meta: [{ title: 'Pengaturan — Glosa' }] }),
  component: SettingsPage,
})

const fieldClass =
  'mt-1 w-full rounded-md border border-line bg-night-950 px-3 py-2 text-ink outline-none focus:border-mint'

function SettingsPage() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const updateProfile = useServerFn(updateProfileFn)
  const deleteAccount = useServerFn(deleteAccountFn)

  const [username, setUsername] = useState(user.username)
  const [profileState, setProfileState] = useState<
    { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; code: string }
  >({ kind: 'idle' })
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const result = await updateProfile({
      data: { displayName: String(form.get('displayName') ?? ''), username },
    })
    if (!result.ok) {
      setProfileState({ kind: 'error', code: result.code })
      return
    }
    setProfileState({ kind: 'saved' })
    await router.invalidate()
  }

  async function onDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteAccount({
      data: { confirmUsername: String(form.get('confirmUsername') ?? '') },
    })
    if (!result.ok) {
      setDeleting(false)
      setDeleteError(result.code)
      return
    }
    await router.invalidate()
    router.history.push('/')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">Pengaturan</h1>
        <Link to="/lobby" className="text-sm text-mint underline">
          ← Lobi
        </Link>
      </div>

      <Panel className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
        <MembershipCard member={user} />
        <form onSubmit={onSaveProfile} className="w-full space-y-3 text-sm">
          <h2 className="font-bold">Profil</h2>
          <label className="block text-xs text-muted">
            Nama
            <input
              name="displayName"
              defaultValue={user.displayName}
              maxLength={60}
              required
              autoComplete="name"
              className={fieldClass}
            />
          </label>
          <label className="block text-xs text-muted">
            Nama pengguna
            <input
              name="username"
              value={username}
              onChange={(event) => setUsername(normalizeUsername(event.target.value))}
              required
              autoComplete="username"
              className={fieldClass}
            />
          </label>
          {profileState.kind === 'error' && (
            <p role="alert" className="text-xs text-[#ff8a80]">
              {authMessage(profileState.code).field}
            </p>
          )}
          {profileState.kind === 'saved' && (
            <output className="block text-xs text-mint">Profil tersimpan.</output>
          )}
          <Button type="submit" className="sm:w-auto">
            Simpan profil
          </Button>
        </form>
      </Panel>

      <Panel className="p-6">
        <Link to="/logout" className={buttonClass('secondary', 'sm:w-auto')}>
          Keluar
        </Link>
      </Panel>

      <Panel className="border-[#b3261e]/50 p-6 text-sm">
        <h2 className="font-bold text-[#ff8a80]">Hapus akun</h2>
        <p className="mt-1 text-muted">
          Semua data milikmu akan dihapus permanen dan tidak bisa dikembalikan.
        </p>
        <form onSubmit={onDelete} className="mt-4 space-y-3">
          <label className="block text-xs text-muted">
            Ketik nama penggunamu untuk konfirmasi ({user.username})
            <input
              name="confirmUsername"
              autoComplete="off"
              required
              className={fieldClass}
            />
          </label>
          {deleteError && (
            <p role="alert" className="text-xs text-[#ff8a80]">
              {authMessage(deleteError).field}
            </p>
          )}
          <button
            type="submit"
            disabled={deleting}
            className="rounded-lg bg-[#b3261e] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#b3261e]/90 disabled:opacity-60"
          >
            {deleting ? 'Menghapus…' : 'Hapus akun saya permanen'}
          </button>
        </form>
      </Panel>
    </main>
  )
}
```

- [ ] **Step 3: Verifikasi manual**

Run: `npm run dev`. Masuk sebagai anggota, lalu buka `/settings`.
Expected:
- Ubah nama dan simpan: "Profil tersimpan." muncul, dan kartu di atas ikut berubah.
- Hapus akun dengan nama pengguna yang salah: muncul "Ketik nama penggunamu persis."
- Hapus dengan nama pengguna yang benar: kembali ke `/`. Login dengan akun itu kemudian gagal.

- [ ] **Step 4: Typecheck, test, lint, commit**

Run: `npm run typecheck && npm test && npm run lint`

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
- Consumes: `LEGAL_CONTACT_EMAIL`, `SITE_NAME` (Task 4).
- Produces: `<LegalPage title updated>children</LegalPage>`.

Kedua teks berikut adalah **draf** yang harus ditinjau ahli hukum sebelum rilis publik. Kalimat ini juga dicantumkan di halaman.

- [ ] **Step 1: Layout halaman hukum**

`src/components/legal/LegalPage.tsx`:

```tsx
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

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
      <h1 className="mt-4 font-serif text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-xs text-muted">
        Terakhir diperbarui: {updated} · Draf, akan ditinjau sebelum rilis publik.
      </p>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink/90 [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Kebijakan privasi**

`src/routes/privacy.tsx` (ganti seluruh isinya):

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '~/components/legal/LegalPage'
import { LEGAL_CONTACT_EMAIL } from '~/lib/site'

export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: 'Kebijakan Privasi — Glosa' }] }),
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <LegalPage title="Kebijakan Privasi" updated="15 Oktober 2026">
      <p>
        Glosa menghormati privasimu. Halaman ini menjelaskan data apa yang kami kumpulkan,
        untuk apa, dan apa hakmu sesuai Undang-Undang Pelindungan Data Pribadi (UU PDP).
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
        Data disimpan di layanan Supabase dan server aplikasi kami. Penyedia layanan tersebut
        hanya memproses data atas instruksi kami.
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
import { createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '~/components/legal/LegalPage'
import { LEGAL_CONTACT_EMAIL } from '~/lib/site'

export const Route = createFileRoute('/terms')({
  head: () => ({ meta: [{ title: 'Syarat Layanan — Glosa' }] }),
  component: TermsPage,
})

function TermsPage() {
  return (
    <LegalPage title="Syarat Layanan (Tata Tertib Perpustakaan)" updated="15 Oktober 2026">
      <p>
        Dengan menjadi anggota Glosa, kamu setuju dengan tata tertib berikut.
      </p>
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
        Paket Gratis mendapat 100 MB penyimpanan. Ketentuan paket berbayar akan diumumkan
        sebelum tersedia.
      </p>
      <h2>5. Perubahan layanan</h2>
      <p>
        Kami dapat mengubah tata tertib ini. Perubahan penting akan diberitahukan lewat
        aplikasi atau email.
      </p>
      <h2>Kontak</h2>
      <p>
        Pertanyaan atau laporan pelanggaran: <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
```

- [ ] **Step 4: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint`

```bash
git add src
git commit -m "feat: add draft privacy policy and terms pages"
```

---

### Task 14: Test end-to-end alur anggota

**Files:**
- Create: `playwright.config.ts`, `e2e/helpers/env.ts`, `e2e/helpers/mailpit.ts`, `e2e/helpers/members.ts`, `e2e/auth.spec.ts`

**Interfaces:**
- Consumes: semua rute dari Task 5–13. Label UI: "Email", "Kata sandi", "Nama lengkap", "Nama pengguna", "Kata sandi baru", "Ulangi kata sandi baru", "Ketik nama penggunamu untuk konfirmasi". Tombol: "Tanda tangan & masuk", "Ajukan keanggotaan", "Kirim surat atur ulang", "Simpan kata sandi", "Masuk ke perpustakaan →", "Hapus akun saya permanen".
- Produces: `npm run test:e2e` yang hijau.

- [ ] **Step 1: Konfigurasi Playwright dan helper**

Run: `npx playwright install chromium`

`playwright.config.ts`:

```ts
import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

`e2e/helpers/env.ts`:

```ts
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}. Run "npm run env:local" first.`)
  return value
}
```

`e2e/helpers/mailpit.ts`:

```ts
import { requireEnv } from './env'

type MailpitSearch = { messages: Array<{ ID: string }> }
type MailpitMessage = { HTML: string; Text: string }

/** Polls the local Mailpit inbox for the newest /auth/confirm link containing `mustContain`. */
export async function waitForEmailLink(email: string, mustContain: string): Promise<string> {
  const base = requireEnv('MAILPIT_URL')
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = (await (
      await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
    ).json()) as MailpitSearch
    for (const { ID } of search.messages ?? []) {
      const message = (await (await fetch(`${base}/api/v1/message/${ID}`)).json()) as MailpitMessage
      const links = `${message.HTML}\n${message.Text}`.match(/https?:\/\/[^\s"'<>]+\/auth\/confirm\?[^\s"'<>]+/g)
      const link = links?.map((l) => l.replaceAll('&amp;', '&')).find((l) => l.includes(mustContain))
      if (link) return link
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`No email containing ${mustContain} arrived for ${email}`)
}
```

`e2e/helpers/members.ts`:

```ts
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { requireEnv } from './env'

export type TestMember = { email: string; username: string; name: string; password: string }

export function newMember(): TestMember {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  return {
    email: `anggota${id}@glosa.test`,
    username: `ang${id}`.slice(0, 20),
    name: 'Anggota Uji',
    password: 'rahasia-123',
  }
}

/** Creates an already-confirmed member directly through the admin API. */
export async function createConfirmedMember(member = newMember()): Promise<TestMember> {
  const admin = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false },
  })
  const { error } = await admin.auth.admin.createUser({
    email: member.email,
    password: member.password,
    email_confirm: true,
    user_metadata: { username: member.username, display_name: member.name },
  })
  if (error) throw error
  return member
}

export async function signIn(page: Page, member: TestMember, password = member.password) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(member.email)
  await page.getByLabel('Kata sandi', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Tanda tangan & masuk' }).click()
}

export async function signInAndOnboard(page: Page, member: TestMember) {
  await signIn(page, member)
  await expect(page).toHaveURL(/\/welcome$/)
  await page.getByRole('button', { name: /Masuk ke perpustakaan/ }).click()
  await expect(page).toHaveURL(/\/lobby$/)
}
```

- [ ] **Step 2: Tulis spesifikasi E2E**

`e2e/auth.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { waitForEmailLink } from './helpers/mailpit'
import { createConfirmedMember, newMember, signIn, signInAndOnboard } from './helpers/members'

test('a guest opening the lobby is sent to the guest book', async ({ page }) => {
  await page.goto('/lobby')
  await expect(page).toHaveURL(/\/login\?next=%2Flobby$/)
  await expect(page.getByRole('status')).toContainText('Silakan isi buku tamu')
})

test('a new member registers, confirms by email, receives a card and enters the lobby', async ({
  page,
}) => {
  const member = newMember()
  await page.goto('/')
  await page.getByRole('link', { name: 'Daftar jadi anggota' }).click()
  await expect(page).toHaveURL(/\/register$/)

  await page.getByLabel('Nama lengkap').fill(member.name)
  await page.getByLabel('Nama pengguna').fill(member.username)
  await expect(page.getByText('Nama pengguna tersedia ✓')).toBeVisible()
  await page.getByLabel('Email').fill(member.email)
  await page.getByLabel('Kata sandi', { exact: true }).fill(member.password)
  await page.getByLabel('Saya setuju dengan tata tertib').check()
  await page.getByRole('button', { name: 'Ajukan keanggotaan' }).click()
  await expect(page.getByRole('status')).toContainText('Kami kirim surat konfirmasi')

  await page.goto(await waitForEmailLink(member.email, 'type=email'))
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByText('DITERIMA')).toBeVisible()
  const card = page.getByRole('figure', { name: 'Kartu anggota Glosa' })
  await expect(card).toContainText(`@${member.username}`)
  await expect(card).toContainText('GRATIS · 100 MB')

  await page.getByRole('button', { name: /Masuk ke perpustakaan/ }).click()
  await expect(page).toHaveURL(/\/lobby$/)
  await expect(page.getByRole('heading', { name: 'Lobi' })).toBeVisible()
})

test('the librarian flags a wrong password, then a returning member goes straight to the lobby', async ({
  page,
}) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await page.goto('/logout')
  await expect(page).toHaveURL(/\/$/)

  await signIn(page, member, 'salah-sandi-1')
  await expect(page.getByRole('alert').first()).toContainText('belum cocok')

  await page.getByLabel('Kata sandi', { exact: true }).fill(member.password)
  await page.getByRole('button', { name: 'Tanda tangan & masuk' }).click()
  await expect(page).toHaveURL(/\/lobby$/)

  await page.goto('/')
  await expect(page).toHaveURL(/\/lobby\?kembali=1$/)
  await expect(page.getByRole('status')).toContainText('Selamat datang kembali')
})

test('a member resets a forgotten password by email', async ({ page }) => {
  const member = await createConfirmedMember()
  await page.goto('/forgot-password')
  await page.getByLabel('Email').fill(member.email)
  await page.getByRole('button', { name: 'Kirim surat atur ulang' }).click()
  await expect(page.getByRole('status')).toContainText('sudah kami kirim')

  await page.goto(await waitForEmailLink(member.email, 'type=recovery'))
  await expect(page).toHaveURL(/\/reset-password$/)
  await page.getByLabel('Kata sandi baru', { exact: true }).fill('sandi-baru-456')
  await page.getByLabel('Ulangi kata sandi baru').fill('sandi-baru-456')
  await page.getByRole('button', { name: 'Simpan kata sandi' }).click()
  await expect(page).toHaveURL(/\/welcome$/)

  await page.goto('/logout')
  await signIn(page, member, 'sandi-baru-456')
  await expect(page).toHaveURL(/\/welcome$/)
})

test('a member deletes their account', async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await page.goto('/settings')

  const confirmField = page.getByLabel(/Ketik nama penggunamu untuk konfirmasi/)
  await confirmField.fill('bukan-saya')
  await page.getByRole('button', { name: 'Hapus akun saya permanen' }).click()
  await expect(page.getByRole('alert')).toContainText('Ketik nama penggunamu persis.')

  await confirmField.fill(member.username)
  await page.getByRole('button', { name: 'Hapus akun saya permanen' }).click()
  await expect(page).toHaveURL(/\/$/)

  await signIn(page, member)
  await expect(page.getByRole('alert').first()).toContainText('belum cocok')
})
```

- [ ] **Step 3: Jalankan E2E**

Pastikan Supabase lokal berjalan dan `.env.local` sudah ada (`npm run db:start && npm run env:local`).
Run: `npm run test:e2e`
Expected: 10 tests passed (5 test × proyek `desktop` dan `mobile`).

Jika ada yang gagal, buka trace dengan `npx playwright show-trace test-results/<folder>/trace.zip`. Perbaiki **kode aplikasi**, bukan melemahkan assertion. Pengecualian: jika label atau teks di test berbeda dari teks UI yang ditetapkan di task sebelumnya, ikuti teks UI dari task tersebut.

- [ ] **Step 4: Lint dan commit**

Run: `npm run lint`

```bash
git add playwright.config.ts e2e
git commit -m "test(e2e): cover registration, sign-in, password reset and account deletion"
```

---

### Task 15: Continuous integration

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: skrip npm dari Task 1 dan Task 3.

- [ ] **Step 1: Workflow CI**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

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
      - run: npm run typecheck
      - run: npm test
      - run: npx supabase start
      - run: npm run test:db
      - run: npm run env:local
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env:
          CI: 'true'
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 7
```

- [ ] **Step 2: Validasi seluruh rangkaian secara lokal**

Run: `npm run lint && npm run typecheck && npm test && npm run test:db && npm run test:e2e`
Expected: semua lulus. CI baru berjalan setelah repo di-push ke GitHub. Push dilakukan hanya jika pemilik repo memintanya.

- [ ] **Step 3: Commit**

```bash
git add .github
git commit -m "ci: run lint, typecheck, unit, database and e2e tests"
```

---

## Cakupan terhadap spec (untuk reviewer)

| Spec | Task |
|---|---|
| §3 Arsitektur, keputusan teknis | 1, 2, 5 |
| §4 Model data `profiles`, RLS, kolom server-only | 3 |
| §6 Alur "datang ke perpustakaan" (/, /login, /register, /welcome), callback, lupa/atur ulang sandi, aturan redirect, username otomatis, error lewat petugas, animasi bisa dilewati/reduced motion, hapus akun | 2, 4, 6–12 |
| §6 SMTP kustom produksi | Rencana 1D (deploy) |
| §7 Lobi isometrik penuh | Rencana 1D (task 12 hanya lobi sementara) |
| §4 `books`, §5 upload/kuota/genre, §8 Rak Saya | Rencana 1B |
| §9–§11 Reader, sinkronisasi, offline | Rencana 1C |
| §13 Testing (unit, pgTAP RLS, E2E) | 1–4, 7, 9, 11, 14 |
| §14 CI | 15 (deploy di rencana 1D) |
| Halaman `/privacy` dan `/terms` | 13 |
