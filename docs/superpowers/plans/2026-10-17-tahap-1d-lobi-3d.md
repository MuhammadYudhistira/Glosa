# Glosa Tahap 1D — Lobi Perpustakaan 3D, Kerangka Navigasi, dan Font Reader Offline: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/lobby` menjadi atrium perpustakaan 3D bertema Starfield Library yang memenuhi layar, hidup dengan animasi ringan, dan setiap tempat pentingnya bisa diketuk. Hasil tambahan:
- semua halaman anggota (kecuali reader) mendapat sidebar/tab bar;
- huruf reader tetap termuat saat offline.

**Architecture:**
- **Adegan 3D.** Adegan Three.js r160 dibangun dari modul kecil di `src/components/lobby/scene/`. Modul itu dimuat lewat `import()` dinamis hanya di `/lobby`.
  - `layout.ts`, `projection.ts`, dan `quality.ts` murni (tanpa three.js), jadi bisa diuji di Vitest.
  - `projection.ts` memuat proyeksi isometrik dan `clampView` (batas kamera).
  - Modul lain membangun mesh. `stage.ts` memegang renderer, kamera, kontrol, loop, dan `dispose()`.
- **Hotspot dan panel** adalah HTML biasa di atas kanvas.
  - Posisi hotspot dihitung dengan `project()` dari `projection.ts`.
  - Tanpa WebGL, atau selama chunk 3D dimuat, lobi memakai gambar diam `public/lobby/lobby-still.*`. Gambar ini dirender dari adegan yang sama oleh `scripts/lobby-harness.mjs`.
- **Data lobi** datang dari `loadShelf` (1C), jadi lobi juga tampil offline.

**Tech Stack:**
- TanStack Start + Router, React 19, TypeScript 6, Tailwind CSS 4, shadcn/ui (base-mira).
- Three.js `0.160.1` (+ `@types/three` `0.160.0`).
- Vitest 5 + Testing Library.
- Playwright: proyek baru `lobby-3d` dengan WebGL SwiftShader. `sharp` dipakai untuk menghitung piksel di test batas kamera dan untuk mengonversi gambar diam.

**Seri rencana tahap 1** (spec induk: [`docs/superpowers/specs/2026-10-15-epub-reader-tahap-1-design.md`](../specs/2026-10-15-epub-reader-tahap-1-design.md); spec 1D: [`docs/superpowers/specs/2026-10-17-tahap-1d-lobi-3d-design.md`](../specs/2026-10-17-tahap-1d-lobi-3d-design.md)):

| Rencana | Isi | Status |
|---|---|---|
| 1A | Fondasi proyek, `profiles`, auth, kartu anggota, pengaturan, halaman hukum, E2E, CI | Selesai (`main`) |
| 1B | Tabel `books`, Storage, kuota, genre + Troli, Rak Saya, upload | Selesai (`main`) |
| 1C | Reader, setelan baca, sinkronisasi posisi, penyimpanan lokal, rak offline, PWA offline | Selesai (`main`) |
| **1D** | **Lobi 3D, kerangka navigasi anggota, font reader offline** | **Dokumen ini** |
| 1E | Produksi: Supabase prod + SMTP, Docker + Caddy di VPS, deploy GitHub Actions, Sentry + Uptime Kuma, sapuan Storage, header cache `sw.js` | Ditulis setelah 1D |

Rujukan visual yang disetujui pemilik proyek: [`docs/superpowers/specs/mockups/lobi-starfield.html`](../specs/mockups/lobi-starfield.html). Kode adegan di rencana ini adalah port prototipe itu ke modul TypeScript. Jika ragu soal warna, ukuran, atau posisi, prototipe itulah acuannya.

## Keputusan dan penyimpangan dari spec

Semua keputusan berikut disengaja. Reviewer tidak perlu menganggapnya sebagai cacat.

1. **Three.js `0.160.1`.** Ini versi yang sama dengan prototipe. `scene.environmentIntensity` baru ada di r163. Prototipe menyetelnya, tetapi tanpa efek, jadi kode ini tidak menyetelnya; tampilannya tetap sama dengan yang disetujui.
2. **Bayangan dan stencil dibuat benar.**
   - Kamera bayangan memanggil `updateProjectionMatrix()`. Di prototipe ini terlewat, sehingga bayangan hanya jatuh di area 10 × 10 m.
   - `EffectComposer` diberi render target yang punya stencil buffer, supaya pemandangan luar benar-benar hanya tergambar di area kaca (spec §3.1).
   - Hasilnya bisa sedikit berbeda dari prototipe. Task 5 membandingkan keduanya secara visual.
3. **Ukuran peta bayangan dipilih sekali saat lobi dibuka:** 2048 untuk tingkat tinggi, 1024 untuk rendah. Jika kualitas turun saat berjalan, yang berubah hanya DPR, bloom, dan jumlah pejalan kaki. Peta bayangan tidak dibuat ulang.
4. **Tingkat "diam" memakai tampilan tingkat rendah** (DPR 1, tanpa bloom) tanpa loop animasi. Gambar diam dirender dengan mode `still`: tampilan tingkat tinggi, satu frame, DPR 1.
5. **Zoom 1–2,6×**, mengikuti spec. Prototipe memakai 3×.
6. **Kerangka navigasi (`MemberShell`) juga tidak tampil di `/welcome`.** Halaman kartu anggota muncul sebelum anggota resmi masuk, sehingga tautan Lobi/Rak di sana hanya akan mengembalikannya ke kartu.
7. **E2E dan WebGL:**
   - Proyek `desktop`, `mobile`, dan `offline` berjalan dengan `--disable-3d-apis`. Lobi di sana memakai gambar diam, sehingga cepat dan stabil walau setiap test melewati `/lobby`.
   - 3D diuji di proyek baru `lobby-3d` (SwiftShader): batas kamera, klik hotspot di kanvas, dan reduced-motion.
   - Di HP, gambar diam 16:9 memotong sisi layar. Karena itu test E2E mengaktifkan hotspot dengan keyboard (`press("Enter")`), jalur yang memang wajib bekerja (spec §6).
8. **Mode uji batas kamera** diaktifkan dengan `window.__GLOSA_LOBBY_TEST__ = true` lewat `page.addInitScript`. Mode ini memberi latar magenta, tanpa bayangan, tanpa bloom, dan tingkat "diam". Tidak ada parameter URL baru.
9. **Gambar diam berukuran 2560 × 1440 dan 1280 × 720**, masing-masing dalam AVIF dan WebP.
   - Halaman auth meng-zoom latar 3×, jadi ukuran 2560 dibutuhkan supaya tidak buram.
   - Posisi Meja Admin untuk zoom CSS di halaman auth dihitung dari `projection.ts` lewat variabel CSS `--desk-x`/`--desk-y`, bukan angka yang ditulis tangan.
10. **Zona tanpa buku diredupkan dengan teks abu dan garis putus-putus, bukan `opacity`.** Dengan begitu label tetap memenuhi kontras AA (spec §6).
11. **Nama aksesibel hotspot:**
    - zona: "Sains & Teknologi · 3 buku";
    - troli berisi: "Troli Buku Baru · 2 buku"; troli kosong: "Troli Buku Baru";
    - lainnya: "Meja Baca", "Meja Admin".

    Titik di Peta bernama "Meja Baca di peta" dan seterusnya, supaya tidak tertukar dengan hotspot.
12. **"Buku terakhir" untuk Meja Baca** adalah buku dengan `last_opened_at` terbaru di server. Membaca saat offline tidak mengubah nilai itu (keputusan 7 di 1C).
13. **Lobi juga menyimpan salinan rak** (seperti Rak Saya), sehingga lobi bisa tampil offline walau anggota belum pernah membuka Rak Saya. Kode penyimpanan dan komponen error dipakai bersama lewat `useShelfSnapshot` dan `ShelfLoadError`.
14. **Posisi "Anda" disimpan** di `sessionStorage` dengan kunci `glosa:lobby-anda`.
15. **Ukuran adegan diukur dari elemen wilayah adegan** (`ResizeObserver`), bukan dari `window`, karena sidebar desktop memakan lebar layar.
16. **Panel desktop ada di satu kolom kanan:** Peta, Detail Buku (hanya saat ada buku dipilih lewat pencarian atau Baru Dibuka), Baru Dibuka, dan Meja Admin. Top bar ada di atas adegan, di kiri kolom itu.
17. **Di HP, sheet "Lanjutkan membaca" juga memuat sapaan pustakawan saat rak kosong**, karena Meja Admin berada di luar layar pada tampilan awal HP.
18. **Panel "Susun buku" saat offline** menampilkan "Butuh internet." dan tidak menampilkan pilihan genre.
19. **Font reader diambil sekali per sesi lalu diubah menjadi `blob:` URL.** Jika ada file yang gagal diambil, hasilnya tidak di-cache dan panggilan berikutnya mencoba lagi.
20. **Nama komponen dan skrip sedikit berbeda dari spec §3:**
    - `LobbyStage` di spec bernama `LobbyScene`, karena `stage.ts` sudah dipakai untuk modul three.js;
    - `scripts/render-lobby-still.mjs` menjadi perintah `still` di `scripts/lobby-harness.mjs`, yang juga menyajikan adegan untuk dilihat saat pengembangan;
    - modul tambahan `kit.ts` menampung pembantu mesh dan PRNG yang dipakai semua modul adegan.

## Global Constraints

- Node.js **≥ 24**. Package manager: **npm**. Supabase Cloud saja; semua test memakai **proyek dev**.
- Teks UI dalam **bahasa Indonesia**, path URL dalam bahasa Inggris. Komentar kode dalam bahasa Inggris, seperti kode yang sudah ada.
- `three` **`0.160.1`** (persis), `@types/three` **`0.160.0`** (persis, devDependency).
- **three.js hanya dimuat lewat `import("./scene/stage")` di `LobbyCanvas`** (dan oleh halaman harness di `scripts/`). Tidak ada route atau modul lain yang mengimpornya secara statis. `layout.ts`, `projection.ts`, `quality.ts`, dan `lobby-data.ts` tidak mengimpor three.
- Ukuran atrium: **34 × 34 m, tinggi 13,5 m**. Lantai di depan ruangan ikut dihitung sebagai bagian peta sampai **6 m**. Jarak aman dari tepi: **0,25 m**. Zoom **1–2,6**. Kamera ditempatkan di `target + (40, 40, 40)`.
- Tingkat kualitas (atribut `data-quality` di wilayah adegan, nilainya persis `tinggi | rendah | diam`):
  - **tinggi:** DPR ≤ 2, peta bayangan 2048, bloom, semua pejalan kaki;
  - **rendah:** HP (`pointer: coarse`), `deviceMemory` ≤ 4, atau rata-rata < **40** fps selama **3000** ms di tingkat tinggi. Isinya DPR 1, peta bayangan 1024, tanpa bloom, separuh pejalan kaki (dibulatkan ke atas);
  - **diam:** `prefers-reduced-motion`, WebGL tidak tersedia, rata-rata < **20** fps selama 3000 ms di tingkat rendah, atau mode uji. Tanpa loop animasi; render hanya saat kamera berubah.
- Anggaran:
  - chunk dinamis `stage-*.js` ≤ **250 kB gzip**;
  - total precache < **4 MB**;
  - gambar diam AVIF ≤ **250 kB** per ukuran;
  - buku sebagai instance ≤ **12.000**;
  - satu lampu berbayangan.
- Breakpoint desktop/HP: **1024 px** (`lg:` di Tailwind).
- Kunci dan penanda (persis): `sessionStorage` `glosa:lobby-anda`; `window.__GLOSA_LOBBY_TEST__`; class `lobby-overlay` pada semua lapisan HTML di atas kanvas.
- Teks UI (persis):
  - wilayah adegan `aria-label="Adegan lobi"`; tombol "Pusatkan";
  - hotspot "Meja Baca", "Meja Admin", "Troli Buku Baru", dan label genre dari `GENRE_LABELS`;
  - "Belum ada buku yang dibaca", dengan tautan "Rak Saya";
  - "Rakmu masih kosong. Bawa buku pertamamu ke sini!";
  - dialog "Susun buku", "Pilih rak untuk setiap buku di troli.", "Troli kosong. Semua buku sudah punya rak.", "Dipindahkan ke {genre}.";
  - "Butuh internet.";
  - top bar: "{n} buku", label pencarian "Cari di rakmu", "Tidak ada buku yang cocok.", "Menu akun", "Pengaturan", "Keluar";
  - panel "Peta Perpustakaan", "Anda", "Baru Dibuka", "Meja Admin", tombol "Bawa buku", "Tutup detail";
  - HP: "Lanjutkan membaca", "Detail", "Tutup detail", tombol "+" bernama "Bawa buku";
  - navigasi `aria-label="Navigasi anggota"` berisi "Lobi", "Rak Saya" (di tab bar tertulis "Rak"), dan "Pengaturan";
  - "Selamat datang kembali, {nama}!" dan "Kamu sedang offline. Rak ditampilkan dari salinan terakhir di perangkat ini." (sama dengan sebelumnya).
- Setiap task diakhiri dengan `npx prettier --write` pada file yang diubah, lalu `npm run lint`, `npm run typecheck`, dan `npm test` hijau sebelum commit.

## Peta file

| File | Tugas |
|---|---|
| `src/components/reader/reader-fonts.ts` | `loadReaderFonts()`: file font sebagai `blob:` URL (Task 1) |
| `src/components/lobby/scene/layout.ts` | Koordinat dunia: atrium, zona, meja, hotspot, jalur pejalan kaki, dinding rak (Task 2) |
| `src/components/lobby/scene/projection.ts` | `project`, `clampView`, `startView`, `panBy`, `centerOn`, `isInView` (Task 2) |
| `src/components/lobby/scene/quality.ts` | Pemilihan tingkat kualitas (Task 2) |
| `src/components/lobby/scene/kit.ts` | Pembantu mesh, material, tekstur kanvas, PRNG (Task 3) |
| `src/components/lobby/scene/room.ts` | Lantai, dinding, balkon, kotak rak melayang, tangga tribun (Task 3) |
| `src/components/lobby/scene/shelves.ts` | Kotak rak menyala, buku dan sekat sebagai `InstancedMesh` (Task 3) |
| `src/components/lobby/scene/skyline.ts` | Kaca, latar kota, awan, burung, lampu suar (Task 3) |
| `src/components/lobby/scene/furniture.ts` | Menara, meja, troli, dekorasi, sudut duduk (Task 3) |
| `src/components/lobby/scene/people.ts` | Figur bersendi dan penempatannya (Task 4) |
| `src/components/lobby/scene/motion.ts` | Animasi per frame dan jalan "Anda" (Task 4) |
| `src/components/lobby/scene/stage.ts` | Renderer, kamera, kontrol, kualitas, loop, `dispose()` (Task 5) |
| `scripts/lobby-harness.mjs`, `scripts/lobby-harness/*` | Halaman pengembangan adegan, tangkapan layar, gambar diam (Task 5–6) |
| `src/components/lobby/LobbyStill.tsx` | Gambar diam dan view-nya (Task 6) |
| `src/components/member/MemberShell.tsx` | Sidebar/tab bar anggota (Task 7) |
| `src/components/lobby/lobby-data.ts` | Ringkasan rak untuk lobi dan model hotspot (Task 8) |
| `src/components/lobby/HotspotLayer.tsx`, `LobbyCanvas.tsx`, `LobbyScene.tsx` | Wilayah adegan (Task 8) |
| `src/components/lobby/LobbyTopBar.tsx`, `LibraryMap.tsx`, `RecentBooks.tsx`, `AdminDeskCard.tsx`, `BookDetailPanel.tsx` | Panel desktop (Task 9) |
| `src/components/lobby/ContinueSheet.tsx`, `TrolleyPanel.tsx`, `LobbyBubbles.tsx`, `useAndaSpot.ts` | Panel HP, troli, gelembung, posisi "Anda" (Task 10) |
| `src/routes/_member/lobby.tsx` | Halaman lobi (Task 11) |
| `e2e/lobby.spec.ts`, `e2e/lobby-3d.spec.ts` | E2E lobi (Task 11–12) |

---

### Task 1: Font reader termuat saat offline

**Files:**
- Modify: `src/components/reader/reader-fonts.ts` (tulis ulang)
- Create: `src/components/reader/reader-fonts.test.ts`
- Modify: `src/components/reader/ReaderView.tsx`
- Modify: `e2e/offline.spec.ts`

**Interfaces:**
- Consumes: `FontSources`, `READER_FONTS`, dan `readerCss(settings, fonts)` dari `src/lib/reader-settings.ts` (tidak berubah).
- Produces: `loadReaderFonts(): Promise<FontSources>`. `readerFonts()` dihapus.

- [ ] **Step 1: Tulis test unit yang gagal**

`src/components/reader/reader-fonts.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The module keeps fetched fonts for the session; each test gets a fresh copy.
async function freshLoader() {
  vi.resetModules()
  return (await import("./reader-fonts")).loadReaderFonts
}

describe("loadReaderFonts", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:font")
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("hands every font file to the book as a blob: URL fetched by the page", async () => {
    const fetchMock = vi.fn(
      async () => new Response(new Blob(["font"]), { status: 200 })
    )
    vi.stubGlobal("fetch", fetchMock)
    const loadReaderFonts = await freshLoader()

    const fonts = await loadReaderFonts()
    for (const face of Object.values(fonts)) {
      expect([face.regular, face.bold, face.italic]).toEqual([
        "blob:font",
        "blob:font",
        "blob:font",
      ])
    }
    expect(fetchMock).toHaveBeenCalledTimes(9)

    await loadReaderFonts()
    expect(fetchMock).toHaveBeenCalledTimes(9)
  })

  it("falls back to absolute URLs, and tries again next time", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })
    vi.stubGlobal("fetch", fetchMock)
    const loadReaderFonts = await freshLoader()

    const fonts = await loadReaderFonts()
    expect(fonts.serif.regular).toMatch(/^http:\/\/localhost(:\d+)?\/.+\.woff2$/)
    await loadReaderFonts()
    expect(fetchMock).toHaveBeenCalledTimes(18)
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/components/reader/reader-fonts.test.ts`
Expected: FAIL, karena `loadReaderFonts` belum ada (`loadReaderFonts is not a function`).

- [ ] **Step 3: Tulis ulang `reader-fonts.ts`**

```ts
import atkinsonBold from "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2?url"
import atkinsonItalic from "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-italic.woff2?url"
import atkinsonRegular from "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2?url"
import caslonBold from "@fontsource/libre-caslon-text/files/libre-caslon-text-latin-700-normal.woff2?url"
import caslonItalic from "@fontsource/libre-caslon-text/files/libre-caslon-text-latin-400-italic.woff2?url"
import caslonRegular from "@fontsource/libre-caslon-text/files/libre-caslon-text-latin-400-normal.woff2?url"
import dyslexicBold from "@fontsource/opendyslexic/files/opendyslexic-latin-700-normal.woff2?url"
import dyslexicItalic from "@fontsource/opendyslexic/files/opendyslexic-latin-400-italic.woff2?url"
import dyslexicRegular from "@fontsource/opendyslexic/files/opendyslexic-latin-400-normal.woff2?url"
import { type FontSources, READER_FONTS } from "@/lib/reader-settings"

const FONT_FILES: FontSources = {
  serif: {
    family: "Glosa Serif",
    fallback: "Georgia, serif",
    regular: caslonRegular,
    bold: caslonBold,
    italic: caslonItalic,
  },
  sans: {
    family: "Glosa Sans",
    fallback: "system-ui, sans-serif",
    regular: atkinsonRegular,
    bold: atkinsonBold,
    italic: atkinsonItalic,
  },
  dyslexic: {
    family: "Glosa Dyslexic",
    fallback: "sans-serif",
    regular: dyslexicRegular,
    bold: dyslexicBold,
    italic: dyslexicItalic,
  },
}

type FontUrl = { url: string; fetched: boolean }

/**
 * One font file for the book's iframe. The page fetches it, so offline it comes
 * from the service worker's precache: the book's documents are blob: URLs,
 * which the service worker does not serve (spec 1D §8). A file that cannot be
 * fetched keeps an absolute URL (plan 1C, decision 11).
 */
async function fontUrl(url: string): Promise<FontUrl> {
  try {
    const response = await fetch(url)
    if (response.ok) {
      return { url: URL.createObjectURL(await response.blob()), fetched: true }
    }
  } catch {
    // Offline and not cached yet: the absolute URL below may still work later.
  }
  return { url: new URL(url, window.location.href).href, fetched: false }
}

let loaded: FontSources | null = null

/** Font files for the book's iframe, fetched once per session when all of them arrive. */
export async function loadReaderFonts(): Promise<FontSources> {
  if (loaded) return loaded
  const faces = await Promise.all(
    READER_FONTS.map(async (font) => {
      const face = FONT_FILES[font]
      const [regular, bold, italic] = await Promise.all(
        [face.regular, face.bold, face.italic].map(fontUrl)
      )
      return {
        font,
        face: {
          ...face,
          regular: regular.url,
          bold: bold.url,
          italic: italic.url,
        },
        fetched: regular.fetched && bold.fetched && italic.fetched,
      }
    })
  )
  const fonts = Object.fromEntries(
    faces.map(({ font, face }) => [font, face])
  ) as FontSources
  if (faces.every(({ fetched }) => fetched)) loaded = fonts
  return fonts
}
```

- [ ] **Step 4: Jalankan test unit dan pastikan lulus**

Run: `npx vitest run src/components/reader/reader-fonts.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Pakai font di `ReaderView.tsx`**

Ganti import dan `applySettings` di bagian atas file:

```ts
import {
  type FontSources,
  MARGIN_GAP,
  type ReaderSettings,
  THEME_COLORS,
  readerCss,
} from "@/lib/reader-settings"
import type { TocItem } from "@/lib/reader-types"
import { loadReaderFonts } from "./reader-fonts"
```

```ts
function applySettings(
  view: View,
  settings: ReaderSettings,
  fonts: FontSources
) {
  const renderer = view.renderer
  renderer.setAttribute("flow", settings.flow)
  renderer.setAttribute("gap", MARGIN_GAP[settings.margin])
  renderer.setAttribute("margin", BAR_SPACE)
  renderer.setAttribute("max-inline-size", MAX_LINE_LENGTH)
  renderer.setStyles?.(readerCss(settings, fonts))
}
```

Di `ReaderView`, tambahkan ref di samping `settingsRef`:

```ts
  const fontsRef = useRef<FontSources | null>(null)
