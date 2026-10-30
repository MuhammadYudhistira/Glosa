# Glosa Tahap 2C — Kenyamanan Baca: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reader Glosa lebih nyaman dipakai lama. Plan ini menambahkan enam hal:
- catatan kaki terbuka di popup;
- tombol **Kembali** setelah melompat;
- footer menunjukkan sisa waktu bab dan buku sesuai kecepatan baca member;
- setelan perataan, pemenggalan kata, dan dua halaman;
- layar tetap menyala selama buku terbuka.

**Architecture:**
- **Setelan.** `ReaderSettings` mendapat tiga kolom: `align`, `hyphenate`, dan `spread`.
  - Kolom baru tersimpan di `profiles.reader_settings` yang sudah ada.
  - `parseReaderSettings` mengisi default untuk setelan lama.
  - `readerCss` memasang perataan dan pemenggalan.
  - `applySettings` memasang `max-column-count` di paginator foliate.
- **Reader.**
  - `ReaderView` membaca alasan tiap `relocate` dari renderer foliate, sehingga bisa membedakan balik halaman dari lompatan. Ia juga meneruskan perkiraan waktu foliate (`time`).
  - Tautan di buku lewat event `link` foliate. Tautan catatan kaki dikenali dengan aturan `footnotes.js`, lalu isinya dibaca dari dokumen section dan ditampilkan sebagai teks di popup. Tautan lain dilaporkan sebagai lompatan.
- **Halaman reader.**
  - Mencatat tempat sebelum lompatan (daftar isi, tautan, panel anotasi, slider) untuk tombol Kembali, dan menghitung balik halaman sesudahnya.
  - `useReadingSpeed` mengukur kecepatan baca. Datanya disimpan di Dexie `meta`, hanya di perangkat.
  - `useWakeLock` menjaga layar tetap menyala.

**Tech Stack:** TanStack Start + Router, React 19, TypeScript, Tailwind CSS 4, Base UI (Popover, Dialog), Dexie 4, zod 4, foliate-js (`view.js`, `paginator.js`, `progress.js`; aturan dari `footnotes.js`), Screen Wake Lock API, Vitest + Testing Library (jsdom, `fake-indexeddb`), Playwright.

**Spec:** [`docs/superpowers/specs/2026-10-22-tahap-2-ketuk-kata-design.md`](../specs/2026-10-22-tahap-2-ketuk-kata-design.md) §2 (keputusan 11), §3 (2C), §4.4, §5, §6.1, §6.7, §10.

## Global Constraints

- **Bahasa:** teks UI berbahasa Indonesia, komentar kode berbahasa Inggris (mengikuti kode yang ada). Array ditulis `Array<T>`, seperti kode yang ada.
- **Dependensi:** tidak ada dependensi baru.
- **Server:** tidak ada tabel, migrasi, atau server function baru. Setelan baru masuk ke kolom `profiles.reader_settings` (jsonb) yang sudah ada, lewat `saveReaderSettingsFn` yang memvalidasi dengan `ReaderSettingsSchema`.
- **Breakpoint desktop:** `(min-width: 1024px)` (`useWideScreen()` di `src/lib/use-wide-screen.ts`).
- **Setelan (persis dari spec §4.4):**

  | Setelan | Nilai | Default |
  |---|---|---|
  | `align` | `start`, `justify` | `start` |
  | `hyphenate` | `boolean` | `true` |
  | `spread` | `auto`, `single` | `auto` |

- **Label setelan (persis dari spec §6.7):** *Rata kiri* / *Rata kiri-kanan*; *Otomatis* / *Satu halaman*. Pilihan dua halaman hanya tampil di layar ≥ 1024px dan mode halaman.
- **Kecepatan baca (persis dari spec §6.7):**
  - diukur dari halaman yang dibaca 5 detik sampai 10 menit;
  - rata-rata bergerak dari 50 halaman terakhir;
  - kecepatan default foliate dipakai sampai ada 10 halaman terukur;
  - hanya disimpan di perangkat (Dexie), tidak dikirim ke server.
- **Sisa waktu (teks dari spec, persis):** "±8 mnt lagi di bab ini".
- **Tombol Kembali (persis dari spec §6.7):**
  - muncul di kiri bawah setelah lompatan lewat daftar isi, tautan, anotasi, atau slider posisi;
  - hilang setelah dipakai atau setelah 5 kali balik halaman.
- **Layar menyala:** Wake Lock diminta saat reader terbuka dan tab terlihat, dilepas saat tab disembunyikan, dan diminta lagi saat tab terlihat. Bila browser menolak atau tidak mendukung, tidak ada pesan apa pun.
- **Line ending:** LF. Di Windows, jangan menulis file lewat Python tanpa `newline=''` dan encoding UTF-8 (`styles.css` memuat `§`).
- **E2E:**
  - Jalankan dengan `--workers=2`.
  - Kalau port 3000 dipegang aplikasi lain (cek `curl -sL localhost:3000/login | grep -o "<title>[^<]*"`), jalankan dengan config sementara di port 3100. Jangan matikan server lain.
  - Kegagalan tunggal dijalankan ulang sendirian sebelum disebut regresi.
  - Proyek Supabase dev dipakai bersama: test hanya menulis baris milik member test-nya sendiri.

## Keputusan dan penyimpangan dari spec

Semua keputusan berikut disengaja. Spec diperbarui mengikutinya di Task 8.

1. **Catatan kaki dikenali dengan aturan `footnotes.js`, tetapi isinya dibaca sendiri.** `FootnoteHandler` foliate menampilkan catatan di `foliate-view` kedua. View itu harus menempel di halaman supaya iframe-nya bisa dimuat, dan HTML buku ikut tampil di dalamnya. Fungsi pengenalnya tidak diekspor, jadi aturannya disalin ke `src/lib/epub/footnotes.ts` (lisensi MIT foliate-js).
   - Isi catatan diambil dari dokumen section (`createDocument`, sama seperti `canOpen`) dan ditampilkan sebagai paragraf teks di popup yang sama dengan popup arti.
   - HTML buku tidak pernah masuk ke halaman aplikasi.
2. **Isi catatan kaki dibatasi 2.000 karakter** dan diakhiri "…" bila terpotong. Tautan kembali ke teks (`backlink`) dibuang.
3. **Tautan catatan kaki yang isinya tidak bisa dibaca berperilaku seperti tautan biasa:** melompat, dan tombol Kembali muncul.
4. **Tombol Kembali mencatat tempat asalnya sendiri,** bukan memakai `history` foliate.
   - Yang dicatat adalah tempat sebelum lompatan **terakhir**.
   - Sumber lompatan hanya empat, sesuai spec: daftar isi, tautan biasa, panel anotasi, dan slider.
   - Yang bukan lompatan: membuka buku lewat `?cfi` dari Kosakata, *Lompat* di tawaran posisi perangkat lain, dan tombol Kembali sendiri.
5. **"Balik halaman" berarti `relocate` dengan alasan `page`, `snap`, atau `scroll` yang memindahkan tempat.** Di mode gulir, tiap kali guliran berhenti (foliate menunggu 250 ms) dihitung satu kali.
6. **Alasan `relocate` dibaca dari event `relocate` renderer foliate.**
   - Listener milik view foliate terpasang lebih dulu dan sudah mengisi `view.lastLocation`.
   - Listener reader dipasang sesudahnya, lalu membaca tempat dari `lastLocation` dan alasan dari event-nya.
   - Event `relocate` milik view tidak dipakai lagi oleh reader.
7. **Kecepatan baca memakai menit foliate.** foliate menghitung sisa waktu dengan 1.600 karakter file section per menit.
   - Satu halaman memberi satu sampel `{ expected, actual }`:
     - `expected`: turunnya `time.total` (dalam menit foliate) antara halaman itu muncul dan halaman berikutnya;
     - `actual`: menit yang benar-benar dipakai.
   - Rasio = Σ`actual` / Σ`expected` dari 50 sampel terakhir, atau 1 sebelum ada 10 sampel.
   - Sisa waktu yang ditampilkan = `time.section` (atau `time.total`) × rasio.
   - Sampel diabaikan bila halamannya dibaca mundur, `relocate` terjadi di tempat yang sama, atau tab sempat disembunyikan.
   - Sampel disimpan di tabel Dexie `meta`, kunci `reading-speed`, sehingga ikut terhapus saat member lain masuk di perangkat ini.
8. **Footer menampilkan "±8 mnt lagi di bab ini".** Sisa waktu buku ("±5 j lagi di buku") ditambahkan di baris yang sama hanya di layar ≥ 1024px, karena layar HP tidak cukup lebar. Format waktunya:
   - di bawah 1 menit: "<1 mnt";
   - di bawah 60 menit: "±N mnt";
   - 60 menit ke atas: "±H j M mnt", dengan bagian menit dihilangkan bila 0.
9. **Perataan dan pemenggalan tidak memakai `!important`.**
   - Aturannya `p, li, blockquote, dd { text-align: …; hyphens: … }`, seperti reader foliate sendiri.
   - Teks yang oleh bukunya sendiri dibuat rata tengah atau rata kanan lewat class tetap di tempatnya.
   - Atribut `lang` dokumen diisi foliate dari metadata buku, jadi `hyphens: auto` memakai bahasa buku.
10. **`spread` dipasang sebagai atribut `max-column-count` paginator:** `1` untuk *Satu halaman*, `2` untuk *Otomatis* (default foliate). Pilihannya disembunyikan di HP dan di mode gulir, tetapi nilainya tetap tersimpan.
11. **Wake Lock dipegang oleh hook `useWakeLock`.**
    - Kunci yang dilepas browser sendiri (event `release`) diminta lagi saat tab terlihat.
    - Permintaan yang ditolak tidak dilaporkan (spec §6.7), dengan komentar di kode.
12. **Popup catatan kaki ikut `popupOpen`.** Ia tertutup saat halaman pindah dan saat ruang kosong diketuk, dan menutup popup lain saat terbuka. Tautan tetap langkah pertama di urutan klik (§6.1).

## Struktur file

