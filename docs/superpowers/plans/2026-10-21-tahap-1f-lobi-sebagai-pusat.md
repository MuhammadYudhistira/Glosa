# Glosa Tahap 1F — Lobi sebagai Pusat: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Di desktop, Rak Saya (`/shelf`) dan Pengaturan (`/settings`) terbuka sebagai panel besar di atas lobi 3D. Lobi tetap terpasang di belakang dan adegannya dibekukan. Di HP keduanya tetap halaman biasa. Dropdown menu akun tidak lagi tertutup peta.

**Architecture:**
- **Rute.** `/lobby`, `/shelf`, dan `/settings` menjadi anak dari layout tanpa path `src/routes/_member/_lobi.tsx`. Layout memegang loader `loadShelf` dan menggambar `LobbyStage` (isi halaman lobi yang sekarang) beserta `<Outlet/>`.
- **Popup.** Rak dan Pengaturan membungkus isinya dengan `LobbyPopup`. CSS menentukan tampilannya: panel kaca tetap di tengah pada ≥ 1024px, halaman biasa di bawah 1024px.
- **Adegan.** Selama popup terbuka, `LobbyStage` mengirim `paused` ke adegan (loop render berhenti lewat `stage.setPaused`). Panel lobi tidak digambar. Adegan dibungkus `inert` + `aria-hidden`.
- **WebGL.** Di HP, adegan tidak menyalakan WebGL saat berada di belakang popup (`allow3d`).

**Tech Stack:** TanStack Start + Router (file routes, `tsr generate`), React 19, TypeScript, Tailwind CSS 4, Base UI dialog, Three.js r160 (`scene/stage.ts`), Vitest + Testing Library (jsdom), Playwright.

**Spec:** [`docs/superpowers/specs/2026-10-21-tahap-1f-lobi-sebagai-pusat-design.md`](../specs/2026-10-21-tahap-1f-lobi-sebagai-pusat-design.md)

## Global Constraints

- **Breakpoint desktop:** `(min-width: 1024px)`, sama dengan Tailwind `lg` dan `@media (min-width: 1024px)` di `src/styles.css`.
- **Bahasa:** teks UI berbahasa Indonesia, komentar kode berbahasa Inggris (mengikuti kode yang ada).
- **Dependensi:** tidak ada dependensi baru.
- **Alamat:** `/lobby`, `/shelf` (beserta `?genre`, `?q`, `?sort`), `/settings`, dan `/lobby?kembali=1` tidak berubah.
- **HP (< 1024px):** tampilan dan perilaku `/lobby`, `/shelf`, dan `/settings` sama seperti sekarang.
- **Popup:** satu-satunya `<main>` di halaman saat terbuka. Labelnya "Rak Saya" atau "Pengaturan", dan tombol tutupnya "Tutup Rak Saya" atau "Tutup Pengaturan".
- **Urutan z-index desktop:** panel lobi 10–11 < latar popup 14 < popup 15 < top bar 20 < menu kiri 30 < dialog Base UI 50.

## Keputusan dan penyimpangan dari spec

Semua keputusan berikut disengaja. Spec sudah diperbarui mengikutinya.

1. **Panel lobi tidak digambar selama popup terbuka.** Spec §4.4 awalnya meminta panel dibuat `inert`. Ternyata panel itu memuat teks dan tombol yang sama dengan Rak, misalnya:
   - tombol buku di "Baru dibuka" ber-`aria-label` judul buku;
   - "Bawa buku" di Meja Admin;
   - pemberitahuan offline;
   - gelembung "Rakmu masih kosong…".

   Teks ganda seperti ini membingungkan pembaca layar dan membuat selektor E2E ambigu. Panel tidak menyimpan state sendiri (state ada di `LobbyStage`), jadi melepasnya aman. Yang tetap ada hanya adegan (beku, `inert`, `aria-hidden`) dan top bar.
2. **Gelembung adegan dan pemberitahuan lobi juga disembunyikan** selama popup terbuka, dengan alasan yang sama.
3. **Waktu animasi memakai jam sendiri.** `motion.update` sekarang menerima `clock`, yang hanya bertambah saat loop berjalan, bukan `now / 1000`. Dengan begitu animasi lanjut tanpa lompatan setelah jeda. Efek sampingnya, animasi juga tidak melompat setelah tab kembali terlihat.
4. **Jeda adegan diuji di unit** (penerusan `paused` dari `LobbyScene` ke `LobbyCanvas` ke `stage.setPaused`). E2E 3D cukup memastikan canvas tidak dipasang ulang setelah membuka dan menutup Rak. Loop render tidak bisa diamati dari luar tanpa membaca piksel, dan proyek `lobby-3d` sudah lambat.
5. **Fokus:**
   - `LobbyPopup` mencatat elemen pembuka di `useLayoutEffect` dan mengembalikan fokus di cleanup `useEffect`. Saat pindah dari Rak ke Pengaturan, popup baru mencatat pembukanya sebelum popup lama mengembalikan fokus, lalu fokus berakhir di `h1` popup baru.
   - Fokus hanya diatur di desktop. Di HP perilaku navigasi halaman tetap seperti sekarang.
6. **`tabIndex = -1` dipasang ke `h1` oleh `LobbyPopup`**, bukan ditulis di `ShelfHeader` dan halaman Pengaturan. Kedua komponen itu tetap tidak tahu apa-apa soal popup.

## Struktur file

| File | Status | Tanggung jawab |
|---|---|---|
| `src/components/lobby/LobbyTopBar.tsx` | Ubah | Menu akun menutup sendiri, atribut `data-lobby-search` di kolom cari |
| `src/styles.css` | Ubah | z-index top bar, gaya `LobbyPopup`, lobi tersembunyi di HP |
| `src/lib/use-wide-screen.ts` | Baru | `useWideScreen()` dan `isWideScreen()` dari `matchMedia` |
| `src/test/media.ts` | Baru | `stubWideScreen()` dan `unstubWideScreen()` untuk Vitest (jsdom tidak punya `matchMedia`) |
| `src/test/router.tsx` | Ubah | `renderWithRouter` juga mengembalikan `router` |
| `src/components/lobby/scene/stage.ts` | Ubah | `setPaused()`, jam animasi sendiri |
| `src/components/lobby/LobbyCanvas.tsx` | Ubah | Prop `paused` diteruskan ke stage |
| `src/components/lobby/LobbyStill.tsx` | Ubah | Prop `loading` |
| `src/components/lobby/LobbyScene.tsx` | Ubah | Prop `paused` dan `allow3d` |
| `src/components/lobby/LobbyPopup.tsx` | Baru | Pembungkus popup: label, tombol tutup, Esc, latar, fokus; `isPopupPath()` |
| `src/components/lobby/LobbyStage.tsx` | Baru | Isi halaman lobi lama, dengan mode `popup` |
| `src/routes/_member/_lobi.tsx` | Baru | Layout: loader rak, `LobbyStage`, `<Outlet/>` |
| `src/routes/_member/_lobi/lobby.tsx` | Pindah dari `_member/lobby.tsx` | `validateSearch` (`kembali`), judul tab |
| `src/routes/_member/_lobi/shelf.tsx` | Pindah dari `_member/shelf.tsx` | Isi Rak di dalam `LobbyPopup` |
| `src/routes/_member/_lobi/settings.tsx` | Pindah dari `_member/settings.tsx` | Isi Pengaturan di dalam `LobbyPopup` |
| `src/components/member/MemberShell.tsx` | Ubah | Menu melayang untuk ketiga alamat |
| `src/routeTree.gen.ts` | Dibuat ulang | `npm run generate-routes` |
| `e2e/lobby-popup.spec.ts` | Baru | E2E popup desktop dan halaman HP |
| `e2e/lobby-3d.spec.ts` | Ubah | Canvas bertahan setelah membuka Rak |

---

### Task 1: Dropdown akun di atas peta dan menutup sendiri

**Files:**
- Modify: `src/components/lobby/LobbyTopBar.tsx`
- Modify: `src/styles.css:1031-1035` (`.lobby-topbar`)
- Test: `src/components/lobby/LobbyTopBar.test.tsx`

**Interfaces:**
- Consumes: —
- Produces:
  - Kolom cari top bar punya atribut `data-lobby-search=""`. `LobbyPopup` (Task 3) memakainya sebagai tujuan fokus cadangan.
  - Esc di menu akun memanggil `event.preventDefault()`, sehingga `LobbyPopup` tidak ikut menutup.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di akhir `describe("LobbyTopBar", …)` di `src/components/lobby/LobbyTopBar.test.tsx`:

```tsx
  it("closes the account menu on a choice, a click outside and Escape", async () => {
    renderWithRouter(
      <>
        <LobbyTopBar user={member} books={[]} onSelect={vi.fn()} />
        <p>Di luar</p>
      </>
    )
    const summary = await screen.findByLabelText("Menu akun")
    const details = summary.closest("details")
    if (!details) throw new Error("the account menu has no <details>")

    details.open = true
    fireEvent.click(screen.getByRole("link", { name: "Pengaturan" }))
    expect(details.open).toBe(false)

    details.open = true
    fireEvent.pointerDown(screen.getByText("Di luar"))
    expect(details.open).toBe(false)

    details.open = true
    fireEvent.pointerDown(summary)
    expect(details.open).toBe(true)

    const escape = fireEvent.keyDown(
      screen.getByRole("link", { name: "Keluar" }),
      { key: "Escape" }
    )
    expect(details.open).toBe(false)
    // Handled here: the popup behind must not close as well.
    expect(escape).toBe(false)
  })

  it("marks the search as the lobby's fallback focus", async () => {
    renderWithRouter(
      <LobbyTopBar user={member} books={[]} onSelect={vi.fn()} />
    )
    expect(await screen.findByLabelText("Cari di rakmu")).toHaveAttribute(
      "data-lobby-search"
    )
  })
```

`fireEvent` mengembalikan `false` kalau handler memanggil `preventDefault()`.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/lobby/LobbyTopBar.test.tsx`
Expected: 2 test baru FAIL. `details.open` tetap `true` setelah klik "Pengaturan", dan atribut `data-lobby-search` tidak ada.

- [ ] **Step 3: Implementasi**

Di `src/components/lobby/LobbyTopBar.tsx`, ubah import React:

```tsx
import { type RefObject, useEffect, useId, useRef, useState } from "react"
```

Di dalam `LobbyTopBar`, setelah `const results = …`, tambahkan:

```tsx
  const accountRef = useRef<HTMLDetailsElement>(null)
  /** The lobby stays mounted under its popups, so the menu must close itself (spec 1F §6). */
  const closeAccount = (refocus: boolean) => {
    const details = accountRef.current
    if (!details?.open) return
    details.open = false
    if (refocus) details.querySelector("summary")?.focus()
  }

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const details = accountRef.current
      if (
        details?.open &&
        event.target instanceof Node &&
        !details.contains(event.target)
      ) {
        details.open = false
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])
```

Di `<Input …>` kolom cari, tambahkan atribut sesudah `autoComplete="off"`:

```tsx
          data-lobby-search=""
```

Ganti blok `<details className="lobby-account">…</details>` dengan:

```tsx
      <details
        ref={accountRef}
        className="lobby-account"
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !accountRef.current?.open) return
          event.preventDefault()
          closeAccount(true)
        }}
      >
        <summary aria-label="Menu akun" className="lobby-me">
          <span className="lobby-avatar">{initials(user.displayName)}</span>
          <span className="hidden min-w-0 xl:block">
            <b className="block truncate text-sm">{user.displayName}</b>
            <span className="block truncate text-xs text-muted-foreground">
              @{user.username}
            </span>
          </span>
        </summary>
        <div className="lobby-account-menu">
          <p className="px-3 py-1 text-sm">
            <b className="block">{user.displayName}</b>
            <span className="text-muted-foreground">@{user.username}</span>
          </p>
          <Link to="/settings" onClick={() => closeAccount(false)}>
            Pengaturan
          </Link>
          <Link to="/logout" onClick={() => closeAccount(false)}>
            Keluar
          </Link>
        </div>
      </details>
```

Di `src/styles.css`, di aturan `.lobby-topbar` (sekitar baris 1031), ganti `z-index: 10;` dengan:

```css
    /* Above the corner panels (10) and the popup (15), so the account menu
       shows over the map; below the floating menu (30) and dialogs (spec 1F §6). */
    z-index: 20;
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run src/components/lobby/LobbyTopBar.test.tsx`
Expected: semua test PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/lobby/LobbyTopBar.tsx src/components/lobby/LobbyTopBar.test.tsx src/styles.css
git commit -m "fix(lobby): account menu shows above the map and closes itself"
```

---

### Task 2: Adegan bisa dijeda dan WebGL bisa ditahan

**Files:**
- Create: `src/lib/use-wide-screen.ts`
- Create: `src/lib/use-wide-screen.test.ts`
- Create: `src/test/media.ts`
- Create: `src/components/lobby/LobbyCanvas.test.tsx`
- Modify: `src/components/lobby/scene/stage.ts` (type `Stage`, fungsi `tick`, objek yang dikembalikan)
- Modify: `src/components/lobby/LobbyCanvas.tsx`
- Modify: `src/components/lobby/LobbyStill.tsx`
- Modify: `src/components/lobby/LobbyScene.tsx`
- Test: `src/components/lobby/LobbyScene.test.tsx`

**Interfaces:**
- Consumes: —
- Produces:
  - `useWideScreen(): boolean`, `isWideScreen(): boolean`, dan `WIDE_QUERY = "(min-width: 1024px)"` dari `@/lib/use-wide-screen`.
  - `stubWideScreen(matches: boolean): { set(next: boolean): void }` dan `unstubWideScreen(): void` dari `@/test/media`.
  - `Stage.setPaused(paused: boolean): void`.
  - `LobbyCanvas` prop `paused: boolean`.
  - `LobbyScene` prop opsional `paused?: boolean` (default `false`) dan `allow3d?: boolean` (default `true`).
  - `LobbyStill` prop opsional `loading?: "eager" | "lazy"` (default `"eager"`).

- [ ] **Step 1: Buat stub `matchMedia` untuk test**

Buat `src/test/media.ts`:

```ts
/**
 * jsdom has no matchMedia. This stands in for "(min-width: 1024px)" (and any
 * other query), and lets a test cross the breakpoint.
 */
export function stubWideScreen(matches: boolean): {
  set: (next: boolean) => void
} {
  const state = { matches }
  const listeners = new Set<() => void>()
  const list = {
    get matches() {
      return state.matches
    },
    addEventListener: (_type: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      listeners.delete(listener),
  }
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => list,
  })
  return {
    set(next) {
      state.matches = next
      for (const listener of listeners) listener()
    },
  }
}

export function unstubWideScreen(): void {
  Reflect.deleteProperty(window, "matchMedia")
}
```

- [ ] **Step 2: Tulis test `useWideScreen` yang gagal**

Buat `src/lib/use-wide-screen.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { stubWideScreen, unstubWideScreen } from "@/test/media"
import { isWideScreen, useWideScreen } from "./use-wide-screen"

describe("useWideScreen", () => {
  afterEach(() => unstubWideScreen())

  it("follows the desktop breakpoint as it is crossed", () => {
    const media = stubWideScreen(false)
    const { result } = renderHook(() => useWideScreen())
    expect(result.current).toBe(false)
    act(() => media.set(true))
    expect(result.current).toBe(true)
    expect(isWideScreen()).toBe(true)
  })

  it("is false where matchMedia does not exist", () => {
    expect(isWideScreen()).toBe(false)
    const { result } = renderHook(() => useWideScreen())
    expect(result.current).toBe(false)
  })
})
```

- [ ] **Step 3: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/use-wide-screen.test.ts`
Expected: FAIL dengan "Failed to resolve import ./use-wide-screen".

- [ ] **Step 4: Implementasi `useWideScreen`**

Buat `src/lib/use-wide-screen.ts`:

```ts
import { useSyncExternalStore } from "react"

/** The desktop layout's breakpoint: Tailwind's `lg`, as in styles.css. */
export const WIDE_QUERY = "(min-width: 1024px)"

function wideQuery(): MediaQueryList | null {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
    ? window.matchMedia(WIDE_QUERY)
    : null
}

/** Whether the screen has the desktop layout now (for event handlers). */
export function isWideScreen(): boolean {
  return wideQuery()?.matches ?? false
}

function subscribe(onChange: () => void): () => void {
  const list = wideQuery()
  list?.addEventListener("change", onChange)
  return () => list?.removeEventListener("change", onChange)
}

/**
 * Whether the screen has the desktop layout. False on the server and in the
 * first render, so CSS, not this, decides what the page looks like (spec 1F,
 * decision 6).
 */
export function useWideScreen(): boolean {
  return useSyncExternalStore(subscribe, isWideScreen, () => false)
}
```

- [ ] **Step 5: Jalankan test, pastikan lolos**

Run: `npx vitest run src/lib/use-wide-screen.test.ts`
Expected: PASS.

- [ ] **Step 6: Tulis test `LobbyCanvas` yang gagal**

Buat `src/components/lobby/LobbyCanvas.test.tsx`:

```tsx
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LobbyCanvas } from "./LobbyCanvas"
import { ANDA_START } from "./scene/layout"