```

Di dalam IIFE pada effect pembuka buku, mulai muat font di baris pertama blok `try`, lalu tunggu font sebelum setelan diterapkan:

```ts
    void (async () => {
      try {
        // Fetched while the book opens; never rejects (absolute URLs as fallback).
        const fontsLoading = loadReaderFonts()
        await import("foliate-js/view.js")
```

```ts
        skipLayoutWhileLoading(view.renderer)
        const fonts = await fontsLoading
        if (isCancelled()) {
          await teardown()
          return
        }
        fontsRef.current = fonts
        applySettings(view, settingsRef.current, fonts)
        viewRef.current = view
```

Ganti effect setelan di bagian bawah:

```ts
  useEffect(() => {
    const view = viewRef.current
    const fonts = fontsRef.current
    if (view && fonts) applySettings(view, settings, fonts)
  }, [settings])
```

- [ ] **Step 6: Tambahkan pemeriksaan font ke E2E offline**

Di `e2e/offline.spec.ts`, tambahkan helper ini di atas `test(...)`:

```ts
/** Whether the book's iframe has drawn its text in the reader's own serif. */
async function readerFontLoaded(page: Page): Promise<boolean> {
  for (const frame of page.frames()) {
    if (!frame.url().startsWith("blob:")) continue
    const loaded = await frame.evaluate(async () => {
      await document.fonts.ready
      return [...document.fonts].some(
        (face) =>
          face.family.replaceAll('"', "") === "Glosa Serif" &&
          face.status === "loaded"
      )
    })
    if (loaded) return true
  }
  return false
}
```

Ubah import Playwright menjadi `import { expect, test, type Page } from "@playwright/test"`. Lalu, setelah pemeriksaan heading buku dalam keadaan offline (`await expect(page.getByRole("heading", { name: SHERLOCK.title })).toBeVisible()`), tambahkan:

```ts
  // The book's blob: iframe cannot reach the service worker; the page hands
  // it the fonts (spec 1D §8).
  await expect
    .poll(() => readerFontLoaded(page), { timeout: 15_000 })
    .toBe(true)
```

- [ ] **Step 7: Verifikasi**

Run: `npm run typecheck && npm run lint && npm test`
Expected: semua hijau.

Run: `npx playwright test --project=offline`
Expected: PASS. Test ini membangun aplikasi dan menjalankan `vite preview` di port 4173, jadi butuh beberapa menit.

- [ ] **Step 8: Commit**

```bash
npx prettier --write src/components/reader/reader-fonts.ts src/components/reader/reader-fonts.test.ts src/components/reader/ReaderView.tsx e2e/offline.spec.ts
git add src/components/reader/reader-fonts.ts src/components/reader/reader-fonts.test.ts src/components/reader/ReaderView.tsx e2e/offline.spec.ts
git commit -m "fix(reader): load the reader fonts offline as blob: URLs fetched by the page"
```

---

### Task 2: Tata letak, proyeksi, batas kamera, dan tingkat kualitas (modul murni)

**Files:**
- Create: `src/components/lobby/scene/layout.ts`, `layout.test.ts`
- Create: `src/components/lobby/scene/projection.ts`, `projection.test.ts`
- Create: `src/components/lobby/scene/quality.ts`, `quality.test.ts`

**Interfaces:**
- Consumes: `GENRE_VALUES` dan `Genre` dari `@/lib/genre`.
- Produces (dipakai semua task berikutnya):
  - `layout.ts`:
    - tipe `Point2 = readonly [number, number]` (x, z di lantai) dan `Point3 = readonly [number, number, number]`;
    - konstanta `ATRIUM`, `GLASS`, `BOX`, `STAIRS`, `TOWER`, `ZONES`, `READING_TABLE`, `ADMIN_DESK`, `TROLLEY`, `READERS`, `LIBRARIAN`, `LOUNGES`, `ANDA_START`, `WALKER_ROUTES`, `SHELF_FACES`, `HOTSPOT_SPOTS`;
    - tipe `ShelfFace`, `HotspotId`, `HotspotSpot`; fungsi `spotOf(id)`.
  - `projection.ts`:
    - tipe `View = { target: Point3; zoom: number }` dan `Viewport = { width: number; height: number }`;
    - konstanta `MIN_ZOOM`, `MAX_ZOOM`, `CAMERA_OFFSET`, `SCREEN_RIGHT`, `SCREEN_UP`;
    - fungsi `baseHalfHeight(aspect)`, `halfExtents(zoom, viewport)`, `clampView(view, viewport)`, `project(point, view, viewport) → { x, y }` (persen), `startView(viewport)`, `panBy(view, right, up, viewport)`, `centerOn(view, point)`, `isInView(point, view, viewport)`.
  - `quality.ts`: tipe `Quality`, `Environment`; `MEASURE_MS`; fungsi `initialQuality(env)`, `nextQuality(current, averageFps)`, `walkerShare(quality)`, `detectEnvironment()`.

- [ ] **Step 1: Tulis `layout.ts`**

Ini data murni. Koordinatnya diambil dari prototipe.

```ts
import type { Genre } from "@/lib/genre"

/**
 * The lobby's world, in metres (spec 1D §4). X runs along the glass wall
 * (Z = 0), Z along the left shelf wall (X = 0), Y up. The camera looks from
 * +X +Z. Pure data: no three.js, so tests and the hotspot layer can use it.
 */
export type Point2 = readonly [number, number]
export type Point3 = readonly [number, number, number]

/**
 * `front`: how far the floor in front of the open room counts as part of the
 * map. `edge`: how far the screen stays from the map's edges.
 */
export const ATRIUM = { size: 34, height: 13.5, front: 6, edge: 0.25 } as const
export const GLASS = { x0: 17, x1: 34, y0: 0.4, y1: 13.1 } as const
/** The box of shelves floating above the stairs. */
export const BOX = { x0: 1.5, x1: 9.5, z0: 1.5, z1: 9.5, y0: 8.4, y1: 12.9 } as const
/** Bleacher stairs rising toward the glass wall. */
export const STAIRS = {
  x0: 1.5,
  x1: 9.5,
  z1: 10.2,
  steps: 10,
  rise: 0.46,
  run: 0.92,
} as const
export const TOWER = { width: 2.4, height: 5.4 } as const

/** One shelf tower per genre, in the order of GENRE_VALUES (spec 1D §4). */
export const ZONES: ReadonlyArray<{ genre: Genre; at: Point2 }> = [
  { genre: "fiksi_sastra", at: [13, 6.5] },
  { genre: "fantasi_petualangan", at: [6.5, 14.5] },
  { genre: "misteri_thriller", at: [13, 12.5] },
  { genre: "anak_remaja", at: [6.5, 20] },
  { genre: "sains_teknologi", at: [13, 18.5] },
  { genre: "sejarah_budaya", at: [19.5, 14] },
  { genre: "bisnis_pengembangan_diri", at: [24.5, 18] },
  { genre: "lainnya", at: [19.5, 20.5] },
]
export const READING_TABLE: Point2 = [19.5, 26]
export const ADMIN_DESK: Point2 = [5.5, 25.5]
export const TROLLEY: Point2 = [9, 26.8]
/** Readers seated at the long table, facing along +Z (0) or −Z (π). */
export const READERS: ReadonlyArray<{ at: Point2; facing: number }> = [
  { at: [18.4, 25], facing: 0 },
  { at: [21.2, 27], facing: Math.PI },
  { at: [16.6, 27], facing: Math.PI },
]
export const LIBRARIAN: Point2 = [4.9, 24.7]
/** Two lounges at the front of the atrium (spec 1D §2, decision 9). */
export const LOUNGES: ReadonlyArray<{ at: Point2; color: string }> = [
  { at: [16.5, 31], color: "#d9c2a3" },
  { at: [27.5, 30.2], color: "#9c6b5a" },
]
/** Where "Anda" stands on a first visit. */
export const ANDA_START: Point2 = [11.5, 29.5]

/** Walkers loop through these points: [x, z, seconds to pause there]. */
export const WALKER_ROUTES: ReadonlyArray<{
  points: ReadonlyArray<readonly [number, number, number]>
  speed: number
}> = [
  {
    points: [
      [16, 9.5, 2],
      [16, 23, 0],
      [23, 23, 2.5],
      [23, 9.5, 0],
    ],
    speed: 0.9,
  },
  {
    points: [
      [10, 16, 1.5],
      [16.3, 16, 0],
      [16.3, 22, 2],
      [10, 22, 0],
    ],
    speed: 0.75,
  },
  {
    points: [
      [21.5, 2.2, 3],
      [28, 2.2, 0],
      [28, 11.5, 2],
      [21.5, 11.5, 0],
    ],
    speed: 0.7,
  },
  {
    points: [
      [3, 12, 0],
      [3, 23, 2],
      [9.8, 23, 0],
      [9.8, 12.5, 1.5],
    ],
    speed: 0.8,
  },
  {
    points: [
      [26.5, 15, 0],
      [26.5, 28, 2.5],
      [21.5, 28.2, 0],
      [21.5, 33, 2],
      [12, 33, 0],
      [12, 23.5, 1],
      [26.5, 23.2, 0],
    ],
    speed: 0.85,
  },
]

/**
 * A wall of glowing cubbies. `origin` is its bottom-left corner on the wall,
 * `along` the horizontal direction along it, `into` the direction into the room.
 */
export type ShelfFace = {
  origin: Point3
  along: Point3
  into: Point3
  width: number
  height: number
  glow: number
}

const PLUS_X: Point3 = [1, 0, 0]
const PLUS_Z: Point3 = [0, 0, 1]
const MINUS_Z: Point3 = [0, 0, -1]

export const SHELF_FACES: ReadonlyArray<ShelfFace> = [
  // Left wall (X = 0): cubbies the whole way.
  {
    origin: [0, 0, ATRIUM.size],
    along: MINUS_Z,
    into: PLUS_X,
    width: ATRIUM.size,
    height: ATRIUM.height,
    glow: 0.8,
  },
  // Right wall (Z = 0): cubbies up to the glass curtain wall.
  {
    origin: [0, 0, 0],
    along: PLUS_X,
    into: PLUS_Z,
    width: GLASS.x0 - 0.4,
    height: ATRIUM.height,
    glow: 0.8,
  },
  // The two visible sides of the floating box.
  {
    origin: [BOX.x1, BOX.y0, BOX.z1],
    along: MINUS_Z,
    into: PLUS_X,
    width: BOX.z1 - BOX.z0,
    height: BOX.y1 - BOX.y0,
    glow: 0.9,
  },
  {
    origin: [BOX.x0, BOX.y0, BOX.z1],
    along: PLUS_X,
    into: PLUS_Z,
    width: BOX.x1 - BOX.x0,
    height: BOX.y1 - BOX.y0,
    glow: 0.9,
  },
  // The two visible sides of every tower.
  ...ZONES.flatMap(({ at: [x, z] }): Array<ShelfFace> => {
    const half = TOWER.width / 2
    const height = TOWER.height - 0.2
    return [
      {
        origin: [x + half, 0.1, z + half],
        along: MINUS_Z,
        into: PLUS_X,
        width: TOWER.width,
        height,
        glow: 0.9,
      },
      {
        origin: [x - half, 0.1, z + half],
        along: PLUS_X,
        into: PLUS_Z,
        width: TOWER.width,
        height,
        glow: 0.9,
      },
    ]
  }),
]

export type HotspotId = Genre | "meja-baca" | "meja-admin" | "troli"
/** `label`: where the hotspot's label floats. `stand`: where "Anda" walks to. */
export type HotspotSpot = { id: HotspotId; label: Point3; stand: Point2 }

/** In tab order (spec 1D §6): reading table, zones, trolley, admin desk. */
export const HOTSPOT_SPOTS: ReadonlyArray<HotspotSpot> = [
  { id: "meja-baca", label: [19.5, 2.2, 26], stand: [19.5, 28.2] },
  ...ZONES.map(
    ({ genre, at: [x, z] }): HotspotSpot => ({
      id: genre,
      label: [x, TOWER.height + 0.7, z],
      stand: [x + 1.9, z + 1.9],
    })
  ),
  { id: "troli", label: [9, 1.9, 26.8], stand: [10.5, 28.3] },
  { id: "meja-admin", label: [5.5, 2.8, 25.5], stand: [7.5, 27.8] },
]

export function spotOf(id: HotspotId): HotspotSpot {
  const spot = HOTSPOT_SPOTS.find((candidate) => candidate.id === id)
  if (!spot) throw new Error(`No hotspot ${id}`)
  return spot
}
```

- [ ] **Step 2: Tulis test layout**

`src/components/lobby/scene/layout.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { GENRE_VALUES } from "@/lib/genre"
import {
  ATRIUM,
  HOTSPOT_SPOTS,
  TOWER,
  WALKER_ROUTES,
  ZONES,
  type Point2,
} from "./layout"

/** Distance from a floor point to the nearest tower's footprint. */
function towerClearance([x, z]: Point2): number {
  return Math.min(
    ...ZONES.map(({ at: [cx, cz] }) =>
      Math.hypot(
        Math.max(Math.abs(x - cx) - TOWER.width / 2, 0),
        Math.max(Math.abs(z - cz) - TOWER.width / 2, 0)
      )
    )
  )
}

const onFloor = ([x, z]: Point2) =>
  x >= 0 && x <= ATRIUM.size && z >= 0 && z <= ATRIUM.size

describe("lobby layout", () => {
  it("gives every genre exactly one zone", () => {
    expect(ZONES.map(({ genre }) => genre)).toEqual([...GENRE_VALUES])
  })

  it("lists unique hotspots in tab order", () => {
    expect(HOTSPOT_SPOTS.map(({ id }) => id)).toEqual([
      "meja-baca",
      ...GENRE_VALUES,
      "troli",
      "meja-admin",
    ])
  })

  it("lets 'Anda' stand on the floor, clear of the towers", () => {
    for (const { id, stand } of HOTSPOT_SPOTS) {
      expect(onFloor(stand), id).toBe(true)
      expect(towerClearance(stand), id).toBeGreaterThan(0.25)
    }
  })

  it("keeps walkers on the floor and out of the towers", () => {
    for (const [index, { points }] of WALKER_ROUTES.entries()) {
      points.forEach(([x, z], i) => {
        const [nx, nz] = points[(i + 1) % points.length]
        for (let t = 0; t <= 1; t += 0.01) {
          const at: Point2 = [x + (nx - x) * t, z + (nz - z) * t]
          expect(onFloor(at), `route ${index}`).toBe(true)
          expect(towerClearance(at), `route ${index}`).toBeGreaterThanOrEqual(
            0.25
          )
        }
      })
    }
  })
})
```

- [ ] **Step 3: Jalankan test layout**

Run: `npx vitest run src/components/lobby/scene/layout.test.ts`
Expected: PASS (4 test). Jarak terdekat jalur ke menara adalah 0,30 m (jalur pertama di x = 23).

- [ ] **Step 4: Tulis test proyeksi yang gagal**

`src/components/lobby/scene/projection.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { ATRIUM, type Point3 } from "./layout"
import {
  MAX_ZOOM,
  MIN_ZOOM,
  SCREEN_RIGHT,
  SCREEN_UP,
  type View,
  type Viewport,
  centerOn,
  clampView,
  halfExtents,
  project,
  startView,
} from "./projection"

const R2 = Math.SQRT2
const R3 = Math.sqrt(3)
const R6 = Math.sqrt(6)
const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const along = (from: Point3, direction: Point3, distance: number): Point3 => [
  from[0] + direction[0] * distance,
  from[1] + direction[1] * distance,
  from[2] + direction[2] * distance,
]

/**
 * The map on screen, shrunk by the safety edge (u right, v up, in metres):
 * the wall ends bound it sideways; the tops of the two back walls meet in a
 * peak above; the front corners of the floor (with the floor in front of the
 * room) meet in a point below. Both slopes are 1/√3 in an isometric view.
 */
function insideMap(u: number, v: number): boolean {
  const { size, height, front, edge } = ATRIUM
  const slack = 1e-9
  return (
    Math.abs(u) <= (size - edge) / R2 + slack &&
    v <= (2 * (height - edge)) / R6 - Math.abs(u) / R3 + slack &&
    v >= (-2 * (size + front - edge)) / R6 + Math.abs(u) / R3 - slack
  )
}

function screenCorners(view: View, viewport: Viewport) {
  const { halfWidth, halfHeight } = halfExtents(view.zoom, viewport)
  const u = dot(SCREEN_RIGHT, view.target)
  const v = dot(SCREEN_UP, view.target)
  return [
    [u - halfWidth, v - halfHeight],
    [u + halfWidth, v - halfHeight],
    [u - halfWidth, v + halfHeight],
    [u + halfWidth, v + halfHeight],
  ] as const
}

/** Deterministic random numbers, so a failure replays. */
function random(seed: number) {
  let state = seed
  return () => (state = (state * 16807) % 2147483647) / 2147483647
}

/** Views anywhere around the atrium, at any zoom, on screens from 9:20 to 21:9. */
function* randomViews(count: number) {
  const next = random(42)
  for (let i = 0; i < count; i++) {
    const aspect = 9 / 20 + next() * (21 / 9 - 9 / 20)
    const viewport: Viewport = { width: 1000 * aspect, height: 1000 }
    const view: View = {
      target: [next() * 80 - 20, next() * 30 - 10, next() * 80 - 20],
      zoom: 0.5 + next() * 3,
    }
    yield { i, view, viewport }
  }
}

describe("project", () => {
  const viewport: Viewport = { width: 1600, height: 900 }
  const view: View = { target: [14, 4, 14], zoom: 1 }

  it("puts the target in the middle of the screen", () => {
    expect(project(view.target, view, viewport)).toEqual({ x: 50, y: 50 })
  })

  it("puts the screen's edges at 0 and 100 percent, also zoomed in", () => {
    for (const zoom of [1, 2]) {
      const zoomed = { ...view, zoom }
      const { halfWidth, halfHeight } = halfExtents(zoom, viewport)
      const right = project(
        along(view.target, SCREEN_RIGHT, halfWidth),
        zoomed,
        viewport
      )
      const top = project(
        along(view.target, SCREEN_UP, halfHeight),
        zoomed,
        viewport
      )
      expect(right.x).toBeCloseTo(100)
      expect(right.y).toBeCloseTo(50)
      expect(top.x).toBeCloseTo(50)
      expect(top.y).toBeCloseTo(0)
    }
  })

  it("shows points on the camera's axis at the same spot", () => {
    const behind = project([24, 14, 24], view, viewport)
    expect(behind.x).toBeCloseTo(50)
    expect(behind.y).toBeCloseTo(50)
  })
})

describe("clampView", () => {
  it("keeps every corner of the screen inside the map", () => {
    for (const { i, view, viewport } of randomViews(5000)) {
      const clamped = clampView(view, viewport)
      expect(clamped.zoom).toBeGreaterThanOrEqual(MIN_ZOOM)
      expect(clamped.zoom).toBeLessThanOrEqual(MAX_ZOOM)
      for (const [u, v] of screenCorners(clamped, viewport)) {
        expect(insideMap(u, v), `view ${i}`).toBe(true)
      }
    }
  })

  it("leaves a view that already fits as it is", () => {
    for (const { i, view, viewport } of randomViews(2000)) {
      const once = clampView(view, viewport)
      const twice = clampView(once, viewport)
      expect(twice.zoom).toBe(once.zoom)
      for (let k = 0; k < 3; k++) {
        expect(twice.target[k], `view ${i}`).toBeCloseTo(once.target[k], 9)
      }
    }
  })
})

describe("startView", () => {
  it("opens wide screens on the whole atrium and tall ones closer in", () => {
    const wide = { width: 1600, height: 900 }
    const tall = { width: 390, height: 780 }
    expect(startView(wide).zoom).toBe(1)
    expect(startView(tall).zoom).toBe(1.6)
    for (const viewport of [wide, tall]) {
      const view = startView(viewport)
      const again = clampView(view, viewport)
      for (let k = 0; k < 3; k++) {
        expect(again.target[k]).toBeCloseTo(view.target[k], 9)
      }
    }
  })
})

describe("centerOn", () => {
  it("brings a point to the middle of the screen", () => {
    const viewport = { width: 1200, height: 800 }
    const point: Point3 = [19.5, 2.2, 26]
    const centred = centerOn({ target: [14, 4, 14], zoom: 2 }, point)
    const at = project(point, centred, viewport)
    expect(at.x).toBeCloseTo(50)
    expect(at.y).toBeCloseTo(50)
  })
})
```

- [ ] **Step 5: Jalankan test proyeksi dan pastikan gagal**

Run: `npx vitest run src/components/lobby/scene/projection.test.ts`
Expected: FAIL, karena `./projection` belum ada.

- [ ] **Step 6: Tulis `projection.ts`**

```ts
import { ATRIUM, type Point3 } from "./layout"

/** What the camera looks at (any point on its axis) and how far it zooms in. */
export type View = { target: Point3; zoom: number }
/** The scene's size on screen, in CSS pixels. */
export type Viewport = { width: number; height: number }

export const MIN_ZOOM = 1
export const MAX_ZOOM = 2.6
/** The camera sits at target + CAMERA_OFFSET, looking back along it: isometric. */
export const CAMERA_OFFSET: Point3 = [40, 40, 40]

const R2 = Math.SQRT2
const R3 = Math.sqrt(3)
const R6 = Math.sqrt(6)
/** The world directions of screen-right and screen-up for that camera. */
export const SCREEN_RIGHT: Point3 = [1 / R2, 0, -1 / R2]
export const SCREEN_UP: Point3 = [-1 / R6, 2 / R6, -1 / R6]

const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))
const minus = (a: Point3, b: Point3): Point3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
]

/** Moves a point along the screen: `right` metres right, `up` metres up. */
function slide(point: Point3, right: number, up: number): Point3 {
  return [
    point[0] + SCREEN_RIGHT[0] * right + SCREEN_UP[0] * up,
    point[1] + SCREEN_RIGHT[1] * right + SCREEN_UP[1] * up,
    point[2] + SCREEN_RIGHT[2] * right + SCREEN_UP[2] * up,
  ]
}

const { size: SIZE, height: HEIGHT, front: FRONT, edge: EDGE } = ATRIUM
/** The floor counts as map up to FRONT metres in front of the room. */
const FLOOR = SIZE + FRONT
/** Half the map's height on screen, from the wall tops' peak to the floor's front point. */
const FIT_V = (HEIGHT + FLOOR - 2 * EDGE) / R6

/** Half the view's height in metres at zoom 1: the widest view that fits the map. */
export function baseHalfHeight(aspect: number): number {
  return (
    Math.min(FIT_V / (1 + aspect / R3), (SIZE - EDGE) / R2 / aspect) * 0.96
  )
}

/** Half the view's width and height in metres. */
export function halfExtents(
  zoom: number,
  viewport: Viewport
): { halfWidth: number; halfHeight: number } {
  const aspect = viewport.width / viewport.height
  const halfHeight = baseHalfHeight(aspect) / zoom
  return { halfWidth: halfHeight * aspect, halfHeight }
}

/**
 * Keeps the whole screen inside the map (spec 1D §3.1). On screen the atrium
 * is a hexagon: the tops of the two back walls above, the wall ends at the
 * sides, the floor's front corners below. u/v are screen-right/screen-up
 * distances in metres.
 */
export function clampView(view: View, viewport: Viewport): View {
  const zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM)
  const { halfWidth, halfHeight } = halfExtents(zoom, viewport)
  const u0 = dot(SCREEN_RIGHT, view.target)
  const v0 = dot(SCREEN_UP, view.target)
  // Sideways, the view stops at the wall ends, and also where the space
  // between the wall tops and the floor's edge is no longer as tall as the
  // screen; past that point the top and the bottom would both show the void.
  const umax = Math.max(
    0,
    Math.min(
      (SIZE - EDGE) / R2 - halfWidth,
      R3 * (FIT_V - halfHeight) - halfWidth
    )
  )
  const u = clamp(u0, -umax, umax)
  const slope = (Math.abs(u) + halfWidth) / R3
  const vmax = (2 * (HEIGHT - EDGE)) / R6 - slope - halfHeight
  const vmin = (-2 * (FLOOR - EDGE)) / R6 + slope + halfHeight
  const v = vmin > vmax ? (vmin + vmax) / 2 : clamp(v0, vmin, vmax)
  return { target: slide(view.target, u - u0, v - v0), zoom }
}

/** Where a world point appears, in percent of the viewport from its top left. */
export function project(
  point: Point3,
  view: View,
  viewport: Viewport
): { x: number; y: number } {
  const { halfWidth, halfHeight } = halfExtents(view.zoom, viewport)
  const relative = minus(point, view.target)
  return {
    x: 50 + (50 * dot(SCREEN_RIGHT, relative)) / halfWidth,
    y: 50 - (50 * dot(SCREEN_UP, relative)) / halfHeight,
  }
}

/** The first view: the whole atrium on wide screens, the reading table on tall ones. */
export function startView(viewport: Viewport): View {
  const tall = viewport.width < viewport.height
  return clampView(
    tall ? { target: [17, 3, 19], zoom: 1.6 } : { target: [14, 4, 14], zoom: 1 },
    viewport
  )
}

/** The view moved by a share of the screen (arrow keys). Not clamped yet. */
export function panBy(
  view: View,
  right: number,
  up: number,
  viewport: Viewport
): View {
  const { halfWidth, halfHeight } = halfExtents(view.zoom, viewport)
  return {
    target: slide(view.target, right * 2 * halfWidth, up * 2 * halfHeight),
    zoom: view.zoom,
  }
}

/** The view with a point in the middle of the screen. Not clamped yet. */
export function centerOn(view: View, point: Point3): View {
  const relative = minus(point, view.target)
  return {
    target: slide(
      view.target,
      dot(SCREEN_RIGHT, relative),
      dot(SCREEN_UP, relative)
    ),
    zoom: view.zoom,
  }
}

/** Whether a point shows well inside the screen, clear of its edges. */
export function isInView(
  point: Point3,
  view: View,
  viewport: Viewport
): boolean {
  const { x, y } = project(point, view, viewport)
  return x >= 8 && x <= 92 && y >= 12 && y <= 92
}
```

- [ ] **Step 7: Jalankan test proyeksi dan pastikan lulus**

Run: `npx vitest run src/components/lobby/scene/projection.test.ts`
Expected: PASS (7 test).

- [ ] **Step 8: Tulis test kualitas yang gagal**

`src/components/lobby/scene/quality.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  type Environment,
  initialQuality,
  nextQuality,
  walkerShare,
} from "./quality"

const desktop: Environment = {
  reducedMotion: false,
  webgl: true,
  coarsePointer: false,
  deviceMemory: 8,
}

describe("initialQuality", () => {
  it("starts desktops high", () => {
    expect(initialQuality(desktop)).toBe("tinggi")
    expect(initialQuality({ ...desktop, deviceMemory: undefined })).toBe(
      "tinggi"
    )
  })

  it("starts phones and small devices low", () => {
    expect(initialQuality({ ...desktop, coarsePointer: true })).toBe("rendah")
    expect(initialQuality({ ...desktop, deviceMemory: 4 })).toBe("rendah")
  })

  it("keeps the scene still with reduced motion or without WebGL", () => {
    expect(initialQuality({ ...desktop, reducedMotion: true })).toBe("diam")
    expect(initialQuality({ ...desktop, webgl: false })).toBe("diam")
  })
})

describe("nextQuality", () => {
  it("steps down when the frame rate is too low", () => {
    expect(nextQuality("tinggi", 39)).toBe("rendah")
    expect(nextQuality("tinggi", 40)).toBe("tinggi")
    expect(nextQuality("rendah", 19)).toBe("diam")
    expect(nextQuality("rendah", 20)).toBe("rendah")
    expect(nextQuality("diam", 5)).toBe("diam")
  })
})

describe("walkerShare", () => {
  it("shows half the walkers on the low tier", () => {
    expect(walkerShare("tinggi")).toBe(1)
    expect(walkerShare("rendah")).toBe(0.5)
    expect(walkerShare("diam")).toBe(1)
  })
})
```

- [ ] **Step 9: Jalankan test kualitas dan pastikan gagal**

Run: `npx vitest run src/components/lobby/scene/quality.test.ts`
Expected: FAIL, karena `./quality` belum ada.

- [ ] **Step 10: Tulis `quality.ts`**

```ts
/** How the lobby is drawn (spec 1D §3.1). The values appear as data-quality. */
export type Quality = "tinggi" | "rendah" | "diam"

export type Environment = {
  reducedMotion: boolean
  webgl: boolean
  coarsePointer: boolean
  /** GiB, from navigator.deviceMemory (Chromium only). */
  deviceMemory: number | undefined
}

/** How long each animated tier is measured before it may step down. */
export const MEASURE_MS = 3000

export function initialQuality(environment: Environment): Quality {
  if (environment.reducedMotion || !environment.webgl) return "diam"
  if (
    environment.coarsePointer ||
    (environment.deviceMemory !== undefined && environment.deviceMemory <= 4)
  ) {
    return "rendah"
  }
  return "tinggi"
}

/** The tier to continue with after MEASURE_MS at `current`. */
export function nextQuality(current: Quality, averageFps: number): Quality {
  if (current === "tinggi" && averageFps < 40) return "rendah"
  if (current === "rendah" && averageFps < 20) return "diam"
  return current
}

/** The share of walkers shown. */
export function walkerShare(quality: Quality): number {
  return quality === "rendah" ? 0.5 : 1
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas")
    return (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) !== null
  } catch {
    return false
  }
}

export function detectEnvironment(): Environment {
  const memory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory
  return {
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
    webgl: webglAvailable(),
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    deviceMemory: memory,
  }
}
```

- [ ] **Step 11: Jalankan test kualitas dan pastikan lulus**

Run: `npx vitest run src/components/lobby/scene/quality.test.ts`
Expected: PASS (5 test).

- [ ] **Step 12: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: semua hijau.

```bash
npx prettier --write src/components/lobby/scene
git add src/components/lobby/scene
git commit -m "feat(lobby): lobby layout, isometric projection, camera bounds and quality tiers"
```

---

### Task 3: Three.js dan modul adegan statis (ruangan, rak, kaca, perabot)

**Files:**
- Modify: `package.json`, `package-lock.json` (dependensi)
- Create: `src/components/lobby/scene/kit.ts`
- Create: `src/components/lobby/scene/shelves.ts`, `shelves.test.ts`
- Create: `src/components/lobby/scene/room.ts`
- Create: `src/components/lobby/scene/skyline.ts`
- Create: `src/components/lobby/scene/furniture.ts`

**Interfaces:**
- Consumes: semua konstanta `layout.ts` dari Task 2.
- Produces:
  - `kit.ts`: tipe `Kit = { scene, rand, pick, mat, mesh, block, canvasTexture, glow }` dan `createKit(scene, seed?)`.
  - `shelves.ts`: `BOOK_COLORS`, tipe `Instance`, `shelfFaceInstances(face, rand)` (murni), dan `buildShelves(kit, faces): number` (jumlah buku).
  - `room.ts`: `buildRoom(kit): { stairSeats: Array<Point3> }`.
  - `skyline.ts`: tipe `Skyline = { clouds, birds, beacons }` dan `buildSkyline(kit)`.
  - `furniture.ts`: tipe `Seat = { at: Point2; facing: number }`, tipe `Furnishings = { pagePivots, arts, loungeSeats }`, dan `buildFurniture(kit)`.

Modul ini hanya membangun mesh. Belum ada yang merendernya; tampilannya diperiksa di Task 5.

- [ ] **Step 1: Pasang three.js**

```bash
npm install --save-exact three@0.160.1
npm install --save-exact --save-dev @types/three@0.160.0
```

Expected: `package.json` memuat `"three": "0.160.1"` di `dependencies` dan `"@types/three": "0.160.0"` di `devDependencies`.

- [ ] **Step 2: Tulis `kit.ts`**

```ts
import * as THREE from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"

export type MeshOptions = {
  cast?: boolean
  receive?: boolean
  parent?: THREE.Object3D
}
export type BlockOptions = MeshOptions & { r?: number }
type Paint = THREE.Material | string

/** Shared helpers for building the lobby, with one seeded random sequence. */
export type Kit = {
  scene: THREE.Scene
  rand: () => number
  pick: <T>(list: ReadonlyArray<T>) => T
  /** One MeshStandardMaterial per colour and options, shared. */
  mat: (
    color: string,
    extra?: THREE.MeshStandardMaterialParameters
  ) => THREE.MeshStandardMaterial
  mesh: (
    geometry: THREE.BufferGeometry,
    paint: Paint,
    x: number,
    y: number,
    z: number,
    options?: MeshOptions
  ) => THREE.Mesh
  /** A rounded box standing on y. */
  block: (
    width: number,
    height: number,
    depth: number,
    paint: Paint,
    x: number,
    y: number,
    z: number,
    options?: BlockOptions
  ) => THREE.Mesh
  canvasTexture: (
    width: number,
    height: number,
    draw: (g: CanvasRenderingContext2D, width: number, height: number) => void,
    repeat?: readonly [number, number]
  ) => THREE.CanvasTexture
  /** The warm glow behind every cubby. */
  glow: THREE.CanvasTexture
}