| File | Status | Tanggung jawab |
|---|---|---|
| `src/lib/reader-settings.ts` | Ubah | `align`, `hyphenate`, `spread`, label, CSS perataan |
| `src/lib/reader-settings.test.ts` | Ubah | Setelan baru dan setelan lama |
| `src/components/reader/ReaderSettingsPanel.tsx` | Ubah | Pilihan Perataan, Pemenggalan kata, Dua halaman |
| `src/components/reader/ReaderSettingsPanel.test.tsx` | Ubah | Pilihan baru |
| `src/lib/reading-speed.ts` | Baru | Sampel, rasio, format waktu |
| `src/lib/reading-speed.test.ts` | Baru | |
| `src/lib/local/reading-speed.ts` | Baru | Sampel di Dexie `meta` |
| `src/lib/local/reading-speed.test.ts` | Baru | |
| `src/lib/epub/footnotes.ts` | Baru | `isFootnoteLink`, `footnoteText` |
| `src/lib/epub/footnotes.test.ts` | Baru | |
| `src/lib/use-wake-lock.ts` | Baru | `useWakeLock` |
| `src/lib/use-wake-lock.test.ts` | Baru | |
| `src/components/reader/FootnotePopup.tsx` | Baru | Popup catatan kaki |
| `src/components/reader/FootnotePopup.test.tsx` | Baru | |
| `src/components/reader/ReaderBack.tsx` | Baru | Tombol Kembali |
| `src/components/reader/ReaderBack.test.tsx` | Baru | |
| `src/components/reader/ReaderFooter.tsx` | Ubah | Sisa waktu |
| `src/components/reader/ReaderFooter.test.tsx` | Ubah | Sisa waktu, fixture lokasi |
| `src/types/foliate-js.d.ts` | Ubah | `time`, `lastLocation` |
| `src/components/reader/ReaderView.tsx` | Ubah | Alasan relocate, waktu, tautan dan catatan kaki, `max-column-count` |
| `src/components/reader/useReadingSpeed.ts` | Baru | Mengukur kecepatan dari relocate |
| `src/components/reader/useReadingSpeed.test.tsx` | Baru | |
| `src/routes/_member/read.$bookId.tsx` | Ubah | Menyatukan semuanya |
| `src/styles.css` | Ubah | Tombol Kembali, popup catatan kaki |
| `e2e/helpers/epub.ts` | Ubah | `makeEpub` menerima isi bab |
| `e2e/helpers/books.ts` | Ubah | `seedBook` menerima file di memori |
| `e2e/comfort.spec.ts` | Baru | E2E 2C |
| `docs/superpowers/specs/2026-10-22-tahap-2-ketuk-kata-design.md` | Ubah | Keputusan di atas |

---

### Task 1: Setelan perataan, pemenggalan kata, dan dua halaman

**Files:**
- Modify: `src/lib/reader-settings.ts`
- Modify: `src/lib/reader-settings.test.ts`
- Modify: `src/components/reader/ReaderSettingsPanel.tsx`
- Modify: `src/components/reader/ReaderSettingsPanel.test.tsx`
- Modify: `src/components/reader/ReaderView.tsx` (hanya `applySettings`)

**Interfaces:**
- Produces:
  - `READER_ALIGNS`, `READER_SPREADS`, tipe `ReaderAlign` dan `ReaderSpread`;
  - kolom `align`, `hyphenate`, dan `spread` di `ReaderSettings`;
  - `ALIGN_LABELS` dan `SPREAD_LABELS`.

- [ ] **Step 1: Tulis test setelan yang gagal**

Di `src/lib/reader-settings.test.ts`, tambahkan di akhir `describe("parseReaderSettings", …)`:

```ts
  it("knows the 2C settings and defaults them for settings saved before", () => {
    expect(DEFAULT_READER_SETTINGS).toMatchObject({
      align: "start",
      hyphenate: true,
      spread: "auto",
    })
    expect(parseReaderSettings({ theme: "dark", fontSize: 120 })).toEqual({
      ...DEFAULT_READER_SETTINGS,
      theme: "dark",
      fontSize: 120,
    })
    expect(
      parseReaderSettings({ align: "justify", hyphenate: false, spread: "single" })
    ).toEqual({
      ...DEFAULT_READER_SETTINGS,
      align: "justify",
      hyphenate: false,
      spread: "single",
    })
    expect(
      parseReaderSettings({ align: "center", hyphenate: "yes", spread: 2 })
    ).toEqual(DEFAULT_READER_SETTINGS)
  })
```

dan di akhir `describe("readerCss", …)`:

```ts
  it("aligns and hyphenates paragraphs as chosen, without forcing it", () => {
    expect(readerCss(DEFAULT_READER_SETTINGS, fonts)).toContain(
      "p, li, blockquote, dd { text-align: start; -webkit-hyphens: auto; hyphens: auto; }"
    )
    expect(
      readerCss(
        { ...DEFAULT_READER_SETTINGS, align: "justify", hyphenate: false },
        fonts
      )
    ).toContain(
      "p, li, blockquote, dd { text-align: justify; -webkit-hyphens: manual; hyphens: manual; }"
    )
  })
```

- [ ] **Step 2: Tulis test panel yang gagal**

Ganti seluruh isi `src/components/reader/ReaderSettingsPanel.test.tsx` dengan:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_READER_SETTINGS } from "@/lib/reader-settings"
import { ReaderSettingsPanel } from "./ReaderSettingsPanel"

function renderPanel(settings = DEFAULT_READER_SETTINGS) {
  const onChange = vi.fn()
  render(
    <ReaderSettingsPanel
      open
      onOpenChange={() => undefined}
      settings={settings}
      onChange={onChange}
    />
  )
  return onChange
}

/** jsdom has no matchMedia: the screen is as wide as the test says. */
function stubWideScreen(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ReaderSettingsPanel", () => {
  it("changes the theme, font and layout", async () => {
    const onChange = renderPanel()
    await screen.findByRole("dialog", { name: "Tampilan" })

    fireEvent.click(screen.getByLabelText("Gelap"))
    expect(onChange).toHaveBeenLastCalledWith({ theme: "dark" })
    fireEvent.click(screen.getByLabelText("Ramah disleksia"))
    expect(onChange).toHaveBeenLastCalledWith({ font: "dyslexic" })
    fireEvent.click(screen.getByLabelText("Gulir"))
    expect(onChange).toHaveBeenLastCalledWith({ flow: "scrolled" })
    expect(screen.getByLabelText("Sepia")).toBeChecked()
  })

  it("steps the font size and line height within their limits", async () => {
    const onChange = renderPanel({ ...DEFAULT_READER_SETTINGS, fontSize: 200 })
    await screen.findByRole("dialog", { name: "Tampilan" })

    expect(
      screen.getByRole("button", { name: "Perbesar huruf" })
    ).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Perkecil huruf" }))
    expect(onChange).toHaveBeenLastCalledWith({ fontSize: 190 })
    fireEvent.click(screen.getByRole("button", { name: "Renggangkan baris" }))
    expect(onChange).toHaveBeenLastCalledWith({ lineHeight: 1.6 })
    expect(
      screen.getByRole("status", { name: "Ukuran huruf" })
    ).toHaveTextContent("200%")
  })

  it("changes the alignment and the hyphenation", async () => {
    const onChange = renderPanel()
    await screen.findByRole("dialog", { name: "Tampilan" })

    expect(screen.getByLabelText("Rata kiri")).toBeChecked()
    fireEvent.click(screen.getByLabelText("Rata kiri-kanan"))
    expect(onChange).toHaveBeenLastCalledWith({ align: "justify" })
    expect(screen.getByLabelText("Ya")).toBeChecked()
    fireEvent.click(screen.getByLabelText("Tidak"))
    expect(onChange).toHaveBeenLastCalledWith({ hyphenate: false })
  })

  it("offers two pages on a wide screen in the page layout only", async () => {
    stubWideScreen(true)
    const onChange = renderPanel()
    await screen.findByRole("dialog", { name: "Tampilan" })
    expect(screen.getByLabelText("Otomatis")).toBeChecked()
    fireEvent.click(screen.getByLabelText("Satu halaman"))
    expect(onChange).toHaveBeenLastCalledWith({ spread: "single" })

    cleanup()
    renderPanel({ ...DEFAULT_READER_SETTINGS, flow: "scrolled" })
    await screen.findByRole("dialog", { name: "Tampilan" })
    expect(screen.queryByLabelText("Satu halaman")).toBeNull()
  })

  it("does not offer two pages on a phone", async () => {
    stubWideScreen(false)
    renderPanel()
    await screen.findByRole("dialog", { name: "Tampilan" })
    expect(screen.queryByLabelText("Otomatis")).toBeNull()
  })
})
```

- [ ] **Step 3: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/reader-settings.test.ts src/components/reader/ReaderSettingsPanel.test.tsx`
Expected: FAIL. Default belum punya `align`, CSS tidak memuat `text-align`, dan label "Rata kiri" tidak ditemukan.

- [ ] **Step 4: Setelan baru di `reader-settings.ts`**

Di `src/lib/reader-settings.ts`:

Tepat di bawah `export const READER_FLOWS = …` tambahkan:

```ts
export const READER_ALIGNS = ["start", "justify"] as const
export const READER_SPREADS = ["auto", "single"] as const
```

Tepat di bawah `export type ReaderFlow = …` tambahkan:

```ts
export type ReaderAlign = (typeof READER_ALIGNS)[number]
export type ReaderSpread = (typeof READER_SPREADS)[number]
```

Ganti tipe `ReaderSettings`, `DEFAULT_READER_SETTINGS`, dan `ReaderSettingsSchema` dengan:

```ts
export type ReaderSettings = {
  font: ReaderFont
  /** Percent of the book's own size. */
  fontSize: number
  lineHeight: number
  margin: ReaderMargin
  theme: ReaderTheme
  flow: ReaderFlow
  align: ReaderAlign
  /** Words break at line ends, in the book's language. */
  hyphenate: boolean
  /** Two pages side by side when the screen is wide enough (`auto`), or always one. */
  spread: ReaderSpread
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  font: "serif",
  fontSize: 100,
  lineHeight: 1.5,
  margin: "normal",
  theme: "sepia",
  flow: "paginated",
  align: "start",
  hyphenate: true,
  spread: "auto",
}

export const ReaderSettingsSchema = z.object({
  font: z.enum(READER_FONTS),
  fontSize: z
    .number()
    .int()
    .min(FONT_SIZE.min)
    .max(FONT_SIZE.max)
    .refine((value) => value % FONT_SIZE.step === 0),
  lineHeight: z
    .number()
    .min(LINE_HEIGHT.min)
    .max(LINE_HEIGHT.max)
    .refine((value) => Math.abs(value * 10 - Math.round(value * 10)) < 1e-9),
  margin: z.enum(READER_MARGINS),
  theme: z.enum(READER_THEMES),
  flow: z.enum(READER_FLOWS),
  align: z.enum(READER_ALIGNS),
  hyphenate: z.boolean(),
  spread: z.enum(READER_SPREADS),
})
```

Tepat di bawah `FLOW_LABELS` tambahkan:

```ts
export const ALIGN_LABELS: Record<ReaderAlign, string> = {
  start: "Rata kiri",
  justify: "Rata kiri-kanan",
}
export const SPREAD_LABELS: Record<ReaderSpread, string> = {
  auto: "Otomatis",
  single: "Satu halaman",
}
```

Di `readerCss`, tepat di bawah `const face = fonts[settings.font]` tambahkan:

```ts
  const hyphens = settings.hyphenate ? "auto" : "manual"
```

Lalu tepat di bawah baris `` `p, li, blockquote, dd, dt, td, th { line-height: … }`, `` tambahkan:

```ts
    // Not forced: a book's own centred or right-aligned text keeps its place
    // (plan 2C, decision 9). foliate gives each section the book's language.
    `p, li, blockquote, dd { text-align: ${settings.align}; -webkit-hyphens: ${hyphens}; hyphens: ${hyphens}; }`,
```

- [ ] **Step 5: Pilihan baru di panel**