// The real stage needs WebGL, which jsdom does not have.
const stage = vi.hoisted(() => ({
  books: 0,
  setView: vi.fn(),
  walkTo: vi.fn(),
  setPaused: vi.fn(),
  dispose: vi.fn(),
}))
vi.mock("./scene/stage", () => ({ createStage: vi.fn(() => stage) }))

function canvasWith(paused: boolean, onReady = vi.fn()) {
  return (
    <LobbyCanvas
      quality="tinggi"
      test={false}
      anda={ANDA_START}
      paused={paused}
      onReady={onReady}
      onView={vi.fn()}
      onQuality={vi.fn()}
      onFail={vi.fn()}
    />
  )
}

describe("LobbyCanvas", () => {
  it("starts the stage paused behind a popup, and passes later changes on", async () => {
    const onReady = vi.fn()
    const { rerender, unmount } = render(canvasWith(true, onReady))
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledWith(stage))
    expect(stage.setPaused).toHaveBeenLastCalledWith(true)

    rerender(canvasWith(false, onReady))
    expect(stage.setPaused).toHaveBeenLastCalledWith(false)

    unmount()
    expect(stage.dispose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 7: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/lobby/LobbyCanvas.test.tsx`
Expected: FAIL. `setPaused` tidak pernah dipanggil (dan TypeScript di editor menandai prop `paused` yang belum ada).

- [ ] **Step 8: Implementasi jeda di stage**

Di `src/components/lobby/scene/stage.ts`, tambahkan anggota ke type `Stage` sesudah `walkTo`:

```ts
  /** Stops the animation behind a popup; it goes on from the same moment (spec 1F §4.5). */
  setPaused: (paused: boolean) => void
```

Ganti blok deklarasi loop:

```ts
  let frame = 0
  let disposed = false
  let needsRender = true
  let last = performance.now()
```

dengan:

```ts
  let frame = 0
  let disposed = false
  let needsRender = true
  let paused = false
  let last = performance.now()
  // The animation's own time: it moves only while the loop runs, so nothing
  // jumps after a pause or a hidden tab.
  let clock = last / 1000
```

Di fungsi `tick`, ganti:

```ts
    if (animates()) {
      motion.update(now / 1000, dt)
```

dengan:

```ts
    if (animates() && !paused) {
      clock += dt
      motion.update(clock, dt)
```

Di objek yang dikembalikan, tambahkan sesudah `walkTo(spot) { … },`:

```ts
    setPaused(next) {
      if (next === paused) return
      paused = next
      // The time spent paused does not count, and the speed check starts over.
      last = performance.now()
      measureStart = 0
      requestRender()
    },
```

Saat dijeda, `tick` tetap menggambar satu frame kalau `needsRender` (misalnya setelah resize), lalu berhenti. Ini jalur yang sama dengan tingkat "diam".

- [ ] **Step 9: Teruskan `paused` di `LobbyCanvas`**

Di `src/components/lobby/LobbyCanvas.tsx`:

Tambahkan `paused` ke destrukturisasi props sesudah `anda,` dan ke type props sesudah `anda: Point2`:

```tsx
  /** Behind a popup: the stage keeps its last frame (spec 1F §4.5). */
  paused: boolean
```

Sesudah `const andaRef = useRef(anda)`, tambahkan:

```tsx
  const pausedRef = useRef(paused)
```

Di dalam `.then(({ createStage }) => { … })`, ganti:

```tsx
        stageRef.current = stage
        callbacks.current.onReady(stage)
```

dengan:

```tsx
        stage.setPaused(pausedRef.current)
        stageRef.current = stage
        callbacks.current.onReady(stage)
```

Sesudah effect `anda`, tambahkan:

```tsx
  useEffect(() => {
    pausedRef.current = paused
    stageRef.current?.setPaused(paused)
  }, [paused])
```

- [ ] **Step 10: Jalankan test `LobbyCanvas`, pastikan lolos**

Run: `npx vitest run src/components/lobby/LobbyCanvas.test.tsx`
Expected: PASS.

- [ ] **Step 11: Tulis test `LobbyScene` yang gagal**

Di `src/components/lobby/LobbyScene.test.tsx`, ganti fungsi `renderScene` dengan versi yang menerima props tambahan:

```tsx
type SceneProps = Partial<ComponentProps<typeof LobbyScene>>

function renderScene(environment: Environment, extra: SceneProps = {}) {
  vi.mocked(detectEnvironment).mockReturnValue(environment)
  const onActivate = vi.fn()
  const onLiveChange = vi.fn()
  const ref = createRef<LobbySceneHandle>()
  const ui = (more: SceneProps) => (
    <LobbyScene
      ref={ref}
      hotspots={hotspots}
      anda={ANDA_START}
      onActivate={onActivate}
      onLiveChange={onLiveChange}
      {...extra}
      {...more}
    />
  )
  const { rerender } = render(ui({}))
  const scene = screen.getByRole("region", { name: "Adegan lobi" })
  return {
    scene,
    onActivate,
    onLiveChange,
    ref,
    update: (more: SceneProps) => rerender(ui(more)),
  }
}
```

Tambahkan di dalam `describe("LobbyScene", …)`:

```tsx
  it("holds the 3D scene back until it may start, with a lazy poster meanwhile", async () => {
    const { scene, update } = renderScene(desktop, { allow3d: false })
    await vi.waitFor(() =>
      expect(scene).toHaveAttribute("data-quality", "tinggi")
    )
    expect(screen.queryByTestId("lobby-canvas")).toBeNull()
    expect(scene.querySelector("img")).toHaveAttribute("loading", "lazy")

    update({ allow3d: true })
    expect(screen.getByTestId("lobby-canvas")).toBeInTheDocument()
    expect(scene.querySelector("img")).toHaveAttribute("loading", "eager")
  })

  it("passes the pause on to the canvas", async () => {
    const { update } = renderScene(desktop, { paused: true })
    await vi.waitFor(() => expect(canvas.props?.paused).toBe(true))
    update({ paused: false })
    expect(canvas.props?.paused).toBe(false)
  })
```

- [ ] **Step 12: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/lobby/LobbyScene.test.tsx`
Expected: 2 test baru FAIL. Canvas tetap dipasang walau `allow3d: false`, dan `canvas.props.paused` bernilai `undefined`.

- [ ] **Step 13: Implementasi di `LobbyStill` dan `LobbyScene`**

Di `src/components/lobby/LobbyStill.tsx`, ubah tanda tangan dan `<img>`:

```tsx
export function LobbyStill({
  className,
  sizes = "100vw",
  loading = "eager",
}: {
  className?: string
  sizes?: string
  /** Lazy where the lobby may stay hidden (behind a page on phones), so it is not fetched. */
  loading?: "eager" | "lazy"
}) {
```

dan di `<img …>` tambahkan `loading={loading}` sesudah `height={STILL_SIZE.height}`.

Di `src/components/lobby/LobbyScene.tsx`, tambahkan props di destrukturisasi (sesudah `onLiveChange,`):

```tsx
  paused = false,
  allow3d = true,
```

dan di type props (sesudah `onLiveChange?: …`):

```tsx
  /** Behind a popup: the 3D scene keeps its last frame (spec 1F §4.5). */
  paused?: boolean
  /** False keeps WebGL off, e.g. while the lobby is hidden behind a page on phones (spec 1F §5). */
  allow3d?: boolean
```

Ganti kondisi canvas:

```tsx
      {mode !== "still" && quality !== null && (
        <LobbyCanvas
          quality={quality}
          test={test}
          anda={anda}
```

dengan:

```tsx
      {mode !== "still" && quality !== null && allow3d && (
        <LobbyCanvas
          quality={quality}
          test={test}
          anda={anda}
          paused={paused}
```

Ganti gambar diam:

```tsx
          <LobbyStill className="lobby-still" sizes="max(100vw, 178vh)" />
```

dengan:

```tsx
          <LobbyStill
            className="lobby-still"
            sizes="max(100vw, 178vh)"
            loading={allow3d ? "eager" : "lazy"}
          />
```

- [ ] **Step 14: Jalankan semua test lobi dan typecheck**

Run: `npx vitest run src/components/lobby src/lib/use-wide-screen.test.ts && npm run typecheck`
Expected: semua PASS, tanpa error TypeScript.

- [ ] **Step 15: Commit**

```bash
git add src/lib/use-wide-screen.ts src/lib/use-wide-screen.test.ts src/test/media.ts src/components/lobby/scene/stage.ts src/components/lobby/LobbyCanvas.tsx src/components/lobby/LobbyCanvas.test.tsx src/components/lobby/LobbyStill.tsx src/components/lobby/LobbyScene.tsx src/components/lobby/LobbyScene.test.tsx
git commit -m "feat(lobby): the scene can pause, and hold WebGL back while hidden"
```

---

### Task 3: Komponen `LobbyPopup`

**Files:**
- Create: `src/components/lobby/LobbyPopup.tsx`
- Create: `src/components/lobby/LobbyPopup.test.tsx`
- Modify: `src/test/router.tsx`
- Modify: `src/styles.css` (blok lobi berlapis, sesudah aturan `.lobby-add`; blok tanpa lapisan di akhir file)

**Interfaces:**
- Consumes:
  - `isWideScreen()` dari `@/lib/use-wide-screen` (Task 2);
  - `stubWideScreen`/`unstubWideScreen` dari `@/test/media` (Task 2);
  - atribut `data-lobby-search` (Task 1).
- Produces:
  - `LobbyPopup({ label, className?, bodyClassName?, children })`;
  - `POPUP_PATHS` dan `isPopupPath(pathname: string): boolean`;
  - `renderWithRouter(ui, url?)` yang mengembalikan hasil `render` ditambah `router`.

- [ ] **Step 1: `renderWithRouter` mengembalikan router**

Di `src/test/router.tsx`, ganti baris terakhir fungsi:

```tsx
  return render(<RouterProvider router={router} />)
```

dengan:

```tsx
  return { ...render(<RouterProvider router={router} />), router }
```

- [ ] **Step 2: Tulis test yang gagal**

Buat `src/components/lobby/LobbyPopup.test.tsx`:

```tsx
import { act, fireEvent, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { stubWideScreen, unstubWideScreen } from "@/test/media"
import { renderWithRouter } from "@/test/router"
import { LobbyPopup, isPopupPath } from "./LobbyPopup"

const shelf = (
  <LobbyPopup label="Rak Saya">
    <h1>Rak Saya</h1>
    <div role="dialog" aria-label="Detail buku">
      <button type="button">Di dialog</button>
    </div>
  </LobbyPopup>
)

describe("LobbyPopup", () => {
  afterEach(() => unstubWideScreen())

  it("knows which pages open over the lobby", () => {
    expect(isPopupPath("/shelf")).toBe(true)
    expect(isPopupPath("/settings")).toBe(true)
    expect(isPopupPath("/lobby")).toBe(false)
    expect(isPopupPath("/read/abc")).toBe(false)
  })

  it("is the labelled main area and takes the focus to its heading on desktop", async () => {
    stubWideScreen(true)
    renderWithRouter(shelf, "/shelf")
    const main = await screen.findByRole("main", { name: "Rak Saya" })
    const heading = within(main).getByRole("heading", { level: 1 })
    await vi.waitFor(() => expect(heading).toHaveFocus())
    expect(heading).toHaveAttribute("tabindex", "-1")
  })

  it("leaves the focus alone on phones, where it is a page", async () => {
    stubWideScreen(false)
    renderWithRouter(shelf, "/shelf")
    const main = await screen.findByRole("main", { name: "Rak Saya" })
    expect(within(main).getByRole("heading", { level: 1 })).not.toHaveFocus()
  })

  it.each([
    [
      "its close button",
      () => fireEvent.click(screen.getByRole("button", { name: "Tutup Rak Saya" })),
    ],
    [
      "the dimmed lobby",
      () => {
        const backdrop = document.querySelector(".lobby-popup-backdrop")
        if (!backdrop) throw new Error("no backdrop")
        fireEvent.click(backdrop)
      },
    ],
    ["Escape", () => fireEvent.keyDown(document.body, { key: "Escape" })],
  ])("closes to the lobby with %s", async (_how, act_) => {
    stubWideScreen(true)
    const { router } = renderWithRouter(shelf, "/shelf")
    await screen.findByRole("main", { name: "Rak Saya" })
    await act(async () => act_())
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe("/lobby")
    )
  })

  it("leaves Escape to a dialog over it, to the top bar, and to phones", async () => {
    const media = stubWideScreen(true)
    const { router } = renderWithRouter(
      <>
        <header className="lobby-topbar">
          <input aria-label="Cari di rakmu" />
        </header>
        {shelf}
      </>,
      "/shelf"
    )
    await screen.findByRole("main", { name: "Rak Saya" })
    fireEvent.keyDown(screen.getByRole("button", { name: "Di dialog" }), {
      key: "Escape",
    })
    fireEvent.keyDown(screen.getByLabelText("Cari di rakmu"), {
      key: "Escape",
    })
    media.set(false)
    fireEvent.keyDown(document.body, { key: "Escape" })
    await act(async () => {})
    expect(router.state.location.pathname).toBe("/shelf")
  })

  it("gives the focus back to what opened it", async () => {
    stubWideScreen(true)
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Buka rak
          </button>
          {open && (
            <LobbyPopup label="Rak Saya">
              <h1>Rak Saya</h1>
              <button type="button" onClick={() => setOpen(false)}>
                Selesai
              </button>
            </LobbyPopup>
          )}
        </>
      )
    }
    renderWithRouter(<Harness />, "/shelf")
    const opener = await screen.findByRole("button", { name: "Buka rak" })
    opener.focus()
    fireEvent.click(opener)
    const heading = await screen.findByRole("heading", { level: 1 })
    await vi.waitFor(() => expect(heading).toHaveFocus())
    fireEvent.click(screen.getByRole("button", { name: "Selesai" }))
    expect(opener).toHaveFocus()
  })

  it("falls back to the lobby's search when the opener is gone", async () => {
    stubWideScreen(true)
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <input aria-label="Cari di rakmu" data-lobby-search="" />
          {open && (
            <LobbyPopup label="Rak Saya">
              <h1>Rak Saya</h1>
              <button type="button" onClick={() => setOpen(false)}>
                Selesai
              </button>
            </LobbyPopup>
          )}
        </>
      )
    }
    renderWithRouter(<Harness />, "/shelf")
    fireEvent.click(await screen.findByRole("button", { name: "Selesai" }))
    expect(screen.getByLabelText("Cari di rakmu")).toHaveFocus()
  })
})
```

Pada test "falls back…", tidak ada elemen yang fokus saat popup dipasang (`document.body`), jadi pembukanya `null`.

- [ ] **Step 3: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/lobby/LobbyPopup.test.tsx`
Expected: FAIL dengan "Failed to resolve import ./LobbyPopup".

- [ ] **Step 4: Implementasi `LobbyPopup`**

Buat `src/components/lobby/LobbyPopup.tsx`:

```tsx
import { useNavigate } from "@tanstack/react-router"
import { XIcon } from "lucide-react"
import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { isWideScreen } from "@/lib/use-wide-screen"
import { cn } from "@/lib/utils"

/** The pages that open over the lobby on desktop (spec 1F §3). */
export const POPUP_PATHS: ReadonlyArray<string> = ["/shelf", "/settings"]

export const isPopupPath = (pathname: string): boolean =>
  POPUP_PATHS.includes(pathname)

/** Where the focus goes when the popup's opener is gone (spec 1F §4.3). */
const FALLBACK_FOCUS = "[data-lobby-search]"
/** What handles Escape itself: dialogs over the popup and the top bar. */
const OWN_ESCAPE = '[role="dialog"], [role="alertdialog"], .lobby-topbar'

/**
 * Rak Saya or Pengaturan: a glass panel over the lobby on desktop, a plain
 * page on phones. CSS decides which (spec 1F §4, §5); the focus and Escape
 * are handled on desktop only.
 */
export function LobbyPopup({
  label,
  className,
  bodyClassName,
  children,
}: {
  /** The page's name, as in its h1: "Rak Saya", "Pengaturan". */
  label: string
  /** On the panel, e.g. its max width. */
  className?: string
  /** On the column that holds the content, e.g. its gap. */
  bodyClassName?: string
  children: ReactNode
}) {
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const close = () => void navigate({ to: "/lobby" })

  // Taken before a popup on its way out hands the focus back, so going from
  // Rak Saya to Pengaturan remembers the link that was used.
  useLayoutEffect(() => {
    const active = document.activeElement
    openerRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null
  }, [])

  useEffect(() => {
    if (isWideScreen()) {
      const heading = mainRef.current?.querySelector("h1")
      if (heading) {
        heading.tabIndex = -1
        heading.focus({ preventScroll: true })
      }
    }
    return () => {
      if (!isWideScreen()) return
      const opener = openerRef.current
      // A link in the closed account menu is still connected, but hidden.
      const back =
        opener?.isConnected && opener.checkVisibility?.() !== false
          ? opener
          : document.querySelector<HTMLElement>(FALLBACK_FOCUS)
      back?.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return
      if (!isWideScreen()) return
      if (event.target instanceof Element && event.target.closest(OWN_ESCAPE)) {
        return
      }
      event.preventDefault()
      void navigate({ to: "/lobby" })
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [navigate])

  return (
    <>
      {/* Mouse only: Escape and the close button do the same for everyone. */}
      <div aria-hidden="true" className="lobby-popup-backdrop" onClick={close} />
      <main
        ref={mainRef}
        aria-label={label}
        className={cn("lobby-popup", className)}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Tutup ${label}`}
          className="lobby-popup-close"
          onClick={close}
        >
          <XIcon />
        </Button>
        <div className={cn("flex flex-col", bodyClassName)}>{children}</div>
      </main>
    </>
  )
}
```

- [ ] **Step 5: Gaya popup**

Di `src/styles.css`, di dalam blok lapisan yang sama dengan aturan lobi, tambahkan sesudah aturan `.lobby-add { … }` dan sebelum `@media (min-width: 1024px) { .lobby-page { height: 100dvh; } …`:

```css
  /* Rak Saya and Pengaturan (spec 1F §4, §5): a page on phones, a glass panel
     over the lobby on desktop. */
  .lobby-popup {
    width: 100%;
    margin-inline: auto;
    padding: 1rem;
  }
  .lobby-popup-backdrop,
  .lobby-popup-close {
    display: none;
  }
  @media (min-width: 640px) {
    .lobby-popup {
      padding: 2rem;
    }
  }
  @media (max-width: 1023px) {
    /* On phones the page stands alone; the lobby waits hidden behind it. */
    .lobby-page[data-popup] {
      display: none;
    }
  }
  @media (min-width: 1024px) {
    .lobby-popup-backdrop {
      position: fixed;
      inset: 0;
      z-index: 14;
      display: block;
      background: rgb(12 8 5 / 0.55);
      backdrop-filter: blur(3px);
    }
    /* Between the floating menu and the right edge, centred up to its max width. */
    .lobby-popup {
      position: fixed;
      top: calc(var(--lobby-bar-h) + 0.75rem);
      left: calc(var(--float-menu-w) + 1.5rem);
      right: 0.75rem;
      z-index: 15;
      width: auto;
      max-height: calc(100dvh - var(--lobby-bar-h) - 1.5rem);
      overflow-y: auto;
      overscroll-behavior: contain;
      border: 1px solid var(--border);
      border-radius: 1rem;
      background: var(--color-panel);
      box-shadow: 0 20px 50px rgb(0 0 0 / 0.5);
      backdrop-filter: blur(12px);
    }
    /* Stays in the corner while the panel scrolls. */
    .lobby-popup-close {
      position: sticky;
      top: 0;
      z-index: 1;
      float: right;
      display: inline-flex;
      margin: -1.25rem -1.25rem 0 0;
    }
  }
```

Di bagian tanpa lapisan di akhir file, di dalam `@media (min-width: 1024px) { .member-main[data-shell] > main { min-height: 100dvh; } }`, tambahkan:

```css
  /* The popup is as tall as its content, up to the screen. */
  .member-main[data-shell] > main.lobby-popup {
    min-height: 0;
  }
```

Aturan ini harus tanpa lapisan. Aturan `min-height` di atasnya juga tanpa lapisan, jadi selalu menang atas aturan berlapis.

- [ ] **Step 6: Jalankan test, pastikan lolos**

Run: `npx vitest run src/components/lobby/LobbyPopup.test.tsx src/components/lobby/LobbyTopBar.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/lobby/LobbyPopup.tsx src/components/lobby/LobbyPopup.test.tsx src/test/router.tsx src/styles.css
git commit -m "feat(lobby): popup that holds Rak Saya and Pengaturan over the lobby"
```

---

### Task 4: Layout `_lobi`, `LobbyStage`, dan pemindahan rute

**Files:**
- Create: `src/components/lobby/LobbyStage.tsx`
- Create: `src/components/lobby/LobbyStage.test.tsx`
- Create: `src/routes/_member/_lobi.tsx`
- Move + modify: `src/routes/_member/lobby.tsx` → `src/routes/_member/_lobi/lobby.tsx`
- Move + modify: `src/routes/_member/shelf.tsx` → `src/routes/_member/_lobi/shelf.tsx`
- Move + modify: `src/routes/_member/settings.tsx` → `src/routes/_member/_lobi/settings.tsx`
- Modify: `src/components/member/MemberShell.tsx`
- Test: `src/components/member/MemberShell.test.tsx`
- Regenerate: `src/routeTree.gen.ts`

**Interfaces:**
- Consumes:
  - `LobbyPopup` dan `isPopupPath` (Task 3);
  - `useWideScreen` (Task 2);
  - `LobbyScene` props `paused` dan `allow3d` (Task 2);
  - `stubWideScreen` (Task 2);
  - `renderWithRouter` yang mengembalikan `router` (Task 3).
- Produces:
  - `LobbyStage({ user, books, usage, offline, popup })`;
  - route id `/_member/_lobi` dengan loader data `{ books, usage, offline }` (dibaca anak lewat `getRouteApi("/_member/_lobi")`).

- [ ] **Step 1: Tulis test `LobbyStage` yang gagal**

Buat `src/components/lobby/LobbyStage.test.tsx`:

```tsx
import "fake-indexeddb/auto"
import { act, fireEvent, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { StorageUsage } from "@/lib/book-types"
import type { SessionUser } from "@/lib/session-types"
import { stubWideScreen, unstubWideScreen } from "@/test/media"
import { renderWithRouter } from "@/test/router"
import { LobbyStage } from "./LobbyStage"

// The real scene starts three.js; here it only shows what it was given.
const scene = vi.hoisted(() => ({
  props: null as { paused?: boolean; allow3d?: boolean } | null,
}))
vi.mock("./LobbyScene", () => ({
  LobbyScene: (props: { paused?: boolean; allow3d?: boolean }) => {
    scene.props = props
    return <section aria-label="Adegan lobi" className="lobby-scene" />
  },
}))

const member: SessionUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "ani@glosa.test",
  provider: "email",
  username: "anibaca",
  displayName: "Ani Baca",
  memberNo: 7,
  plan: "free",
  storageLimitBytes: 104857600,
  memberSince: "2026-10-15T00:00:00+00:00",
  onboarded: true,
}
const usage: StorageUsage = {
  usedBytes: 0,
  limitBytes: 104857600,
  plan: "free",
}

function renderStage(popup: boolean, url = popup ? "/shelf" : "/lobby") {
  return renderWithRouter(
    <LobbyStage
      user={member}
      books={[sherlock]}
      usage={usage}
      offline={false}
      popup={popup}
    />,
    url
  )
}

describe("LobbyStage", () => {
  afterEach(() => {
    unstubWideScreen()
    scene.props = null
  })

  it("is the lobby page, with its panels and a live scene", async () => {
    stubWideScreen(true)
    renderStage(false)
    expect(await screen.findByRole("main")).toHaveClass("lobby-page")
    expect(screen.getByRole("heading", { name: "Lobi" })).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Peta Perpustakaan" })
    ).toBeInTheDocument()
    expect(scene.props).toMatchObject({ paused: false, allow3d: true })
  })

  it("behind a popup keeps only a paused, hidden scene and the top bar", async () => {
    stubWideScreen(true)
    const { container } = renderStage(true)
    await screen.findByLabelText("Cari di rakmu")
    expect(screen.queryByRole("main")).toBeNull()
    expect(screen.queryByRole("heading", { name: "Lobi" })).toBeNull()
    expect(
      screen.queryByRole("heading", { name: "Peta Perpustakaan" })
    ).toBeNull()
    expect(scene.props).toMatchObject({ paused: true, allow3d: true })
    const wrapper = container.querySelector(".lobby-scene")?.parentElement
    expect(wrapper).toHaveAttribute("inert")
    expect(wrapper).toHaveAttribute("aria-hidden", "true")
    expect(container.querySelector(".lobby-page")).toHaveAttribute(
      "data-popup"
    )
  })

  it("keeps WebGL off behind a page on phones", async () => {
    stubWideScreen(false)
    renderStage(true)
    await screen.findByLabelText("Cari di rakmu")
    expect(scene.props).toMatchObject({ paused: true, allow3d: false })
  })

  it("closes the popup when a search result is picked, and shows the book", async () => {
    stubWideScreen(true)
    const { router } = renderStage(true)
    fireEvent.change(await screen.findByLabelText("Cari di rakmu"), {
      target: { value: "sherlock" },
    })
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: new RegExp(sherlock.title) })
      )
    })
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe("/lobby")
    )
  })
})
```

Di test terakhir, `popup` tetap `true` karena prop-nya tetap. Test ini hanya memastikan navigasi ke `/lobby`. Munculnya detail buku di lobi dicek E2E di Task 5.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/lobby/LobbyStage.test.tsx`
Expected: FAIL dengan "Failed to resolve import ./LobbyStage".

- [ ] **Step 3: Implementasi `LobbyStage`**

Buat `src/components/lobby/LobbyStage.tsx`. Isinya `LobbyPage` dari `src/routes/_member/lobby.tsx`, dengan data dari props dan mode `popup`:

```tsx
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { type ReactNode, useMemo, useRef, useState } from "react"
import { AdminDeskCard } from "@/components/lobby/AdminDeskCard"
import { BookDetailPanel } from "@/components/lobby/BookDetailPanel"
import { ContinueSheet } from "@/components/lobby/ContinueSheet"
import { LibraryMap } from "@/components/lobby/LibraryMap"
import { LibrarianWelcome, ReadingHint } from "@/components/lobby/LobbyBubbles"
import {
  LobbyScene,
  type LobbySceneHandle,
} from "@/components/lobby/LobbyScene"
import { LobbyTopBar } from "@/components/lobby/LobbyTopBar"
import { RecentBooks } from "@/components/lobby/RecentBooks"
import { TrolleyPanel } from "@/components/lobby/TrolleyPanel"
import { lobbyHotspots, summarizeLobby } from "@/components/lobby/lobby-data"
import { type HotspotId, spotOf } from "@/components/lobby/scene/layout"
import { useAndaSpot } from "@/components/lobby/useAndaSpot"
import { UploadPanel } from "@/components/shelf/UploadPanel"
import { useLocalShelf } from "@/components/shelf/useLocalShelf"
import { Button } from "@/components/ui/button"
import type { ShelfBook, StorageUsage } from "@/lib/book-types"
import type { SessionUser } from "@/lib/session-types"
import { useWideScreen } from "@/lib/use-wide-screen"

/**
 * The lobby (spec 1D), mounted under /lobby, /shelf and /settings so the 3D
 * scene stays loaded. With a popup over it (spec 1F §3): the scene pauses
 * and hides from the keyboard, and the panels step aside; only the top bar
 * stays. On phones CSS hides it all, and WebGL stays off.
 */
export function LobbyStage({
  user,
  books,
  usage,
  offline,
  popup,
}: {
  user: SessionUser
  books: Array<ShelfBook>
  usage: StorageUsage
  offline: boolean
  /** Rak Saya or Pengaturan is open over the lobby. */
  popup: boolean
}) {
  const search = useSearch({ strict: false })
  const kembali = "kembali" in search ? search.kembali : undefined
  const navigate = useNavigate()
  const router = useRouter()
  const wide = useWideScreen()
  const local = useLocalShelf()
  const summary = useMemo(() => summarizeLobby(books), [books])
  const hotspots = useMemo(() => lobbyHotspots(summary.counts), [summary])
  const [anda, moveAnda] = useAndaSpot()
  const sceneRef = useRef<LobbySceneHandle>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  // What had the focus when a book was picked; "Tutup detail" returns there.
  const openerRef = useRef<HTMLElement | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sorting, setSorting] = useState(false)
  const [readingHint, setReadingHint] = useState(false)
  const [sceneLive, setSceneLive] = useState(false)
  const selected = books.find((book) => book.id === selectedId) ?? null
  const refresh = () => void router.invalidate()
  const select = (book: ShelfBook) => {
    const active = document.activeElement
    openerRef.current = active instanceof HTMLElement ? active : null
    setSelectedId(book.id)
    // The details belong to the lobby: a popup over it closes (spec 1F §4.4).
    if (popup) void navigate({ to: "/lobby" })
  }
  // A search result is gone once picked: then the focus goes to the search.
  const closeDetail = () => {
    setSelectedId(null)
    const opener = openerRef.current
    if (opener?.isConnected && opener !== document.body) opener.focus()
    else searchRef.current?.focus()
  }
  const onDeleted = (book: ShelfBook) => {
    if (book.id === selectedId) {
      setSelectedId(null)
      searchRef.current?.focus()
    }
    refresh()
  }

  /** Every tap acts at once, while "Anda" walks over (spec 1D §5.1). */
  function activate(id: HotspotId) {
    moveAnda(spotOf(id).stand)
    setReadingHint(false)
    if (id === "meja-baca") {
      if (summary.lastRead) {
        void navigate({
          to: "/read/$bookId",
          params: { bookId: summary.lastRead.id },
        })
      } else {
        setReadingHint(true)
      }
    } else if (id === "meja-admin") {
      setUploading(true)
    } else if (id === "troli") {
      setSorting(true)
    } else {
      void navigate({ to: "/shelf", search: { genre: id } })
    }
  }

  // Behind a popup the scene says nothing: its words would repeat the page's.
  const bubbles: Partial<Record<HotspotId, ReactNode>> = {}
  if (!popup && readingHint) bubbles["meja-baca"] = <ReadingHint />
  // Phones greet in the sheet instead: their first view leaves the desk out.
  if (!popup && books.length === 0) {
    bubbles["meja-admin"] = <LibrarianWelcome className="hidden lg:grid" />
  }

  // One element for every mode, so switching never remounts the WebGL scene.
  return (
    <div
      className="lobby-page"
      role={popup ? undefined : "main"}
      data-popup={popup ? "" : undefined}
    >
      {!popup && <h1 className="sr-only">Lobi</h1>}
      <div
        className="contents"
        inert={popup}
        aria-hidden={popup ? "true" : undefined}
      >
        <LobbyScene
          ref={sceneRef}
          hotspots={hotspots}
          anda={anda}
          bubbles={bubbles}
          onActivate={activate}
          onLiveChange={setSceneLive}
          paused={popup}
          allow3d={!popup || wide}
        />
      </div>
      <LobbyTopBar
        user={user}
        books={books}
        onSelect={select}
        searchRef={searchRef}
        className="hidden lg:flex"
      />
      {!popup && (
        <>
          <div className="lobby-notices lobby-overlay">
            {kembali === 1 && (
              <output className="lobby-notice">
                Selamat datang kembali, {user.displayName}!
              </output>
            )}
            {offline && (
              <output className="lobby-notice">
                Kamu sedang offline. Rak ditampilkan dari salinan terakhir di
                perangkat ini.
              </output>
            )}
          </div>
          {/* Each panel has its own corner, like mockups/lobi.html. */}
          <aside aria-label="Panel lobi" className="lobby-side lobby-overlay">
            <LibraryMap
              hotspots={hotspots}
              anda={anda}
              interactive={sceneLive}
              onSelect={(id) => sceneRef.current?.showSpot(id)}
              className="lobby-at-map"
            />
            {selected && (
              <BookDetailPanel
                book={selected}
                local={local}
                onClose={closeDetail}
                onChanged={refresh}
                onDeleted={onDeleted}
                className="lobby-at-detail"
              />
            )}
            <RecentBooks
              books={summary.recent}
              local={local}
              onSelect={select}
              className="lobby-at-recent"
            />
            <AdminDeskCard
              usage={usage}
              onUpload={() => setUploading(true)}
              className="lobby-at-admin"
            />
          </aside>
          <ContinueSheet
            key={summary.lastRead?.id}
            book={summary.lastRead}
            empty={books.length === 0}
            local={local}
            onChanged={refresh}
            onDeleted={onDeleted}
          />
          <Button
            size="icon-lg"
            aria-label="Bawa buku"
            className="lobby-add lobby-overlay lg:hidden"
            onClick={() => setUploading(true)}
          >
            <PlusIcon />
          </Button>
        </>
      )}
      <UploadPanel open={uploading} onOpenChange={setUploading} usage={usage} />
      <TrolleyPanel
        open={sorting}
        onOpenChange={setSorting}
        books={summary.trolley}
        onSaved={refresh}
      />
    </div>
  )
}
```

`useSearch({ strict: false })` mengembalikan gabungan search semua rute. Pemeriksaan `"kembali" in search` menjaga tipe tetap sempit, baik sebelum maupun sesudah `routeTree.gen.ts` dibuat ulang. Kalau TypeScript sudah tahu `search.kembali` setelah Step 9, cukup pakai `search.kembali`.

- [ ] **Step 4: Jalankan test `LobbyStage`, pastikan lolos**

Run: `npx vitest run src/components/lobby/LobbyStage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Pindahkan file rute**

```bash
mkdir -p src/routes/_member/_lobi
git mv src/routes/_member/lobby.tsx src/routes/_member/_lobi/lobby.tsx
git mv src/routes/_member/shelf.tsx src/routes/_member/_lobi/shelf.tsx
git mv src/routes/_member/settings.tsx src/routes/_member/_lobi/settings.tsx
```

- [ ] **Step 6: Buat layout `_lobi`**

Buat `src/routes/_member/_lobi.tsx`:

```tsx
import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router"
import { isPopupPath } from "@/components/lobby/LobbyPopup"
import { LobbyStage } from "@/components/lobby/LobbyStage"
import { ShelfLoadError } from "@/components/shelf/ShelfLoadError"
import { useShelfSnapshot } from "@/components/shelf/useShelfSnapshot"
import { loadShelf } from "@/lib/shelf-loader"

export const Route = createFileRoute("/_member/_lobi")({
  // One shelf for the lobby and the pages over it, so all three open
  // offline too (spec 1D §3.2, spec 1F §3).
  loader: ({ context }) => loadShelf(context.user.id),
  // Filtering happens in the browser; reload only on invalidate or after a minute.
  staleTime: 60_000,
  errorComponent: ShelfLoadError,
  component: LobiLayout,
})

/** The lobby stays mounted under Rak Saya and Pengaturan (spec 1F §3). */
function LobiLayout() {
  const { books, usage, offline } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  // The resolved location, like MemberShell: the page being left still
  // renders while the next route resolves.
  const popup = useRouterState({
    select: (state) =>
      isPopupPath((state.resolvedLocation ?? state.location).pathname),
  })
  useShelfSnapshot(user.id, books, usage, offline)

  return (
    <>
      <LobbyStage
        user={user}
        books={books}
        usage={usage}
        offline={offline}
        popup={popup}
      />
      <Outlet />
    </>
  )
}
```

- [ ] **Step 7: Ubah rute lobi**

Ganti seluruh isi `src/routes/_member/_lobi/lobby.tsx` dengan:

```tsx
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_member/_lobi/lobby")({
  // Keep the value as the number 1 so the URL stays `?kembali=1` after validation.
  validateSearch: (search: Record<string, unknown>): { kembali?: 1 } => ({
    kembali: search.kembali === 1 || search.kembali === "1" ? 1 : undefined,
  }),
  head: () => ({ meta: [{ title: "Lobi — Glosa" }] }),
  // The layout draws the lobby (LobbyStage); nothing goes over it here.
  component: () => null,
})
```

- [ ] **Step 8: Ubah rute Rak dan Pengaturan**

Di `src/routes/_member/_lobi/shelf.tsx`:

1. Ganti import router dan hapus import yang tidak dipakai lagi:

```tsx
import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"
```

   Hapus baris import `ShelfLoadError`, `useShelfSnapshot`, dan `loadShelf`. Tambahkan:

```tsx
import { LobbyPopup } from "@/components/lobby/LobbyPopup"
```

2. Ganti definisi rute:

```tsx
const lobi = getRouteApi("/_member/_lobi")

export const Route = createFileRoute("/_member/_lobi/shelf")({
  validateSearch: parseShelfSearch,
  head: () => ({ meta: [{ title: "Rak Saya — Glosa" }] }),
  component: ShelfPage,
})
```

3. Di `ShelfPage`, ganti dua baris pertama:

```tsx
  const { books, usage, offline } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
```

   dengan:

```tsx
  const { books, usage, offline } = lobi.useLoaderData()
```

   Hapus baris `useShelfSnapshot(user.id, books, usage, offline)` beserta baris kosong di atasnya. Layout yang sekarang memanggilnya.

4. Ganti pembuka dan penutup `<main …>`:

```tsx
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-5 p-4 sm:p-8">
```

   menjadi:

```tsx
    <LobbyPopup label="Rak Saya" className="max-w-5xl" bodyClassName="gap-5">
```

   dan `</main>` di akhir menjadi `</LobbyPopup>`. Isi di antaranya tidak berubah.

Di `src/routes/_member/_lobi/settings.tsx`:

1. Tambahkan import:

```tsx
import { LobbyPopup } from "@/components/lobby/LobbyPopup"
```

2. Ganti `createFileRoute("/_member/settings")` dengan `createFileRoute("/_member/_lobi/settings")`.
3. Ganti:

```tsx
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-8">
```

   dengan:

```tsx
    <LobbyPopup label="Pengaturan" className="max-w-3xl" bodyClassName="gap-6">
```

   dan `</main>` penutupnya dengan `</LobbyPopup>`.

`Route.useRouteContext()` di Pengaturan tetap berfungsi. Konteks `user` dari `/_member` diwariskan lewat layout.

- [ ] **Step 9: Buat ulang route tree dan typecheck**

Run: `npm run generate-routes && npm run typecheck`
Expected:
- `src/routeTree.gen.ts` sekarang mengimpor `./routes/_member/_lobi`, `./routes/_member/_lobi/lobby`, `./routes/_member/_lobi/shelf`, dan `./routes/_member/_lobi/settings`;
- tidak ada lagi impor `./routes/_member/lobby`;
- typecheck tanpa error.

Kalau `search.kembali` di `LobbyStage` sudah dikenali TypeScript, sederhanakan barisnya menjadi `const { kembali } = useSearch({ strict: false })`.

- [ ] **Step 10: Tulis test `MemberShell` yang gagal**

Di `src/components/member/MemberShell.test.tsx`, ganti dua test `"floats the menu over the lobby only"` dan `"keeps the sidebar fixed beside other pages"` dengan:

```tsx
  it.each(["/lobby", "/shelf?genre=lainnya", "/settings"])(
    "floats the menu over the lobby at %s",
    async (url) => {
      const { container } = renderAt(url)
      const [sidebar] = await screen.findAllByRole("navigation", {
        name: "Navigasi anggota",
      })
      expect(sidebar).toHaveAttribute("data-floating")
      expect(container.querySelector(".member-main")).toHaveAttribute(
        "data-floating"
      )
    }
  )
```

- [ ] **Step 11: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/member/MemberShell.test.tsx`
Expected: kasus `/shelf?genre=lainnya` dan `/settings` FAIL karena `data-floating` tidak ada.

- [ ] **Step 12: Implementasi di `MemberShell`**

Di `src/components/member/MemberShell.tsx`, sesudah `const isCurrent = …`, tambahkan:

```tsx
/** Pages with the lobby behind them on desktop (spec 1F §3). */
const OVER_LOBBY = ["/lobby", "/shelf", "/settings"]
```

Ganti:

```tsx
  // Over the lobby's scene the menu floats as a card, like the top bar and
  // the panels there (owner's choice after the 1D review).
  const floating = shown && isCurrent(pathname, "/lobby") ? "" : undefined
```

dengan:

```tsx
  // Over the lobby's scene the menu floats as a card, like the top bar and
  // the panels there (owner's choice after the 1D review). Rak Saya and
  // Pengaturan open over the lobby too (spec 1F).
  const floating =
    shown && OVER_LOBBY.some((to) => isCurrent(pathname, to)) ? "" : undefined
```

- [ ] **Step 13: Jalankan seluruh unit test, lint, dan format**

Run: `npm test && npm run lint && npm run check && npm run typecheck`
Expected: semua PASS. Kalau `npm run check` gagal karena format, jalankan `npm run format` lalu ulangi.

- [ ] **Step 14: Cek cepat di browser**

Run: `npm run dev`. Port 3000 sering dipakai server proyek lain (garuda-reborn/merchant), jadi hentikan dulu kalau ada. Lalu buka `http://localhost:3000`, masuk, dan cek di lebar ≥ 1024px:
- menu kiri "Rak Saya" membuka panel di atas lobi yang redup;
- Esc dan ✕ kembali ke lobi;
- menu akun → Pengaturan membuka panel Pengaturan, dan menu akun tertutup.

Lalu persempit jendela di bawah 1024px. `/shelf` harus menjadi halaman biasa tanpa lobi di belakangnya.

- [ ] **Step 15: Commit**

```bash
git add src/components/lobby/LobbyStage.tsx src/components/lobby/LobbyStage.test.tsx src/routes/_member src/routeTree.gen.ts src/components/member/MemberShell.tsx src/components/member/MemberShell.test.tsx
git commit -m "feat(lobby): Rak Saya and Pengaturan open over the lobby on desktop"
```

---

### Task 5: E2E popup, halaman HP, dan adegan 3D yang bertahan

**Files:**
- Create: `e2e/lobby-popup.spec.ts`
- Modify: `e2e/lobby-3d.spec.ts` (test baru di akhir file)

**Interfaces:**
- Consumes:
  - perilaku Task 1–4;
  - helper `createConfirmedMember`, `hydrated`, `signInAndOnboard`, `userIdOf` (`e2e/helpers/members.ts`);
  - helper `SHERLOCK`, `seedBook` (`e2e/helpers/books.ts`).
- Produces: —

- [ ] **Step 1: Tulis E2E popup**

Buat `e2e/lobby-popup.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test"
import { SHERLOCK, seedBook } from "./helpers/books"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"

// Spec 1F: on desktop Rak Saya and Pengaturan open over the lobby; on phones
// they stay pages. Without WebGL here, the lobby shows its still image.

const popupOf = (page: Page, name: string) =>
  page.getByRole("main", { name })
const navOf = (page: Page) =>
  page.getByRole("navigation", { name: "Navigasi anggota" })
/** The scene by class: behind a popup it is aria-hidden, so out of getByRole. */
const sceneOf = (page: Page) => page.locator(".lobby-scene")

async function memberInLobby(page: Page) {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await hydrated(page)
  await expect(page).toHaveURL(/\/lobby/)
  return member
}

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "the popups are for desktop")

  test("Rak Saya and Pengaturan open over the lobby, which stays mounted", async ({
    page,
  }) => {
    await memberInLobby(page)
    await sceneOf(page).evaluate((element) => {
      element.dataset.e2eMark = "lobi"
    })

    await navOf(page).getByRole("link", { name: "Rak Saya" }).click()
    await expect(page).toHaveURL(/\/shelf$/)
    await expect(
      popupOf(page, "Rak Saya").getByRole("heading", { name: "Rak Saya", level: 1 })
    ).toBeFocused()
    await expect(page.getByRole("region", { name: "Adegan lobi" })).toHaveCount(0)

    await navOf(page).getByRole("link", { name: "Pengaturan" }).click()
    await expect(
      popupOf(page, "Pengaturan").getByRole("heading", {
        name: "Pengaturan",
        level: 1,
      })
    ).toBeFocused()

    await page.keyboard.press("Escape")
    await expect(page).toHaveURL(/\/lobby$/)
    await expect(popupOf(page, "Pengaturan")).toHaveCount(0)
    await expect(navOf(page).getByRole("link", { name: "Pengaturan" })).toBeFocused()
    // The same scene element all along: the lobby was never mounted again.
    await expect(sceneOf(page)).toHaveAttribute("data-e2e-mark", "lobi")
  })

  test("Back and the close button close the popup; a refresh keeps it over the lobby", async ({
    page,
  }) => {
    await memberInLobby(page)
    await navOf(page).getByRole("link", { name: "Rak Saya" }).click()
    await expect(popupOf(page, "Rak Saya")).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/\/lobby$/)
    await expect(popupOf(page, "Rak Saya")).toHaveCount(0)

    await page.goto("/shelf")
    await hydrated(page)
    await expect(popupOf(page, "Rak Saya")).toBeVisible()
    await expect(sceneOf(page)).toBeAttached()
    await page.getByRole("button", { name: "Tutup Rak Saya" }).click()
    await expect(page).toHaveURL(/\/lobby$/)

    await page.goto("/settings")
    await hydrated(page)
    await expect(popupOf(page, "Pengaturan")).toBeVisible()
    // The dimmed lobby in the bottom-left corner, left of the panel and
    // below the floating menu.
    await page.mouse.click(20, 700)
    await expect(page).toHaveURL(/\/lobby$/)
  })

  test("the account menu shows above the map and closes on its way to Pengaturan", async ({
    page,
  }) => {
    await memberInLobby(page)
    await page.getByLabel("Menu akun").click()
    const link = page
      .locator(".lobby-account-menu")
      .getByRole("link", { name: "Pengaturan" })
    await expect(link).toBeVisible()
    const onTop = await link.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2
      )
      return hit !== null && element.contains(hit)
    })
    expect(onTop).toBe(true)

    await link.click()
    await expect(popupOf(page, "Pengaturan")).toBeVisible()
    await expect(page.locator(".lobby-account")).not.toHaveAttribute("open")
  })

  test("a search result picked over Rak Saya shows the book in the lobby", async ({
    page,
  }) => {
    const member = await memberInLobby(page)
    await seedBook(await userIdOf(member.email))
    await page.goto("/shelf")
    await hydrated(page)
    await expect(popupOf(page, "Rak Saya")).toBeVisible()

    await page.getByLabel("Cari di rakmu").fill("sherlock")
    await page
      .getByRole("list", { name: "Hasil pencarian" })
      .getByRole("button", { name: new RegExp(SHERLOCK.title) })
      .click()
    await expect(page).toHaveURL(/\/lobby$/)
    await expect(page.getByRole("region", { name: SHERLOCK.title })).toBeVisible()
  })
})

test("on phones Rak Saya and Pengaturan stay pages", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "phones only")
  await memberInLobby(page)

  await navOf(page).getByRole("link", { name: "Rak Saya" }).click()
  await expect(page).toHaveURL(/\/shelf$/)
  await expect(
    page.getByRole("heading", { name: "Rak Saya", level: 1 })
  ).toBeVisible()
  await expect(sceneOf(page)).toBeHidden()
  await expect(page.getByRole("button", { name: "Tutup Rak Saya" })).toBeHidden()
  await page.keyboard.press("Escape")
  await expect(page).toHaveURL(/\/shelf$/)

  await navOf(page).getByRole("link", { name: "Pengaturan" }).click()
  await expect(
    page.getByRole("heading", { name: "Pengaturan", level: 1 })
  ).toBeVisible()
  await expect(sceneOf(page)).toBeHidden()
})
```

Proyek `desktop` memakai "Desktop Chrome" (1280 × 720), jadi titik `(20, 700)` berada di kiri panel (`left` = 10,5rem + 1,5rem = 192px) dan di bawah menu kiri. Proyek `mobile` memakai Pixel 7.

- [ ] **Step 2: Tambahkan test 3D**

Di akhir `e2e/lobby-3d.spec.ts`, tambahkan:

```ts
test("the 3D scene stays loaded behind Rak Saya", async ({ page }) => {
  test.setTimeout(300_000)
  await signInAndOnboard(page, await createConfirmedMember())
  const canvas = sceneOf(page).locator("canvas")
  await expect(canvas).toBeVisible({ timeout: 120_000 })
  await canvas.evaluate((element) => {
    element.dataset.e2eMark = "1"
  })

  await page
    .getByRole("navigation", { name: "Navigasi anggota" })
    .getByRole("link", { name: "Rak Saya" })
    .click()
  await expect(page.getByRole("main", { name: "Rak Saya" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page).toHaveURL(/\/lobby$/)
  // The same canvas: WebGL was not started again (spec 1F §3).
  await expect(sceneOf(page).locator("canvas")).toHaveAttribute(
    "data-e2e-mark",
    "1"
  )
})
```

- [ ] **Step 3: Jalankan E2E popup**

Hentikan dulu server lain yang memakai port 3000 (lihat Task 4 Step 14).

Run: `npx playwright test e2e/lobby-popup.spec.ts --project=desktop --project=mobile`
Expected: 5 test PASS. Masing-masing proyek melewatkan test untuk ukuran layar lainnya.

- [ ] **Step 4: Jalankan E2E yang sudah ada**

Run: `npx playwright test --project=desktop --project=mobile --project=offline`
Expected: semua PASS.

Kalau ada test lama yang gagal karena selektornya menemukan dua elemen (pelanggaran strict mode), batasi selektornya ke popup dengan `page.getByRole("main", { name: "Rak Saya" })` atau `page.getByRole("main", { name: "Pengaturan" })`. Dialog tetap dicari dari `page`, karena dirender lewat portal di luar `<main>`. Jangan ubah perilaku aplikasi untuk menyesuaikan test.

- [ ] **Step 5: Jalankan test 3D yang baru saja**

Run: `npx playwright test e2e/lobby-3d.spec.ts --project=lobby-3d --no-deps -g "stays loaded behind Rak Saya"`
Expected: PASS. SwiftShader lambat, jadi bisa butuh beberapa menit.

- [ ] **Step 6: Commit**

```bash
git add e2e/lobby-popup.spec.ts e2e/lobby-3d.spec.ts
git commit -m "test(e2e): popups over the lobby, phone pages, and a 3D scene that stays"
```

---

### Task 6: Verifikasi akhir

**Files:** — (hanya perbaikan kalau verifikasi menemukan masalah)

- [ ] **Step 1: Seluruh pemeriksaan statis dan unit**

Run: `npm run typecheck && npm run lint && npm run check && npm test`
Expected: semua PASS.

- [ ] **Step 2: Build produksi**

Run: `npm run build`
Expected: build selesai tanpa error. `dist/` berisi chunk `stage` terpisah seperti sebelumnya.

- [ ] **Step 3: Seluruh E2E kecuali uji batas kamera**

Run: `npx playwright test --project=desktop --project=mobile --project=offline`
Expected: semua PASS.

Uji batas kamera di `lobby-3d` makan hingga 25 menit dan tidak tersentuh perubahan ini. CI yang menjalankannya di job `e2e-3d`.

- [ ] **Step 4: Catat pemeriksaan manual untuk pemilik proyek**

Setelah merge ke `main`, situs dev ter-deploy otomatis. Sampaikan daftar cek berikut ke pemilik proyek di `glosa.nuvrastudio.space`:
- **Desktop:**
  - Rak dan Pengaturan tampil sebagai panel di tengah, lobi redup dan diam di belakang;
  - scroll grid buku mulus;
  - Esc, ✕, klik area redup, dan Back browser menutup panel;
  - dropdown akun terlihat di atas peta.
- **HP:** Rak dan Pengaturan tetap halaman biasa.
- **Performa:** di tab Performance DevTools, CPU hampir diam saat panel terbuka, karena loop render berhenti.