export function createKit(scene: THREE.Scene, seed = 7): Kit {
  let state = seed
  const rand = () =>
    ((state = (state * 16807) % 2147483647) - 1) / 2147483646
  const pick = <T>(list: ReadonlyArray<T>): T =>
    list[Math.floor(rand() * list.length)]

  const materials = new Map<string, THREE.MeshStandardMaterial>()
  const mat = (
    color: string,
    extra: THREE.MeshStandardMaterialParameters = {}
  ) => {
    const key = color + JSON.stringify(extra)
    let material = materials.get(key)
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.75,
        ...extra,
      })
      materials.set(key, material)
    }
    return material
  }

  const mesh = (
    geometry: THREE.BufferGeometry,
    paint: Paint,
    x: number,
    y: number,
    z: number,
    options: MeshOptions = {}
  ) => {
    const object = new THREE.Mesh(
      geometry,
      typeof paint === "string" ? mat(paint) : paint
    )
    object.position.set(x, y, z)
    object.castShadow = options.cast ?? true
    object.receiveShadow = options.receive ?? true
    const parent = options.parent ?? scene
    parent.add(object)
    return object
  }

  const block = (
    width: number,
    height: number,
    depth: number,
    paint: Paint,
    x: number,
    y: number,
    z: number,
    options: BlockOptions = {}
  ) => {
    const radius = Math.min(
      options.r ?? 0.04,
      width / 2.01,
      height / 2.01,
      depth / 2.01
    )
    return mesh(
      new RoundedBoxGeometry(width, height, depth, 2, radius),
      paint,
      x,
      y + height / 2,
      z,
      options
    )
  }

  const canvasTexture = (
    width: number,
    height: number,
    draw: (g: CanvasRenderingContext2D, width: number, height: number) => void,
    repeat?: readonly [number, number]
  ) => {
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const g = canvas.getContext("2d")
    if (g) draw(g, width, height)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    if (repeat) {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(repeat[0], repeat[1])
    }
    return texture
  }

  const glow = canvasTexture(128, 128, (g) => {
    const gradient = g.createRadialGradient(64, 54, 6, 64, 64, 84)
    gradient.addColorStop(0, "#ffe2a8")
    gradient.addColorStop(0.5, "#e8913f")
    gradient.addColorStop(1, "#3a1e0c")
    g.fillStyle = gradient
    g.fillRect(0, 0, 128, 128)
  })

  return { scene, rand, pick, mat, mesh, block, canvasTexture, glow }
}
```

- [ ] **Step 3: Tulis test rak yang gagal**

`src/components/lobby/scene/shelves.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { ATRIUM, SHELF_FACES } from "./layout"
import { shelfFaceInstances } from "./shelves"

function random(seed = 7) {
  let state = seed
  return () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646
}

describe("shelfFaceInstances", () => {
  it("fills every wall with at most 12,000 books in all (spec 1D §10)", () => {
    const next = random()
    const books = SHELF_FACES.reduce(
      (sum, face) => sum + shelfFaceInstances(face, next).books.length,
      0
    )
    expect(books).toBeGreaterThan(6000)
    expect(books).toBeLessThanOrEqual(12000)
  })

  it("keeps the books of the left wall inside it", () => {
    const wall = SHELF_FACES[0]
    for (const book of shelfFaceInstances(wall, random()).books) {
      expect(book.position[0]).toBeCloseTo(0.19)
      expect(book.position[2]).toBeGreaterThanOrEqual(0)
      expect(book.position[2]).toBeLessThanOrEqual(ATRIUM.size)
      expect(book.position[1] + book.scale[1] / 2).toBeLessThanOrEqual(
        wall.height
      )
    }
  })
})
```

- [ ] **Step 4: Jalankan test dan pastikan gagal**

Run: `npx vitest run src/components/lobby/scene/shelves.test.ts`
Expected: FAIL, karena `./shelves` belum ada.

- [ ] **Step 5: Tulis `shelves.ts`**

```ts
import * as THREE from "three"
import type { Kit } from "./kit"
import type { Point3, ShelfFace } from "./layout"

const CELL_WIDTH = 0.9
const CELL_HEIGHT = 0.72
const DEPTH = 0.42

export const BOOK_COLORS = [
  "#f4efe6",
  "#e9e2d4",
  "#d9cdb8",
  "#3d5a80",
  "#98c1d9",
  "#ee6c4d",
  "#f4a6a0",
  "#7a9e7e",
  "#2f3e46",
  "#c9a35b",
  "#b56576",
  "#ffffff",
] as const

/** One box of an InstancedMesh: centre, size, and turn around the vertical axis. */
export type Instance = {
  position: Point3
  scale: Point3
  rotation: number
  color: string | null
}

const gridOf = (face: ShelfFace) => ({
  cols: Math.round(face.width / CELL_WIDTH),
  rows: Math.round(face.height / CELL_HEIGHT),
})

/** The books and divider boards of one wall of cubbies. Pure: no WebGL. */
export function shelfFaceInstances(
  face: ShelfFace,
  rand: () => number
): { books: Array<Instance>; dividers: Array<Instance> } {
  const { cols, rows } = gridOf(face)
  const cellWidth = face.width / cols
  const cellHeight = face.height / rows
  const [ox, oy, oz] = face.origin
  const [ax, , az] = face.along
  const [nx, , nz] = face.into
  // a: along the wall, b: up, c: into the room.
  const at = (a: number, b: number, c: number): Point3 => [
    ox + ax * a + nx * c,
    oy + b,
    oz + az * a + nz * c,
  ]
  const rotation = Math.atan2(ax, az) - Math.PI / 2

  const dividers: Array<Instance> = []
  for (let c = 0; c <= cols; c++) {
    dividers.push({
      position: at(c * cellWidth, face.height / 2, DEPTH / 2),
      scale: [0.05, face.height, DEPTH],
      rotation,
      color: null,
    })
  }
  for (let r = 0; r <= rows; r++) {
    dividers.push({
      position: at(face.width / 2, r * cellHeight, DEPTH / 2),
      scale: [face.width, 0.05, DEPTH],
      rotation,
      color: null,
    })
  }

  const books: Array<Instance> = []
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (rand() < 0.08) continue
      let a = c * cellWidth + 0.06
      // Some cubbies leave room for a leaning book.
      const end = (c + 1) * cellWidth - (rand() < 0.2 ? 0.25 : 0.08)
      while (a < end) {
        const width = 0.045 + rand() * 0.05
        const height = cellHeight * (0.5 + rand() * 0.32)
        books.push({
          position: at(a + width / 2, r * cellHeight + 0.025 + height / 2, 0.19),
          scale: [width, height, 0.26],
          rotation,
          color: BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)],
        })
        a += width + 0.004
      }
    }
  }
  return { books, dividers }
}

/** The glowing back of a wall of cubbies. */
function backPanel(kit: Kit, face: ShelfFace) {
  const { cols, rows } = gridOf(face)
  const texture = kit.glow.clone()
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(cols, rows)
  texture.needsUpdate = true
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(face.width, face.height),
    new THREE.MeshStandardMaterial({
      color: "#6b4426",
      emissive: "#ffffff",
      emissiveMap: texture,
      emissiveIntensity: face.glow,
      roughness: 0.9,
    })
  )
  const [ox, oy, oz] = face.origin
  const [ax, , az] = face.along
  const [nx, , nz] = face.into
  panel.position.set(
    ox + (ax * face.width) / 2 + nx * 0.01,
    oy + face.height / 2,
    oz + (az * face.width) / 2 + nz * 0.01
  )
  panel.lookAt(panel.position.x + nx, panel.position.y, panel.position.z + nz)
  panel.receiveShadow = true
  kit.scene.add(panel)
}

function addInstances(
  scene: THREE.Scene,
  list: ReadonlyArray<Instance>,
  material: THREE.Material
) {
  const instanced = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    material,
    list.length
  )
  const matrix = new THREE.Matrix4()
  const turn = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const color = new THREE.Color()
  list.forEach((item, i) => {
    turn.setFromAxisAngle(up, item.rotation)
    matrix.compose(
      position.set(...item.position),
      turn,
      scale.set(...item.scale)
    )
    instanced.setMatrixAt(i, matrix)
    if (item.color) instanced.setColorAt(i, color.set(item.color))
  })
  instanced.castShadow = false
  instanced.receiveShadow = true
  scene.add(instanced)
}

/**
 * Every wall of cubbies: a glowing back panel each, then all books and all
 * dividers as two InstancedMeshes. Returns how many books there are.
 */
export function buildShelves(
  kit: Kit,
  faces: ReadonlyArray<ShelfFace>
): number {
  const books: Array<Instance> = []
  const dividers: Array<Instance> = []
  for (const face of faces) {
    backPanel(kit, face)
    const parts = shelfFaceInstances(face, kit.rand)
    for (const book of parts.books) books.push(book)
    for (const divider of parts.dividers) dividers.push(divider)
  }
  addInstances(
    kit.scene,
    books,
    new THREE.MeshStandardMaterial({ roughness: 0.65 })
  )
  addInstances(kit.scene, dividers, kit.mat("#a8703f", { roughness: 0.55 }))
  return books.length
}
```

- [ ] **Step 6: Jalankan test rak dan pastikan lulus**

Run: `npx vitest run src/components/lobby/scene/shelves.test.ts`
Expected: PASS (2 test). Perkiraan jumlah buku sekitar 10.000.

- [ ] **Step 7: Tulis `room.ts`**

```ts
import * as THREE from "three"
import type { Kit } from "./kit"
import { ATRIUM, BOX, GLASS, type Point3, STAIRS } from "./layout"
import { BOOK_COLORS } from "./shelves"

const { size: SIZE, height: HEIGHT } = ATRIUM
const WHITE = "#ddd6cb"

/** Polished wood; it runs on past the open front, so the screen is always full. */
function floor(kit: Kit) {
  const texture = kit.canvasTexture(
    1024,
    1024,
    (g) => {
      for (let i = 0; i < 16; i++) {
        for (let j = 0; j < 5; j++) {
          const tone = 112 + Math.floor(kit.rand() * 22)
          const x = j * 256 + (i % 2) * 128 - 128
          g.fillStyle = `rgb(${tone + 34},${tone - 8},${tone - 52})`
          g.fillRect(x, i * 64, 256, 64)
          g.fillStyle = "rgba(40,20,8,.35)"
          g.fillRect(x, i * 64, 2, 64)
        }
        g.fillStyle = "rgba(40,20,8,.4)"
        g.fillRect(0, i * 64 + 62, 1024, 2)
      }
    },
    [6, 6]
  )
  kit.mesh(
    new THREE.BoxGeometry(SIZE * 2, 0.2, SIZE * 2),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.32,
      metalness: 0.05,
    }),
    SIZE,
    -0.1,
    SIZE,
    { cast: false }
  )
}

/** The shells behind the shelf walls and beside the glass. */
function walls(kit: Kit) {
  kit.block(0.4, HEIGHT, SIZE, "#3a2516", -0.2, 0, SIZE / 2, { r: 0.02 })
  kit.block(GLASS.x0, HEIGHT, 0.4, "#3a2516", GLASS.x0 / 2, 0, -0.2, {
    r: 0.02,
  })
}

function balcony(
  kit: Kit,
  [x0, x1, z0, z1]: readonly [number, number, number, number],
  y: number,
  rail: THREE.Material,
  strip: THREE.Material
) {
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  kit.block(x1 - x0, 0.42, z1 - z0, WHITE, cx, y - 0.42, cz, { r: 0.1 })
  kit.block(x1 - x0, 0.06, z1 - z0, "#b07b4a", cx, y, cz, {
    r: 0.02,
    cast: false,
  })
  // A warm strip of light under each open edge, and a glass railing above it.
  if (z1 < SIZE) {
    kit.block(x1 - x0 - 0.2, 0.05, 0.05, strip, cx, y - 0.45, z1 - 0.06, {
      cast: false,
    })
    kit.mesh(
      new THREE.BoxGeometry(x1 - x0, 1, 0.03),
      rail,
      cx,
      y + 0.5,
      z1 - 0.05,
      { cast: false }
    )
  }
  if (x1 < SIZE) {
    kit.block(0.05, 0.05, z1 - z0 - 0.2, strip, x1 - 0.06, y - 0.45, cz, {
      cast: false,
    })
    kit.mesh(
      new THREE.BoxGeometry(0.03, 1, z1 - z0),
      rail,
      x1 - 0.05,
      y + 0.5,
      cz,
      { cast: false }
    )
  }
}

function balconies(kit: Kit) {
  const rail = new THREE.MeshStandardMaterial({
    color: "#d7f0ff",
    transparent: true,
    opacity: 0.18,
    roughness: 0.1,
    depthWrite: false,
  })
  const strip = new THREE.MeshBasicMaterial({ color: "#ffd9a0" })
  for (const y of [4.6, 9.2]) {
    balcony(kit, [0, 3.2, 10, SIZE], y, rail, strip)
    balcony(kit, [10.5, GLASS.x0 - 0.4, 0, 3.2], y, rail, strip)
  }
}

/** The floating box's body; its cubbies are shelf faces (layout.ts). */
function floatingBox(kit: Kit) {
  const width = BOX.x1 - BOX.x0
  const depth = BOX.z1 - BOX.z0
  const cx = (BOX.x0 + BOX.x1) / 2
  const cz = (BOX.z0 + BOX.z1) / 2
  kit.block(width, BOX.y1 - BOX.y0, depth, "#8a5a33", cx, BOX.y0, cz, {
    r: 0.05,
  })
  kit.block(width + 0.3, 0.3, depth + 0.3, "#c9945f", cx, BOX.y0 - 0.3, cz, {
    r: 0.05,
  })
}

/** Bleacher stairs with LEDs and small shelves. Returns where people sit. */
function stairs(kit: Kit): Array<Point3> {
  const led = new THREE.MeshBasicMaterial({ color: "#fff2d6" })
  const width = STAIRS.x1 - STAIRS.x0
  const middle = (STAIRS.x0 + STAIRS.x1) / 2
  const seats: Array<Point3> = []
  for (let k = 0; k < STAIRS.steps; k++) {
    const front = STAIRS.z1 - k * STAIRS.run
    const top = (k + 1) * STAIRS.rise
    const base = top - STAIRS.rise
    kit.block(width, top, front, WHITE, middle, 0, front / 2, { r: 0.03 })
    kit.block(width - 0.2, 0.03, 0.03, led, middle, top - 0.1, front + 0.01, {
      cast: false,
    })
    if (k % 3 === 1) {
      // A small shelf set into the step.
      const shelfX = 3 + (k % 2) * 3
      kit.block(1.6, STAIRS.rise - 0.08, 0.05, "#5a3a22", shelfX, base + 0.02, front + 0.02, { r: 0.01 })
      for (let i = 0; i < 18; i++) {
        const height = 0.24 + kit.rand() * 0.1
        kit.block(0.06, height, 0.18, kit.pick(BOOK_COLORS), shelfX - 0.7 + i * 0.08, base + 0.06, front - 0.06, { r: 0.005 })
      }
    }
    if (k > 0 && k < STAIRS.steps - 1) {
      for (let s = 0; s < 2; s++) {
        if (kit.rand() < 0.55) {
          seats.push([STAIRS.x0 + 1 + kit.rand() * 6, top, front - 0.45])
        }
      }
    }
  }
  // The steps continue up to the balcony as a white landing.
  kit.block(width, 4.6, 0.6, WHITE, middle, 0, 0.3, { r: 0.03 })
  return seats
}

/** Floor, wall shells, balconies, the floating box and the bleacher stairs. */
export function buildRoom(kit: Kit): { stairSeats: Array<Point3> } {
  floor(kit)
  walls(kit)
  balconies(kit)
  floatingBox(kit)
  return { stairSeats: stairs(kit) }
}
```

- [ ] **Step 8: Tulis `skyline.ts`**

```ts
import * as THREE from "three"
import type { Kit } from "./kit"
import { ATRIUM, GLASS } from "./layout"

const { size: SIZE, height: HEIGHT } = ATRIUM
const GLASS_WIDTH = GLASS.x1 - GLASS.x0
const GLASS_HEIGHT = GLASS.y1 - GLASS.y0
const GLASS_CENTER = [(GLASS.x0 + GLASS.x1) / 2, (GLASS.y0 + GLASS.y1) / 2] as const
/**
 * The camera looks down, so through real glass it would only see the street.
 * The skyline is painted on a backdrop just behind the glass instead (a
 * diorama), and drawn only where the glass mask marked the stencil buffer.
 */
const SKY = { x0: GLASS.x0 - 4, x1: SIZE + 2, y0: -4, y1: HEIGHT + 1, z: -2.2 }
const OUTSIDE = {
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: THREE.EqualStencilFunc,
  stencilZPass: THREE.KeepStencilOp,
} satisfies THREE.MaterialParameters

export type Skyline = {
  clouds: Array<{ group: THREE.Group; speed: number }>
  birds: Array<{
    group: THREE.Group
    left: THREE.Mesh
    right: THREE.Mesh
    speed: number
    phase: number
  }>
  beacons: Array<{ mesh: THREE.Mesh; phase: number }>
}

function glassMask(kit: Kit) {
  const mask = new THREE.Mesh(
    new THREE.PlaneGeometry(GLASS_WIDTH, GLASS_HEIGHT),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp,
    })
  )
  mask.position.set(GLASS_CENTER[0], GLASS_CENTER[1], -0.05)
  mask.renderOrder = -1
  kit.scene.add(mask)
}

/** The painted city at dusk. Returns its blinking tower-top beacons. */
function backdrop(kit: Kit): Skyline["beacons"] {
  const tops: Array<readonly [number, number]> = []
  const texture = kit.canvasTexture(2048, 2048, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, "#2b3a67")
    sky.addColorStop(0.45, "#6c5b9e")
    sky.addColorStop(0.72, "#e7909a")
    sky.addColorStop(0.88, "#ffc58a")
    g.fillStyle = sky
    g.fillRect(0, 0, w, h)
    const layer = (
      minHeight: number,
      maxHeight: number,
      base: number,
      color: string,
      lit: boolean
    ) => {
      let x = -20
      while (x < w) {
        const width = 60 + kit.rand() * 120
        const height = minHeight + kit.rand() * (maxHeight - minHeight)
        const top = base - height
        g.fillStyle = color
        g.fillRect(x, top, width, h - top)
        if (kit.rand() < 0.3) {
          g.fillRect(x + width * 0.4, top - 40, width * 0.2, 40)
        }
        if (lit) {
          for (let wy = top + 12; wy < h - 10; wy += 22) {
            for (let wx = x + 8; wx < x + width - 10; wx += 16) {
              if (kit.rand() < 0.38) {
                g.fillStyle =
                  kit.rand() < 0.8
                    ? "rgba(255,214,150,.85)"
                    : "rgba(180,220,255,.8)"
                g.fillRect(wx, wy, 8, 11)
              }
            }
          }
          if (height > maxHeight * 0.75) {
            tops.push([x + width / 2, top - (kit.rand() < 0.3 ? 40 : 0)])
          }
        }
        x += width + 6 + kit.rand() * 30
      }
    }
    layer(500, 900, h * 0.92, "#5d4f7d", false)
    layer(700, 1300, h * 0.95, "#3c3557", true)
    layer(400, 1000, h, "#272338", true)
  })
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(SKY.x1 - SKY.x0, SKY.y1 - SKY.y0),
    new THREE.MeshBasicMaterial({ map: texture, ...OUTSIDE })
  )
  plane.position.set((SKY.x0 + SKY.x1) / 2, (SKY.y0 + SKY.y1) / 2, SKY.z)
  kit.scene.add(plane)

  const red = new THREE.MeshBasicMaterial({ color: "#ff3b3b", ...OUTSIDE })
  return tops.slice(0, 7).map(([px, py], i) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), red)
    mesh.position.set(
      SKY.x0 + (px / 2048) * (SKY.x1 - SKY.x0),
      SKY.y1 - (py / 2048) * (SKY.y1 - SKY.y0),
      SKY.z + 0.05
    )
    kit.scene.add(mesh)
    return { mesh, phase: i * 0.37 }
  })
}

function clouds(kit: Kit): Skyline["clouds"] {
  const material = new THREE.MeshStandardMaterial({
    color: "#fff4f0",
    emissive: "#ffd9d0",
    emissiveIntensity: 0.55,
    roughness: 1,
    ...OUTSIDE,
  })
  const puffs = [
    [0, 0, 0.7],
    [0.8, -0.1, 0.5],
    [-0.8, -0.12, 0.5],
    [0.3, 0.38, 0.5],
  ] as const
  return Array.from({ length: 5 }, (_, i) => {
    const group = new THREE.Group()
    for (const [dx, dy, radius] of puffs) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 18, 12),
        material
      )
      puff.position.set(dx, dy, 0)
      group.add(puff)
    }
    group.scale.set(1 + (i % 3) * 0.4, 0.55, 0.2)
    group.position.set(GLASS.x0 + i * 3.5, 8.5 + (i % 3) * 1.4, -1.6)
    kit.scene.add(group)
    return { group, speed: 0.25 + (i % 3) * 0.08 }
  })
}

function birds(kit: Kit): Skyline["birds"] {
  const material = new THREE.MeshBasicMaterial({
    color: "#2a2433",
    side: THREE.DoubleSide,
    ...OUTSIDE,
  })
  const wing = new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 0.34, 0, 0, 0.17, 0.08, 0], 3)
  )
  return Array.from({ length: 4 }, (_, i) => {
    const group = new THREE.Group()
    const left = new THREE.Mesh(wing, material)
    const right = new THREE.Mesh(wing, material)
    right.rotation.y = Math.PI
    group.add(left, right)
    group.position.set(SIZE - i * 0.7, 9.5 + (i % 2) * 0.4 - i * 0.2, -0.9)
    kit.scene.add(group)
    return { group, left, right, speed: 1.1 + i * 0.1, phase: i * 1.3 }
  })
}

/** Mullions, transoms and a faint pane. */
function frame(kit: Kit) {
  for (let x = GLASS.x0; x <= GLASS.x1 + 0.01; x += 2.6) {
    kit.block(0.14, HEIGHT, 0.22, "#d8d2c8", Math.min(x, GLASS.x1 - 0.07), 0, -0.05)
  }
  for (const y of [0, 4.5, 9, HEIGHT - 0.25]) {
    kit.block(GLASS_WIDTH, 0.22, 0.24, "#d8d2c8", GLASS_CENTER[0], y, -0.05)
  }
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(GLASS_WIDTH, GLASS_HEIGHT),
    new THREE.MeshBasicMaterial({
      color: "#bcd6ff",
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
    })
  )
  pane.position.set(GLASS_CENTER[0], GLASS_CENTER[1], 0.02)
  kit.scene.add(pane)
}

/** The glass curtain wall and the city behind it (spec 1D §2, decision 4). */
export function buildSkyline(kit: Kit): Skyline {
  glassMask(kit)
  const beacons = backdrop(kit)
  const skyline: Skyline = { clouds: clouds(kit), birds: birds(kit), beacons }
  frame(kit)
  return skyline
}
```

- [ ] **Step 9: Tulis `furniture.ts`**

```ts
import * as THREE from "three"
import type { Kit } from "./kit"
import {
  ADMIN_DESK,
  ATRIUM,
  LOUNGES,
  type Point2,
  type Point3,
  READING_TABLE,
  TOWER,
  TROLLEY,
  ZONES,
} from "./layout"
import { BOOK_COLORS } from "./shelves"

const WOOD = "#c98d55"

export type Seat = { at: Point2; facing: number }
export type Furnishings = {
  /** The page that turns in each open book on the reading table. */
  pagePivots: Array<THREE.Group>
  /** The hanging art globes, which turn slowly. */
  arts: Array<THREE.Mesh>
  /** Where lounge visitors sit. */
  loungeSeats: Array<Seat>
}

const LAMP_POSTS: ReadonlyArray<Point2> = [
  [11.2, 9.6],
  [10.8, 3.2],
  [16.5, 9.5],
  [27.5, 13.5],
  [2.2, 12.5],
]
/** [x, z, scale] */
const PLANTS: ReadonlyArray<Point3> = [
  [16.2, 3.2, 1.3],
  [28.6, 5, 1.2],
  [2.4, 22, 1.1],
  [27.8, 24.5, 1.2],
  [10.8, 22.5, 1],
  [2.4, 31.5, 1.2],
  [32, 20, 1.2],
]

function light(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: "#fff6e0" })
}

/** A tower's body and top; its cubbies are shelf faces (layout.ts). */
function towerBody(kit: Kit, [x, z]: Point2) {
  const { width, height } = TOWER
  kit.block(width, height, width, "#6b4426", x, 0, z)
  kit.block(width + 0.12, 0.14, width + 0.12, "#b9824c", x, height, z)
}

function lampPost(
  kit: Kit,
  x: number,
  z: number,
  base: number,
  height: number
) {
  kit.mesh(
    new THREE.CylinderGeometry(0.02, 0.02, height, 8),
    "#b9935a",
    x,
    base + height / 2,
    z
  )
  kit.mesh(new THREE.SphereGeometry(0.22, 20, 16), light(), x, base + height + 0.18, z, {
    cast: false,
  })
}

function lampSmall(kit: Kit, x: number, z: number, y: number) {
  kit.mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), "#3a2a22", x, y + 0.15, z)
  kit.mesh(new THREE.SphereGeometry(0.1, 14, 10), light(), x, y + 0.36, z, {
    cast: false,
  })
}

function plant(kit: Kit, [x, z, s]: Point3) {
  kit.mesh(
    new THREE.CylinderGeometry(0.32 * s, 0.26 * s, 0.6 * s, 20),
    "#e7e1d8",
    x,
    0.3 * s,
    z
  )
  kit.mesh(
    new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 1.4 * s, 8),
    "#6b4a2e",
    x,
    1.2 * s,
    z
  )
  const leaves = [
    [0, 2, 0, 0.5],
    [0.3, 1.75, 0.15, 0.36],
    [-0.28, 1.8, -0.1, 0.38],
  ] as const
  for (const [dx, dy, dz, r] of leaves) {
    kit.mesh(
      new THREE.SphereGeometry(r * s, 16, 12),
      "#4f7f4f",
      x + dx * s,
      dy * s,
      z + dz * s
    )
  }
}

function displayTable(
  kit: Kit,
  x: number,
  z: number,
  width = 2.6,
  depth = 1.4
) {
  kit.block(width, 0.85, depth, WOOD, x, 0, z, { r: 0.05 })
  const glowSide = new THREE.MeshStandardMaterial({
    color: "#5a3a22",
    emissive: "#ffffff",
    emissiveMap: kit.glow,
    emissiveIntensity: 0.9,
  })
  for (let i = 0; i < Math.floor(width / 0.8); i++) {
    kit.mesh(
      new THREE.PlaneGeometry(0.62, 0.55),
      glowSide,
      x - width / 2 + 0.45 + i * 0.82,
      0.45,
      z + depth / 2 + 0.01,
      { cast: false }
    )
  }
  const covers = ["#3d5a80", "#ee6c4d", "#f4efe6", "#7a9e7e"]
  for (let i = 0; i < 6; i++) {
    kit.block(
      0.32,
      0.03,
      0.42,
      kit.pick(covers),
      x - width / 2 + 0.3 + i * 0.42,
      0.85,
      z + (i % 2 === 1 ? 0.2 : -0.2),
      { r: 0.01 }
    )
  }
  lampPost(kit, x + width / 2 - 0.3, z - depth / 2 + 0.3, 0.85, 0.5)
}

/** An open book whose right-hand page can turn. Returns the page's pivot. */
function openBook(kit: Kit, x: number, y: number, z: number): THREE.Group {
  const base = new THREE.Group()
  base.position.set(x, y, z)
  kit.scene.add(base)
  kit.block(0.22, 0.012, 0.3, "#f7f2e6", -0.11, 0, 0, { parent: base, r: 0.004 })
  kit.block(0.22, 0.012, 0.3, "#ece3cf", 0.11, 0, 0, { parent: base, r: 0.004 })
  const pivot = new THREE.Group()
  base.add(pivot)
  kit.block(0.22, 0.006, 0.29, "#fffaf0", 0.11, 0.013, 0, {
    parent: pivot,
    r: 0.003,
  })
  return pivot
}