Di `src/components/reader/ReaderSettingsPanel.tsx`:

Ganti blok import dari `@/lib/reader-settings` dengan:

```tsx
import {
  ALIGN_LABELS,
  FLOW_LABELS,
  FONT_LABELS,
  FONT_SIZE,
  LINE_HEIGHT,
  MARGIN_LABELS,
  READER_ALIGNS,
  READER_FLOWS,
  READER_FONTS,
  READER_MARGINS,
  READER_SPREADS,
  READER_THEMES,
  type ReaderSettings,
  SPREAD_LABELS,
  THEME_LABELS,
  stepFontSize,
  stepLineHeight,
} from "@/lib/reader-settings"
import { useWideScreen } from "@/lib/use-wide-screen"

const HYPHENATE_CHOICES = ["on", "off"] as const
const HYPHENATE_LABELS: Record<(typeof HYPHENATE_CHOICES)[number], string> = {
  on: "Ya",
  off: "Tidak",
}
```

Di awal badan `ReaderSettingsPanel` (sebelum `return`) tambahkan:

```tsx
  const wide = useWideScreen()
```

Tepat setelah `ChoiceGroup` "Tata letak" (sebelum `</div>` penutup `space-y-4`) tambahkan:

```tsx
          <ChoiceGroup
            legend="Perataan"
            name="reader-align"
            options={READER_ALIGNS}
            labels={ALIGN_LABELS}
            value={settings.align}
            onChange={(align) => onChange({ align })}
          />
          <ChoiceGroup
            legend="Pemenggalan kata"
            name="reader-hyphenate"
            options={HYPHENATE_CHOICES}
            labels={HYPHENATE_LABELS}
            value={settings.hyphenate ? "on" : "off"}
            onChange={(choice) => onChange({ hyphenate: choice === "on" })}
          />
          {/* Two pages need a wide screen and pages (spec 2 §6.7). */}
          {wide && settings.flow === "paginated" && (
            <ChoiceGroup
              legend="Dua halaman"
              name="reader-spread"
              options={READER_SPREADS}
              labels={SPREAD_LABELS}
              value={settings.spread}
              onChange={(spread) => onChange({ spread })}
            />
          )}
```

- [ ] **Step 6: Paginator mengikuti `spread`**

Di `src/components/reader/ReaderView.tsx`, di `applySettings`, tepat di bawah `renderer.setAttribute("max-inline-size", MAX_LINE_LENGTH)` tambahkan:

```ts
  // foliate shows two columns when the page is wide enough; "single" keeps
  // one (plan 2C, decision 10).
  renderer.setAttribute(
    "max-column-count",
    settings.spread === "single" ? "1" : "2"
  )
```

- [ ] **Step 7: Jalankan test, pastikan lulus**

Run: `npx vitest run src/lib/reader-settings.test.ts src/components/reader/ReaderSettingsPanel.test.tsx src/components/reader/useReaderSettings.test.tsx src/lib/reader-settings-cache.test.ts`
Expected: PASS.

Kalau `useReaderSettings.test.tsx` atau `reader-settings-cache.test.ts` gagal karena membandingkan objek setelan lengkap yang ditulis manual, tambahkan `align: "start", hyphenate: true, spread: "auto"` ke objek itu, atau ganti dengan `...DEFAULT_READER_SETTINGS`. Jangan ubah perilakunya.

- [ ] **Step 8: Typecheck, lint, format**

Run: `npm run typecheck && npm run lint && npm run check`
Expected: bersih. Fixture lain yang menulis `ReaderSettings` lengkap juga harus mendapat tiga kolom baru, dan typecheck akan menunjukkannya.

- [ ] **Step 9: Commit**

```bash
git add src/lib/reader-settings.ts src/lib/reader-settings.test.ts src/components/reader/ReaderSettingsPanel.tsx src/components/reader/ReaderSettingsPanel.test.tsx src/components/reader/ReaderView.tsx
git commit -m "feat(reader): alignment, hyphenation and two pages in the display settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Tambahkan file test lain yang ikut diubah di Step 7 atau 8.)

---

### Task 2: Kecepatan baca

**Files:**
- Create: `src/lib/reading-speed.ts`
- Create: `src/lib/reading-speed.test.ts`
- Create: `src/lib/local/reading-speed.ts`
- Create: `src/lib/local/reading-speed.test.ts`

**Interfaces:**
- Produces (dipakai Task 5 dan 7):
  - `type SpeedSample = { expected: number; actual: number }` (menit);
  - `type SpeedMark = { at: number; minutesLeft: number }`;
  - `PAGE_MS`, `SPEED_SAMPLES`, `MIN_SPEED_SAMPLES`;
  - `pageSample(from: SpeedMark, to: SpeedMark): SpeedSample | null`;
  - `addSample(samples: ReadonlyArray<SpeedSample>, sample: SpeedSample): Array<SpeedSample>`;
  - `speedRatio(samples: ReadonlyArray<SpeedSample>): number`;
  - `formatDuration(minutes: number): string`;
  - `parseSamples(value: unknown): Array<SpeedSample>`;
  - `loadSpeedSamples(): Promise<Array<SpeedSample>>`;
  - `saveSpeedSamples(samples: ReadonlyArray<SpeedSample>): Promise<void>`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/reading-speed.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  PAGE_MS,
  SPEED_SAMPLES,
  addSample,
  formatDuration,
  pageSample,
  parseSamples,
  speedRatio,
} from "./reading-speed"

const mark = (at: number, minutesLeft: number) => ({ at, minutesLeft })
const sample = (expected: number, actual: number) => ({ expected, actual })

describe("pageSample", () => {
  it("measures a page read forwards, in foliate's minutes and real ones", () => {
    expect(pageSample(mark(0, 5), mark(60_000, 4))).toEqual(sample(1, 1))
    expect(pageSample(mark(0, 5), mark(PAGE_MS.min, 4.5))).toEqual(
      sample(0.5, PAGE_MS.min / 60_000)
    )
    expect(pageSample(mark(0, 5), mark(PAGE_MS.max, 4))).toEqual(sample(1, 10))
  })

  it("ignores pages skimmed, left open, read backwards or not left", () => {
    expect(pageSample(mark(0, 5), mark(PAGE_MS.min - 1, 4))).toBeNull()
    expect(pageSample(mark(0, 5), mark(PAGE_MS.max + 1, 4))).toBeNull()
    expect(pageSample(mark(0, 4), mark(60_000, 5))).toBeNull()
    expect(pageSample(mark(0, 4), mark(60_000, 4))).toBeNull()
  })
})

describe("speedRatio", () => {
  it("keeps foliate's speed until ten pages are measured", () => {
    expect(speedRatio([])).toBe(1)
    expect(speedRatio(Array.from({ length: 9 }, () => sample(1, 3)))).toBe(1)
  })

  it("compares the time taken with foliate's over the pages kept", () => {
    const slow = Array.from({ length: 10 }, () => sample(1, 2))
    expect(speedRatio(slow)).toBe(2)
    expect(speedRatio([...slow, sample(10, 0)])).toBeCloseTo(20 / 20)
  })
})

describe("addSample", () => {
  it("keeps the newest pages only", () => {
    let samples = Array.from({ length: SPEED_SAMPLES }, (_, index) =>
      sample(1, index + 1)
    )
    samples = addSample(samples, sample(1, 99))
    expect(samples).toHaveLength(SPEED_SAMPLES)
    expect(samples[0]).toEqual(sample(1, 2))
    expect(samples.at(-1)).toEqual(sample(1, 99))
  })
})

describe("formatDuration", () => {
  it("says minutes, then hours and minutes", () => {
    expect(formatDuration(0.4)).toBe("<1 mnt")
    expect(formatDuration(0.6)).toBe("±1 mnt")
    expect(formatDuration(8.4)).toBe("±8 mnt")
    expect(formatDuration(59.6)).toBe("±1 j")
    expect(formatDuration(80)).toBe("±1 j 20 mnt")
    expect(formatDuration(120)).toBe("±2 j")
  })
})

describe("parseSamples", () => {
  it("keeps the valid samples of what was stored, the newest ones", () => {
    expect(parseSamples(undefined)).toEqual([])
    expect(parseSamples("fast")).toEqual([])
    expect(
      parseSamples([
        sample(1, 2),
        null,
        { expected: "1", actual: 2 },
        sample(0, 2),
        sample(1, Number.POSITIVE_INFINITY),
        sample(2, 1),
      ])
    ).toEqual([sample(1, 2), sample(2, 1)])
    expect(
      parseSamples(Array.from({ length: 60 }, () => sample(1, 1)))
    ).toHaveLength(SPEED_SAMPLES)
  })
})
```

Buat `src/lib/local/reading-speed.test.ts`:

```ts
// @vitest-environment node
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import { localDb } from "./db"
import { loadSpeedSamples, saveSpeedSamples } from "./reading-speed"

beforeEach(async () => {
  await localDb().meta.clear()
})

describe("reading speed on this device", () => {
  it("is empty at first and keeps what was saved", async () => {
    expect(await loadSpeedSamples()).toEqual([])
    await saveSpeedSamples([{ expected: 1, actual: 2 }])
    expect(await loadSpeedSamples()).toEqual([{ expected: 1, actual: 2 }])
  })

  it("drops a stored value it cannot read", async () => {
    await localDb().meta.put({ key: "reading-speed", value: { fast: true } })
    expect(await loadSpeedSamples()).toEqual([])
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/reading-speed.test.ts src/lib/local/reading-speed.test.ts`
Expected: FAIL, karena modulnya belum ada.

- [ ] **Step 3: Tulis `src/lib/reading-speed.ts`**

```ts
/**
 * How fast this member reads, against foliate's own estimate (spec 2 §6.7).
 * foliate counts 1,600 characters of a section's file as a minute; a page
 * took `actual` minutes where foliate expected `expected` (plan 2C,
 * decision 7).
 */
export type SpeedSample = { expected: number; actual: number }

/** When a place showed, and foliate's minutes left in the book from it. */
export type SpeedMark = { at: number; minutesLeft: number }

/** Pages read faster or slower than this were skimmed or left open. */
export const PAGE_MS = { min: 5_000, max: 600_000 } as const
/** The moving average spans this many pages. */
export const SPEED_SAMPLES = 50
/** foliate's own speed counts until this many pages are measured. */
export const MIN_SPEED_SAMPLES = 10

const MINUTE_MS = 60_000

/** The page read between two marks, or null when it says nothing of speed. */
export function pageSample(from: SpeedMark, to: SpeedMark): SpeedSample | null {
  const expected = from.minutesLeft - to.minutesLeft
  const ms = to.at - from.at
  // Backwards, the same place, or read too fast or too slowly to count.
  if (!(expected > 0) || ms < PAGE_MS.min || ms > PAGE_MS.max) return null
  return { expected, actual: ms / MINUTE_MS }
}

export function addSample(
  samples: ReadonlyArray<SpeedSample>,
  sample: SpeedSample
): Array<SpeedSample> {
  return [...samples, sample].slice(-SPEED_SAMPLES)
}

/**
 * The member's minutes per minute of foliate's: above 1 reads slower. 1
 * until enough pages are measured.
 */
export function speedRatio(samples: ReadonlyArray<SpeedSample>): number {
  if (samples.length < MIN_SPEED_SAMPLES) return 1
  let expected = 0
  let actual = 0
  for (const sample of samples) {
    expected += sample.expected
    actual += sample.actual
  }
  return expected > 0 ? actual / expected : 1
}

/** "<1 mnt", "±8 mnt", "±1 j 20 mnt" (plan 2C, decision 8). */
export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes)
  if (rounded < 1) return "<1 mnt"
  if (rounded < 60) return `±${rounded} mnt`
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  return rest === 0 ? `±${hours} j` : `±${hours} j ${rest} mnt`
}

const isSample = (value: unknown): value is SpeedSample => {
  if (typeof value !== "object" || value === null) return false
  const { expected, actual } = value as Record<string, unknown>
  return (
    typeof expected === "number" &&
    typeof actual === "number" &&
    Number.isFinite(expected) &&
    Number.isFinite(actual) &&
    expected > 0 &&
    actual > 0
  )
}

/** The valid samples of a stored value, the newest ones: it may be old or broken. */
export function parseSamples(value: unknown): Array<SpeedSample> {
  return Array.isArray(value)
    ? value.filter(isSample).slice(-SPEED_SAMPLES)
    : []
}
```

- [ ] **Step 4: Tulis `src/lib/local/reading-speed.ts`**

```ts
import { type SpeedSample, parseSamples } from "@/lib/reading-speed"
import { localDb } from "./db"

/**
 * This device's reading speed (spec 2 §4.4): never sent to the server, and
 * cleared with the rest of `meta` when another member signs in here.
 */
const SPEED_KEY = "reading-speed"

export async function loadSpeedSamples(): Promise<Array<SpeedSample>> {
  const row = await localDb().meta.get(SPEED_KEY)
  return parseSamples(row?.value)
}

export async function saveSpeedSamples(
  samples: ReadonlyArray<SpeedSample>
): Promise<void> {
  await localDb().meta.put({ key: SPEED_KEY, value: [...samples] })
}
```

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run: `npx vitest run src/lib/reading-speed.test.ts src/lib/local/reading-speed.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck, lint, format**

Run: `npm run typecheck && npm run lint && npm run check`
Expected: bersih.

- [ ] **Step 7: Commit**

```bash
git add src/lib/reading-speed.ts src/lib/reading-speed.test.ts src/lib/local/reading-speed.ts src/lib/local/reading-speed.test.ts
git commit -m "feat(reader): this device learns how fast its member reads

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Catatan kaki — mengenali tautan dan membaca isinya

**Files:**
- Create: `src/lib/epub/footnotes.ts`
- Create: `src/lib/epub/footnotes.test.ts`

**Interfaces:**
- Produces (dipakai Task 6):
  - `isFootnoteLink(a: Element): boolean`;
  - `footnoteText(target: Element): Array<string> | null`;
  - `FOOTNOTE_MAX_LENGTH = 2000`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/epub/footnotes.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { FOOTNOTE_MAX_LENGTH, footnoteText, isFootnoteLink } from "./footnotes"

/** A section as EPUB has it: XHTML, with the epub: namespace. */
const xhtml = (body: string) =>
  new DOMParser().parseFromString(
    `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body>${body}</body></html>`,
    "application/xhtml+xml"
  )

const element = (doc: Document, id: string) => {
  const found = doc.getElementById(id)
  if (!found) throw new Error(`no #${id}`)
  return found
}

describe("isFootnoteLink", () => {
  it("knows links marked as notes", () => {
    const doc = xhtml(
      '<p><a id="type" epub:type="noteref" href="#n1">1</a><a id="role" role="doc-noteref" href="#n2">2</a><a id="gloss" epub:type="glossref" href="#g">g</a></p>'
    )
    expect(isFootnoteLink(element(doc, "type"))).toBe(true)
    expect(isFootnoteLink(element(doc, "role"))).toBe(true)
    expect(isFootnoteLink(element(doc, "gloss"))).toBe(true)
  })

  it("knows unmarked notes by their raised number", () => {
    const doc = xhtml(
      '<p><sup><a id="inside" href="#n1">1</a></sup><a id="around" href="#n2"><sup>2</sup></a></p>'
    )
    expect(isFootnoteLink(element(doc, "inside"))).toBe(true)
    expect(isFootnoteLink(element(doc, "around"))).toBe(true)
  })

  it("leaves other links and links back to the text alone", () => {
    const doc = xhtml(
      '<p><a id="plain" href="bab2.xhtml">Bab 2</a><sup><a id="back" epub:type="backlink" href="#r1">↩</a></sup></p>'
    )
    expect(isFootnoteLink(element(doc, "plain"))).toBe(false)
    expect(isFootnoteLink(element(doc, "back"))).toBe(false)
  })
})