/** The long reading table with lamps and chairs. Returns its turning pages. */
function readingTable(kit: Kit): Array<THREE.Group> {
  const [cx, cz] = READING_TABLE
  kit.block(6, 0.08, 1.5, "#d9a66b", cx, 0.76, cz, { r: 0.03 })
  for (const dx of [-2.7, 2.7]) {
    for (const dz of [-0.55, 0.55]) {
      kit.block(0.08, 0.76, 0.08, "#3a2a22", cx + dx, 0, cz + dz, { r: 0.02 })
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = cx - 2.1 + i * 1.4
    lampSmall(kit, x, cz, 0.84)
    for (const side of [-1, 1]) {
      const chairZ = cz + side * 1.1
      kit.block(0.46, 0.08, 0.46, "#efe3cf", x + 0.35, 0.44, chairZ, { r: 0.03 })
      kit.block(0.46, 0.5, 0.06, "#efe3cf", x + 0.35, 0.52, cz + side * 1.33, {
        r: 0.03,
      })
      for (const lx of [-0.18, 0.18]) {
        for (const lz of [-0.18, 0.18]) {
          kit.block(0.03, 0.44, 0.03, "#3a2a22", x + 0.35 + lx, 0, chairZ + lz, {
            r: 0.01,
          })
        }
      }
    }
  }
  return [
    openBook(kit, cx - 1.1, 0.85, cz - 0.3),
    openBook(kit, cx + 1.7, 0.85, cz + 0.3),
  ]
}

function adminDesk(kit: Kit) {
  const [cx, cz] = ADMIN_DESK
  kit.block(3.2, 1.0, 1.0, "#e9e3da", cx, 0, cz, { r: 0.12 })
  kit.block(
    3.0,
    0.05,
    0.05,
    new THREE.MeshBasicMaterial({ color: "#ffd9a0" }),
    cx,
    0.15,
    cz + 0.52,
    { cast: false }
  )
  kit.block(3.3, 0.06, 1.1, WOOD, cx, 1.0, cz, { r: 0.03 })
  const screen = new THREE.MeshStandardMaterial({
    color: "#20242a",
    emissive: "#4a86d6",
    emissiveIntensity: 0.8,
  })
  const monitor = kit.block(0.6, 0.38, 0.05, screen, cx + 0.6, 1.24, cz - 0.15, {
    r: 0.02,
  })
  monitor.rotation.y = 0.35
  kit.block(0.06, 0.2, 0.06, "#3a3a40", cx + 0.6, 1.06, cz - 0.2, { r: 0.01 })
  lampSmall(kit, cx - 1.2, cz - 0.2, 1.06)
}

function trolley(kit: Kit) {
  const [cx, cz] = TROLLEY
  kit.block(1.1, 0.06, 0.6, "#9aa0a6", cx, 0.35, cz, { r: 0.02 })
  kit.block(1.1, 0.06, 0.6, "#9aa0a6", cx, 0.85, cz, { r: 0.02 })
  for (const dx of [-0.5, 0.5]) {
    for (const dz of [-0.25, 0.25]) {
      kit.block(0.03, 0.85, 0.03, "#7a8086", cx + dx, 0.08, cz + dz, { r: 0.01 })
      kit.mesh(new THREE.SphereGeometry(0.06, 10, 8), "#222222", cx + dx, 0.06, cz + dz)
    }
  }
  for (let i = 0; i < 9; i++) {
    const height = 0.26 + kit.rand() * 0.08
    kit.block(0.07, height, 0.2, kit.pick(BOOK_COLORS), cx - 0.45 + i * 0.1, 0.91, cz, {
      r: 0.006,
    })
  }
}

function hangingArt(
  kit: Kit,
  [x, y, z]: Point3,
  radius: number,
  colors: ReadonlyArray<string>
): THREE.Mesh {
  const top = ATRIUM.height + 2
  kit.mesh(
    new THREE.CylinderGeometry(0.01, 0.01, top - y, 4),
    "#c9c4bd",
    x,
    (top + y) / 2,
    z,
    { cast: false }
  )
  const texture = kit.canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = colors[0]
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = kit.pick(colors)
      g.lineWidth = 6 + kit.rand() * 18
      g.beginPath()
      g.moveTo(kit.rand() * w, kit.rand() * h)
      g.bezierCurveTo(
        kit.rand() * w,
        kit.rand() * h,
        kit.rand() * w,
        kit.rand() * h,
        kit.rand() * w,
        kit.rand() * h
      )
      g.stroke()
    }
  })
  return kit.mesh(
    new THREE.SphereGeometry(radius, 32, 24),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5 }),
    x,
    y,
    z
  )
}

const shade = (hex: string, factor: number) =>
  `#${new THREE.Color(hex).multiplyScalar(factor).getHexString()}`

function sofa(kit: Kit, x: number, z: number, facing: number, color: string) {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = facing
  kit.scene.add(group)
  kit.block(2.3, 0.4, 0.95, shade(color, 0.85), 0, 0, 0, { parent: group, r: 0.1 })
  kit.block(2.1, 0.14, 0.75, shade(color, 1.15), 0, 0.4, 0.06, {
    parent: group,
    r: 0.07,
  })
  kit.block(2.3, 0.62, 0.24, color, 0, 0.34, -0.36, { parent: group, r: 0.1 })
  for (const dx of [-1.06, 1.06]) {
    kit.block(0.2, 0.36, 0.95, color, dx, 0.34, 0, { parent: group, r: 0.08 })
  }
}

/** A rug, two facing sofas, a round table and a lamp. Returns its two seats. */
function lounge(kit: Kit, [cx, cz]: Point2, color: string): Array<Seat> {
  kit.block(5.4, 0.02, 4.2, "#7a4a32", cx, 0, cz, { r: 0.01, cast: false })
  sofa(kit, cx, cz - 1.45, 0, color)
  sofa(kit, cx, cz + 1.45, Math.PI, color)
  kit.mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 32), WOOD, cx, 0.42, cz)
  kit.mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.4, 12), "#3a2a22", cx, 0.2, cz)
  for (let i = 0; i < 3; i++) {
    kit.block(0.3, 0.05, 0.22, kit.pick(BOOK_COLORS), cx - 0.15 + i * 0.05, 0.45 + i * 0.05, cz, {
      r: 0.01,
    })
  }
  lampPost(kit, cx + 2.4, cz - 1.6, 0, 2.2)
  return [
    { at: [cx - 0.5, cz - 1.45], facing: 0 },
    { at: [cx + 0.6, cz + 1.45], facing: Math.PI },
  ]
}

/** Towers, desks, the trolley, decorations and the lounges (spec 1D §4). */
export function buildFurniture(kit: Kit): Furnishings {
  for (const { at } of ZONES) towerBody(kit, at)
  const pagePivots = readingTable(kit)
  adminDesk(kit)
  trolley(kit)
  displayTable(kit, 22, 5.5)
  displayTable(kit, 26.5, 9.5, 2.2, 1.2)
  displayTable(kit, 9.5, 11.6, 2.2, 1.2)
  for (const [x, z] of LAMP_POSTS) lampPost(kit, x, z, 0, 2.6)
  for (const spot of PLANTS) plant(kit, spot)
  const loungeSeats = LOUNGES.flatMap(({ at, color }) => lounge(kit, at, color))
  const arts = [
    hangingArt(kit, [14.5, 10.6, 9], 1.1, ["#f6e7d0", "#2f6fb0", "#e94f37", "#f2c14e", "#3a3a3a"]),
    hangingArt(kit, [22, 11.4, 4.5], 1.4, ["#fbe3e8", "#d1495b", "#edae49", "#00798c", "#30638e"]),
    hangingArt(kit, [11.5, 12.2, 17], 0.8, ["#e8f1f2", "#13293d", "#006494", "#e94f37"]),
  ]
  return { pagePivots, arts, loungeSeats }
}
```

- [ ] **Step 10: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: semua hijau.

Jika TypeScript menolak `stencilFunc`/`stencilZPass` di `OUTSIDE`, pastikan objeknya ditulis dengan `satisfies THREE.MaterialParameters`, bukan `as const`. `satisfies` mempertahankan tipe literal konstanta three.

```bash
npx prettier --write src/components/lobby/scene package.json
git add package.json package-lock.json src/components/lobby/scene
git commit -m "feat(lobby): build the atrium, glowing shelves, skyline and furniture with three.js"
```

---

### Task 4: Figur bersendi dan animasi

**Files:**
- Create: `src/components/lobby/scene/people.ts`
- Create: `src/components/lobby/scene/motion.ts`

**Interfaces:**
- Consumes:
  - `Kit` (Task 3);
  - `Seat`, `Furnishings` dari `furniture.ts`; `Skyline` dari `skyline.ts`;
  - `READERS`, `LIBRARIAN`, `WALKER_ROUTES`, `ATRIUM`, `GLASS`, `Point2`, `Point3` dari `layout.ts`.
- Produces:
  - `people.ts`: tipe `Figure`, `Sitter`, `People`; fungsi `buildPeople(kit, seats, anda)`;
  - `motion.ts`: tipe `Motion = { update(t, dt), walkTo(spot, instant), showWalkers(share) }` dan `createMotion(people, furniture, skyline)`.

- [ ] **Step 1: Tulis `people.ts`**

```ts
import * as THREE from "three"
import type { Seat } from "./furniture"
import type { Kit } from "./kit"
import {
  LIBRARIAN,
  type Point2,
  type Point3,
  READERS,
  WALKER_ROUTES,
} from "./layout"

const SKIN = ["#e8b48e", "#c68e63", "#8a5a3c", "#f0c8a0"]
const HAIR = ["#2b1d16", "#1d1d1d", "#6b4a2b", "#d8d4cf", "#a8742f"]
const SHIRT = [
  "#f2f0ea",
  "#2f3e46",
  "#ee6c4d",
  "#98c1d9",
  "#7a9e7e",
  "#b56576",
  "#e0c068",
  "#3d5a80",
  "#1f1f24",
]
const PANTS = ["#2b2420", "#3d5a80", "#4a4a4a", "#d9cdb8"]

export type Figure = {
  root: THREE.Group
  legs: Array<{ hip: THREE.Group; knee: THREE.Group }>
  arms: Array<THREE.Group>
  head: THREE.Group
}
/** A seated visitor whose head moves; `phase` keeps them out of step. */
export type Sitter = Figure & { phase: number }
export type People = {
  sitters: Array<Sitter>
  librarian: Figure
  walkers: Array<Figure>
  anda: Figure
  /** The mint ring on the floor around "Anda". */
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
}

type Look = {
  shirt?: string
  pants?: string
  skin?: string
  hair?: string
  seated?: boolean
}

/** A jointed figure from simple shapes: hips, knees, shoulders, head (spec 1D §2, decision 8). */
function person(kit: Kit, look: Look = {}): Figure {
  const shirt = look.shirt ?? kit.pick(SHIRT)
  const pants = look.pants ?? kit.pick(PANTS)
  const skin = look.skin ?? kit.pick(SKIN)
  const hair = look.hair ?? kit.pick(HAIR)
  const capsule = (radius: number, length: number) =>
    new THREE.CapsuleGeometry(radius, length, 5, 10)
  const root = new THREE.Group()
  const hipY = look.seated ? 0 : 0.86

  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group()
    hip.position.set(side * 0.09, hipY, 0)
    root.add(hip)
    kit.mesh(capsule(0.075, 0.32), pants, 0, -0.22, 0, { parent: hip })
    const knee = new THREE.Group()
    knee.position.set(0, -0.42, 0)
    hip.add(knee)
    kit.mesh(capsule(0.065, 0.3), pants, 0, -0.2, 0, { parent: knee })
    kit.block(0.11, 0.07, 0.2, "#2b1d16", 0, -0.42, 0.04, {
      parent: knee,
      r: 0.03,
    })
    return { hip, knee }
  })
  kit.mesh(capsule(0.19, 0.3), shirt, 0, hipY + 0.32, 0, { parent: root })
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.25, hipY + 0.5, 0)
    root.add(shoulder)
    kit.mesh(capsule(0.06, 0.4), shirt, 0, -0.25, 0, { parent: shoulder })
    kit.mesh(new THREE.SphereGeometry(0.065, 10, 8), skin, 0, -0.5, 0, {
      parent: shoulder,
    })
    return shoulder
  })
  const head = new THREE.Group()
  head.position.y = hipY + 0.8
  root.add(head)
  kit.mesh(new THREE.SphereGeometry(0.16, 20, 16), skin, 0, 0, 0, {
    parent: head,
  })
  const cap = kit.mesh(
    new THREE.SphereGeometry(0.17, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    hair,
    0,
    0.01,
    -0.01,
    { parent: head }
  )
  cap.rotation.x = -0.25
  if (look.seated) {
    for (const { hip, knee } of legs) {
      hip.rotation.x = -Math.PI / 2
      knee.rotation.x = Math.PI / 2
    }
  }
  kit.scene.add(root)
  return { root, legs, arms, head }
}

/** Someone sitting on a chair or a sofa. */
function seated(kit: Kit, { at: [x, z], facing }: Seat, arms: number): Figure {
  const figure = person(kit, { seated: true })
  figure.root.position.set(x, 0.48, z)
  figure.root.rotation.y = facing
  for (const arm of figure.arms) arm.rotation.x = arms
  return figure
}

/** Everyone in the lobby. motion.ts places the walkers. */
export function buildPeople(
  kit: Kit,
  seats: { stairs: ReadonlyArray<Point3>; lounges: ReadonlyArray<Seat> },
  anda: Point2
): People {
  // Up to 12 people on the stairs, some reading or on their phone.
  const sitters: Array<Sitter> = seats.stairs
    .slice(0, 12)
    .map(([x, y, z], i) => {
      const figure = person(kit, { seated: true })
      figure.root.position.set(x, y + 0.02, z)
      for (const arm of figure.arms) arm.rotation.x = -0.9 - (i % 3) * 0.2
      return { ...figure, phase: i * 0.9 }
    })
  for (const reader of READERS) seated(kit, reader, -1.1)
  for (const lounger of seats.lounges) {
    sitters.push({ ...seated(kit, lounger, -0.8), phase: lounger.at[0] })
  }
  const librarian = person(kit, {
    shirt: "#f2f0ea",
    hair: "#d8d4cf",
    seated: true,
  })
  librarian.root.position.set(LIBRARIAN[0], 0.5, LIBRARIAN[1])
  const walkers = WALKER_ROUTES.map(() => person(kit))

  const member = person(kit, {
    shirt: "#1fa58a",
    hair: "#2b1d16",
    skin: "#c68e63",
  })
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.52, 40),
    new THREE.MeshBasicMaterial({
      color: "#4fd8ff",
      transparent: true,
      opacity: 0.9,
    })
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.02
  member.root.add(ring)
  member.root.position.set(anda[0], 0, anda[1])
  return { sitters, librarian, walkers, anda: member, ring }
}
```

- [ ] **Step 2: Tulis `motion.ts`**

```ts
import * as THREE from "three"
import type { Furnishings } from "./furniture"
import { ATRIUM, GLASS, type Point2, WALKER_ROUTES } from "./layout"
import type { Figure, People } from "./people"
import type { Skyline } from "./skyline"

const ANDA_WALK_SECONDS = 0.9

type Segment = { from: Point2; to: Point2; walk: number; pause: number }
type Route = { segments: Array<Segment>; total: number }

function routeOf(
  points: ReadonlyArray<readonly [number, number, number]>,
  speed: number
): Route {
  const segments = points.map(([x, z, pause], i): Segment => {
    const [nx, nz] = points[(i + 1) % points.length]
    return {
      from: [x, z],
      to: [nx, nz],
      walk: Math.hypot(nx - x, nz - z) / speed,
      pause,
    }
  })
  return {
    segments,
    total: segments.reduce((sum, { walk, pause }) => sum + walk + pause, 0),
  }
}

/** Legs and arms swing opposite each other; a knee bends on its back swing. */
function stride(figure: Figure, swing: number) {
  const [left, right] = figure.legs
  left.hip.rotation.x = swing
  right.hip.rotation.x = -swing
  left.knee.rotation.x = Math.max(0, -swing) * 0.8
  right.knee.rotation.x = Math.max(0, swing) * 0.8
  figure.arms[0].rotation.x = -swing * 0.7
  figure.arms[1].rotation.x = swing * 0.7
}

/** Walks the route, pausing and looking around at its corners. */
function placeWalker(walker: Figure, route: Route, t: number) {
  let time = t % route.total
  for (const { from, to, walk, pause } of route.segments) {
    if (time > pause + walk) {
      time -= pause + walk
      continue
    }
    const moving = time > pause
    const f = moving ? (time - pause) / walk : 0
    walker.root.position.set(
      from[0] + (to[0] - from[0]) * f,
      0,
      from[1] + (to[1] - from[1]) * f
    )
    walker.root.rotation.y = Math.atan2(to[0] - from[0], to[1] - from[1])
    stride(walker, moving ? Math.sin(t * 6.5) * 0.42 : 0)
    walker.head.rotation.y = moving ? 0 : Math.sin(t * 0.8) * 0.5
    return
  }
}

export type Motion = {
  /** Poses everything at time t (seconds); dt is the time since the last frame. */
  update: (t: number, dt: number) => void
  /** Sends "Anda" to a spot, walking or at once. */
  walkTo: (spot: Point2, instant: boolean) => void
  /** Shows a share of the walkers (the low tier shows half). */
  showWalkers: (share: number) => void
}

/** The lobby's light animation (spec 1D §4). */
export function createMotion(
  people: People,
  furniture: Furnishings,
  skyline: Skyline
): Motion {
  const routes = WALKER_ROUTES.map(({ points, speed }) =>
    routeOf(points, speed)
  )
  const from = new THREE.Vector3()
  const to = new THREE.Vector3()
  let progress = 1
  let shown = people.walkers.length

  function update(t: number, dt: number) {
    people.walkers.forEach((walker, i) => {
      if (i < shown) placeWalker(walker, routes[i], t)
    })
    for (const sitter of people.sitters) {
      sitter.head.rotation.x = Math.sin(t * 0.6 + sitter.phase) * 0.12 + 0.15
      sitter.head.rotation.y = Math.sin(t * 0.3 + sitter.phase) * 0.25
    }
    // Every seven seconds each reader turns a page.
    const cycle = (t % 7) / 7
    furniture.pagePivots.forEach((pivot, i) => {
      const k = (cycle + i * 0.45) % 1
      pivot.rotation.z =
        k < 0.6 ? 0 : k < 0.8 ? ((k - 0.6) / 0.2) * Math.PI : Math.PI
      pivot.visible = k < 0.82
    })
    people.librarian.arms[0].rotation.x = -1.2 + Math.sin(t * 14) * 0.06
    people.librarian.arms[1].rotation.x = -1.2 + Math.cos(t * 14) * 0.06
    furniture.arts.forEach((art, i) => {
      art.rotation.y = t * (0.08 + i * 0.03)
    })
    for (const cloud of skyline.clouds) {
      cloud.group.position.x += dt * cloud.speed
      if (cloud.group.position.x > ATRIUM.size + 2) {
        cloud.group.position.x = GLASS.x0 - 3
      }
    }
    for (const bird of skyline.birds) {
      bird.group.position.x -= dt * bird.speed
      if (bird.group.position.x < GLASS.x0 - 2) {
        bird.group.position.x = ATRIUM.size + 1
      }
      const flap = Math.sin(t * 9 + bird.phase) * 0.8
      bird.left.rotation.x = flap
      bird.right.rotation.x = -flap
    }
    for (const beacon of skyline.beacons) {
      beacon.mesh.visible = (t * 0.8 + beacon.phase) % 1 < 0.45
    }
    if (progress < 1) {
      progress = Math.min(1, progress + dt / ANDA_WALK_SECONDS)
      const eased = 1 - Math.pow(1 - progress, 3)
      people.anda.root.position.lerpVectors(from, to, eased)
      stride(people.anda, progress < 1 ? Math.sin(t * 9) * 0.45 : 0)
    }
    people.ring.material.opacity = 0.55 + Math.sin(t * 2.6) * 0.35
  }

  function walkTo([x, z]: Point2, instant: boolean) {
    const root = people.anda.root
    if (Math.hypot(root.position.x - x, root.position.z - z) < 0.01) return
    to.set(x, 0, z)
    root.rotation.y = Math.atan2(x - root.position.x, z - root.position.z)
    if (instant) {
      root.position.copy(to)
      progress = 1
      stride(people.anda, 0)
      return
    }
    from.copy(root.position)
    progress = 0
  }

  function showWalkers(share: number) {
    shown = Math.ceil(people.walkers.length * share)
    people.walkers.forEach((walker, i) => {
      walker.root.visible = i < shown
    })
  }

  return { update, walkTo, showWalkers }
}
```

- [ ] **Step 3: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: semua hijau.

```bash
npx prettier --write src/components/lobby/scene
git add src/components/lobby/scene
git commit -m "feat(lobby): jointed visitors, walkers, readers and the lobby's animation"
```

---

### Task 5: Stage (renderer, kamera, batas, kualitas, loop) dan harness pengembangan

**Files:**
- Create: `src/components/lobby/scene/stage.ts`
- Create: `scripts/lobby-harness.mjs`
- Create: `scripts/lobby-harness/index.html`, `scripts/lobby-harness/main.ts`

**Interfaces:**
- Consumes: semua modul Task 2–4.
- Produces:
  - tipe `StageMode = "normal" | "still" | "test"`;
  - tipe `StageOptions = { host, quality, mode, view, anda, onView(view, viewport), onQuality(quality), onLost() }`;
  - tipe `Stage = { books: number; setView(view): void; walkTo(spot): void; dispose(): void }`;
  - fungsi `createStage(options): Stage`, yang melempar error jika WebGL tidak bisa dibuat;
  - perintah `node scripts/lobby-harness.mjs serve | shot <file.png> | still` (`still` dipakai di Task 6).

- [ ] **Step 1: Tulis `stage.ts`**

```ts
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { OutputPass } from "three/addons/postprocessing/OutputPass.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js"
import { buildFurniture } from "./furniture"
import { createKit } from "./kit"
import { type Point2, SHELF_FACES } from "./layout"
import { createMotion } from "./motion"
import { buildPeople } from "./people"
import {
  CAMERA_OFFSET,
  MAX_ZOOM,
  MIN_ZOOM,
  type View,
  type Viewport,
  baseHalfHeight,
  clampView,
} from "./projection"
import { MEASURE_MS, type Quality, nextQuality, walkerShare } from "./quality"
import { buildRoom } from "./room"
import { buildShelves } from "./shelves"
import { buildSkyline } from "./skyline"

/**
 * normal: the lobby. still: the poster image (high-tier look, one frame).
 * test: the E2E camera-bounds check (still, no shadows or bloom, magenta void).
 */
export type StageMode = "normal" | "still" | "test"

export type StageOptions = {
  /** The element the canvas fills; its size is the viewport. */
  host: HTMLElement
  quality: Quality
  mode: StageMode
  view: View
  anda: Point2
  onView: (view: View, viewport: Viewport) => void
  onQuality: (quality: Quality) => void
  /** The WebGL context was lost: the lobby falls back to the still image. */
  onLost: () => void
}

export type Stage = {
  /** How many books stand on the shelves (budget: 12,000). */
  books: number
  /** Moves the camera; the view is kept inside the map. */
  setView: (view: View) => void
  walkTo: (spot: Point2) => void
  dispose: () => void
}

function pixelRatio(quality: Quality, mode: StageMode): number {
  return mode === "normal" && quality === "tinggi"
    ? Math.min(window.devicePixelRatio, 2)
    : 1
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    const materials: Array<THREE.Material> = Array.isArray(object.material)
      ? object.material
      : [object.material]
    for (const material of materials) {
      for (const value of Object.values(material) as Array<unknown>) {
        if (value instanceof THREE.Texture) value.dispose()
      }
      material.dispose()
    }
    if (object instanceof THREE.InstancedMesh) object.dispose()
  })
}