describe("footnoteText", () => {
  it("reads a note's paragraphs without its link back", () => {
    const doc = xhtml(
      '<aside epub:type="footnote" id="n1"><p>Satu <em>dua</em>.</p><p>Tiga <a epub:type="backlink" href="#r1">↩</a></p></aside>'
    )
    expect(footnoteText(element(doc, "n1"))).toEqual(["Satu dua.", "Tiga"])
  })

  it("takes the block around a target inside it", () => {
    const doc = xhtml('<p><a id="n2"/>2. Isi   catatan\n kedua.</p>')
    expect(footnoteText(element(doc, "n2"))).toEqual(["2. Isi catatan kedua."])
  })

  it("takes the next block when the target stands alone", () => {
    const doc = xhtml('<a id="n3"/><p>Catatan tiga.</p>')
    expect(footnoteText(element(doc, "n3"))).toEqual(["Catatan tiga."])
  })

  it("has nothing for a note without text", () => {
    const doc = xhtml('<p id="n4">   </p>')
    expect(footnoteText(element(doc, "n4"))).toBeNull()
  })

  it("stops a long note", () => {
    const doc = xhtml(`<p id="n5">${"x".repeat(FOOTNOTE_MAX_LENGTH + 500)}</p>`)
    const [text] = footnoteText(element(doc, "n5")) ?? []
    expect(text).toHaveLength(FOOTNOTE_MAX_LENGTH + 1)
    expect(text.endsWith("…")).toBe(true)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/epub/footnotes.test.ts`
Expected: FAIL, karena modulnya belum ada.

- [ ] **Step 3: Tulis `src/lib/epub/footnotes.ts`**

```ts
/**
 * Footnotes (spec 2 §6.7). Which links point at a note follows foliate-js's
 * footnotes.js (MIT), which does not export its test. The note's text is
 * read here, so the book's own markup never enters the app's page (plan 2C,
 * decision 1).
 */

const OPS = "http://www.idpf.org/2007/ops"
const REF_TYPES = ["biblioref", "glossref", "noteref"]
const REF_ROLES = ["doc-biblioref", "doc-glossref", "doc-noteref"]
const INLINE = "a, span, sup, sub, em, strong, i, b, small, big"
const BLOCKS = "p, div, li, blockquote, dd, dt, aside, section"

/** A note shown in the popup stops after this many characters (plan 2C, decision 2). */
export const FOOTNOTE_MAX_LENGTH = 2000

const wordsOf = (value: string | null) =>
  new Set(value?.split(/\s+/).filter(Boolean) ?? [])
// XHTML has epub:type in its namespace; a section parsed as HTML has it as a name.
const typesOf = (el: Element) =>
  wordsOf(el.getAttributeNS(OPS, "type") ?? el.getAttribute("epub:type"))
const rolesOf = (el: Element) => wordsOf(el.getAttribute("role"))
const isBacklink = (a: Element) =>
  typesOf(a).has("backlink") || rolesOf(a).has("doc-backlink")

function isRaised(el: Element | null): boolean {
  if (!el) return false
  if (el.matches("sup")) return true
  const align =
    el.ownerDocument.defaultView?.getComputedStyle(el).verticalAlign ?? ""
  return (
    align === "super" ||
    align === "top" ||
    align === "text-top" ||
    /^\d/.test(align)
  )
}

/** Whether a link points at a note rather than at another place to read. */
export function isFootnoteLink(a: Element): boolean {
  const types = typesOf(a)
  const roles = rolesOf(a)
  if (
    REF_ROLES.some((role) => roles.has(role)) ||
    REF_TYPES.some((type) => types.has(type))
  )
    return true
  if (isBacklink(a)) return false
  // Unmarked notes: a raised number, as most books set them.
  return (
    isRaised(a) ||
    (a.children.length === 1 && isRaised(a.children[0])) ||
    isRaised(a.parentElement)
  )
}

/** The note a link's target belongs to: the target, or the block around it. */
function noteOf(target: Element): Element | null {
  let note = target
  while (note.matches(INLINE) && note.parentElement)
    note = note.parentElement
  if (note !== note.ownerDocument.body) return note
  // A bare anchor before its note.
  const next = target.nextElementSibling
  return next && !next.matches(INLINE) ? next : null
}

const clean = (text: string) => text.replace(/\s+/g, " ").trim()

/** The note's paragraphs, without its links back to the text; null when it has no text. */
export function footnoteText(target: Element): Array<string> | null {
  const note = noteOf(target)
  if (!note) return null
  const copy = note.cloneNode(true) as Element
  for (const a of copy.querySelectorAll("a")) if (isBacklink(a)) a.remove()
  // The innermost blocks are the paragraphs; a note without blocks is one.
  const blocks = [...copy.querySelectorAll(BLOCKS)].filter(
    (block) => !block.querySelector(BLOCKS)
  )
  const parts = (blocks.length > 0 ? blocks : [copy])
    .map((block) => clean(block.textContent ?? ""))
    .filter((part) => part !== "")
  const paragraphs: Array<string> = []
  let left = FOOTNOTE_MAX_LENGTH
  for (const part of parts) {
    if (left <= 0) break
    const chars = Array.from(part)
    paragraphs.push(
      chars.length > left ? `${chars.slice(0, left).join("").trimEnd()}…` : part
    )
    left -= chars.length
  }
  return paragraphs.length > 0 ? paragraphs : null
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run src/lib/epub/footnotes.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck, lint, format**

Run: `npm run typecheck && npm run lint && npm run check`
Expected: bersih.

- [ ] **Step 6: Commit**

```bash
git add src/lib/epub/footnotes.ts src/lib/epub/footnotes.test.ts
git commit -m "feat(reader): footnote links are known and their notes read as text

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Layar tetap menyala

**Files:**
- Create: `src/lib/use-wake-lock.ts`
- Create: `src/lib/use-wake-lock.test.ts`

**Interfaces:**
- Produces (dipakai Task 7): `useWakeLock(active: boolean): void`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/use-wake-lock.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useWakeLock } from "./use-wake-lock"

let visibility: DocumentVisibilityState = "visible"

/** A lock the browser hands out; `release` is what the hook calls. */
function fakeSentinel() {
  return { release: vi.fn(() => Promise.resolve()), addEventListener: vi.fn() }
}

function stubWakeLock(request: () => Promise<unknown>) {
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request: vi.fn(request) },
  })
  return (navigator as unknown as { wakeLock: { request: ReturnType<typeof vi.fn> } })
    .wakeLock.request
}

const settle = () =>
  act(async () => {
    await Promise.resolve()
  })

function show(state: DocumentVisibilityState) {
  visibility = state
  document.dispatchEvent(new Event("visibilitychange"))
}

beforeEach(() => {
  visibility = "visible"
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, "wakeLock")
})

describe("useWakeLock", () => {
  it("keeps the screen on while the tab shows, and lets go when done", async () => {
    const sentinel = fakeSentinel()
    const request = stubWakeLock(() => Promise.resolve(sentinel))
    const { unmount } = renderHook(() => useWakeLock(true))
    await settle()
    expect(request).toHaveBeenCalledWith("screen")
    unmount()
    expect(sentinel.release).toHaveBeenCalled()
  })

  it("lets go when the tab hides and asks again when it shows", async () => {
    const first = fakeSentinel()
    const second = fakeSentinel()
    const request = stubWakeLock(vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second))
    renderHook(() => useWakeLock(true))
    await settle()
    await act(async () => show("hidden"))
    expect(first.release).toHaveBeenCalled()
    await act(async () => show("visible"))
    await settle()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it("does nothing while inactive", async () => {
    const request = stubWakeLock(() => Promise.resolve(fakeSentinel()))
    renderHook(() => useWakeLock(false))
    await settle()
    expect(request).not.toHaveBeenCalled()
  })

  it("says nothing when the browser refuses or has no Wake Lock", async () => {
    stubWakeLock(() => Promise.reject(new DOMException("no", "NotAllowedError")))
    const refused = renderHook(() => useWakeLock(true))
    await settle()
    refused.unmount()
    Reflect.deleteProperty(navigator, "wakeLock")
    const missing = renderHook(() => useWakeLock(true))
    await settle()
    missing.unmount()
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/use-wake-lock.test.ts`
Expected: FAIL, karena modulnya belum ada.

- [ ] **Step 3: Tulis `src/lib/use-wake-lock.ts`**

```ts
import { useEffect } from "react"

/**
 * Keeps the screen on while `active` and the tab shows (spec 2 §6.7). The
 * lock goes when the tab hides and is asked for again when it shows. A
 * browser without Wake Lock, or one that refuses (low battery, a setting),
 * lets the screen sleep as usual, and nothing is said.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return
    let live = true
    let asking = false
    let lock: WakeLockSentinel | null = null

    const release = () => {
      const held = lock
      lock = null
      held?.release().catch(() => undefined)
    }
    const request = () => {
      if (asking || lock || document.visibilityState !== "visible") return
      asking = true
      navigator.wakeLock
        .request("screen")
        .then(
          (sentinel) => {
            if (!live || document.visibilityState !== "visible") {
              sentinel.release().catch(() => undefined)
              return
            }
            lock = sentinel
            // The browser may let go by itself (the tab hid, the battery is low).
            sentinel.addEventListener("release", () => {
              if (lock === sentinel) lock = null
            })
          },
          // Refused: the screen sleeps as usual, without a word (plan 2C, decision 11).
          () => undefined
        )
        .finally(() => {
          asking = false
        })
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") request()
      else release()
    }

    request()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      live = false
      document.removeEventListener("visibilitychange", onVisibility)
      release()
    }
  }, [active])
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run src/lib/use-wake-lock.test.ts`
Expected: PASS, dan output test bersih (tanpa *unhandled rejection*).

- [ ] **Step 5: Typecheck, lint, format**

Run: `npm run typecheck && npm run lint && npm run check`
Expected: bersih.

- [ ] **Step 6: Commit**

```bash
git add src/lib/use-wake-lock.ts src/lib/use-wake-lock.test.ts
git commit -m "feat(reader): the screen stays on while a book is open

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Popup catatan kaki, tombol Kembali, dan sisa waktu di footer

**Files:**
- Create: `src/components/reader/FootnotePopup.tsx`
- Create: `src/components/reader/FootnotePopup.test.tsx`
- Create: `src/components/reader/ReaderBack.tsx`
- Create: `src/components/reader/ReaderBack.test.tsx`
- Modify: `src/components/reader/ReaderFooter.tsx`
- Modify: `src/components/reader/ReaderFooter.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `formatDuration` (Task 2); `ReaderPopup` dan `WordRect` (`src/components/reader/ReaderPopup.tsx`).
- Produces (dipakai Task 6 dan 7):
  - `type FootnoteTap = { paragraphs: Array<string>; rect: WordRect }` dan `FootnotePopup({ note, onClose, finalFocus })`;
  - `ReaderBack({ shown, onBack })`;
  - `type TimeLeft = { chapter: number; book: number }` (menit yang sudah disesuaikan kecepatan member), dan prop baru `timeLeft: TimeLeft | null` di `ReaderFooter`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/components/reader/FootnotePopup.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FootnotePopup } from "./FootnotePopup"

const rect = { left: 100, top: 200, width: 10, height: 16 }

describe("FootnotePopup", () => {
  it("shows nothing without a note", () => {
    render(
      <FootnotePopup note={null} onClose={vi.fn()} finalFocus={() => null} />
    )
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("shows the note's paragraphs and closes with Escape", async () => {
    const onClose = vi.fn()
    render(
      <FootnotePopup
        note={{ paragraphs: ["Satu dua.", "Tiga."], rect }}
        onClose={onClose}
        finalFocus={() => null}
      />
    )
    const dialog = await screen.findByRole("dialog", { name: "Catatan kaki" })
    expect(dialog).toHaveTextContent("Satu dua.")
    expect(dialog).toHaveTextContent("Tiga.")
    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })
})
```

Buat `src/components/reader/ReaderBack.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ReaderBack } from "./ReaderBack"

describe("ReaderBack", () => {
  it("shows only after a jump", () => {
    render(<ReaderBack shown={false} onBack={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "Kembali" })).toBeNull()
  })

  it("goes back when pressed", () => {
    const onBack = vi.fn()
    render(<ReaderBack shown onBack={onBack} />)
    fireEvent.click(screen.getByRole("button", { name: "Kembali" }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
```

Di `src/components/reader/ReaderFooter.test.tsx`:
- Kedua `render(<ReaderFooter … />)` yang sudah ada mendapat prop `timeLeft={null}`.
- Tambahkan test berikut di akhir `describe("ReaderFooter", …)`:

```tsx
  it("shows the time left in the chapter and in the book", () => {
    render(
      <ReaderFooter
        hidden={false}
        location={location}
        timeLeft={{ chapter: 8.4, book: 312 }}
        onSeek={() => undefined}
      />
    )
    expect(
      screen.getByRole("status", { name: "Sisa waktu" })
    ).toHaveTextContent("±8 mnt lagi di bab ini · ±5 j 12 mnt lagi di buku")
  })

  it("shows no time before foliate has one", () => {
    render(
      <ReaderFooter
        hidden={false}
        location={location}
        timeLeft={null}
        onSeek={() => undefined}
      />
    )
    expect(screen.queryByRole("status", { name: "Sisa waktu" })).toBeNull()
  })
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/reader/FootnotePopup.test.tsx src/components/reader/ReaderBack.test.tsx src/components/reader/ReaderFooter.test.tsx`
Expected: FAIL. Modul `FootnotePopup` dan `ReaderBack` belum ada, dan "Sisa waktu" tidak ditemukan.

- [ ] **Step 3: Tulis `src/components/reader/FootnotePopup.tsx`**

```tsx
import { ReaderPopup, type WordRect } from "./ReaderPopup"

/** A footnote opened from its link (spec 2 §6.7): its text, beside the link. */
export type FootnoteTap = { paragraphs: Array<string>; rect: WordRect }

/**
 * A footnote in the popup the meanings use: a popover beside the link on
 * wide screens, a bottom sheet on phones. The page stays where it is.
 */
export function FootnotePopup({
  note,
  onClose,
  finalFocus,
}: {
  note: FootnoteTap | null
  onClose: () => void
  finalFocus: () => HTMLElement | null
}) {
  if (!note) return null
  return (
    <ReaderPopup
      rect={note.rect}
      label="Catatan kaki"
      onClose={onClose}
      finalFocus={finalFocus}
    >
      <div className="word-card footnote-card">
        {note.paragraphs.map((paragraph, index) => (
          // The paragraphs never change while the popup shows.
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </ReaderPopup>
  )
}
```

- [ ] **Step 4: Tulis `src/components/reader/ReaderBack.tsx`**

```tsx
import { ArrowLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Back to the place read before a jump (spec 2 §6.7), bottom left. */
export function ReaderBack({
  shown,
  onBack,
}: {
  shown: boolean
  onBack: () => void
}) {
  if (!shown) return null
  return (
    <Button variant="secondary" size="lg" className="reader-back" onClick={onBack}>
      <ArrowLeftIcon aria-hidden="true" />
      Kembali
    </Button>
  )
}
```

- [ ] **Step 5: Sisa waktu di `ReaderFooter.tsx`**

Di `src/components/reader/ReaderFooter.tsx`:

Tambahkan import:

```tsx
import { formatDuration } from "@/lib/reading-speed"
```

Tepat di bawah `const SEEK_DELAY_MS = 250` tambahkan:

```tsx
/** Minutes left at this member's speed (plan 2C, decision 7). */
export type TimeLeft = { chapter: number; book: number }
```

Ganti signature komponen dengan:

```tsx
export function ReaderFooter({
  hidden,
  location,
  timeLeft,
  onSeek,
}: {
  hidden: boolean
  location: ReaderLocation | null
  timeLeft: TimeLeft | null
  onSeek: (fraction: number) => void
}) {
```

Ganti `<output aria-label="Bab saat ini" …>…</output>` di akhir footer dengan:

```tsx
      <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
        <output aria-label="Bab saat ini" className="block min-w-0 flex-1 truncate">
          {location?.chapter ?? ""}
        </output>
        {timeLeft && (
          // The book's time needs a wide screen (plan 2C, decision 8).
          <output aria-label="Sisa waktu" className="shrink-0 tabular-nums">
            {formatDuration(timeLeft.chapter)} lagi di bab ini
            <span className="max-lg:hidden">
              {" "}
              · {formatDuration(timeLeft.book)} lagi di buku
            </span>
          </output>
        )}
      </div>
```

- [ ] **Step 6: CSS**

Di `src/styles.css`, tepat setelah blok `.reader-note { top: 4.5rem; … }` (di dalam `@layer components`), tambahkan:

```css
  /* Back to the place before a jump (spec 2 §6.7), above the bottom bar. */
  .reader-back {
    position: absolute;
    bottom: 5.5rem;
    left: max(1rem, env(safe-area-inset-left));
    z-index: 2;
  }
```

Tepat setelah blok `.word-card { … }` tambahkan:

```css
  /* A long footnote scrolls inside its popup. */
  .footnote-card {
    max-height: 40dvh;
    overflow-y: auto;
  }
```

- [ ] **Step 7: Jalankan test, pastikan lulus**

Run: `npx vitest run src/components/reader/FootnotePopup.test.tsx src/components/reader/ReaderBack.test.tsx src/components/reader/ReaderFooter.test.tsx`
Expected: PASS.

- [ ] **Step 8: Sambungan sementara di halaman reader**

`ReaderFooter` sekarang membutuhkan `timeLeft`. Di `src/routes/_member/read.$bookId.tsx`, tambahkan `timeLeft={null}` ke `<ReaderFooter … />`. Task 7 menggantinya.

- [ ] **Step 9: Typecheck, lint, format**

Run: `npm run typecheck && npm run lint && npm run check`
Expected: bersih.

- [ ] **Step 10: Commit**

```bash
git add src/components/reader/FootnotePopup.tsx src/components/reader/FootnotePopup.test.tsx src/components/reader/ReaderBack.tsx src/components/reader/ReaderBack.test.tsx src/components/reader/ReaderFooter.tsx src/components/reader/ReaderFooter.test.tsx src/styles.css src/routes/_member/read.\$bookId.tsx
git commit -m "feat(reader): footnote popup, Back button and the time left in the footer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: ReaderView — alasan perpindahan, waktu, tautan, dan catatan kaki

**Files:**
- Modify: `src/types/foliate-js.d.ts`
- Modify: `src/components/reader/ReaderView.tsx`
- Modify: `src/components/reader/ReaderFooter.test.tsx` (fixture lokasi)
- Modify: `src/routes/_member/read.$bookId.tsx` (sambungan sementara)

**Interfaces:**
- Consumes:
  - `isFootnoteLink`, `footnoteText` (Task 3);
  - `FootnoteTap` (Task 5).
- Produces (dipakai Task 7):
  - `ReaderLocation` mendapat `turned: boolean` (member membalik halaman atau menggulir, bukan lompatan atau tata letak baru) dan `time: { section: number; total: number } | null` (menit tersisa dengan kecepatan foliate);
  - callback baru `onFootnote(note: FootnoteTap)`;
  - callback baru `onJump()`: member mengikuti tautan biasa dan meninggalkan tempat ini. Callback ini dipanggil sebelum foliate pindah.

Tidak ada unit test baru di task ini. Semua yang bisa diuji tanpa layout ada di Task 3. Penjaga regresinya adalah `e2e/reader.spec.ts`, `e2e/vocabulary.spec.ts`, dan `e2e/annotations.spec.ts`. Perilaku baru diuji E2E di Task 7.

- [ ] **Step 1: Tipe foliate**

Di `src/types/foliate-js.d.ts`, di `RelocateDetail`, tepat di bawah `range?: Range` tambahkan:

```ts
    /** Minutes left in the section and the book at foliate's speed (1,600 characters a minute). */
    time?: { section: number; total: number }
```

Di `class View`, tepat di bawah `renderer: FoliateRenderer` tambahkan:

```ts
    /** The place shown now; set before "relocate" is sent. */
    lastLocation: RelocateDetail | null
```

- [ ] **Step 2: Lokasi, callback, dan helper di `ReaderView.tsx`**

Di `src/components/reader/ReaderView.tsx`:

Tambahkan import:

```ts
import { footnoteText, isFootnoteLink } from "@/lib/epub/footnotes"
import type { FootnoteTap } from "./FootnotePopup"
```

Ganti tipe `ReaderLocation` dengan:

```ts
export type ReaderLocation = {
  fraction: number
  cfi: string
  chapter: string | null
  chapterHref: string | null
  /** The start of the page's text: a bookmark's excerpt. */
  pageText: string
  /** The member turned the page or scrolled here: not a jump or a new layout. */
  turned: boolean
  /** Minutes left in the section and the book at foliate's speed. */
  time: { section: number; total: number } | null
}
```

Di tipe `Callbacks`, tepat di bawah `onDismiss: () => void` tambahkan:

```ts
  /** A footnote link: its note shows instead of a jump (spec 2 §6.7). */
  onFootnote: (note: FootnoteTap) => void
  /** The member follows a link away from this place; called before foliate moves. */
  onJump: () => void
```

Tepat di bawah `const SELECTION_SETTLE_MS = 300` tambahkan:

```ts
/** foliate's reasons for a relocate the member made by turning or scrolling (plan 2C, decision 5). */
const TURN_REASONS = new Set(["page", "snap", "scroll"])

/** A box in a section's frame, in this window's coordinates. */
function rectInWindow(doc: Document, box: DOMRect): WordRect {
  const frame = doc.defaultView?.frameElement?.getBoundingClientRect()
  return {
    left: box.left + (frame?.left ?? 0),
    top: box.top + (frame?.top ?? 0),
    width: box.width,
    height: box.height,
  }
}
```

Tepat setelah fungsi `chaptersOf(…)` tambahkan:

```ts
/**
 * A footnote's paragraphs (spec 2 §6.7), read from its section's document;
 * null when the link's place holds no note. Never rejects.
 */
async function footnoteOf(
  view: View,
  href: string
): Promise<Array<string> | null> {
  try {
    const resolved = view.resolveNavigation(href)
    if (!resolved || resolved.index < 0 || !resolved.anchor) return null
    const doc = await view.book.sections[resolved.index]?.createDocument?.()
    const target = doc ? resolved.anchor(doc) : null
    return target instanceof Element ? footnoteText(target) : null
  } catch {
    return null
  }
}
```

Ganti fungsi `toLocation` dengan:

```ts
function toLocation(
  detail: RelocateDetail,
  reason: string | undefined
): ReaderLocation {
  const label = detail.tocItem?.label?.trim()
  return {
    fraction: detail.fraction,
    cfi: detail.cfi,
    chapter: label ? label : null,
    chapterHref: detail.tocItem?.href ?? null,
    pageText: excerptOf(
      detail.range?.toString() ?? "",
      BOOKMARK_EXCERPT_LENGTH
    ),
    turned: reason !== undefined && TURN_REASONS.has(reason),
    time: detail.time ?? null,
  }
}
```

- [ ] **Step 3: `rectInWindow` bersama di `onSectionLoad`**

Di `onSectionLoad`, ganti definisi lokal

```ts
      const rectInWindow = (box: DOMRect): WordRect => ({
        left: box.left + (frameBox()?.left ?? 0),
        top: box.top + (frameBox()?.top ?? 0),
        width: box.width,
        height: box.height,
      })
```

dengan

```ts
      const toWindow = (box: DOMRect) => rectInWindow(doc, box)
```

Lalu ganti ketiga pemakaian `rectInWindow(…)` di dalam `onSectionLoad` (di `tapOf`, `reportSelection`, dan `onHighlight`) dengan `toWindow(…)`. `frameBox` dan `inWindow` tetap dipakai untuk `inWindow(click.clientX)` dan tidak berubah.

- [ ] **Step 4: Relocate dari renderer**

Ganti

```ts
    const onRelocate = (event: Event) =>
      call().onRelocate(
        toLocation((event as CustomEvent<RelocateDetail>).detail)
      )
```

dengan

```ts
    // foliate's view listens to its renderer first and keeps the new place in
    // lastLocation; the renderer's event also says why it moved (plan 2C,
    // decision 6).
    const onRendererRelocate = (event: Event) => {
      const place = view?.lastLocation
      if (!place) return
      const { reason } = (event as CustomEvent<{ reason?: string }>).detail
      call().onRelocate(toLocation(place, reason))
    }
```

- [ ] **Step 5: Tautan dan catatan kaki**

Tepat di bawah `onRendererRelocate` tambahkan:

```ts
    // A link in the book, before foliate follows it: a footnote opens in a
    // popup (spec 2 §6.7), any other link is a jump the member can come back from.
    const showFootnote = async (a: Element, href: string) => {
      const current = view
      if (!current) return
      const paragraphs = await footnoteOf(current, href)
      if (isCancelled()) return
      if (paragraphs) {
        call().onFootnote({
          paragraphs,
          rect: rectInWindow(a.ownerDocument, a.getBoundingClientRect()),
        })
        return
      }
      // No note to show there: the link goes where it points (plan 2C, decision 3).
      call().onJump()
      await current.goTo(href)
    }
    const onLink = (event: Event) => {
      const { a, href } = (event as CustomEvent<{ a: Element; href: string }>)
        .detail
      if (!isFootnoteLink(a)) {
        call().onJump()
        return
      }
      event.preventDefault()
      void showFootnote(a, href)
    }
```

- [ ] **Step 6: Pasang listener**

Ganti

```ts
        view.addEventListener("relocate", onRelocate)
```

dengan

```ts
        view.addEventListener("link", onLink)
```

Lalu tepat setelah `skipLayoutWhileLoading(view.renderer)` tambahkan:

```ts
        // After open, which made the renderer and put foliate's listener first.
        view.renderer.addEventListener("relocate", onRendererRelocate)
```

`RelocateDetail` masih dipakai di `toLocation`, jadi import-nya tetap.

- [ ] **Step 7: Fixture dan sambungan sementara**

Di `src/components/reader/ReaderFooter.test.tsx`, tambahkan `turned: false, time: null` ke objek `location`.

Di `src/routes/_member/read.$bookId.tsx`, tambahkan dua prop ke `<ReaderView … />`: `onFootnote={() => undefined}` dan `onJump={() => undefined}`. Task 7 menggantinya.

- [ ] **Step 8: Typecheck, lint, format, unit test**

Run: `npm run typecheck && npm run lint && npm run check && npx vitest run`
Expected: semuanya lulus.

- [ ] **Step 9: E2E reader, kosakata, dan anotasi tetap lulus**

Run: `npx playwright test e2e/reader.spec.ts e2e/vocabulary.spec.ts e2e/annotations.spec.ts --project=desktop --project=mobile --workers=2`
Expected: semuanya lulus atau di-skip seperti sebelumnya. Posisi baca tetap tersimpan setelah balik halaman. Itu bukti `onRelocate` dari renderer masih jalan.

- [ ] **Step 10: Commit**

```bash
git add src/types/foliate-js.d.ts src/components/reader/ReaderView.tsx src/components/reader/ReaderFooter.test.tsx src/routes/_member/read.\$bookId.tsx
git commit -m "feat(reader): the reader knows turns from jumps, foliate's time, and footnote links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Halaman reader menyatukan 2C, dan E2E 2C

**Files:**
- Create: `src/components/reader/useReadingSpeed.ts`
- Create: `src/components/reader/useReadingSpeed.test.tsx`
- Modify: `src/routes/_member/read.$bookId.tsx`
- Modify: `e2e/helpers/epub.ts`
- Modify: `e2e/helpers/books.ts`
- Create: `e2e/comfort.spec.ts`

**Interfaces:**
- Consumes:
  - Task 2: `loadSpeedSamples`, `saveSpeedSamples`, `pageSample`, `addSample`, `speedRatio`, `SPEED_SAMPLES`, `SpeedMark`, `SpeedSample`;
  - Task 4: `useWakeLock`;
  - Task 5: `FootnotePopup`, `ReaderBack`, `TimeLeft`;
  - Task 6: `ReaderLocation.turned`/`time`, `onFootnote`, `onJump`.
- Produces:
  - `useReadingSpeed(): { ratio: number; record: (location: ReaderLocation) => void }`;
  - `makeEpub` menerima `body?: string`;
  - `seedBook` menerima `{ file: Buffer }` sebagai ganti `{ path }`.

- [ ] **Step 1: Tulis test hook yang gagal**

Buat `src/components/reader/useReadingSpeed.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { loadSpeedSamples, saveSpeedSamples } from "@/lib/local/reading-speed"
import type { ReaderLocation } from "./ReaderView"
import { useReadingSpeed } from "./useReadingSpeed"

vi.mock("@/lib/local/reading-speed", () => ({
  loadSpeedSamples: vi.fn(() => Promise.resolve([])),
  saveSpeedSamples: vi.fn(() => Promise.resolve()),
}))

const place = (
  cfi: string,
  minutesLeft: number,
  turned = true
): ReaderLocation => ({
  fraction: 0,
  cfi,
  chapter: null,
  chapterHref: null,
  pageText: "",
  turned,
  time: { section: minutesLeft, total: minutesLeft },
})

/** Reads `pages` pages forwards, `msEach` on each, one foliate minute apiece. */
function readPages(record: (location: ReaderLocation) => void, pages: number, msEach: number) {
  for (let page = 0; page <= pages; page++) {
    act(() => record(place(`page-${page}`, 100 - page)))
    vi.advanceTimersByTime(msEach)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(loadSpeedSamples).mockResolvedValue([])
  vi.mocked(saveSpeedSamples).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useReadingSpeed", () => {
  it("keeps foliate's speed until ten pages are read, then learns", async () => {
    const { result } = renderHook(() => useReadingSpeed())
    await act(async () => {})
    readPages(result.current.record, 9, 120_000)
    expect(result.current.ratio).toBe(1)
    readPages(result.current.record, 1, 120_000)
    expect(result.current.ratio).toBe(2)
    expect(vi.mocked(saveSpeedSamples).mock.lastCall?.[0]).toHaveLength(10)
  })

  it("does not measure a jump, nor a relocate at the same place", async () => {
    const { result } = renderHook(() => useReadingSpeed())
    await act(async () => {})
    act(() => result.current.record(place("a", 50)))
    vi.advanceTimersByTime(30_000)
    // A touch snaps the page at the same place: the page still shows.
    act(() => result.current.record(place("a", 50)))
    vi.advanceTimersByTime(30_000)
    act(() => result.current.record(place("b", 49)))
    expect(vi.mocked(saveSpeedSamples).mock.lastCall?.[0]).toEqual([
      { expected: 1, actual: 1 },
    ])
    vi.advanceTimersByTime(30_000)
    act(() => result.current.record(place("z", 10, false)))
    vi.advanceTimersByTime(30_000)
    act(() => result.current.record(place("y", 9)))
    expect(vi.mocked(saveSpeedSamples).mock.lastCall?.[0]).toEqual([
      { expected: 1, actual: 1 },
      { expected: 1, actual: 0.5 },
    ])
  })

  it("starts from the pages measured before", async () => {
    vi.mocked(loadSpeedSamples).mockResolvedValue(
      Array.from({ length: 10 }, () => ({ expected: 1, actual: 3 }))
    )
    const { result } = renderHook(() => useReadingSpeed())
    await act(async () => {})
    expect(result.current.ratio).toBe(3)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/reader/useReadingSpeed.test.tsx`
Expected: FAIL, karena modulnya belum ada.

- [ ] **Step 3: Tulis `src/components/reader/useReadingSpeed.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from "react"
import { loadSpeedSamples, saveSpeedSamples } from "@/lib/local/reading-speed"
import {
  SPEED_SAMPLES,
  type SpeedMark,
  type SpeedSample,
  addSample,
  pageSample,
  speedRatio,
} from "@/lib/reading-speed"
import type { ReaderLocation } from "./ReaderView"

/**
 * This member's reading speed on this device (spec 2 §6.7). Each page turned
 * is measured from the moment it showed; a jump, a new layout or a hidden
 * tab starts the measure again (plan 2C, decision 7).
 */
export function useReadingSpeed(): {
  ratio: number
  record: (location: ReaderLocation) => void
} {
  const samples = useRef<ReadonlyArray<SpeedSample>>([])
  const mark = useRef<(SpeedMark & { cfi: string }) | null>(null)
  const [ratio, setRatio] = useState(1)

  const keep = useCallback((next: ReadonlyArray<SpeedSample>) => {
    samples.current = next
    setRatio(speedRatio(next))
  }, [])

  useEffect(() => {
    let live = true
    loadSpeedSamples()
      .then((stored) => {
        // Pages measured while the stored ones loaded come after them.
        if (live) keep([...stored, ...samples.current].slice(-SPEED_SAMPLES))
      })
      .catch((error: unknown) =>
        console.error("reading the reading speed failed", error)
      )
    // A hidden tab is not reading: the page showing then is not measured.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") mark.current = null
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      live = false
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [keep])

  const record = useCallback(
    (location: ReaderLocation) => {
      const previous = mark.current
      // foliate also relocates without moving (a touch snaps the page).
      if (previous?.cfi === location.cfi) return
      const next = location.time
        ? { at: Date.now(), minutesLeft: location.time.total, cfi: location.cfi }
        : null
      mark.current = next
      if (!location.turned || !previous || !next) return
      const sample = pageSample(previous, next)
      if (!sample) return
      const all = addSample(samples.current, sample)
      keep(all)
      saveSpeedSamples(all).catch((error: unknown) =>
        console.error("saving the reading speed failed", error)
      )
    },
    [keep]
  )

  return { ratio, record }
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run src/components/reader/useReadingSpeed.test.tsx`
Expected: PASS.

- [ ] **Step 5: Helper E2E — buku dengan catatan kaki**

Di `e2e/helpers/epub.ts`, tambahkan `body?: string` ke parameter `makeEpub`, dengan komentar sesudah `cover?: boolean`:

```ts
  /** The chapter's body (XHTML, epub: namespace available); by default a heading and the title. */
  body?: string
```

Lalu ganti isi `"OEBPS/bab1.xhtml"` dengan:

```ts
    "OEBPS/bab1.xhtml": strToU8(
      xhtml(
        "Bab 1",
        book.body ?? `<h1>Bab 1</h1><p>${escapeXml(book.title)}</p>`
      )
    ),
```

Di `e2e/helpers/books.ts`, ganti signature dan baris pertama `seedBook` dengan:

```ts
/** A book from the fixtures (`path`) or made by the test (`file`). */
type SeedBook = { title: string; author: string } & (
  | { path: string }
  | { file: Buffer }
)

/**
 * Puts an EPUB straight on a member's shelf, without the upload screen:
 * reserve, upload through the admin client, mark ready. The global teardown
 * removes it with the member.
 */
export async function seedBook(
  userId: string,
  book: SeedBook = SHERLOCK
): Promise<string> {
  const file = "file" in book ? book.file : await readFile(book.path)
```

Sisa fungsinya tidak berubah.

- [ ] **Step 6: Tulis E2E yang gagal**

Buat `e2e/comfort.spec.ts`:

```ts
import { type Page, expect, test } from "@playwright/test"
import { seedBook } from "./helpers/books"
import { makeEpub } from "./helpers/epub"
import {
  createConfirmedMember,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"
import { startReading, turnPages } from "./helpers/reading"

const SPECKLED_BAND = "The Adventure of the Speckled Band"
const NOTE = "Isi catatan kaki ini terbuka di popup."
const FOOTNOTE_BOOK = { title: "Buku Catatan Kaki", author: "Penguji" }

/** The middle of an element of the shown section, in this window. */
async function pointOf(page: Page, id: string) {
  const point = await page.evaluate((target) => {
    const view = document.querySelector("foliate-view") as unknown as {
      renderer: { getContents: () => Array<{ doc: Document }> }
    }
    const doc = view.renderer.getContents()[0].doc
    const element = doc.getElementById(target)
    const frame = doc.defaultView?.frameElement?.getBoundingClientRect()
    if (!element || !frame) return null
    const box = element.getBoundingClientRect()
    return {
      x: frame.left + box.left + box.width / 2,
      y: frame.top + box.top + box.height / 2,
    }
  }, id)
  if (!point) throw new Error(`#${id} does not show`)
  return point
}

test("a footnote opens in a popup and the page stays", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90_000)
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  const userId = await userIdOf(member.email)
  const bookId = await seedBook(userId, {
    ...FOOTNOTE_BOOK,
    file: await makeEpub({
      ...FOOTNOTE_BOOK,
      subjects: [],
      cover: false,
      body: `<h1>Bab 1</h1><p>Kalimat pertama dengan catatan<a epub:type="noteref" id="r1" href="#n1">1</a> di ujungnya.</p><aside epub:type="footnote" id="n1"><p>${NOTE} <a epub:type="backlink" href="#r1">↩</a></p></aside>`,
    }),
  })
  await page.goto(`/read/${bookId}`)
  const place = page.getByRole("status", { name: "Posisi baca" })
  await expect(place).toHaveText(/^\d+%$/, { timeout: 30_000 })
  const before = await place.textContent()

  const { x, y } = await pointOf(page, "r1")
  if (isMobile) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)

  const popup = page.getByRole("dialog", { name: "Catatan kaki" })
  await expect(popup).toHaveText(NOTE)
  await expect(place).toHaveText(before ?? "")
  await page.keyboard.press("Escape")
  await expect(popup).toBeHidden()
})

test("Kembali goes back to the place before a jump from the contents", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await startReading(page)
  const chapter = page.getByRole("status", { name: "Bab saat ini" })
  const before = (await chapter.textContent()) ?? ""
  const back = page.getByRole("button", { name: "Kembali", exact: true })
  const jumpToSpeckledBand = async () => {
    await page.getByRole("button", { name: "Daftar isi" }).click()
    await page
      .getByRole("dialog", { name: "Daftar isi" })
      .getByRole("button", { name: SPECKLED_BAND })
      .click()
    await expect(chapter).toHaveText(SPECKLED_BAND)
  }

  await expect(back).toBeHidden()
  await jumpToSpeckledBand()
  await back.click()
  await expect(chapter).toHaveText(before)
  await expect(back).toBeHidden()

  // Five page turns after a jump put the button away (spec 2 §6.7).
  await jumpToSpeckledBand()
  await turnPages(page, "PageDown", 4)
  await expect(back).toBeVisible()
  await turnPages(page, "PageDown", 1)
  await expect(back).toBeHidden()
})
```

- [ ] **Step 7: Jalankan E2E, pastikan gagal**

Run: `npx playwright test e2e/comfort.spec.ts --project=desktop --workers=2`
Expected: FAIL. Popup "Catatan kaki" tidak muncul (`onFootnote` masih sementara) dan tombol "Kembali" tidak ada.

- [ ] **Step 8: Sambungkan halaman reader**

Di `src/routes/_member/read.$bookId.tsx`:

1. Tambahkan import:

```ts
import {
  FootnotePopup,
  type FootnoteTap,
} from "@/components/reader/FootnotePopup"
import { ReaderBack } from "@/components/reader/ReaderBack"
import { useReadingSpeed } from "@/components/reader/useReadingSpeed"
import { useWakeLock } from "@/lib/use-wake-lock"
```

2. Tepat di bawah `const NOTE_MS = 8000` tambahkan:

```ts
/** Kembali goes after this many page turns (spec 2 §6.7). */
const BACK_TURNS = 5
```

3. Tepat di bawah `const [noteFor, setNoteFor] = useState<Annotation | null>(null)` tambahkan:

```ts
  const [footnote, setFootnote] = useState<FootnoteTap | null>(null)
  // The place left by the last jump, and the page turns since (spec 2 §6.7).
  const [backTo, setBackTo] = useState<string | null>(null)
  const turnsSinceJump = useRef(0)
  const { ratio, record: recordSpeed } = useReadingSpeed()
  useWakeLock(true)
```

Ganti `const popupOpen = …` dengan:

```ts
  const popupOpen =
    tap !== null || marked !== null || selection !== null || footnote !== null
```

4. Di `onRelocate`:
   - Di dalam `if (next.cfi !== tappedAtCfi.current) { … }`, tambahkan `setFootnote(null)`.
   - Tepat di bawah `shownCfi.current = next.cfi`, tambahkan:

```ts
      recordSpeed(next)
      if (moved && next.turned) {
        turnsSinceJump.current += 1
        if (turnsSinceJump.current >= BACK_TURNS) setBackTo(null)
      }
```

   - Ganti dependensi `useCallback` dari `[bookId]` menjadi `[bookId, recordSpeed]`.

5. Di `openWord`, `openHighlight`, dan di cabang `if (next)` milik `showSelection`, tambahkan `setFootnote(null)`. Di `closePopups`, tambahkan `setFootnote(null)`. Tepat di bawah `closePopups` tambahkan:

```ts
  const openFootnote = useCallback((next: FootnoteTap) => {
    tappedAtCfi.current = shownCfi.current
    // A link beats the selection (spec 2 §6.1): drop it with its menu.
    controlsRef.current?.clearSelection()
    setTap(null)
    setMarked(null)
    setSelection(null)
    setFootnote(next)
  }, [])
  /** A jump from here: Kembali comes back to this place (plan 2C, decision 4). */
  const markJump = useCallback(() => {
    if (!shownCfi.current) return
    turnsSinceJump.current = 0
    setBackTo(shownCfi.current)
  }, [])
```

6. Ganti `onSeek` dengan:

```ts
  const onSeek = useCallback(
    (fraction: number) => {
      markJump()
      go((current) => current.goToFraction(fraction))
    },
    [go, markJump]
  )
  const goBack = () => {
    const place = backTo
    setBackTo(null)
    if (place) go((current) => current.goTo(place))
  }
  const timeLeft = location?.time
    ? { chapter: location.time.section * ratio, book: location.time.total * ratio }
    : null
```

7. Di `<ReaderView … />`, ganti prop sementara `onFootnote={() => undefined}` dan `onJump={() => undefined}` dengan `onFootnote={openFootnote}` dan `onJump={markJump}`.

8. Ganti `<ReaderFooter hidden={chromeHidden} location={location} timeLeft={null} onSeek={onSeek} />` dengan:

```tsx
      <ReaderBack shown={backTo !== null} onBack={goBack} />
      <ReaderFooter
        hidden={chromeHidden}
        location={location}
        timeLeft={timeLeft}
        onSeek={onSeek}
      />
```

9. Tepat sebelum `<WordPopup` tambahkan:

```tsx
      <FootnotePopup
        key={
          footnote
            ? `${footnote.rect.left} ${footnote.rect.top}`
            : "no-footnote"
        }
        note={footnote}
        onClose={() => setFootnote(null)}
        finalFocus={bookFocus}
      />
```

10. Di `TocPanel`:
    - Di `onSelect`, panggil `markJump()` tepat sebelum `go((current) => current.goTo(href))`.
    - Di `onSelectPlace`, ganti badan async-nya dengan:

```ts
          go(async (current) => {
            if (!(await current.canOpen(cfi))) {
              setTargetMissing(true)
              return
            }
            markJump()
            await current.goTo(cfi)
          })
```

- [ ] **Step 9: Typecheck, lint, format, unit test**

Run: `npm run typecheck && npm run lint && npm run check && npx vitest run`
Expected: semuanya lulus.

- [ ] **Step 10: Jalankan E2E 2C, pastikan lulus**

Run: `npx playwright test e2e/comfort.spec.ts --project=desktop --project=mobile --workers=2`
Expected: 4 passed (2 test × 2 project).

- [ ] **Step 11: E2E reader, kosakata, anotasi, dan rak tetap lulus**

Run: `npx playwright test e2e/reader.spec.ts e2e/vocabulary.spec.ts e2e/annotations.spec.ts e2e/shelf.spec.ts --project=desktop --project=mobile --workers=2`
Expected: semuanya lulus atau di-skip seperti sebelumnya. `shelf.spec.ts` ikut dijalankan karena memakai `makeEpub`.

- [ ] **Step 12: Commit**

```bash
git add src/components/reader/useReadingSpeed.ts src/components/reader/useReadingSpeed.test.tsx src/routes/_member/read.\$bookId.tsx e2e/helpers/epub.ts e2e/helpers/books.ts e2e/comfort.spec.ts
git commit -m "feat(reader): footnotes, Kembali, time left and a waking screen in the reader

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Spec dan verifikasi penuh

**Files:**
- Modify: `docs/superpowers/specs/2026-10-22-tahap-2-ketuk-kata-design.md`

**Interfaces:**
- Consumes: semua task sebelumnya.
- Produces: spec yang cocok dengan kode, dan bukti seluruh test lulus.

Kebijakan Privasi tidak berubah. Kecepatan baca tidak pernah meninggalkan perangkat, dan setelan tampilan sudah tercantum.

- [ ] **Step 1: Perbarui spec**

Di `docs/superpowers/specs/2026-10-22-tahap-2-ketuk-kata-design.md`:

- **§2 keputusan 11:** ganti isinya menjadi: "Overlay anotasi dan perkiraan waktu memakai fitur bawaan foliate-js (`overlayer.js`, `progress.js`). Tautan catatan kaki dikenali dengan aturan `footnotes.js`, tetapi isinya dibaca dari dokumen section dan ditampilkan sebagai teks, jadi HTML buku tidak masuk ke halaman aplikasi." Alasannya: "Sudah teruji dan bekerja dengan CFI; `FootnoteHandler` butuh `foliate-view` kedua yang menempel di halaman."
- **§5 tabel modul:**
  - Tambahkan baris `src/lib/epub/footnotes.ts` | "`isFootnoteLink` (aturan `footnotes.js` foliate) dan `footnoteText`: paragraf catatan, tanpa tautan kembali, maksimal 2.000 karakter."
  - Ganti tugas `src/lib/reading-speed.ts` menjadi "Sampel per halaman, rasio kecepatan, dan format sisa waktu (§6.7)".
  - Tambahkan baris `src/lib/local/reading-speed.ts` | "Sampel kecepatan di Dexie `meta`, hanya di perangkat."
  - Tambahkan baris `src/lib/use-wake-lock.ts` | "Wake Lock selama reader terbuka (§6.7)."
- **§6.7 Catatan kaki:** ganti dengan "Tautan catatan kaki dikenali dengan aturan `footnotes.js` foliate (`epub:type="noteref"`, `role="doc-noteref"`, atau angka yang dinaikkan). Isinya dibaca dari dokumen section dan ditampilkan sebagai paragraf teks di popup yang gayanya sama dengan popup arti: tanpa tautan kembali, maksimal 2.000 karakter. Catatan yang isinya tidak bisa dibaca berperilaku seperti tautan biasa. Tautan biasa tetap melompat."
- **§6.7 Tombol Kembali:** tambahkan "Yang dicatat adalah tempat sebelum lompatan terakhir. Balik halaman dihitung dari `relocate` foliate dengan alasan `page`, `snap`, atau `scroll` yang memindahkan tempat; di mode gulir, tiap kali guliran berhenti dihitung satu. Membuka buku dari Kosakata dan *Lompat* ke posisi perangkat lain bukan lompatan."
- **§6.7 Sisa waktu:** tambahkan "Satu halaman memberi sampel menit foliate yang terlewati (turunnya `time.total`) dan menit yang benar-benar dipakai. Rasio = jumlah menit yang dipakai / jumlah menit foliate dari 50 sampel terakhir. Halaman yang dibaca mundur, `relocate` di tempat yang sama, dan halaman saat tab disembunyikan tidak dihitung. Di layar ≥ 1024px footer juga menampilkan sisa waktu buku (\"±5 j lagi di buku\")."
- **§6.7 Setelan baru:** tambahkan "Perataan dan pemenggalan dipasang tanpa `!important` pada `p, li, blockquote, dd`, jadi teks yang oleh bukunya dibuat rata tengah atau rata kanan tetap di tempatnya. *Satu halaman* memasang `max-column-count` paginator menjadi 1."

- [ ] **Step 2: Verifikasi penuh**

Run, berurutan:

```bash
npx vitest run
npm run typecheck
npm run lint
npm run check
npx vitest run --config vitest.db.config.ts
npx playwright test --project=desktop --project=mobile --workers=2
```

Expected: semuanya lulus. Untuk E2E, cek dulu port 3000 (Global Constraints). Kegagalan tunggal dijalankan ulang sendirian. Laporkan yang tetap gagal beserta output-nya.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-10-22-tahap-2-ketuk-kata-design.md
git commit -m "docs: plan 2C decisions in the spec

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Cek manual pemilik di situs dev (setelah push)**

Untuk pemilik proyek, setelah `main` di-push dan situs dev ter-deploy:
- **Catatan kaki:** buka buku sungguhan yang punya catatan kaki, misalnya terbitan Standard Ebooks. Ketuk angka catatan, lalu cek bahwa isinya muncul di popup dan halaman tidak pindah.
- **Kembali:**
  - lompat lewat daftar isi, slider, panel anotasi, dan tautan biasa; tombol Kembali muncul di kiri bawah dan membawa kembali;
  - tombol tidak bertabrakan dengan pesan di bawah, misalnya tawaran posisi perangkat lain.
- **Sisa waktu:**
  - "±… mnt lagi di bab ini" muncul di footer;
  - setelah membaca sekitar 10 halaman dengan tenang, angkanya menyesuaikan;
  - di desktop, sisa waktu buku ikut tampil.
- **Setelan:**
  - *Rata kiri-kanan* dan pemenggalan kata terlihat di buku berbahasa Inggris;
  - di desktop yang lebar, *Satu halaman* menghapus kolom kedua dan *Otomatis* mengembalikannya;
  - pilihan dua halaman tidak muncul di HP.
- **Layar menyala:** di Android, layar tidak mati selama membaca melebihi batas waktu layar. Setelah pindah ke aplikasi lain lalu kembali, layar tetap menyala.