/** The 3D lobby (spec 1D §3.1). Throws when WebGL cannot be created. */
export function createStage(options: StageOptions): Stage {
  const { host, mode } = options
  let quality: Quality = mode === "test" ? "diam" : options.quality
  const fancy = mode !== "test"

  const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true })
  renderer.setPixelRatio(pixelRatio(quality, mode))
  renderer.shadowMap.enabled = fancy
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.82
  const canvas = renderer.domElement
  canvas.className = "lobby-canvas"
  canvas.setAttribute("aria-hidden", "true")
  host.append(canvas)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(mode === "test" ? "#ff00ff" : "#1b120c")
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04).texture
  scene.environment = environment
  disposeTree(room)
  pmrem.dispose()

  // Warm atrium light and one soft key light that casts the shadows.
  scene.add(new THREE.HemisphereLight("#ffe9cc", "#4a2e18", 0.55))
  const key = new THREE.DirectionalLight("#ffe6c4", 1.25)
  key.position.set(22, 30, 34)
  key.target.position.set(14, 0, 14)
  key.castShadow = fancy
  const shadowSize = quality === "tinggi" ? 2048 : 1024
  key.shadow.mapSize.set(shadowSize, shadowSize)
  const shadowCamera = key.shadow.camera
  shadowCamera.left = -24
  shadowCamera.right = 24
  shadowCamera.top = 24
  shadowCamera.bottom = -24
  shadowCamera.far = 100
  shadowCamera.updateProjectionMatrix()
  key.shadow.radius = 5
  key.shadow.bias = -0.0005
  scene.add(key, key.target)

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
  // A stencil buffer, so the skyline stays inside the glass.
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      stencilBuffer: true,
    })
  )
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(256, 256),
    0.35,
    0.45,
    0.9
  )
  bloom.enabled = fancy && quality === "tinggi"
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  const kit = createKit(scene)
  const { stairSeats } = buildRoom(kit)
  const skyline = buildSkyline(kit)
  const books = buildShelves(kit, SHELF_FACES)
  const furniture = buildFurniture(kit)
  const people = buildPeople(
    kit,
    { stairs: stairSeats, lounges: furniture.loungeSeats },
    options.anda
  )
  const motion = createMotion(people, furniture, skyline)
  motion.showWalkers(walkerShare(quality))
  motion.update(0, 0)

  const animates = () => mode === "normal" && quality !== "diam"

  const controls = new OrbitControls(camera, canvas)
  controls.enableRotate = false
  controls.screenSpacePanning = true
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  }
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }
  controls.minZoom = MIN_ZOOM
  controls.maxZoom = MAX_ZOOM
  controls.enableDamping = animates()

  let viewport: Viewport = {
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
  }
  let view = clampView(options.view, viewport)

  function placeCamera() {
    camera.position.set(
      view.target[0] + CAMERA_OFFSET[0],
      view.target[1] + CAMERA_OFFSET[1],
      view.target[2] + CAMERA_OFFSET[2]
    )
    controls.target.set(...view.target)
  }

  function frameCamera() {
    const aspect = viewport.width / viewport.height
    const halfHeight = baseHalfHeight(aspect)
    camera.left = -halfHeight * aspect
    camera.right = halfHeight * aspect
    camera.top = halfHeight
    camera.bottom = -halfHeight
    camera.zoom = view.zoom
    camera.updateProjectionMatrix()
    placeCamera()
    camera.lookAt(controls.target)
  }

  let frame = 0
  let disposed = false
  let needsRender = true
  let last = performance.now()
  let measuring = animates()
  let measureStart = 0
  let measureFrames = 0

  function draw() {
    composer.render()
    needsRender = false
  }
  function schedule() {
    if (frame === 0 && !disposed && !document.hidden) {
      frame = requestAnimationFrame(tick)
    }
  }
  function requestRender() {
    needsRender = true
    schedule()
  }

  function setQuality(next: Quality) {
    quality = next
    measuring = next !== "diam"
    renderer.setPixelRatio(pixelRatio(next, mode))
    bloom.enabled = fancy && next === "tinggi"
    controls.enableDamping = animates()
    motion.showWalkers(walkerShare(next))
    resize()
    options.onQuality(next)
  }

  /** Steps down a tier when its first seconds run too slowly. */
  function measure(now: number) {
    if (!measuring) return
    if (measureStart === 0) {
      measureStart = now
      measureFrames = 0
      return
    }
    measureFrames += 1
    const elapsed = now - measureStart
    if (elapsed < MEASURE_MS) return
    measureStart = 0
    const next = nextQuality(quality, (measureFrames * 1000) / elapsed)
    if (next === quality) measuring = false
    else setQuality(next)
  }

  function tick(now: number) {
    frame = 0
    if (disposed || document.hidden) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (animates()) {
      motion.update(now / 1000, dt)
      controls.update()
      draw()
      measure(now)
      schedule()
    } else if (needsRender) {
      draw()
    }
  }

  /** After every pan or zoom: keep the view inside the map (spec 1D §3.1). */
  function onControlsChange() {
    const { x, y, z } = controls.target
    view = clampView({ target: [x, y, z], zoom: camera.zoom }, viewport)
    if (view.zoom !== camera.zoom) {
      camera.zoom = view.zoom
      camera.updateProjectionMatrix()
    }
    placeCamera()
    options.onView(view, viewport)
    requestRender()
  }

  function resize() {
    const width = host.clientWidth
    const height = host.clientHeight
    if (width === 0 || height === 0) return
    viewport = { width, height }
    renderer.setSize(width, height)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(width, height)
    bloom.resolution.set(width / 2, height / 2)
    view = clampView(view, viewport)
    frameCamera()
    options.onView(view, viewport)
    requestRender()
  }

  const onVisibility = () => {
    if (document.hidden) return
    last = performance.now()
    measureStart = 0
    requestRender()
  }
  const onContextLost = (event: Event) => {
    event.preventDefault()
    options.onLost()
  }

  controls.addEventListener("change", onControlsChange)
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  document.addEventListener("visibilitychange", onVisibility)
  canvas.addEventListener("webglcontextlost", onContextLost)
  frameCamera()
  resize()

  return {
    books,
    setView(next) {
      view = clampView(next, viewport)
      frameCamera()
      options.onView(view, viewport)
      requestRender()
    },
    walkTo(spot) {
      motion.walkTo(spot, !animates())
      requestRender()
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
      canvas.removeEventListener("webglcontextlost", onContextLost)
      controls.removeEventListener("change", onControlsChange)
      controls.dispose()
      disposeTree(scene)
      environment.dispose()
      bloom.dispose()
      composer.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
```

- [ ] **Step 2: Tulis halaman harness**

`scripts/lobby-harness/index.html`:

```html
<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Lobi 3D — harness</title>
    <style>
      html,
      body {
        margin: 0;
        height: 100%;
        overflow: hidden;
        background: #1b120c;
      }
      #stage {
        position: fixed;
        inset: 0;
      }
      .lobby-canvas {
        position: absolute;
        inset: 0;
        display: block;
      }
    </style>
  </head>
  <body>
    <div id="stage"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`scripts/lobby-harness/main.ts`:

```ts
// The 3D lobby on a page of its own, served by scripts/lobby-harness.mjs: for
// looking at the scene while working on it, and for rendering the still image.
// Not part of the app.
import { ANDA_START } from "@/components/lobby/scene/layout"
import { startView } from "@/components/lobby/scene/projection"
import { type StageMode, createStage } from "@/components/lobby/scene/stage"

const requested = new URLSearchParams(window.location.search).get("mode")
const mode: StageMode =
  requested === "still" || requested === "test" ? requested : "normal"
const host = document.getElementById("stage")
if (!host) throw new Error("#stage is missing")

const stage = createStage({
  host,
  mode,
  quality: mode === "test" ? "diam" : "tinggi",
  view: startView({ width: host.clientWidth, height: host.clientHeight }),
  anda: ANDA_START,
  onView: () => undefined,
  onQuality: (quality) => {
    document.body.dataset.quality = quality
  },
  onLost: () => {
    document.body.dataset.lost = "true"
  },
})
document.body.dataset.books = String(stage.books)
// The first frame draws the scene; the second shows it.
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    document.body.dataset.ready = "true"
  })
)
```

- [ ] **Step 3: Tulis `scripts/lobby-harness.mjs`**

```js
// The 3D lobby on its own page, without the app (plan 1D, Task 5):
//   node scripts/lobby-harness.mjs serve         open it in a browser
//   node scripts/lobby-harness.mjs shot <file>   1440 × 900 screenshot (PNG)
//   node scripts/lobby-harness.mjs still         public/lobby/lobby-still*.{avif,webp}
import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { chromium } from "@playwright/test"
import sharp from "sharp"
import { createServer } from "vite"

const PORT = 5199
const PAGE = `http://localhost:${PORT}/scripts/lobby-harness/index.html`
// Chromium without a GPU draws WebGL with SwiftShader, on the CPU.
const GL_ARGS = [
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
]
// Same size as STILL_SIZE in src/components/lobby/LobbyStill.tsx.
const STILL = { width: 2560, height: 1440 }
const STILL_MAX_BYTES = 250 * 1024

async function render(viewport) {
  const browser = await chromium.launch({ args: GL_ARGS })
  try {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`${PAGE}?mode=still`, { timeout: 120_000 })
    await page.waitForSelector("body[data-ready]", { timeout: 300_000 })
    if (errors.length > 0) throw new Error(errors.join("\n"))
    const books = await page.evaluate(() => document.body.dataset.books)
    console.log(`books on the shelves: ${books}`)
    return await page.screenshot({ timeout: 300_000 })
  } finally {
    await browser.close()
  }
}

async function shot(path) {
  mkdirSync(dirname(path), { recursive: true })
  await sharp(await render({ width: 1440, height: 900 })).toFile(path)
  console.log(`wrote ${path}`)
}

async function still() {
  const png = await render(STILL)
  for (const width of [STILL.width, STILL.width / 2]) {
    const name = `lobby-still${width === STILL.width ? "" : `-${width}`}`
    const image = sharp(png).resize({ width })
    const avif = await image
      .clone()
      .avif({ quality: 50, effort: 6 })
      .toFile(`public/lobby/${name}.avif`)
    const webp = await image
      .clone()
      .webp({ quality: 75 })
      .toFile(`public/lobby/${name}.webp`)
    console.log(
      `${name}: avif ${Math.round(avif.size / 1024)} kB, webp ${Math.round(webp.size / 1024)} kB`
    )
    if (avif.size > STILL_MAX_BYTES) {
      throw new Error(`${name}.avif is over 250 kB (spec 1D §10)`)
    }
  }
}

const [command, file] = process.argv.slice(2)
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: "warn",
  resolve: { alias: { "@": resolve("src") } },
  server: { port: PORT, strictPort: true },
})
await server.listen()

if (command === "serve") {
  console.log(`${PAGE}   (?mode=still or ?mode=test)`)
} else {
  try {
    if (command === "shot") await shot(file ?? "lobby.png")
    else if (command === "still") await still()
    else throw new Error(`Unknown command: ${command}`)
  } finally {
    await server.close()
  }
}
```

- [ ] **Step 4: Periksa adegan secara visual**

Run: `node scripts/lobby-harness.mjs shot test-results/lobby-task5.png` (folder `test-results/` diabaikan git).
Expected:
- output memuat `books on the shelves: N`, dengan N ≤ 12000;
- PNG tertulis tanpa error halaman;
- render dengan SwiftShader bisa memakan beberapa menit.

Buka PNG itu dan bandingkan dengan prototipe (`docs/superpowers/specs/mockups/lobi-starfield.html` di browser). Harus terlihat:
- dinding rak menyala di kiri dan kanan, balkon, kotak rak melayang di atas tangga putih berisi pengunjung duduk;
- 8 menara rak, Meja Baca dengan pembaca, Meja Admin dengan pustakawan, Troli, dua sudut duduk di depan;
- kota senja hanya di dalam kaca;
- bayangan lembut di lantai, termasuk di area depan.

Jika langit tampak di luar kaca, atau kaca hitam/kosong, periksa render target stencil di `EffectComposer` dan `renderOrder = -1` pada `glassMask`. Untuk melihat animasi, jalankan `node scripts/lobby-harness.mjs serve`, lalu buka URL yang dicetak di browser dengan GPU (Ctrl+C untuk berhenti).

- [ ] **Step 5: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: semua hijau. `typecheck` juga memeriksa `scripts/lobby-harness/main.ts`.

```bash
npx prettier --write src/components/lobby/scene/stage.ts scripts/lobby-harness.mjs scripts/lobby-harness/main.ts scripts/lobby-harness/index.html
git add src/components/lobby/scene/stage.ts scripts/lobby-harness.mjs scripts/lobby-harness
git commit -m "feat(lobby): stage with bounded camera, quality tiers and render loop, plus a dev harness"
```

---

### Task 6: Gambar diam, dan latar halaman sambutan/auth

**Files:**
- Create: `public/lobby/lobby-still.avif`, `lobby-still.webp`, `lobby-still-1280.avif`, `lobby-still-1280.webp` (hasil skrip)
- Create: `src/components/lobby/LobbyStill.tsx`, `LobbyStill.test.ts`
- Modify: `src/components/scene/SceneBackdrop.tsx`
- Modify: `src/styles.css` (blok "Library scene backdrop")
- Delete: `public/lobby/scene.svg`, `public/lobby/scene-labels.svg`, `scripts/extract-lobby-scene.mjs`

**Interfaces:**
- Consumes: `scripts/lobby-harness.mjs still` (Task 5); `project`, `startView` (Task 2); `ADMIN_DESK` (Task 2).
- Produces:
  - `STILL_SIZE: Viewport` (2560 × 1440);
  - `STILL_VIEW: View`;
  - `LobbyStill({ className?, sizes? })`, yang merender `<picture>` AVIF/WebP dengan `<img alt="">`.

- [ ] **Step 1: Render gambar diam**

Run: `node scripts/lobby-harness.mjs still`
Expected: empat file di `public/lobby/` dan output seperti ini:

```
lobby-still: avif … kB, webp … kB
lobby-still-1280: avif … kB, webp … kB
```

Setiap AVIF harus ≤ 250 kB; skrip gagal jika lebih. Buka `public/lobby/lobby-still-1280.webp` dan pastikan seluruh atrium tampil seperti tangkapan Task 5, tanpa latar kosong di tepi.

- [ ] **Step 2: Tulis test yang gagal**

`src/components/lobby/LobbyStill.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { STILL_SIZE, STILL_VIEW } from "./LobbyStill"
import { ADMIN_DESK } from "./scene/layout"
import { project, startView } from "./scene/projection"

describe("the still image", () => {
  it("shows the wide-screen start view, at 16:9", () => {
    expect(STILL_SIZE.width / STILL_SIZE.height).toBeCloseTo(16 / 9)
    expect(STILL_VIEW).toEqual(startView(STILL_SIZE))
  })

  it("has the admin desk in its lower left, where the sign-in pages zoom in", () => {
    const desk = project([ADMIN_DESK[0], 1, ADMIN_DESK[1]], STILL_VIEW, STILL_SIZE)
    expect(desk.x).toBeGreaterThan(5)
    expect(desk.x).toBeLessThan(40)
    expect(desk.y).toBeGreaterThan(40)
    expect(desk.y).toBeLessThan(85)
  })
})
```

Run: `npx vitest run src/components/lobby/LobbyStill.test.ts`
Expected: FAIL, karena `./LobbyStill` belum ada.

- [ ] **Step 3: Tulis `LobbyStill.tsx`**

```tsx
import { type View, type Viewport, startView } from "./scene/projection"

/** The still image's size; scripts/lobby-harness.mjs renders it at this size. */
export const STILL_SIZE: Viewport = { width: 2560, height: 1440 }
/** What the still image shows: the wide-screen start view. */
export const STILL_VIEW: View = startView(STILL_SIZE)

/**
 * The lobby drawn once (spec 1D §3.1): the poster while the 3D scene loads,
 * the scene itself without WebGL, and the backdrop of the welcome and sign-in
 * pages.
 */
export function LobbyStill({
  className,
  sizes = "100vw",
}: {
  className?: string
  sizes?: string
}) {
  return (
    <picture>
      <source
        type="image/avif"
        srcSet="/lobby/lobby-still-1280.avif 1280w, /lobby/lobby-still.avif 2560w"
        sizes={sizes}
      />
      <source
        type="image/webp"
        srcSet="/lobby/lobby-still-1280.webp 1280w, /lobby/lobby-still.webp 2560w"
        sizes={sizes}
      />
      <img
        src="/lobby/lobby-still.webp"
        alt=""
        width={STILL_SIZE.width}
        height={STILL_SIZE.height}
        decoding="async"
        draggable={false}
        className={className}
      />
    </picture>
  )
}
```

Run: `npx vitest run src/components/lobby/LobbyStill.test.ts`
Expected: PASS (2 test).

- [ ] **Step 4: Ganti latar di `SceneBackdrop.tsx`**

Tambahkan import dan konstanta di atas komponen:

```tsx
import { useRouterState } from "@tanstack/react-router"
import { type CSSProperties, useEffect } from "react"
import {
  LobbyStill,
  STILL_SIZE,
  STILL_VIEW,
} from "@/components/lobby/LobbyStill"
import { ADMIN_DESK } from "@/components/lobby/scene/layout"
import { project } from "@/components/lobby/scene/projection"
import { sceneStateFor } from "./scene-state"

// Where the admin desk sits in the still image; the CSS camera zooms in on it.
const desk = project([ADMIN_DESK[0], 1, ADMIN_DESK[1]], STILL_VIEW, STILL_SIZE)
const DESK_POSITION = {
  "--desk-x": `${desk.x}%`,
  "--desk-y": `${desk.y}%`,
} as CSSProperties
```

Ganti isi `return` di akhir komponen:

```tsx
  if (!state) return null
  return (
    <div aria-hidden="true" className="scene-viewport">
      <div
        className="scene-canvas"
        data-focus={state.focus}
        data-blur={state.blur}
        style={DESK_POSITION}
      >
        {/* Zoomed in up to 3×: ask for the large image. */}
        <LobbyStill className="scene-image" sizes="300vw" />
        {state.focus === "overview" && <span className="scene-pulse" />}
      </div>
      {state.dim && <div className="scene-dim" />}
    </div>
  )
```

- [ ] **Step 5: Sesuaikan CSS latar di `src/styles.css`**

Ganti dua aturan `.scene-canvas[data-focus="admin"]` (desktop dan `@media (max-width: 767px)`):

```css
/* The admin desk sits at (--desk-x, --desk-y) of the canvas, worked out from
   the 3D layout (SceneBackdrop). Desktop: zoom 3× and move it to (25%, 50%). */
.scene-canvas[data-focus="admin"] {
  transform: translate(
      calc(25% - 3 * var(--desk-x)),
      calc(50% - 3 * var(--desk-y))
    )
    scale(3);
}
/* Phone: move it to (50%, 22%) so the guest book sheet fits below. */
@media (max-width: 767px) {
  .scene-canvas[data-focus="admin"] {
    transform: translate(
        calc(50% - 3 * var(--desk-x)),
        calc(22% - 3 * var(--desk-y))
      )
      scale(3);
  }
}
```

Ganti aturan `.scene-image, .scene-labels { … }` dan dua aturan `.scene-labels` sesudahnya (beserta komentarnya) dengan:

```css
.scene-canvas > picture {
  display: contents;
}
.scene-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
}
```

Di `.scene-pulse`, ganti `left: 61.5%;` dan `top: 70%;` dengan:

```css
  left: var(--desk-x);
  top: var(--desk-y);
```

Di blok `@media (prefers-reduced-motion: reduce)` milik latar, ubah selektor `.scene-canvas, .scene-labels` menjadi `.scene-canvas` saja.

- [ ] **Step 6: Hapus latar lama**

```bash
git rm public/lobby/scene.svg public/lobby/scene-labels.svg scripts/extract-lobby-scene.mjs
```

Run: `git grep -n "scene-labels\|scene.svg" -- src scripts pwa e2e`
Expected: tidak ada hasil.

- [ ] **Step 7: Verifikasi**

Run: `npm run typecheck && npm run lint && npm test`
Expected: semua hijau.

Run: `npx playwright test e2e/scene.spec.ts --project=desktop`
Expected: PASS. Zoom kamera CSS masih berjalan setelah klik "Masuk".

Lalu buka `npm run dev` dan cek `/login` serta `/` di browser:
- di `/login`, Meja Admin terlihat besar di kiri layar, dan buku tamu tidak menutupinya;
- di `/`, denyut mint berada tepat di Meja Admin.

Jika meja meleset, perbaiki di `desk` pada `SceneBackdrop`, bukan dengan angka CSS.

- [ ] **Step 8: Commit**

```bash
npx prettier --write src/components/lobby/LobbyStill.tsx src/components/lobby/LobbyStill.test.ts src/components/scene/SceneBackdrop.tsx
git add public/lobby src/components/lobby/LobbyStill.tsx src/components/lobby/LobbyStill.test.ts src/components/scene/SceneBackdrop.tsx src/styles.css
git commit -m "feat(lobby): still image of the 3D lobby, also behind the welcome and sign-in pages"
```

---

### Task 7: Kerangka navigasi anggota (sidebar dan tab bar)

**Files:**
- Create: `src/components/member/MemberShell.tsx`, `MemberShell.test.tsx`
- Modify: `src/routes/_member.tsx`
- Modify: `src/components/shelf/ShelfHeader.tsx` (hapus "← Lobi")
- Modify: `src/routes/_member/settings.tsx` (hapus "← Lobi")
- Modify: `src/styles.css` (token `--tabbar-h`, `--sidebar-w`, dan class `member-*`)

**Interfaces:**
- Produces:
  - `MemberShell({ children })`;
  - `hasShell(pathname): boolean`;
  - variabel CSS `--tabbar-h` dan `--sidebar-w`, yang dipakai lobi di Task 11.

- [ ] **Step 1: Tulis test yang gagal**

`src/components/member/MemberShell.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { describe, expect, it } from "vitest"
import { MemberShell } from "./MemberShell"

function renderAt(url: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <MemberShell>
        <p>Isi halaman</p>
      </MemberShell>
    ),
  })
  const pages = ["/lobby", "/shelf", "/settings", "/welcome", "/read/$bookId"]
  const router = createRouter({
    routeTree: rootRoute.addChildren(
      pages.map((path) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path,
          component: () => null,
        })
      )
    ),
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  return render(<RouterProvider router={router} />)
}

describe("MemberShell", () => {
  it("offers the sidebar and the tab bar, with the current page marked", async () => {
    renderAt("/shelf?genre=lainnya")
    const navs = await screen.findAllByRole("navigation", {
      name: "Navigasi anggota",
    })
    expect(navs).toHaveLength(2)
    for (const nav of navs) {
      const links = within(nav).getAllByRole("link")
      expect(links.map((link) => link.getAttribute("href"))).toEqual([
        "/lobby",
        "/shelf",
        "/settings",
      ])
      expect(
        within(nav).getByRole("link", { name: "Rak Saya" })
      ).toHaveAttribute("aria-current", "page")
      expect(
        within(nav).getByRole("link", { name: "Lobi" })
      ).not.toHaveAttribute("aria-current")
    }
    expect(screen.getByText("Isi halaman")).toBeInTheDocument()
  })

  it.each(["/read/abc", "/welcome"])(
    "leaves %s without navigation",
    async (url) => {
      renderAt(url)
      expect(await screen.findByText("Isi halaman")).toBeInTheDocument()
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
    }
  )
})
```

Run: `npx vitest run src/components/member/MemberShell.test.tsx`
Expected: FAIL, karena `./MemberShell` belum ada.

- [ ] **Step 2: Tulis `MemberShell.tsx`**

```tsx
import { Link, useRouterState } from "@tanstack/react-router"
import { BookOpenIcon, LibraryIcon, SettingsIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Logo } from "@/components/ui/logo"

const LINKS = [
  { to: "/lobby", label: "Lobi", short: "Lobi", Icon: LibraryIcon },
  { to: "/shelf", label: "Rak Saya", short: "Rak", Icon: BookOpenIcon },
  {
    to: "/settings",
    label: "Pengaturan",
    short: "Pengaturan",
    Icon: SettingsIcon,
  },
] as const

/**
 * The reader is full screen; the card page comes before membership, so links
 * there would only lead back to it (plan 1D, decision 6).
 */
export function hasShell(pathname: string): boolean {
  return !pathname.startsWith("/read/") && pathname !== "/welcome"
}

const isCurrent = (pathname: string, to: string) =>
  pathname === to || pathname.startsWith(`${to}/`)

/** Sidebar from 1024 px, tab bar below (spec 1D §5.3). */
export function MemberShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  if (!hasShell(pathname)) return children

  return (
    <>
      <nav aria-label="Navigasi anggota" className="member-sidebar">
        <Logo className="mb-6 size-10" />
        {LINKS.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="member-nav-link"
            aria-current={isCurrent(pathname, to) ? "page" : undefined}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="member-main">{children}</div>
      <nav aria-label="Navigasi anggota" className="member-tabbar">
        {LINKS.map(({ to, label, short, Icon }) => (
          <Link
            key={to}
            to={to}
            className="member-tab"
            aria-label={short === label ? undefined : label}
            aria-current={isCurrent(pathname, to) ? "page" : undefined}
          >
            <Icon aria-hidden="true" className="size-5" />
            <span>{short}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
```

- [ ] **Step 3: Tambahkan CSS kerangka**

Di `src/styles.css`, tambahkan ke blok `:root` (setelah `--sidebar-ring`):

```css
  /* Member navigation (plan 1D, Task 7). */
  --tabbar-h: calc(3.5rem + env(safe-area-inset-bottom));
  --sidebar-w: 13rem;
```

Tambahkan ke dalam `@layer components { … }`, di bagian akhir:

```css
  .member-sidebar {
    display: none;
  }
  .member-main {
    padding-bottom: var(--tabbar-h);
  }
  .member-tabbar {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 30;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    height: var(--tabbar-h);
    padding-bottom: env(safe-area-inset-bottom);
    border-top: 1px solid var(--border);
    background: var(--color-panel);
    backdrop-filter: blur(8px);
  }
  .member-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.15rem;
    font-size: 0.7rem;
    color: var(--muted-foreground);
  }
  .member-nav-link {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    border-radius: 0.5rem;
    padding: 0.55rem 0.75rem;
    font-size: 0.9rem;
  }
  .member-nav-link:hover {
    background: var(--muted);
  }
  .member-tab[aria-current="page"],
  .member-nav-link[aria-current="page"] {
    color: var(--color-mint);
  }
  @media (min-width: 1024px) {
    .member-sidebar {
      position: fixed;
      inset-block: 0;
      left: 0;
      z-index: 30;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      width: var(--sidebar-w);
      padding: 1.25rem 0.75rem;
      border-right: 1px solid var(--border);
      background: var(--color-panel);
      backdrop-filter: blur(8px);
    }
    .member-main {
      padding-bottom: 0;
      padding-left: var(--sidebar-w);
    }
    .member-tabbar {
      display: none;
    }
  }
```

- [ ] **Step 4: Pasang kerangka di `_member.tsx`**

```tsx
import { MemberShell } from "@/components/member/MemberShell"
```

Ganti `return <Outlet />` di `MemberLayout` dengan:

```tsx
  return (
    <MemberShell>
      <Outlet />
    </MemberShell>
  )
```

- [ ] **Step 5: Hapus tautan "← Lobi" yang kini diganti navigasi**

Di `ShelfHeader.tsx`: hapus `import { Link } from "@tanstack/react-router"` dan elemen `<Link to="/lobby" …>← Lobi</Link>`. Judulnya tetap di dalam `<div>`:

```tsx
      <div>
        <h1 className="font-heading text-3xl font-bold">Rak Saya</h1>
      </div>
```

Di `settings.tsx`: hapus `<Link to="/lobby" …>← Lobi</Link>` beserta pembungkus `<div className="flex items-center justify-between">`, sehingga yang tersisa hanya:

```tsx
      <h1 className="font-heading text-3xl font-bold">Pengaturan</h1>
```

`Link` tetap diimpor di `settings.tsx` karena masih dipakai untuk "Keluar".

Di lobi lama (`src/routes/_member/lobby.tsx`), hapus tautan "Rak Saya" dan "Pengaturan" dari panel. Yang tersisa hanya "Keluar". Tanpa langkah ini, `getByRole("link", { name: "Rak Saya" })` di E2E menemukan dua tautan dan gagal (strict mode). Halaman lobi ini diganti seluruhnya di Task 11.

```tsx
        <div className="flex w-full flex-col gap-2.5 sm:max-w-48">
          <Link to="/logout" className={linkClass}>
            Keluar
          </Link>
        </div>
```

- [ ] **Step 6: Jalankan test dan verifikasi**

Run: `npx vitest run src/components/member/MemberShell.test.tsx`
Expected: PASS (3 test).

Run: `npm run typecheck && npm run lint && npm test`
Expected: semua hijau.

Run: `npx playwright test e2e/shelf.spec.ts e2e/auth.spec.ts`
Expected: PASS di proyek `desktop` dan `mobile`. `openShelf` di `shelf.spec.ts` mengklik tautan "Rak Saya": di desktop tautan itu ada di sidebar, di HP di tab bar (`aria-label="Rak Saya"`).

- [ ] **Step 7: Commit**

```bash
npx prettier --write src/components/member src/routes/_member.tsx src/components/shelf/ShelfHeader.tsx src/routes/_member/settings.tsx src/routes/_member/lobby.tsx
git add src/components/member src/routes/_member.tsx src/components/shelf/ShelfHeader.tsx src/routes/_member/settings.tsx src/routes/_member/lobby.tsx src/styles.css
git commit -m "feat(member): sidebar and tab bar on every member page except the reader"
```

---

### Task 8: Data lobi, lapisan hotspot, dan wilayah adegan

**Files:**
- Create: `src/components/lobby/lobby-data.ts`, `lobby-data.test.ts`
- Create: `src/components/lobby/HotspotLayer.tsx`, `HotspotLayer.test.tsx`
- Create: `src/components/lobby/LobbyCanvas.tsx`
- Create: `src/components/lobby/LobbyScene.tsx`, `LobbyScene.test.tsx`
- Modify: `src/styles.css` (class `lobby-scene`, `lobby-hotspot*`, `lobby-still*`, `lobby-center`)

**Interfaces:**
- Consumes:
  - `countBooks` dan `ShelfFilter` dari `@/lib/shelf`; `GENRE_LABELS` dan `TROLLEY_LABEL` dari `@/lib/genre`;
  - layout, projection, dan quality (Task 2); `Stage` dan `createStage` (Task 5, hanya lewat `import()`); `LobbyStill`, `STILL_VIEW`, dan `STILL_SIZE` (Task 6).
- Produces:
  - `lobby-data.ts`:
    - `RECENT_LIMIT = 5`;
    - tipe `LobbySummary = { counts, trolley, recent, lastRead }` dan `summarizeLobby(books)`;
    - tipe `HotspotModel = { id, label, count: number | null, badge: number | null, dim: boolean }` dan `lobbyHotspots(counts)`.
  - `HotspotLayer({ hotspots, view, viewport, bubbles?, onActivate, onFocusSpot? })`.
  - `LobbyCanvas({ quality, test, anda, onReady, onView, onQuality, onFail })`.
  - `LobbyScene({ hotspots, anda, bubbles?, onActivate, ref? })`, dengan `ref` bertipe `LobbySceneHandle = { showSpot(id) }`.
  - `lobbyTestMode(): boolean`.

- [ ] **Step 1: Tulis test data lobi yang gagal**

`src/components/lobby/lobby-data.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { ShelfBook } from "@/lib/book-types"
import { RECENT_LIMIT, lobbyHotspots, summarizeLobby } from "./lobby-data"

const book = (id: string, changes: Partial<ShelfBook> = {}): ShelfBook => ({
  ...sherlock,
  id,
  title: `Buku ${id}`,
  ...changes,
})

describe("summarizeLobby", () => {
  it("counts the books per zone and lists the trolley", () => {
    const summary = summarizeLobby([
      book("a"),
      book("b", { genre: null }),
      book("c", { genre: "lainnya" }),
    ])
    expect(summary.counts.misteri_thriller).toBe(1)
    expect(summary.counts.lainnya).toBe(1)
    expect(summary.counts.troli).toBe(1)
    expect(summary.trolley.map(({ id }) => id)).toEqual(["b"])
  })

  it("lists the books opened last, newest first, and hands the last one to the reading table", () => {
    const opened = Array.from({ length: 7 }, (_, i) =>
      book(String(i), { lastOpenedAt: `2026-10-1${i}T08:00:00+00:00` })
    )
    const summary = summarizeLobby([...opened, book("never")])
    expect(summary.recent.map(({ id }) => id)).toEqual(["6", "5", "4", "3", "2"])
    expect(summary.recent).toHaveLength(RECENT_LIMIT)
    expect(summary.lastRead?.id).toBe("6")
  })

  it("has no last book when nothing was opened yet", () => {
    expect(summarizeLobby([book("a")]).lastRead).toBeNull()
    expect(summarizeLobby([]).recent).toEqual([])
  })
})

describe("lobbyHotspots", () => {
  it("gives the zones their counts, dims empty ones and badges the trolley", () => {
    const { counts } = summarizeLobby([
      book("a"),
      book("b", { genre: null }),
      book("c", { genre: null }),
    ])
    const hotspots = lobbyHotspots(counts)
    expect(hotspots[0]).toMatchObject({ id: "meja-baca", label: "Meja Baca" })
    expect(hotspots.find(({ id }) => id === "misteri_thriller")).toMatchObject(
      { label: "Misteri & Thriller", count: 1, dim: false }
    )
    expect(hotspots.find(({ id }) => id === "fiksi_sastra")).toMatchObject({
      count: 0,
      dim: true,
    })
    expect(hotspots.find(({ id }) => id === "troli")).toMatchObject({
      label: "Troli Buku Baru",
      count: null,
      badge: 2,
    })
    expect(hotspots.at(-1)).toMatchObject({
      id: "meja-admin",
      label: "Meja Admin",
      count: null,
      badge: null,
    })
  })

  it("hides the trolley's badge when it is empty", () => {
    const { counts } = summarizeLobby([book("a")])
    expect(
      lobbyHotspots(counts).find(({ id }) => id === "troli")?.badge
    ).toBeNull()
  })
})
```

Run: `npx vitest run src/components/lobby/lobby-data.test.ts`
Expected: FAIL, karena `./lobby-data` belum ada.

- [ ] **Step 2: Tulis `lobby-data.ts`**

```ts
import type { ShelfBook } from "@/lib/book-types"
import { GENRE_LABELS, TROLLEY_LABEL } from "@/lib/genre"
import { type ShelfFilter, countBooks } from "@/lib/shelf"
import { HOTSPOT_SPOTS, type HotspotId } from "./scene/layout"

export const RECENT_LIMIT = 5

/** What the lobby shows from the shelf (spec 1D §3.2). */
export type LobbySummary = {
  counts: Record<ShelfFilter, number>
  trolley: Array<ShelfBook>
  /** Books opened before, last opened first. */
  recent: Array<ShelfBook>
  /** The book the reading table opens: the one opened last on the server. */
  lastRead: ShelfBook | null
}

export function summarizeLobby(books: ReadonlyArray<ShelfBook>): LobbySummary {
  const opened = books
    .filter((book) => book.lastOpenedAt !== null)
    .sort((a, b) => (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? ""))
  return {
    counts: countBooks(books),
    trolley: books.filter((book) => book.genre === null),
    recent: opened.slice(0, RECENT_LIMIT),
    lastRead: opened.length > 0 ? opened[0] : null,
  }
}

/** What a hotspot says (spec 1D §5.1). */
export type HotspotModel = {
  id: HotspotId
  label: string
  /** Books in a zone; null where there is no count. */
  count: number | null
  /** The trolley's badge; null when it is empty. */
  badge: number | null
  /** A zone without books. */
  dim: boolean
}

export function lobbyHotspots(
  counts: Record<ShelfFilter, number>
): Array<HotspotModel> {
  return HOTSPOT_SPOTS.map(({ id }): HotspotModel => {
    const plain = { id, count: null, badge: null, dim: false }
    if (id === "meja-baca") return { ...plain, label: "Meja Baca" }
    if (id === "meja-admin") return { ...plain, label: "Meja Admin" }
    if (id === "troli") {
      return {
        ...plain,
        label: TROLLEY_LABEL,
        badge: counts.troli > 0 ? counts.troli : null,
      }
    }
    return {
      ...plain,
      label: GENRE_LABELS[id],
      count: counts[id],
      dim: counts[id] === 0,
    }
  })
}
```

Run: `npx vitest run src/components/lobby/lobby-data.test.ts`
Expected: PASS (5 test).

- [ ] **Step 3: Tulis test lapisan hotspot yang gagal**

`src/components/lobby/HotspotLayer.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { ShelfBook } from "@/lib/book-types"
import { HotspotLayer } from "./HotspotLayer"
import { STILL_SIZE, STILL_VIEW } from "./LobbyStill"
import { lobbyHotspots, summarizeLobby } from "./lobby-data"
import { spotOf } from "./scene/layout"
import { project } from "./scene/projection"

const onTrolley: ShelfBook = { ...sherlock, id: "t", genre: null }

function renderLayer(books: Array<ShelfBook>, bubble?: string) {
  const onActivate = vi.fn()
  render(
    <HotspotLayer
      hotspots={lobbyHotspots(summarizeLobby(books).counts)}
      view={STILL_VIEW}
      viewport={STILL_SIZE}
      bubbles={bubble ? { "meja-baca": <p>{bubble}</p> } : undefined}
      onActivate={onActivate}
    />
  )
  return onActivate
}

describe("HotspotLayer", () => {
  it("names the zones and the trolley with their book counts", () => {
    renderLayer([sherlock, onTrolley])
    expect(
      screen.getByRole("button", { name: "Misteri & Thriller · 1 buku" })
    ).not.toHaveAttribute("data-empty")
    expect(
      screen.getByRole("button", { name: "Fiksi & Sastra · 0 buku" })
    ).toHaveAttribute("data-empty")
    expect(
      screen.getByRole("button", { name: "Troli Buku Baru · 1 buku" })
    ).toBeInTheDocument()
  })

  it("names an empty trolley without a count", () => {
    renderLayer([sherlock])
    expect(
      screen.getByRole("button", { name: "Troli Buku Baru" })
    ).toBeInTheDocument()
  })

  it("starts at the reading table and ends at the admin desk", () => {
    renderLayer([sherlock])
    const buttons = screen.getAllByRole("button")
    expect(buttons[0]).toHaveAccessibleName("Meja Baca")
    expect(buttons.at(-1)).toHaveAccessibleName("Meja Admin")
  })

  it("puts each hotspot where its spot appears on screen", () => {
    renderLayer([sherlock])
    const anchor = screen.getByRole("button", { name: "Meja Baca" })
      .parentElement as HTMLElement
    const { x, y } = project(spotOf("meja-baca").label, STILL_VIEW, STILL_SIZE)
    expect(anchor.style.left).toBe(`${x}%`)
    expect(anchor.style.top).toBe(`${y}%`)
  })

  it("acts on a tap and shows a speech bubble above its hotspot", () => {
    const onActivate = renderLayer([sherlock], "Halo dari meja baca")
    fireEvent.click(screen.getByRole("button", { name: "Meja Admin" }))
    expect(onActivate).toHaveBeenCalledWith("meja-admin")
    expect(screen.getByText("Halo dari meja baca")).toBeInTheDocument()
  })
})
```

Run: `npx vitest run src/components/lobby/HotspotLayer.test.tsx`
Expected: FAIL, karena `./HotspotLayer` belum ada.

- [ ] **Step 4: Tulis `HotspotLayer.tsx`**

```tsx
import type { ReactNode } from "react"
import type { HotspotModel } from "./lobby-data"
import { type HotspotId, spotOf } from "./scene/layout"
import { type View, type Viewport, project } from "./scene/projection"

/**
 * The lobby's places as HTML buttons over the scene (spec 1D §5.1), placed by
 * projecting their 3D spot with the camera's current view.
 */
export function HotspotLayer({
  hotspots,
  view,
  viewport,
  bubbles,
  onActivate,
  onFocusSpot,
}: {
  hotspots: ReadonlyArray<HotspotModel>
  view: View
  viewport: Viewport
  /** Speech bubbles shown above a hotspot. */
  bubbles?: Partial<Record<HotspotId, ReactNode>>
  onActivate: (id: HotspotId) => void
  onFocusSpot?: (id: HotspotId) => void
}) {
  return (
    <div className="lobby-hotspots lobby-overlay">
      {hotspots.map((hotspot) => {
        const { x, y } = project(spotOf(hotspot.id).label, view, viewport)
        return (
          <div
            key={hotspot.id}
            className="lobby-hotspot-anchor"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {bubbles?.[hotspot.id]}
            <button
              type="button"
              className="lobby-hotspot"
              data-empty={hotspot.dim ? "" : undefined}
              onClick={() => onActivate(hotspot.id)}
              onFocus={() => onFocusSpot?.(hotspot.id)}
            >
              <span>{hotspot.label}</span>
              {hotspot.count !== null && (
                <>
                  {" "}
                  <span className="lobby-hotspot-count">
                    · {hotspot.count}
                    <span className="sr-only"> buku</span>
                  </span>
                </>
              )}
              {hotspot.badge !== null && (
                <>
                  {" "}
                  <span className="lobby-hotspot-badge" aria-hidden="true">
                    {hotspot.badge}
                  </span>
                  <span className="sr-only">· {hotspot.badge} buku</span>
                </>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
```

Run: `npx vitest run src/components/lobby/HotspotLayer.test.tsx`
Expected: PASS (5 test).

- [ ] **Step 5: Tulis `LobbyCanvas.tsx`**

Komponen ini tidak punya test unit karena memuat three.js. Ia diuji di E2E `lobby-3d` (Task 12).

```tsx
import { useEffect, useRef } from "react"
import type { Point2 } from "./scene/layout"
import { type View, type Viewport, startView } from "./scene/projection"
import type { Quality } from "./scene/quality"
import type { Stage } from "./scene/stage"

/**
 * The 3D scene. three.js arrives in its own chunk, loaded only here (spec 1D
 * §3.1). Any failure (no chunk offline, no WebGL) calls onFail, and the lobby
 * keeps the still image.
 */
export function LobbyCanvas({
  quality,
  test,
  anda,
  onReady,
  onView,
  onQuality,
  onFail,
}: {
  /** Read once, when the stage is created. */
  quality: Quality
  test: boolean
  anda: Point2
  onReady: (stage: Stage) => void
  onView: (view: View, viewport: Viewport) => void
  onQuality: (quality: Quality) => void
  onFail: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Stage | null>(null)
  const andaRef = useRef(anda)
  const callbacks = useRef({ onReady, onView, onQuality, onFail })
  const initial = useRef({ quality, test })

  useEffect(() => {
    callbacks.current = { onReady, onView, onQuality, onFail }
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    import("./scene/stage")
      .then(({ createStage }) => {
        if (cancelled) return
        const viewport = { width: host.clientWidth, height: host.clientHeight }
        const stage = createStage({
          host,
          mode: initial.current.test ? "test" : "normal",
          quality: initial.current.quality,
          view: startView(viewport),
          anda: andaRef.current,
          onView: (view, size) => callbacks.current.onView(view, size),
          onQuality: (next) => callbacks.current.onQuality(next),
          onLost: () => callbacks.current.onFail(),
        })
        stageRef.current = stage
        callbacks.current.onReady(stage)
      })
      .catch((error: unknown) => {
        console.error("the 3D lobby could not start", error)
        if (!cancelled) callbacks.current.onFail()
      })
    return () => {
      cancelled = true
      stageRef.current?.dispose()
      stageRef.current = null
    }
  }, [])

  // "Anda" walks wherever the page sends them.
  useEffect(() => {
    andaRef.current = anda
    stageRef.current?.walkTo(anda)
  }, [anda])

  return <div ref={hostRef} className="lobby-canvas-host" />
}
```

- [ ] **Step 6: Tulis test wilayah adegan yang gagal**

`src/components/lobby/LobbyScene.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import { LobbyScene } from "./LobbyScene"
import { lobbyHotspots, summarizeLobby } from "./lobby-data"
import { ANDA_START } from "./scene/layout"
import { type Environment, detectEnvironment } from "./scene/quality"

vi.mock("./scene/quality", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./scene/quality")>()),
  detectEnvironment: vi.fn(),
}))
// The real canvas loads three.js, which jsdom cannot draw.
vi.mock("./LobbyCanvas", () => ({
  LobbyCanvas: () => <div data-testid="lobby-canvas" />,
}))

const desktop: Environment = {
  reducedMotion: false,
  webgl: true,
  coarsePointer: false,
  deviceMemory: 8,
}
const hotspots = lobbyHotspots(summarizeLobby([sherlock]).counts)

function renderScene(environment: Environment) {
  vi.mocked(detectEnvironment).mockReturnValue(environment)
  const onActivate = vi.fn()
  render(
    <LobbyScene hotspots={hotspots} anda={ANDA_START} onActivate={onActivate} />
  )
  const scene = screen.getByRole("region", { name: "Adegan lobi" })
  return { scene, onActivate }
}

describe("LobbyScene", () => {
  beforeEach(() => {
    Reflect.deleteProperty(window, "__GLOSA_LOBBY_TEST__")
  })

  it("draws the 3D scene at the tier the device allows", async () => {
    const { scene } = renderScene(desktop)
    await vi.waitFor(() =>
      expect(scene).toHaveAttribute("data-quality", "tinggi")
    )
    expect(screen.getByTestId("lobby-canvas")).toBeInTheDocument()
    expect(scene).toHaveAttribute("tabindex", "0")
  })

  it("keeps the scene still with reduced motion", async () => {
    const { scene } = renderScene({ ...desktop, reducedMotion: true })
    await vi.waitFor(() =>
      expect(scene).toHaveAttribute("data-quality", "diam")
    )
    expect(screen.getByTestId("lobby-canvas")).toBeInTheDocument()
  })

  it("shows the still image without WebGL, and its hotspots still work", async () => {
    const { scene, onActivate } = renderScene({ ...desktop, webgl: false })
    await vi.waitFor(() =>
      expect(scene).toHaveAttribute("data-quality", "diam")
    )
    expect(screen.queryByTestId("lobby-canvas")).not.toBeInTheDocument()
    expect(scene.querySelector("img")).toHaveAttribute(
      "src",
      "/lobby/lobby-still.webp"
    )
    fireEvent.click(screen.getByRole("button", { name: "Meja Admin" }))
    expect(onActivate).toHaveBeenCalledWith("meja-admin")
  })

  it("stays still in the camera-bounds test mode", async () => {
    Object.assign(window, { __GLOSA_LOBBY_TEST__: true })
    const { scene } = renderScene(desktop)
    await vi.waitFor(() =>
      expect(scene).toHaveAttribute("data-quality", "diam")
    )
  })
})
```

Run: `npx vitest run src/components/lobby/LobbyScene.test.tsx`
Expected: FAIL, karena `./LobbyScene` belum ada.

- [ ] **Step 7: Tulis `LobbyScene.tsx`**

```tsx
import {
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { Button } from "@/components/ui/button"
import { HotspotLayer } from "./HotspotLayer"
import { LobbyCanvas } from "./LobbyCanvas"
import { LobbyStill, STILL_SIZE, STILL_VIEW } from "./LobbyStill"
import type { HotspotModel } from "./lobby-data"
import { type HotspotId, type Point2, spotOf } from "./scene/layout"
import {
  type View,
  type Viewport,
  centerOn,
  isInView,
  panBy,
  startView,
} from "./scene/projection"
import { type Quality, detectEnvironment, initialQuality } from "./scene/quality"
import type { Stage } from "./scene/stage"

export type LobbySceneHandle = {
  /** Moves the camera to a hotspot (the map's spots). */
  showSpot: (id: HotspotId) => void
}

type Camera = { view: View; viewport: Viewport }

/** Arrow keys move the camera by 15% of the screen. */
const PAN_KEYS: Partial<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-0.15, 0],
  ArrowRight: [0.15, 0],
  ArrowUp: [0, 0.15],
  ArrowDown: [0, -0.15],
}

/** Set by the E2E camera-bounds test before the page loads (plan 1D, decision 8). */
export function lobbyTestMode(): boolean {
  return (
    (window as Window & { __GLOSA_LOBBY_TEST__?: boolean })
      .__GLOSA_LOBBY_TEST__ === true
  )
}

/**
 * The lobby scene (spec 1D §3, §6): the 3D canvas, or the still image as the
 * poster while it loads and as the fallback without WebGL, with the hotspots
 * on top. Focus it to move the camera with the arrow keys.
 */
export function LobbyScene({
  hotspots,
  anda,
  bubbles,
  onActivate,
  ref,
}: {
  hotspots: ReadonlyArray<HotspotModel>
  anda: Point2
  bubbles?: Partial<Record<HotspotId, ReactNode>>
  onActivate: (id: HotspotId) => void
  ref?: Ref<LobbySceneHandle>
}) {
  const [quality, setQuality] = useState<Quality | null>(null)
  const [mode, setMode] = useState<"poster" | "3d" | "still">("poster")
  const [test, setTest] = useState(false)
  const [camera, setCamera] = useState<Camera | null>(null)
  const stageRef = useRef<Stage | null>(null)
  const cameraRef = useRef<Camera | null>(null)

  // Only the browser knows how the lobby can be drawn; the server sends the poster.
  useEffect(() => {
    const environment = detectEnvironment()
    const testing = lobbyTestMode()
    setTest(testing)
    setQuality(testing ? "diam" : initialQuality(environment))
    if (!environment.webgl) setMode("still")
  }, [])

  const moveCamera = (next: (current: Camera) => View) => {
    const current = cameraRef.current
    if (current && stageRef.current) stageRef.current.setView(next(current))
  }

  useImperativeHandle(ref, () => ({
    showSpot: (id) =>
      moveCamera((current) => centerOn(current.view, spotOf(id).label)),
  }))

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const step = PAN_KEYS[event.key]
    if (event.target !== event.currentTarget || !step) return
    event.preventDefault()
    moveCamera((current) =>
      panBy(current.view, step[0], step[1], current.viewport)
    )
  }

  /** A focused hotspot off screen brings the camera to it (spec 1D §6). */
  function reveal(id: HotspotId) {
    const point = spotOf(id).label
    moveCamera((current) =>
      isInView(point, current.view, current.viewport)
        ? current.view
        : centerOn(current.view, point)
    )
  }

  const live = mode === "3d" && camera !== null
  return (
    <section
      aria-label="Adegan lobi"
      tabIndex={0}
      data-quality={quality ?? undefined}
      className="lobby-scene"
      onKeyDown={onKeyDown}
    >
      {mode !== "still" && quality !== null && (
        <LobbyCanvas
          quality={quality}
          test={test}
          anda={anda}
          onReady={(stage) => {
            stageRef.current = stage
            setMode("3d")
          }}
          onView={(view, viewport) => {
            cameraRef.current = { view, viewport }
            setCamera(cameraRef.current)
          }}
          onQuality={setQuality}
          onFail={() => {
            stageRef.current = null
            setQuality("diam")
            setMode("still")
          }}
        />
      )}
      {live ? (
        <>
          <HotspotLayer
            hotspots={hotspots}
            view={camera.view}
            viewport={camera.viewport}
            bubbles={bubbles}
            onActivate={onActivate}
            onFocusSpot={reveal}
          />
          <Button
            variant="secondary"
            size="sm"
            className="lobby-center lobby-overlay"
            onClick={() =>
              moveCamera((current) => startView(current.viewport))
            }
          >
            Pusatkan
          </Button>
        </>
      ) : (
        <div className="lobby-still-frame">
          <LobbyStill className="lobby-still" />
          <HotspotLayer
            hotspots={hotspots}
            view={STILL_VIEW}
            viewport={STILL_SIZE}
            bubbles={bubbles}
            onActivate={onActivate}
          />
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 8: Tambahkan CSS wilayah adegan**

Tambahkan ke dalam `@layer components { … }` di `src/styles.css`:

```css
  /* Lobby scene (plan 1D, Task 8). */
  .lobby-scene {
    position: absolute;
    inset: 0;
    overflow: clip;
    container-type: size;
    background: #1b120c;
  }
  .lobby-scene:focus-visible {
    outline: 3px solid var(--color-mint);
    outline-offset: -3px;
  }
  .lobby-canvas-host {
    position: absolute;
    inset: 0;
  }
  .lobby-canvas {
    position: absolute;
    inset: 0;
    display: block;
    touch-action: none;
  }
  /* The still image covers the scene like the canvas would, at 16:9. */
  .lobby-still-frame {
    position: absolute;
    left: 50%;
    top: 50%;
    width: max(100cqw, 177.78cqh);
    height: max(100cqh, 56.25cqw);
    translate: -50% -50%;
  }
  .lobby-still-frame > picture {
    display: contents;
  }
  .lobby-still {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    user-select: none;
  }
  .lobby-hotspots {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .lobby-hotspot-anchor {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    translate: -50% -100%;
  }
  .lobby-hotspot-anchor > * {
    pointer-events: auto;
  }
  .lobby-hotspot {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    white-space: nowrap;
    border: 1px solid var(--border);
    border-radius: 0.6rem;
    background: var(--color-panel);
    padding: 0.4rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--foreground);
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.35);
  }
  .lobby-hotspot:hover,
  .lobby-hotspot:focus-visible {
    border-color: var(--color-mint);
    outline: none;
  }
  /* Dimmed by colour, not opacity, so the label keeps AA contrast. */
  .lobby-hotspot[data-empty] {
    border-style: dashed;
    color: var(--muted-foreground);
  }
  .lobby-hotspot-count {
    font-weight: 400;
    color: var(--muted-foreground);
  }
  .lobby-hotspot-badge {
    display: grid;
    place-items: center;
    min-width: 1.25rem;
    height: 1.25rem;
    border-radius: 9999px;
    background: #e8a33b;
    padding: 0 0.3rem;
    font-size: 0.75rem;
    color: #1b1206;
  }
  .lobby-center {
    position: absolute;
    left: 1rem;
    top: 1rem;
    z-index: 5;
  }
  @media (max-width: 1023px) {
    .lobby-hotspot {
      padding: 0.3rem 0.55rem;
      font-size: 0.75rem;
    }
  }
  @media (min-width: 1024px) {
    .lobby-center {
      top: auto;
      bottom: 1rem;
    }
  }
```

- [ ] **Step 9: Jalankan test dan verifikasi**

Run: `npx vitest run src/components/lobby`
Expected: PASS untuk semua file test lobi.

Run: `npm run typecheck && npm run lint && npm test`
Expected: semua hijau.

Pastikan three.js tidak terimpor secara statis:

Run: `git grep -n "from \"three\"\|from \"three/" -- src | grep -v "src/components/lobby/scene/"`
Expected: tidak ada hasil.

- [ ] **Step 10: Commit**

```bash
npx prettier --write src/components/lobby
git add src/components/lobby src/styles.css
git commit -m "feat(lobby): hotspot layer and the lobby scene, 3D or still, with keyboard panning"
```

---

### Task 9: Panel desktop (top bar, peta, detail buku, baru dibuka, meja admin)

**Files:**
- Create: `src/test/router.tsx` (pembantu test)
- Modify: `src/components/shelf/BookDetail.tsx` (pisahkan `BookFacts`)
- Create: `src/components/lobby/LobbyTopBar.tsx`, `LobbyTopBar.test.tsx`
- Create: `src/components/lobby/LibraryMap.tsx`, `LibraryMap.test.tsx`
- Create: `src/components/lobby/RecentBooks.tsx`, `RecentBooks.test.tsx`
- Create: `src/components/lobby/AdminDeskCard.tsx`, `AdminDeskCard.test.tsx`
- Create: `src/components/lobby/BookDetailPanel.tsx`
- Modify: `src/styles.css` (class `lobby-panel*`, `lobby-map*`, `lobby-search-results`, `lobby-account*`, `lobby-avatar`)

**Interfaces:**
- Consumes:
  - dari 1B/1C: `BookCover`, `ReadLink`, `BookActions`, `StorageMeter`, `shelfBooks` (dari `@/lib/shelf`), `useOnline`, `shelfPercentage`, dan tipe `LocalShelf`;
  - `HotspotModel` (Task 8); `HOTSPOT_SPOTS`, `spotOf`, dan `ATRIUM` (Task 2).
- Produces:
  - `BookFacts({ book, percentage })`;
  - `renderWithRouter(ui, url?)` untuk test;
  - `LobbyTopBar({ user, books, onSelect, className? })`;
  - `LibraryMap({ hotspots, anda, onSelect })`;
  - `RecentBooks({ books, local, onSelect })`;
  - `AdminDeskCard({ usage, onUpload })`;
  - `BookDetailPanel({ book, local, onClose, onChanged, onDeleted })`.

- [ ] **Step 1: Pisahkan `BookFacts` dari `BookDetail.tsx`**

Tambahkan komponen ini di `BookDetail.tsx`, di atas `BookDetail`:

```tsx
/** The description and the facts, shared with the lobby's detail panel (spec 1D §5.2). */
export function BookFacts({
  book,
  percentage,
}: {
  book: ShelfBook
  percentage: number
}) {
  return (
    <>
      {book.description && (
        <p className="max-h-48 overflow-y-auto text-sm leading-relaxed text-muted-foreground">
          {book.description}
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {book.language && (
          <>
            <dt className="text-muted-foreground">Bahasa</dt>
            <dd>{book.language}</dd>
          </>
        )}
        {percentage > 0 && (
          <>
            <dt className="text-muted-foreground">Dibaca</dt>
            <dd>{formatPercent(percentage)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Ukuran</dt>
        <dd>{formatBytes(book.sizeBytes)}</dd>
        <dt className="text-muted-foreground">Ditambahkan</dt>
        <dd>{formatLongDate(new Date(book.createdAt))}</dd>
      </dl>
    </>
  )
}
```

Di dalam `BookDetail`, ganti blok `{book.description && …}` dan `<dl>…</dl>` dengan `<BookFacts book={book} percentage={percentage} />`.

Run: `npx vitest run src/components/shelf/BookDetail.test.tsx`
Expected: PASS (tanpa perubahan perilaku).

- [ ] **Step 2: Tulis pembantu test router**

`src/test/router.tsx`:

```tsx
import { render } from "@testing-library/react"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import type { ReactNode } from "react"

const PATHS = ["/lobby", "/shelf", "/settings", "/logout", "/read/$bookId"]

/** Renders a component that uses <Link> or server functions inside a small router. */
export function renderWithRouter(ui: ReactNode, url = "/lobby") {
  const rootRoute = createRootRoute({ component: () => ui })
  const router = createRouter({
    routeTree: rootRoute.addChildren(
      PATHS.map((path) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path,
          component: () => null,
        })
      )
    ),
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  return render(<RouterProvider router={router} />)
}
```

Router merender secara asinkron, jadi test yang memakai pembantu ini harus menunggu dengan `findBy…` sebelum memakai `getBy…`.

- [ ] **Step 3: Tulis test panel yang gagal**

`src/components/lobby/LobbyTopBar.test.tsx`:

```tsx
import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { SessionUser } from "@/lib/session-types"
import { renderWithRouter } from "@/test/router"
import { LobbyTopBar } from "./LobbyTopBar"

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
const other = { ...sherlock, id: "b2", title: "Pride and Prejudice", author: "Jane Austen" }

describe("LobbyTopBar", () => {
  it("counts the books and finds one on the member's shelf", async () => {
    const onSelect = vi.fn()
    renderWithRouter(
      <LobbyTopBar user={member} books={[sherlock, other]} onSelect={onSelect} />
    )
    expect(await screen.findByText("2 buku")).toBeInTheDocument()
    const search = screen.getByLabelText("Cari di rakmu")
    fireEvent.change(search, { target: { value: "sherlock" } })
    fireEvent.click(screen.getByRole("button", { name: /Sherlock Holmes/ }))
    expect(onSelect).toHaveBeenCalledWith(sherlock)
    expect(search).toHaveValue("")
  })

  it("says when nothing matches", async () => {
    renderWithRouter(
      <LobbyTopBar user={member} books={[sherlock]} onSelect={vi.fn()} />
    )
    fireEvent.change(await screen.findByLabelText("Cari di rakmu"), {
      target: { value: "dracula" },
    })
    expect(screen.getByText("Tidak ada buku yang cocok.")).toBeInTheDocument()
  })

  it("keeps settings and sign-out in the account menu", async () => {
    renderWithRouter(
      <LobbyTopBar user={member} books={[]} onSelect={vi.fn()} />
    )
    expect(await screen.findByText("AB")).toBeInTheDocument()
    // The menu is a closed <details>: its links count as hidden until it opens.
    expect(
      screen.getByRole("link", { name: "Pengaturan", hidden: true })
    ).toHaveAttribute("href", "/settings")
    expect(
      screen.getByRole("link", { name: "Keluar", hidden: true })
    ).toHaveAttribute("href", "/logout")
  })
})
```

`src/components/lobby/LibraryMap.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import { LibraryMap } from "./LibraryMap"
import { lobbyHotspots, summarizeLobby } from "./lobby-data"

const hotspots = lobbyHotspots(summarizeLobby([sherlock]).counts)

describe("LibraryMap", () => {
  it("sends the camera to a place picked on the map", () => {
    const onSelect = vi.fn()
    render(<LibraryMap hotspots={hotspots} anda={[17, 17]} onSelect={onSelect} />)
    expect(screen.getAllByRole("button")).toHaveLength(11)
    fireEvent.click(screen.getByRole("button", { name: "Meja Baca di peta" }))
    expect(onSelect).toHaveBeenCalledWith("meja-baca")
  })

  it("marks where 'Anda' stands", () => {
    render(<LibraryMap hotspots={hotspots} anda={[17, 17]} onSelect={vi.fn()} />)
    expect(screen.getByText("Anda").parentElement).toHaveStyle({
      left: "50%",
      top: "50%",
    })
  })
})
```

`src/components/lobby/RecentBooks.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import { RecentBooks } from "./RecentBooks"

const local = { saved: new Set<string>(), percentages: new Map([[sherlock.id, 46]]) }

describe("RecentBooks", () => {
  it("lists the books opened last with their progress", () => {
    const onSelect = vi.fn()
    render(<RecentBooks books={[sherlock]} local={local} onSelect={onSelect} />)
    expect(screen.getByRole("heading", { name: "Baru Dibuka" })).toBeInTheDocument()
    expect(
      screen.getByRole("progressbar", { name: `Progres ${sherlock.title}` })
    ).toHaveAttribute("value", "46")
    fireEvent.click(screen.getByRole("button", { name: sherlock.title }))
    expect(onSelect).toHaveBeenCalledWith(sherlock)
  })

  it("shows nothing before any book was opened", () => {
    const { container } = render(
      <RecentBooks books={[]} local={local} onSelect={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
```

`src/components/lobby/AdminDeskCard.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AdminDeskCard } from "./AdminDeskCard"

const usage = { usedBytes: 742083, limitBytes: 104857600, plan: "free" as const }

describe("AdminDeskCard", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows the storage and opens the upload", () => {
    const onUpload = vi.fn()
    render(<AdminDeskCard usage={usage} onUpload={onUpload} />)
    expect(screen.getByLabelText("Penyimpanan")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Bawa buku" }))
    expect(onUpload).toHaveBeenCalled()
  })

  it("needs a connection to upload", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    render(<AdminDeskCard usage={usage} onUpload={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Bawa buku" })).toBeDisabled()
    expect(screen.getByText("Butuh internet.")).toBeInTheDocument()
  })
})
```

Run: `npx vitest run src/components/lobby/LobbyTopBar.test.tsx src/components/lobby/LibraryMap.test.tsx src/components/lobby/RecentBooks.test.tsx src/components/lobby/AdminDeskCard.test.tsx`
Expected: FAIL, karena komponennya belum ada.

- [ ] **Step 4: Tulis `LobbyTopBar.tsx`**

```tsx
import { Link } from "@tanstack/react-router"
import { useId, useState } from "react"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/ui/logo"
import type { ShelfBook } from "@/lib/book-types"
import type { SessionUser } from "@/lib/session-types"
import { MAX_QUERY_LENGTH, shelfBooks } from "@/lib/shelf"
import { cn } from "@/lib/utils"

const MAX_RESULTS = 6

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?"

/** Logo, book count, search in the member's own shelf, account menu (spec 1D §5.2). */
export function LobbyTopBar({
  user,
  books,
  onSelect,
  className,
}: {
  user: SessionUser
  books: ReadonlyArray<ShelfBook>
  onSelect: (book: ShelfBook) => void
  className?: string
}) {
  const searchId = useId()
  const [query, setQuery] = useState("")
  const q = query.trim().slice(0, MAX_QUERY_LENGTH)
  const results = q ? shelfBooks(books, { q }).slice(0, MAX_RESULTS) : []

  return (
    <header className={cn("lobby-topbar lobby-overlay", className)}>
      <Logo className="size-8" />
      <span className="font-heading text-lg font-bold">Glosa</span>
      <span className="text-sm text-muted-foreground">{books.length} buku</span>
      <div className="relative ml-auto w-72">
        <label htmlFor={searchId} className="sr-only">
          Cari di rakmu
        </label>
        <Input
          id={searchId}
          type="search"
          placeholder="Cari di rakmu"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {q && (
          <ul aria-label="Hasil pencarian" className="lobby-search-results">
            {results.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Tidak ada buku yang cocok.
              </li>
            ) : (
              results.map((book) => (
                <li key={book.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(book)
                      setQuery("")
                    }}
                  >
                    <span className="block truncate text-sm font-bold">
                      {book.title}
                    </span>
                    {book.author && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {book.author}
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <details className="lobby-account">
        <summary aria-label="Menu akun" className="lobby-avatar">
          {initials(user.displayName)}
        </summary>
        <div className="lobby-account-menu">
          <p className="px-3 py-1 text-sm">
            <b className="block">{user.displayName}</b>
            <span className="text-muted-foreground">@{user.username}</span>
          </p>
          <Link to="/settings">Pengaturan</Link>
          <Link to="/logout">Keluar</Link>
        </div>
      </details>
    </header>
  )
}
```

- [ ] **Step 5: Tulis `LibraryMap.tsx`**

```tsx
import type { CSSProperties } from "react"
import { Panel } from "@/components/ui/panel"
import type { HotspotModel } from "./lobby-data"
import { ATRIUM, type HotspotId, type Point2, spotOf } from "./scene/layout"

/**
 * Where a floor point lies on the map: the atrium seen from above, turned like
 * the isometric view, so the map is a diamond (left edge: the left wall).
 */
function onMap([x, z]: Point2): CSSProperties {
  return {
    left: `${50 + ((x - z) / (2 * ATRIUM.size)) * 100}%`,
    top: `${((x + z) / (2 * ATRIUM.size)) * 100}%`,
  }
}

const floorOf = (id: HotspotId): Point2 => {
  const [x, , z] = spotOf(id).label
  return [x, z]
}

/** A small plan of the lobby; tapping a place moves the camera there (spec 1D §5.2). */
export function LibraryMap({
  hotspots,
  anda,
  onSelect,
}: {
  hotspots: ReadonlyArray<HotspotModel>
  anda: Point2
  onSelect: (id: HotspotId) => void
}) {
  return (
    <Panel className="lobby-panel">
      <h2 className="lobby-panel-title">Peta Perpustakaan</h2>
      <div className="lobby-map">
        {hotspots.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            className="lobby-map-spot"
            data-kind={count === null ? "place" : "zone"}
            style={onMap(floorOf(id))}
            aria-label={`${label} di peta`}
            title={label}
            onClick={() => onSelect(id)}
          />
        ))}
        <span className="lobby-map-anda" style={onMap(anda)}>
          <span className="sr-only">Anda</span>
        </span>
      </div>
    </Panel>
  )
}
```

- [ ] **Step 6: Tulis `RecentBooks.tsx`**

```tsx
import { type LocalShelf, shelfPercentage } from "@/components/shelf/useLocalShelf"
import { Panel } from "@/components/ui/panel"
import type { ShelfBook } from "@/lib/book-types"

/** The last five books opened, with their progress (spec 1D §5.2). */
export function RecentBooks({
  books,
  local,
  onSelect,
}: {
  books: ReadonlyArray<ShelfBook>
  local: LocalShelf
  onSelect: (book: ShelfBook) => void
}) {
  if (books.length === 0) return null
  return (
    <Panel className="lobby-panel">
      <h2 className="lobby-panel-title">Baru Dibuka</h2>
      <ul className="space-y-1">
        {books.map((book) => (
          <li key={book.id}>
            <button
              type="button"
              className="w-full space-y-1 rounded-md px-2 py-1.5 text-left hover:bg-muted"
              onClick={() => onSelect(book)}
            >
              <span className="block truncate text-sm">{book.title}</span>
              <progress
                className="book-progress"
                max={100}
                value={shelfPercentage(book, local)}
                aria-label={`Progres ${book.title}`}
              />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
```

- [ ] **Step 7: Tulis `AdminDeskCard.tsx` dan `BookDetailPanel.tsx`**

`AdminDeskCard.tsx`:

```tsx
import { StorageMeter } from "@/components/shelf/StorageMeter"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/ui/panel"
import type { StorageUsage } from "@/lib/book-types"
import { useOnline } from "@/lib/use-online"

/** Upload and storage, beside the scene's admin desk (spec 1D §5.2). */
export function AdminDeskCard({
  usage,
  onUpload,
}: {
  usage: StorageUsage
  onUpload: () => void
}) {
  const online = useOnline()
  return (
    <Panel className="lobby-panel space-y-3">
      <h2 className="lobby-panel-title">Meja Admin</h2>
      <StorageMeter usage={usage} />
      <Button className="w-full" onClick={onUpload} disabled={!online}>
        Bawa buku
      </Button>
      {!online && <p className="text-xs text-stamp">Butuh internet.</p>}
    </Panel>
  )
}
```

`BookDetailPanel.tsx`:

```tsx
import { XIcon } from "lucide-react"
import { useId } from "react"
import { BookActions } from "@/components/shelf/BookActions"
import { BookCover } from "@/components/shelf/BookCover"
import { BookFacts } from "@/components/shelf/BookDetail"
import { ReadLink } from "@/components/shelf/ReadLink"
import { type LocalShelf, shelfPercentage } from "@/components/shelf/useLocalShelf"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/ui/panel"
import type { ShelfBook } from "@/lib/book-types"

/** The book picked from the search or "Baru Dibuka", beside the scene. */
export function BookDetailPanel({
  book,
  local,
  onClose,
  onChanged,
  onDeleted,
}: {
  book: ShelfBook
  local: LocalShelf
  onClose: () => void
  onChanged: () => void
  onDeleted: (book: ShelfBook) => void
}) {
  const titleId = useId()
  const percentage = shelfPercentage(book, local)
  return (
    <Panel
      role="region"
      aria-labelledby={titleId}
      className="lobby-panel space-y-3"
    >
      <div className="flex items-start gap-3">
        <BookCover book={book} className="w-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-heading text-lg leading-tight">
            {book.title}
          </h2>
          {book.author && (
            <p className="text-sm text-muted-foreground">{book.author}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Tutup detail"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
      <BookFacts book={book} percentage={percentage} />
      <ReadLink bookId={book.id} percentage={percentage} />
      <BookActions
        key={book.id}
        book={book}
        saved={local.saved.has(book.id)}
        onGenreSaved={onChanged}
        onDeleted={onDeleted}
      />
    </Panel>
  )
}
```

- [ ] **Step 8: Tambahkan CSS panel**

Tambahkan ke dalam `@layer components { … }` di `src/styles.css`:

```css
  /* Lobby panels (plan 1D, Task 9). */
  .lobby-panel {
    padding: 0.9rem 1rem;
  }
  .lobby-panel-title {
    margin-bottom: 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }
  .lobby-map {
    position: relative;
    aspect-ratio: 2 / 1;
  }
  .lobby-map::before {
    content: "";
    position: absolute;
    inset: 0;
    clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
    background: rgb(201 141 85 / 0.28);
  }
  .lobby-map-spot {
    position: absolute;
    width: 0.9rem;
    height: 0.9rem;
    translate: -50% -50%;
    border: 2px solid var(--background);
    border-radius: 9999px;
    background: #c98d55;
  }
  .lobby-map-spot[data-kind="place"] {
    background: #e9e3da;
  }
  .lobby-map-spot:hover,
  .lobby-map-spot:focus-visible {
    outline: 2px solid var(--color-mint);
    outline-offset: 2px;
  }
  .lobby-map-anda {
    position: absolute;
    width: 0.7rem;
    height: 0.7rem;
    translate: -50% -50%;
    border-radius: 9999px;
    background: #4fd8ff;
    box-shadow: 0 0 0 4px rgb(79 216 255 / 0.3);
  }
  .lobby-search-results {
    position: absolute;
    inset-inline: 0;
    top: calc(100% + 0.35rem);
    z-index: 20;
    max-height: 18rem;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--popover);
    padding: 0.25rem;
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.45);
  }
  .lobby-search-results button {
    display: block;
    width: 100%;
    border-radius: 0.5rem;
    padding: 0.45rem 0.6rem;
    text-align: left;
  }
  .lobby-search-results button:hover,
  .lobby-search-results button:focus-visible {
    background: var(--muted);
  }
  .lobby-account {
    position: relative;
  }
  .lobby-avatar {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 9999px;
    background: var(--primary);
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--primary-foreground);
    list-style: none;
    cursor: pointer;
  }
  .lobby-avatar::-webkit-details-marker {
    display: none;
  }
  .lobby-account-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 0.4rem);
    z-index: 20;
    display: grid;
    gap: 0.15rem;
    min-width: 12rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--popover);
    padding: 0.4rem;
  }
  .lobby-account-menu a {
    border-radius: 0.5rem;
    padding: 0.45rem 0.6rem;
    font-size: 0.875rem;
  }
  .lobby-account-menu a:hover {
    background: var(--muted);
  }
```

- [ ] **Step 9: Jalankan test dan verifikasi**

Run: `npx vitest run src/components/lobby src/components/shelf`
Expected: PASS.

Run: `npm run typecheck && npm run lint && npm test`
Expected: semua hijau.

- [ ] **Step 10: Commit**

```bash
npx prettier --write src/test/router.tsx src/components/shelf/BookDetail.tsx src/components/lobby
git add src/test/router.tsx src/components/shelf/BookDetail.tsx src/components/lobby src/styles.css
git commit -m "feat(lobby): desktop panels for search, map, book details, recent books and the admin desk"
```

---

### Task 10: Sheet HP, panel "Susun buku", gelembung, dan posisi "Anda"

**Files:**
- Create: `src/components/lobby/LobbyBubbles.tsx`, `LobbyBubbles.test.tsx`
- Create: `src/components/lobby/ContinueSheet.tsx`, `ContinueSheet.test.tsx`
- Create: `src/components/lobby/TrolleyPanel.tsx`, `TrolleyPanel.test.tsx`
- Create: `src/components/lobby/useAndaSpot.ts`, `useAndaSpot.test.ts`
- Modify: `src/styles.css` (class `lobby-sheet`, `lobby-bubble*`, `lobby-note`)

**Interfaces:**
- Consumes: `LibrarianBubble` (1A), `TrolleyGenrePicker` (1B), `BookFacts` (Task 9), `ANDA_START` dan `Point2` (Task 2).
- Produces:
  - `ReadingHint()` dan `LibrarianWelcome({ className? })`;
  - `ContinueSheet({ book, empty, local, onChanged, onDeleted })`;
  - `TrolleyPanel({ open, onOpenChange, books, onSaved })`;
  - `useAndaSpot(): [Point2, (spot: Point2) => void]`.

- [ ] **Step 1: Tulis test yang gagal**

`src/components/lobby/LobbyBubbles.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { renderWithRouter } from "@/test/router"
import { LibrarianWelcome, ReadingHint } from "./LobbyBubbles"

describe("lobby bubbles", () => {
  it("points to Rak Saya when no book has been read yet", async () => {
    renderWithRouter(<ReadingHint />)
    expect(
      await screen.findByText(/Belum ada buku yang dibaca/)
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Rak Saya" })).toHaveAttribute(
      "href",
      "/shelf"
    )
  })

  it("greets a member with an empty shelf and points to free EPUBs", () => {
    render(<LibrarianWelcome />)
    expect(
      screen.getByText("Rakmu masih kosong. Bawa buku pertamamu ke sini!")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Standard Ebooks" })
    ).toHaveAttribute("href", "https://standardebooks.org")
    expect(
      screen.getByRole("link", { name: "Project Gutenberg" })
    ).toHaveAttribute("href", "https://www.gutenberg.org")
  })
})
```

`src/components/lobby/ContinueSheet.test.tsx`:

```tsx
import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import { renderWithRouter } from "@/test/router"
import { ContinueSheet } from "./ContinueSheet"

const local = { saved: new Set<string>(), percentages: new Map<string, number>() }

function renderSheet(props: Partial<Parameters<typeof ContinueSheet>[0]>) {
  renderWithRouter(
    <ContinueSheet
      book={null}
      empty={false}
      local={local}
      onChanged={vi.fn()}
      onDeleted={vi.fn()}
      {...props}
    />
  )
}

describe("ContinueSheet", () => {
  it("offers the last book and its details", async () => {
    renderSheet({ book: sherlock })
    const sheet = await screen.findByRole("region", {
      name: "Lanjutkan membaca",
    })
    expect(sheet).toHaveTextContent(sherlock.title)
    expect(screen.getByRole("link", { name: "Mulai membaca" })).toHaveAttribute(
      "href",
      `/read/${sherlock.id}`
    )
    fireEvent.click(screen.getByRole("button", { name: "Detail" }))
    expect(sheet).toHaveTextContent("Twelve cases.")
    expect(
      screen.getByRole("button", { name: "Tutup detail" })
    ).toHaveAttribute("aria-expanded", "true")
  })

  it("points to Rak Saya before any book was read", async () => {
    renderSheet({ book: null })
    expect(
      await screen.findByText(/Belum ada buku yang dibaca/)
    ).toBeInTheDocument()
  })

  it("greets a member with an empty shelf", async () => {
    renderSheet({ empty: true })
    expect(
      await screen.findByText("Rakmu masih kosong. Bawa buku pertamamu ke sini!")
    ).toBeInTheDocument()
  })
})
```

`src/components/lobby/TrolleyPanel.test.tsx`:

```tsx
import { fireEvent, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import { renderWithRouter } from "@/test/router"
import { TrolleyPanel } from "./TrolleyPanel"

vi.mock("@/components/shelf/useSaveGenre", () => ({
  useSaveGenre: () => ({
    save: vi.fn(async () => ({ ok: true })),
    saving: false,
  }),
}))

const onTrolley = { ...sherlock, genre: null }

function renderPanel(books = [onTrolley]) {
  const onSaved = vi.fn()
  renderWithRouter(
    <TrolleyPanel open onOpenChange={vi.fn()} books={books} onSaved={onSaved} />
  )
  return onSaved
}

describe("TrolleyPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("gives a trolley book its shelf", async () => {
    const onSaved = renderPanel()
    const dialog = await screen.findByRole("dialog", { name: "Susun buku" })
    fireEvent.change(
      screen.getByLabelText(`Genre untuk ${sherlock.title}`),
      { target: { value: "fiksi_sastra" } }
    )
    expect(
      await screen.findByText("Dipindahkan ke Fiksi & Sastra.")
    ).toBeInTheDocument()
    expect(onSaved).toHaveBeenCalled()
    expect(dialog).toBeInTheDocument()
  })

  it("says when the trolley is empty", async () => {
    renderPanel([])
    expect(
      await screen.findByText("Troli kosong. Semua buku sudah punya rak.")
    ).toBeInTheDocument()
  })

  it("needs a connection to sort books", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    renderPanel()
    expect(await screen.findByText("Butuh internet.")).toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })
})
```

`src/components/lobby/useAndaSpot.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ANDA_START } from "./scene/layout"
import { useAndaSpot } from "./useAndaSpot"

describe("useAndaSpot", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it("starts at the entrance and remembers the last spot for the session", async () => {
    const first = renderHook(() => useAndaSpot())
    expect(first.result.current[0]).toEqual(ANDA_START)
    act(() => first.result.current[1]([19.5, 28.2]))
    expect(first.result.current[0]).toEqual([19.5, 28.2])
    first.unmount()

    const second = renderHook(() => useAndaSpot())
    await vi.waitFor(() =>
      expect(second.result.current[0]).toEqual([19.5, 28.2])
    )
  })

  it("ignores a broken saved spot", () => {
    sessionStorage.setItem("glosa:lobby-anda", "{oops")
    const { result } = renderHook(() => useAndaSpot())
    expect(result.current[0]).toEqual(ANDA_START)
  })
})
```

Run: `npx vitest run src/components/lobby/LobbyBubbles.test.tsx src/components/lobby/ContinueSheet.test.tsx src/components/lobby/TrolleyPanel.test.tsx src/components/lobby/useAndaSpot.test.ts`
Expected: FAIL, karena modulnya belum ada.

- [ ] **Step 2: Tulis `LobbyBubbles.tsx`**

```tsx
import { Link } from "@tanstack/react-router"
import { LibrarianBubble } from "@/components/auth/LibrarianBubble"
import { cn } from "@/lib/utils"

/** Shown at the reading table when no book has been opened yet (spec 1D §5.1). */
export function ReadingHint() {
  return (
    <output className="lobby-bubble">
      Belum ada buku yang dibaca.{" "}
      <Link to="/shelf" className="font-bold underline">
        Rak Saya
      </Link>
    </output>
  )
}

/** The librarian's greeting for a member without books (spec 1D §5.2). */
export function LibrarianWelcome({ className }: { className?: string }) {
  return (
    <div className={cn("lobby-bubble-stack", className)}>
      <LibrarianBubble>
        Rakmu masih kosong. Bawa buku pertamamu ke sini!
      </LibrarianBubble>
      <p className="lobby-note">
        Belum punya EPUB? Ambil yang legal dan gratis di{" "}
        <a href="https://standardebooks.org" target="_blank" rel="noreferrer">
          Standard Ebooks
        </a>{" "}
        atau{" "}
        <a href="https://www.gutenberg.org" target="_blank" rel="noreferrer">
          Project Gutenberg
        </a>
        .
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Tulis `ContinueSheet.tsx`**

```tsx
import { type ReactNode, useId, useState } from "react"
import { BookActions } from "@/components/shelf/BookActions"
import { BookCover } from "@/components/shelf/BookCover"
import { BookFacts } from "@/components/shelf/BookDetail"
import { ReadLink } from "@/components/shelf/ReadLink"
import { type LocalShelf, shelfPercentage } from "@/components/shelf/useLocalShelf"
import { Button } from "@/components/ui/button"
import type { ShelfBook } from "@/lib/book-types"
import { LibrarianWelcome, ReadingHint } from "./LobbyBubbles"

/**
 * The phone's bottom sheet (spec 1D §5.2): the last book, whose details open
 * in the sheet. On an empty shelf it holds the librarian's greeting, since the
 * admin desk is off screen in the phone's first view.
 */
export function ContinueSheet({
  book,
  empty,
  local,
  onChanged,
  onDeleted,
}: {
  book: ShelfBook | null
  empty: boolean
  local: LocalShelf
  onChanged: () => void
  onDeleted: (book: ShelfBook) => void
}) {
  const titleId = useId()
  const [open, setOpen] = useState(false)

  let content: ReactNode
  if (empty) {
    content = <LibrarianWelcome />
  } else if (!book) {
    content = <ReadingHint />
  } else {
    const percentage = shelfPercentage(book, local)
    content = (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <BookCover book={book} className="w-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{book.title}</p>
            {book.author && (
              <p className="truncate text-xs text-muted-foreground">
                {book.author}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? "Tutup detail" : "Detail"}
          </Button>
        </div>
        <ReadLink bookId={book.id} percentage={percentage} />
        {open && (
          <div className="max-h-[50dvh] space-y-3 overflow-y-auto">
            <BookFacts book={book} percentage={percentage} />
            <BookActions
              key={book.id}
              book={book}
              saved={local.saved.has(book.id)}
              onGenreSaved={onChanged}
              onDeleted={onDeleted}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <section aria-labelledby={titleId} className="lobby-sheet lobby-overlay">
      <h2 id={titleId} className="lobby-panel-title">
        Lanjutkan membaca
      </h2>
      {content}
    </section>
  )
}
```

- [ ] **Step 4: Tulis `TrolleyPanel.tsx`**

```tsx
import { useState } from "react"
import { BookCover } from "@/components/shelf/BookCover"
import { TrolleyGenrePicker } from "@/components/shelf/TrolleyGenrePicker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ShelfBook } from "@/lib/book-types"
import { genreLabel } from "@/lib/genre"
import { useOnline } from "@/lib/use-online"

/** "Susun buku": give each trolley book its shelf, from the lobby (spec 1D §5.1). */
export function TrolleyPanel({
  open,
  onOpenChange,
  books,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  books: ReadonlyArray<ShelfBook>
  onSaved: () => void
}) {
  const online = useOnline()
  const [notice, setNotice] = useState("")

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setNotice("")
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Susun buku</DialogTitle>
          <DialogDescription>
            Pilih rak untuk setiap buku di troli.
          </DialogDescription>
        </DialogHeader>
        {!online && <p className="text-sm text-stamp">Butuh internet.</p>}
        {books.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Troli kosong. Semua buku sudah punya rak.
          </p>
        ) : (
          <ul className="divide-y">
            {books.map((book) => (
              <li key={book.id} className="flex items-center gap-3 py-3">
                <BookCover book={book} className="w-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{book.title}</p>
                  {book.author && (
                    <p className="truncate text-xs text-muted-foreground">
                      {book.author}
                    </p>
                  )}
                </div>
                {online && (
                  <div className="w-44 shrink-0">
                    <TrolleyGenrePicker
                      book={book}
                      onSaved={(genre) => {
                        setNotice(`Dipindahkan ke ${genreLabel(genre)}.`)
                        onSaved()
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <output className="block min-h-5 text-sm text-mint">{notice}</output>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: Tulis `useAndaSpot.ts`**

```ts
import { useCallback, useEffect, useState } from "react"
import { ANDA_START, type Point2 } from "./scene/layout"

const ANDA_KEY = "glosa:lobby-anda"

const isSpot = (value: unknown): value is Point2 =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((n) => typeof n === "number" && Number.isFinite(n))

/**
 * Where "Anda" stands. Kept for the session, so a return to the lobby finds
 * them where they were (spec 1D §5.1). Read after mount, so the server render
 * stays the same.
 */
export function useAndaSpot(): [Point2, (spot: Point2) => void] {
  const [spot, setSpot] = useState<Point2>(ANDA_START)

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(ANDA_KEY) ?? "null")
      if (isSpot(saved)) setSpot(saved)
    } catch {
      // A broken or unreadable value: start at the entrance.
    }
  }, [])

  const move = useCallback((next: Point2) => {
    setSpot(next)
    try {
      sessionStorage.setItem(ANDA_KEY, JSON.stringify(next))
    } catch {
      // Storage can be off (private windows); the spot then lasts this visit.
    }
  }, [])

  return [spot, move]
}
```

- [ ] **Step 6: Tambahkan CSS sheet dan gelembung**

Tambahkan ke dalam `@layer components { … }` di `src/styles.css`:

```css
  /* Lobby: phone sheet and speech bubbles (plan 1D, Task 10). */
  .lobby-sheet {
    position: absolute;
    inset-inline: 0.5rem;
    bottom: 0.5rem;
    z-index: 10;
    border: 1px solid var(--border);
    border-radius: 1rem;
    background: var(--color-panel);
    padding: 0.75rem 0.9rem;
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.45);
    backdrop-filter: blur(8px);
  }
  @media (min-width: 1024px) {
    .lobby-sheet {
      display: none;
    }
  }
  .lobby-bubble {
    display: block;
    max-width: 15rem;
    border-radius: 0.75rem;
    background: #fffaf0;
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--color-sepia-ink);
    box-shadow: 0 6px 16px rgb(0 0 0 / 0.4);
  }
  .lobby-bubble a {
    color: var(--color-maroon);
  }
  .lobby-bubble-stack {
    display: grid;
    gap: 0.5rem;
    width: min(18rem, 70vw);
  }
  .lobby-note {
    border-radius: 0.6rem;
    background: var(--color-panel);
    padding: 0.5rem 0.7rem;
    font-size: 0.8rem;
    color: var(--muted-foreground);
  }
  .lobby-note a {
    color: var(--color-mint);
    text-decoration: underline;
  }
```

- [ ] **Step 7: Jalankan test dan verifikasi**

Run: `npx vitest run src/components/lobby`
Expected: PASS.

Run: `npm run typecheck && npm run lint && npm test`
Expected: semua hijau.

- [ ] **Step 8: Commit**

```bash
npx prettier --write src/components/lobby
git add src/components/lobby src/styles.css
git commit -m "feat(lobby): phone sheet, trolley sorting, speech bubbles and the remembered 'Anda' spot"
```

---

### Task 11: Halaman lobi dan E2E-nya

**Files:**
- Create: `src/components/shelf/ShelfLoadError.tsx`
- Create: `src/components/shelf/useShelfSnapshot.ts`
- Modify: `src/routes/_member/shelf.tsx` (pakai dua file di atas)
- Modify: `src/routes/_member/lobby.tsx` (tulis ulang)
- Modify: `src/styles.css` (tata letak `lobby-page`, `lobby-topbar`, `lobby-side`, `lobby-notices`)
- Modify: `playwright.config.ts` (WebGL dimatikan di proyek biasa; proyek `lobby-3d`)
- Modify: `e2e/helpers/books.ts` (`setGenre`, `markOpened`)
- Create: `e2e/lobby.spec.ts`
- Modify: `e2e/offline.spec.ts` (lobi offline)

**Interfaces:**
- Consumes: semua komponen lobi (Task 6–10), `loadShelf` (1C), `UploadPanel` (1B), `useLocalShelf` (1C).
- Produces:
  - route `/_member/lobby` (loader `loadShelf`);
  - `ShelfLoadError({ error })` dan `useShelfSnapshot(userId, books, usage, offline)`;
  - helper E2E `setGenre(bookId, genre)` dan `markOpened(bookId)`;
  - proyek Playwright `lobby-3d` (dipakai Task 12).

- [ ] **Step 1: Pindahkan error rak dan penyimpanan salinan ke file bersama**

`src/components/shelf/ShelfLoadError.tsx`:

```tsx
import { RouteError } from "@/components/RouteError"
import { Panel } from "@/components/ui/panel"
import { BookLoadError } from "@/lib/book-download"
import { bookMessage } from "@/lib/book-messages"

/** Rak Saya and the lobby, when the shelf cannot load (e.g. offline before it was ever saved). */
export function ShelfLoadError({ error }: { error: unknown }) {
  if (!(error instanceof BookLoadError)) return <RouteError error={error} />
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Panel className="w-full max-w-md p-6 text-center">
        <p role="alert" className="text-sm">
          {bookMessage(error.code)}
        </p>
      </Panel>
    </main>
  )
}
```

`src/components/shelf/useShelfSnapshot.ts`:

```ts
import { useEffect } from "react"
import type { ShelfBook, StorageUsage } from "@/lib/book-types"
import { saveShelfSnapshot } from "@/lib/local/shelf-snapshot"

/** What the shelf looked like online is what offline visits show (plan 1C, decision 2). */
export function useShelfSnapshot(
  userId: string,
  books: Array<ShelfBook>,
  usage: StorageUsage,
  offline: boolean
): void {
  useEffect(() => {
    if (offline) return
    saveShelfSnapshot(userId, { books, usage }).catch((error: unknown) =>
      console.error("saving the shelf snapshot failed", error)
    )
  }, [books, usage, offline, userId])
}
```

Di `src/routes/_member/shelf.tsx`:
- hapus fungsi `ShelfError`, lalu ganti `errorComponent: ShelfError` dengan `errorComponent: ShelfLoadError`;
- ganti `useEffect` "What this shelf looked like online…" dengan `useShelfSnapshot(user.id, books, usage, offline)`;
- tambahkan import `ShelfLoadError` dan `useShelfSnapshot`;
- hapus import yang tidak terpakai lagi: `Link`, `useEffect`, `RouteError`, `Panel`, `BookLoadError`, `bookMessage`, dan `saveShelfSnapshot`. Biarkan `npm run typecheck` menunjukkan sisanya.

Run: `npm run typecheck && npx vitest run src/components/shelf`
Expected: hijau.

- [ ] **Step 2: Tulis ulang `src/routes/_member/lobby.tsx`**

```tsx
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
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
import { ShelfLoadError } from "@/components/shelf/ShelfLoadError"
import { UploadPanel } from "@/components/shelf/UploadPanel"
import { useLocalShelf } from "@/components/shelf/useLocalShelf"
import { useShelfSnapshot } from "@/components/shelf/useShelfSnapshot"
import { Button } from "@/components/ui/button"
import type { ShelfBook } from "@/lib/book-types"
import { loadShelf } from "@/lib/shelf-loader"

export const Route = createFileRoute("/_member/lobby")({
  // Keep the value as the number 1 so the URL stays `?kembali=1` after validation.
  validateSearch: (search: Record<string, unknown>): { kembali?: 1 } => ({
    kembali: search.kembali === 1 || search.kembali === "1" ? 1 : undefined,
  }),
  // The same shelf as Rak Saya, so the lobby also opens offline (spec 1D §3.2).
  loader: ({ context }) => loadShelf(context.user.id),
  staleTime: 60_000,
  head: () => ({ meta: [{ title: "Lobi — Glosa" }] }),
  errorComponent: ShelfLoadError,
  component: LobbyPage,
})

function LobbyPage() {
  const { books, usage, offline } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const { kembali } = Route.useSearch()
  const navigate = useNavigate()
  const router = useRouter()
  const local = useLocalShelf()
  useShelfSnapshot(user.id, books, usage, offline)
  const summary = useMemo(() => summarizeLobby(books), [books])
  const hotspots = useMemo(() => lobbyHotspots(summary.counts), [summary])
  const [anda, moveAnda] = useAndaSpot()
  const sceneRef = useRef<LobbySceneHandle>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sorting, setSorting] = useState(false)
  const [readingHint, setReadingHint] = useState(false)
  const selected = books.find((book) => book.id === selectedId) ?? null
  const refresh = () => void router.invalidate()
  const onDeleted = (book: ShelfBook) => {
    if (book.id === selectedId) setSelectedId(null)
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

  const bubbles: Partial<Record<HotspotId, ReactNode>> = {}
  if (readingHint) bubbles["meja-baca"] = <ReadingHint />
  // Phones greet in the sheet instead: their first view leaves the desk out.
  if (books.length === 0) {
    bubbles["meja-admin"] = <LibrarianWelcome className="hidden lg:grid" />
  }

  return (
    <main className="lobby-page">
      <h1 className="sr-only">Lobi</h1>
      <LobbyScene
        ref={sceneRef}
        hotspots={hotspots}
        anda={anda}
        bubbles={bubbles}
        onActivate={activate}
      />
      <LobbyTopBar
        user={user}
        books={books}
        onSelect={(book) => setSelectedId(book.id)}
        className="hidden lg:flex"
      />
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
      <aside aria-label="Panel lobi" className="lobby-side lobby-overlay">
        <LibraryMap
          hotspots={hotspots}
          anda={anda}
          onSelect={(id) => sceneRef.current?.showSpot(id)}
        />
        {selected && (
          <BookDetailPanel
            book={selected}
            local={local}
            onClose={() => setSelectedId(null)}
            onChanged={refresh}
            onDeleted={onDeleted}
          />
        )}
        <RecentBooks
          books={summary.recent}
          local={local}
          onSelect={(book) => setSelectedId(book.id)}
        />
        <AdminDeskCard usage={usage} onUpload={() => setUploading(true)} />
      </aside>
      <ContinueSheet
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
      <UploadPanel open={uploading} onOpenChange={setUploading} usage={usage} />
      <TrolleyPanel
        open={sorting}
        onOpenChange={setSorting}
        books={summary.trolley}
        onSaved={refresh}
      />
    </main>
  )
}
```

- [ ] **Step 3: Tambahkan CSS tata letak lobi**

Tambahkan ke dalam `@layer components { … }` di `src/styles.css`:

```css
  /* Lobby page layout (plan 1D, Task 11): the scene fills the page and the
     panels float over it. */
  .lobby-page {
    position: relative;
    height: calc(100dvh - var(--tabbar-h));
    overflow: hidden;
  }
  .lobby-topbar {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    right: 21.5rem;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 1rem;
    background: var(--color-panel);
    padding: 0.5rem 0.75rem;
    backdrop-filter: blur(8px);
  }
  .lobby-side {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    bottom: 0.75rem;
    z-index: 10;
    display: none;
    width: 20rem;
    flex-direction: column;
    gap: 0.75rem;
    overflow-y: auto;
  }
  .lobby-notices {
    position: absolute;
    top: 0.75rem;
    left: 50%;
    z-index: 11;
    display: grid;
    gap: 0.5rem;
    width: min(28rem, calc(100% - 8rem));
    translate: -50% 0;
    pointer-events: none;
  }
  .lobby-notice {
    display: block;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--color-panel);
    padding: 0.5rem 0.9rem;
    font-size: 0.85rem;
  }
  .lobby-add {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 10;
  }
  @media (min-width: 1024px) {
    .lobby-page {
      height: 100dvh;
    }
    .lobby-side {
      display: flex;
    }
    .lobby-notices {
      top: 4.75rem;
      left: calc(50% - 10.75rem);
    }
  }
```

- [ ] **Step 4: Matikan WebGL di proyek E2E biasa, dan tambahkan proyek `lobby-3d`**

Di `playwright.config.ts`, tambahkan konstanta ini di bawah `PREVIEW_URL`:

```ts
// The lobby draws its 3D scene only in the "lobby-3d" project; elsewhere it
// shows the still image, so every test that passes through /lobby stays fast
// (plan 1D, decision 7).
const NO_WEBGL = { args: ["--disable-3d-apis"] }
// Chromium without a GPU draws WebGL with SwiftShader, on the CPU.
const SWIFTSHADER = {
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
}
const OWN_PROJECT = /(offline|lobby-3d)\.spec\.ts/
```

Ganti `projects` dengan:

```ts
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], launchOptions: NO_WEBGL },
      testIgnore: OWN_PROJECT,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], launchOptions: NO_WEBGL },
      testIgnore: OWN_PROJECT,
    },
    {
      name: "offline",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: PREVIEW_URL,
        launchOptions: NO_WEBGL,
      },
      testMatch: /offline\.spec\.ts/,
    },
    {
      name: "lobby-3d",
      use: { ...devices["Desktop Chrome"], launchOptions: SWIFTSHADER },
      testMatch: /lobby-3d\.spec\.ts/,
    },
  ],
```

- [ ] **Step 5: Tambahkan helper E2E**

Di `e2e/helpers/books.ts`:

```ts
export async function setGenre(bookId: string, genre: string): Promise<void> {
  const { error } = await admin()
    .from("books")
    .update({ genre, genre_source: "user" })
    .eq("id", bookId)
  if (error) throw error
}

/** Marks the book as opened just now, as the reader does online. */
export async function markOpened(bookId: string): Promise<void> {
  const { error } = await admin()
    .from("books")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", bookId)
  if (error) throw error
}
```

- [ ] **Step 6: Tulis `e2e/lobby.spec.ts`**

```ts
import { expect, test, type Page } from "@playwright/test"
import { SHERLOCK, markOpened, seedBook, setGenre } from "./helpers/books"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"

// These projects run without WebGL, so the lobby shows its still image (plan
// 1D, decision 7). On phones that image is cropped at the sides; hotspots are
// pressed with the keyboard, which reaches every one of them (spec 1D §6).

/** A signed-in member with The Adventures of Sherlock Holmes on the trolley. */
async function memberWithBook(page: Page): Promise<string> {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  return seedBook(await userIdOf(member.email))
}

async function openLobby(page: Page) {
  await page.goto("/lobby")
  await hydrated(page)
  return page.getByRole("region", { name: "Adegan lobi" })
}

test("zones count the books and open the shelf; the reading table opens the last book", async ({
  page,
}) => {
  const bookId = await memberWithBook(page)
  await setGenre(bookId, "misteri_thriller")
  await markOpened(bookId)

  const scene = await openLobby(page)
  await expect(scene).toHaveAttribute("data-quality", "diam")
  await expect(
    scene.getByRole("button", { name: "Fiksi & Sastra · 0 buku" })
  ).toBeAttached()
  await scene
    .getByRole("button", { name: "Meja Baca", exact: true })
    .press("Enter")
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}$`))

  const again = await openLobby(page)
  await again
    .getByRole("button", { name: "Misteri & Thriller · 1 buku" })
    .press("Enter")
  await expect(page).toHaveURL(/\/shelf\?genre=misteri_thriller$/)
  await expect(
    page.getByRole("button", { name: new RegExp(SHERLOCK.title) })
  ).toBeVisible()
})

test("trolley books get their shelf from the lobby", async ({ page }) => {
  await memberWithBook(page)
  const scene = await openLobby(page)
  await scene
    .getByRole("button", { name: "Troli Buku Baru · 1 buku" })
    .press("Enter")

  const dialog = page.getByRole("dialog", { name: "Susun buku" })
  await dialog
    .getByLabel(`Genre untuk ${SHERLOCK.title}`)
    .selectOption("fiksi_sastra")
  await expect(dialog.getByText("Dipindahkan ke Fiksi & Sastra.")).toBeVisible()
  await expect(
    dialog.getByText("Troli kosong. Semua buku sudah punya rak.")
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(
    scene.getByRole("button", { name: "Fiksi & Sastra · 1 buku" })
  ).toBeAttached()
  await expect(
    scene.getByRole("button", { name: "Troli Buku Baru", exact: true })
  ).toBeAttached()
})

test("a new member is greeted, and the admin desk opens the upload", async ({
  page,
}) => {
  await signInAndOnboard(page, await createConfirmedMember())
  await hydrated(page)
  await expect(
    page
      .getByText("Rakmu masih kosong. Bawa buku pertamamu ke sini!")
      .filter({ visible: true })
  ).toBeVisible()

  const scene = page.getByRole("region", { name: "Adegan lobi" })
  await scene
    .getByRole("button", { name: "Meja Baca", exact: true })
    .press("Enter")
  await expect(scene.getByText(/Belum ada buku yang dibaca/)).toBeAttached()
  await scene
    .getByRole("button", { name: "Meja Admin", exact: true })
    .press("Enter")
  await expect(
    page.getByRole("dialog", { name: "Bawa buku ke rak" })
  ).toBeVisible()
})

test("on desktop the search opens a book's details beside the scene", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "the panels are for desktop")
  const bookId = await memberWithBook(page)
  await openLobby(page)
  await page.getByLabel("Cari di rakmu").fill("sherlock")
  await page
    .getByRole("list", { name: "Hasil pencarian" })
    .getByRole("button", { name: new RegExp(SHERLOCK.title) })
    .click()
  const detail = page.getByRole("region", { name: SHERLOCK.title })
  await detail.getByRole("link", { name: "Mulai membaca" }).click()
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}$`))
})

test("on phones the sheet continues the last book and the tab bar leads to the shelf", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "the sheet and the tab bar are for phones")
  const bookId = await memberWithBook(page)
  await markOpened(bookId)
  await openLobby(page)

  const sheet = page.getByRole("region", { name: "Lanjutkan membaca" })
  await expect(sheet).toContainText(SHERLOCK.title)
  await sheet.getByRole("link", { name: "Mulai membaca" }).click()
  await expect(page).toHaveURL(new RegExp(`/read/${bookId}$`))

  await openLobby(page)
  await page
    .getByRole("navigation", { name: "Navigasi anggota" })
    .getByRole("link", { name: "Rak Saya" })
    .click()
  await expect(page).toHaveURL(/\/shelf$/)
})
```

- [ ] **Step 7: Tambahkan lobi offline ke `e2e/offline.spec.ts`**

Sebelum `expect(errors).toEqual([])` di akhir test, tambahkan:

```ts
  // The lobby opens offline too, from the same saved shelf (spec 1D §7).
  await page.goto("/lobby")
  await expect(
    page.getByText(
      "Kamu sedang offline. Rak ditampilkan dari salinan terakhir di perangkat ini."
    )
  ).toBeVisible()
  await expect(
    page
      .getByRole("region", { name: "Adegan lobi" })
      .getByRole("button", { name: "Troli Buku Baru · 1 buku" })
  ).toBeAttached()
```

- [ ] **Step 8: Verifikasi**

Run: `npm run typecheck && npm run lint && npm test`
Expected: semua hijau.

Run: `npx playwright test --project=desktop --project=mobile`
Expected: semua PASS, termasuk `lobby.spec.ts`, `auth.spec.ts` (heading "Lobi" di lobi baru berupa `sr-only`, dan "Selamat datang kembali" berupa `<output>`), `shelf.spec.ts`, `reader.spec.ts`, dan `scene.spec.ts`.

Run: `npx playwright test --project=offline`
Expected: PASS.

Lalu jalankan `npm run dev` dan buka `/lobby` di browser biasa (dengan GPU), di lebar desktop dan di 390 px (DevTools device mode):
- di desktop, adegan 3D muncul menggantikan poster, hotspot mengikuti kamera saat digeser, dan "Pusatkan" mengembalikan tampilan awal;
- Tab dari wilayah adegan berjalan Meja Baca → zona → Troli → Meja Admin, dan hotspot di luar layar membawa kamera kepadanya;
- tombol panah menggeser kamera saat wilayah adegan difokus;
- klik titik di Peta menggeser kamera;
- di 390 px, sheet "Lanjutkan membaca", tombol "+", dan tab bar tampil, sedangkan top bar dan kolom kanan tidak.

- [ ] **Step 9: Commit**

```bash
npx prettier --write src/routes/_member/lobby.tsx src/routes/_member/shelf.tsx src/components/shelf/ShelfLoadError.tsx src/components/shelf/useShelfSnapshot.ts playwright.config.ts e2e/helpers/books.ts e2e/lobby.spec.ts e2e/offline.spec.ts
git add src/routes/_member/lobby.tsx src/routes/_member/shelf.tsx src/components/shelf/ShelfLoadError.tsx src/components/shelf/useShelfSnapshot.ts src/styles.css playwright.config.ts e2e/helpers/books.ts e2e/lobby.spec.ts e2e/offline.spec.ts
git commit -m "feat(lobby): the 3D library lobby with hotspots, panels and a phone sheet"
```

---

### Task 12: E2E 3D — batas kamera, klik hotspot di kanvas, reduced motion

**Files:**
- Create: `e2e/lobby-3d.spec.ts`
- Modify: `.github/workflows/ci.yml` (`timeout-minutes`)

**Interfaces:**
- Consumes: proyek Playwright `lobby-3d` (Task 11), `window.__GLOSA_LOBBY_TEST__` (Task 8), class `lobby-overlay` (Task 8–11).

- [ ] **Step 1: Tulis `e2e/lobby-3d.spec.ts`**

```ts
import { expect, test, type Page } from "@playwright/test"
import sharp from "sharp"
import {
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
} from "./helpers/members"

// Real WebGL through SwiftShader: every frame is drawn on the CPU, so these
// tests are slow and run one at a time.
test.describe.configure({ mode: "serial" })

const sceneOf = (page: Page) =>
  page.getByRole("region", { name: "Adegan lobi" })

/** Pixels of the magenta void the test mode paints outside the map. */
async function voidPixels(page: Page): Promise<number> {
  const png = await page.screenshot({ timeout: 120_000 })
  const { data, info } = await sharp(png)
    .raw()
    .toBuffer({ resolveWithObject: true })
  let count = 0
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 200 && data[i + 1] < 60 && data[i + 2] > 200) count++
  }
  return count
}

async function drag(page: Page, dx: number, dy: number) {
  const box = await sceneOf(page).boundingBox()
  if (!box) throw new Error("the lobby scene has no box")
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx * box.width * 0.45, y + dy * box.height * 0.45, {
    steps: 2,
  })
  await page.mouse.up()
}

const DIRECTIONS = [
  ["kiri", 1, 0],
  ["kanan", -1, 0],
  ["atas", 0, 1],
  ["bawah", 0, -1],
  ["kiri atas", 1, 1],
  ["kiri bawah", 1, -1],
  ["kanan bawah", -1, -1],
  ["kanan atas", -1, 1],
] as const

test("the camera never shows anything outside the map", async ({ page }) => {
  test.setTimeout(900_000)
  await page.addInitScript(() =>
    Object.assign(window, { __GLOSA_LOBBY_TEST__: true })
  )
  await signInAndOnboard(page, await createConfirmedMember())
  await hydrated(page)
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute("data-quality", "diam")
  await expect(scene.locator("canvas")).toBeVisible({ timeout: 120_000 })
  // Only the canvas may show the void: hide the HTML laid over it.
  await page.addStyleTag({
    content: ".lobby-overlay { display: none !important; }",
  })

  // Desktop, a very wide screen (21:9) and a phone held upright.
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1680, height: 720 },
    { width: 390, height: 844 },
  ]) {
    const size = `${viewport.width}×${viewport.height}`
    await page.setViewportSize(viewport)
    const box = await scene.boundingBox()
    if (!box) throw new Error("the lobby scene has no box")
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    // Zoom out as far as it goes.
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 1500)
    const before = await page.screenshot({ timeout: 120_000 })
    for (const [direction, dx, dy] of DIRECTIONS) {
      for (let k = 0; k < 3; k++) await drag(page, dx, dy)
      expect(await voidPixels(page), `${size}, geser ke ${direction}`).toBe(0)
    }
    const after = await page.screenshot({ timeout: 120_000 })
    expect(after.equals(before), `${size}: the camera moved`).toBe(false)
  }
})

test("a hotspot on the 3D scene opens the upload", async ({ page }) => {
  test.setTimeout(300_000)
  await signInAndOnboard(page, await createConfirmedMember())
  const scene = sceneOf(page)
  await expect(scene.locator("canvas")).toBeVisible({ timeout: 120_000 })
  await scene.getByRole("button", { name: "Meja Admin", exact: true }).click()
  await expect(
    page.getByRole("dialog", { name: "Bawa buku ke rak" })
  ).toBeVisible()
})

test("with reduced motion the 3D lobby stays still", async ({ page }) => {
  test.setTimeout(300_000)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await signInAndOnboard(page, await createConfirmedMember())
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute("data-quality", "diam")
  await expect(scene.locator("canvas")).toBeVisible({ timeout: 120_000 })
})
```

- [ ] **Step 2: Jalankan dan pastikan lulus**

Run: `npx playwright test --project=lobby-3d`
Expected: 3 PASS. Test batas kamera bisa memakan 5–15 menit dengan SwiftShader.

Jika ada kebocoran, pesan `expect` menyebut ukuran layar dan arah geser. Perbaikannya ada di `clampView` (`projection.ts`): tambahkan kasus itu ke test unit di `projection.test.ts` lebih dulu, lalu perbaiki rumusnya. Jangan mengubah `ATRIUM.edge` atau `front` tanpa membicarakannya dengan pemilik proyek, karena keduanya ditentukan bersama di brainstorming.

- [ ] **Step 3: Beri CI waktu lebih**

Di `.github/workflows/ci.yml`, ubah `timeout-minutes: 30` menjadi `timeout-minutes: 50`. Proyek `lobby-3d` menggambar dengan CPU.

- [ ] **Step 4: Commit**

```bash
npx prettier --write e2e/lobby-3d.spec.ts
git add e2e/lobby-3d.spec.ts .github/workflows/ci.yml
git commit -m "test(e2e): the 3D lobby keeps its camera on the map, and its hotspots work"
```

---

### Task 13: Verifikasi akhir, anggaran, dan pemeriksaan manual

**Files:** tidak ada file baru. Task ini memeriksa anggaran spec §10, test lengkap, dan pemeriksaan manual.

- [ ] **Step 1: Build dan periksa precache**

Run: `npm run build`
Expected: baris `sw.js: N files precached (X MB), version …` dengan **X < 4.0**.

- [ ] **Step 2: Periksa ukuran dan isolasi chunk three.js**

Run:

```bash
node -e '
const fs = require("fs"), zlib = require("zlib"), dir = "dist/client/assets"
let total = 0
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
  const code = fs.readFileSync(`${dir}/${file}`)
  if (!code.includes("WebGLRenderer")) continue
  const size = zlib.gzipSync(code).length
  total += size
  console.log(file, (size / 1024).toFixed(1), "kB gzip")
}
console.log("three.js chunks:", (total / 1024).toFixed(1), "kB gzip")'
```

Expected:
- hanya chunk `stage-*.js` yang memuat `WebGLRenderer` (three.js tidak ikut di chunk lain);
- totalnya ≤ **250 kB** gzip.

Jika lebih dari 250 kB, laporkan angkanya ke pemilik proyek sebelum memangkas apa pun. Kandidat pangkasan: `RoomEnvironment` (diganti cahaya hemisfer saja) dan `UnrealBloomPass`.

- [ ] **Step 3: Jalankan semua pemeriksaan**

Run: `npm run lint && npm run check && npm run typecheck && npm test`
Expected: semua hijau.

Run: `npm run test:e2e`
Expected: semua proyek (`desktop`, `mobile`, `offline`, `lobby-3d`) PASS.

- [ ] **Step 4: Pemeriksaan manual oleh pemilik proyek**

Minta pemilik proyek melakukan langkah berikut, lalu catat hasilnya di pesan akhir:
1. **Performa (spec §9):**
   - buka `/lobby` di Chrome desktop;
   - di DevTools → Performance, setel CPU **4× slowdown** dan rekam ±10 detik;
   - setelah 3 detik, atribut `data-quality` di `<section aria-label="Adegan lobi">` harus menjadi `rendah` jika fps awal < 40, dan rata-rata fps di tingkat itu ≥ 40;
   - Performance juga tidak boleh menunjukkan *long task* > 50 ms selama animasi berjalan (spec §10).
2. **Tangkapan layar** lobi di desktop dan di lebar 390 px (DevTools device mode), dibandingkan dengan prototipe.
3. **Reduced motion:** di Windows, matikan *Animation effects* (Settings → Accessibility → Visual effects), lalu buka lobi: adegan diam, `data-quality="diam"`, dan "Anda" berpindah seketika saat hotspot diketuk.
4. **Halaman auth:** `/` dan `/login` memakai gambar lobi baru, dengan zoom ke Meja Admin.
5. **Android sungguhan** tetap menunggu deploy HTTPS di 1E.

- [ ] **Step 5: Selesaikan cabang**

Setelah semua di atas hijau, gunakan superpowers:finishing-a-development-branch.
