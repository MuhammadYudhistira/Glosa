# Glosa: Kartu Kutipan: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pembaca bisa membuat gambar kartu dari kutipan buku, dengan satu kata yang disorot beserta artinya dari kamus Glosa. Kartu itu bisa dibagikan lewat jendela berbagi sistem, disimpan sebagai PNG, atau disalin.

**Architecture:**
- **Modul murni** di `src/lib/quote-card/`:
  - `quote-text` merapikan dan memotong kutipan, lalu memecahnya menjadi token.
  - `layout` menghitung posisi semua teks dan bentuk di kartu dengan fungsi `measure` yang disuntikkan, sehingga bisa dites tanpa canvas.
  - `themes` menyimpan warna tema, mengambil warna sampul, dan membuat bintang.
  - `prefs` mengingat pilihan pengguna.
  - `share` menangani berbagi, menyimpan, dan menyalin.
- **Modul browser:**
  - `draw` menggambar hasil layout ke Canvas 2D.
  - `fonts` menunggu font siap.
- **Komponen** `QuoteCardDialog` menyusun semuanya. Dialog ini dibuka dari tiga pintu: menu seleksi, popup highlight, dan daftar Anotasi. Sampul diambil dari EPUB yang sedang terbuka lewat `ReaderControls.cover()`.
- **Server:** tidak ada perubahan server, database, atau Kebijakan Privasi.

**Tech Stack:** TanStack Start + Router, React 19, TypeScript 6, Tailwind CSS 4, Base UI (Dialog, Popover), Canvas 2D, Web Share API Level 2, Async Clipboard API, foliate-js (`getCover()`), Vitest + Testing Library (jsdom), Playwright.

**Spec:** [`docs/superpowers/specs/2026-10-31-kartu-kutipan-design.md`](../specs/2026-10-31-kartu-kutipan-design.md).

## Global Constraints

- **Bahasa:**
  - Teks UI berbahasa Indonesia, komentar kode berbahasa Inggris.
  - Array ditulis `Array<T>` dan `ReadonlyArray<T>`, seperti kode yang ada.
  - Prettier tanpa titik koma.
- **Dependensi:** tidak ada dependensi baru.
- **Server:** tidak ada tabel, migrasi, server function, atau perubahan Kebijakan Privasi.
- **Ukuran kartu (persis dari spec):** Story 1080×1920, Persegi 1080×1080.
- **Batas kutipan (persis dari spec):** 300 karakter, dipotong di batas kata dan diakhiri "…".
- **Arti di kartu (persis dari spec):** 1 sampai 3 arti dari satu kelas kata. Default: arti pertama dari kelas kata pertama.
- **Teks UI (persis dari spec):**

  | Tempat | Teks |
  |---|---|
  | Judul dialog | *Bagikan kutipan* |
  | Petunjuk | *Ketuk kata di kutipan untuk menyorotnya* |
  | Label kontrol | *Layout* (Glosa, Kutipan), *Ukuran* (Story, Persegi), *Tema* (Sampul, Kertas, Malam) |
  | Kata | *Kata: …*, *Tanpa kata*, *Arti di kartu (pilih 1–3)* |
  | Tombol | *Bagikan*, *Simpan gambar*, *Salin gambar* |

- **Pesan (persis dari spec):**
  - *Kutipan dipendekkan menjadi 300 karakter.*
  - *Arti belum bisa dimuat.*
  - *Belum ada arti untuk kata ini.*
  - *Link Glosa sudah disalin, tempel di stiker Link Instagram.*
  - *Gagal membagikan. Coba Simpan gambar.*
  - *Gagal menyalin gambar. Coba Simpan gambar.*
  - *Gambar sudah disalin.* (setelah Salin gambar berhasil)
- **Teks berbagi (persis):** `Dari {judul}, dibaca di Glosa → {location.origin}`. Nama file: `glosa-{judul-pendek}.png`.
- **Kelas kata** memakai `POS_LABELS` dari `src/lib/words/labels.ts` (*kata sifat*, *kata benda*, …).
- **Breakpoint desktop:** `(min-width: 1024px)`, lewat `useWideScreen()` di `src/lib/use-wide-screen.ts`.
- **Lint:** `@tanstack/eslint-config` memakai `no-unnecessary-condition`. Untuk fitur browser yang mungkin tidak ada, ketik sebagai `Partial<...>` (contoh di Task 4), jangan dengan `typeof x === "function"` pada tipe yang selalu ada.
- **Line ending:** LF. Di Windows, jangan menulis file lewat Python tanpa `newline=''` dan encoding UTF-8, karena `styles.css` memuat `§`.
- **Perintah cek:** `npm run typecheck`, `npm run lint`, `npm run check` (Prettier), dan `npx vitest run <file>`. Kalau `npm run check` gagal, jalankan `npx prettier --write <file>`.
- **E2E:**
  - Jalankan dengan `--workers=2`.
  - Kalau port 3000 dipegang aplikasi lain (cek `curl -sL localhost:3000/login | grep -o "<title>[^<]*"`), jalankan dengan config sementara di port 3100. Jangan matikan server lain.
  - Kegagalan tunggal dijalankan ulang sendirian sebelum disebut regresi.
  - Proyek Supabase dev dipakai bersama: test hanya menulis baris milik member test-nya sendiri.

---

### Task 1: Teks kutipan

**Files:**
- Create: `src/lib/quote-card/quote-text.ts`
- Test: `src/lib/quote-card/quote-text.test.ts`

**Interfaces:**
- Consumes: `normalizeWord`, `isLookupWord` dari `src/lib/words/normalize.ts`; `SavedForms` dari `src/lib/words/saved-marks.ts` (`{ set: ReadonlySet<string>; maxWords: number }`).
- Produces:
  - `MAX_QUOTE_LENGTH = 300`
  - `type PreparedQuote = { text: string; cut: boolean }`
  - `prepareQuote(raw: string): PreparedQuote`
  - `type QuoteToken = { text: string; word: string | null }`: `text` seperti tertulis, termasuk tanda baca; `word` adalah bentuk cari, atau `null` kalau token itu tidak bisa disorot.
  - `quoteTokens(text: string): Array<QuoteToken>`
  - `defaultWord(tokens: ReadonlyArray<QuoteToken>, saved: SavedForms): number | null`, yaitu indeks token.

- [ ] **Step 1: Tulis test yang gagal**

`src/lib/quote-card/quote-text.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { savedFormsOf } from "@/lib/words/saved-marks"
import {
  MAX_QUOTE_LENGTH,
  defaultWord,
  prepareQuote,
  quoteTokens,
} from "./quote-text"

describe("prepareQuote", () => {
  it("keeps a short quote on one line, without the outer quotation marks", () => {
    expect(prepareQuote("  “It is a capital\n mistake.”  ")).toEqual({
      text: "It is a capital mistake.",
      cut: false,
    })
  })

  it("cuts a long quote at a word, with an ellipsis", () => {
    const { text, cut } = prepareQuote("word, ".repeat(80))
    expect(cut).toBe(true)
    expect(text.length).toBeLessThanOrEqual(MAX_QUOTE_LENGTH)
    expect(text.endsWith("word…")).toBe(true)
    expect(text.slice(0, -1).split(", ").every((piece) => piece === "word"))
      .toBe(true)
  })

  it("cuts inside a word only when the quote has no space near the end", () => {
    const { text, cut } = prepareQuote("a".repeat(400))
    expect(cut).toBe(true)
    expect(text).toBe(`${"a".repeat(MAX_QUOTE_LENGTH - 1)}…`)
  })
})

describe("quoteTokens", () => {
  it("splits at spaces and gives each word its lookup form", () => {
    expect(quoteTokens("“It's Holmes's data—really, 1891.")).toEqual([
      { text: "“It's", word: "it's" },
      { text: "Holmes's", word: "holmes" },
      { text: "data—really,", word: null },
      { text: "1891.", word: null },
    ])
  })
})

describe("defaultWord", () => {
  const tokens = quoteTokens("Some hundreds of times, he said.")

  it("picks the first word saved in Kosakata, inflected forms too", () => {
    const saved = savedFormsOf({ hundred: ["hundred", "hundreds"], say: ["said"] })
    expect(defaultWord(tokens, saved)).toBe(1)
  })

  it("picks none when no word is saved", () => {
    expect(defaultWord(tokens, savedFormsOf({}))).toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/lib/quote-card/quote-text.test.ts`
Expected: FAIL (`Failed to resolve import "./quote-text"`).

- [ ] **Step 3: Tulis implementasi**

`src/lib/quote-card/quote-text.ts`:

```ts
import { isLookupWord, normalizeWord } from "@/lib/words/normalize"
import type { SavedForms } from "@/lib/words/saved-marks"

/** The longest quote a card carries (spec kartu kutipan, decision 11). */
export const MAX_QUOTE_LENGTH = 300
/** A cut may go back this far to end on a whole word. */
const MIN_CUT = 200
/** Double quotation marks: the card draws its own. */
const OUTER_QUOTES = /^["“”„«»]+|["“”„«»]+$/gu
const TRAILING = /[\s,;:—–-]+$/u

export type PreparedQuote = { text: string; cut: boolean }

/**
 * A quote as a card shows it: one line, no outer quotation marks, at most
 * 300 characters, cut at a word with an ellipsis.
 */
export function prepareQuote(raw: string): PreparedQuote {
  const text = raw
    .replace(/\s+/gu, " ")
    .trim()
    .replace(OUTER_QUOTES, "")
    .trim()
  if (text.length <= MAX_QUOTE_LENGTH) return { text, cut: false }
  const head = text.slice(0, MAX_QUOTE_LENGTH - 1)
  const space = head.lastIndexOf(" ")
  const whole = space >= MIN_CUT ? head.slice(0, space) : head
  return { text: `${whole.replace(TRAILING, "")}…`, cut: true }
}

/** A piece of the quote between spaces, and the word it looks up, if any. */
export type QuoteToken = { text: string; word: string | null }

export function quoteTokens(text: string): Array<QuoteToken> {
  return (text.match(/\S+/gu) ?? []).map((piece) => {
    const word = normalizeWord(piece)
    return { text: piece, word: isLookupWord(word) ? word : null }
  })
}

/** The first word of the quote saved in Kosakata (spec kartu kutipan, decision 2). */
export function defaultWord(
  tokens: ReadonlyArray<QuoteToken>,
  saved: SavedForms
): number | null {
  const index = tokens.findIndex(
    (token) => token.word !== null && saved.set.has(token.word)
  )
  return index === -1 ? null : index
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run src/lib/quote-card/quote-text.test.ts`
Expected: PASS (6 test).

Kalau test `quoteTokens` gagal karena hasil `normalizeWord` berbeda, misalnya `"“It's"` menjadi `"it's"` atau tidak, sesuaikan nilai yang diharapkan di test dengan keluaran nyata `normalizeWord`. Fungsi itu milik reader dan tidak boleh diubah. Yang wajib tetap benar: kata ber-em-dash dan angka menghasilkan `word: null`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quote-card/quote-text.ts src/lib/quote-card/quote-text.test.ts
git commit -m "feat(quote-card): prepare a quote and pick its saved word"
```

---

### Task 2: Font dan layout kartu

**Files:**
- Create: `src/lib/quote-card/fonts.ts`
- Create: `src/lib/quote-card/layout.ts`
- Test: `src/lib/quote-card/fonts.test.ts`
- Test: `src/lib/quote-card/layout.test.ts`

**Interfaces:**
- Consumes: `QuoteToken`, `quoteTokens`, `prepareQuote` dari Task 1; `SITE_NAME`, `SITE_TAGLINE` dari `src/lib/site.ts`.
- Produces (`fonts.ts`):
  - `SERIF`, `SANS`, `HAND` (string keluarga font canvas)
  - `font(size: number, family: string, style?: { bold?: boolean; italic?: boolean }): string`, misalnya `"700 76px \"Libre Caslon Text\", Georgia, serif"`
  - `cardFontsReady(waitMs?: number): Promise<void>`
- Produces (`layout.ts`):
  - `CARD_LAYOUTS = ["kutipan", "glosa"]`, `type CardLayoutKind`
  - `CARD_SIZES = ["story", "square"]`, `type CardSize`
  - `CARD_DIMENSIONS: Record<CardSize, { width: number; height: number }>`
  - `type Measure = (text: string, font: string) => number`
  - `type CardColor = "text" | "soft" | "accent"`
  - `type CardTurn = { angle: number; x: number; y: number }`
  - `type CardItem` = `text` | `mark` | `rule` | `cover` (lihat kode)
  - `type CardHit = { token: number; x: number; y: number; width: number; height: number }`
  - `type CardWord = { label: string; pos: string; meanings: string }`
  - `type CardInput = { layout; size; tokens; highlight: number | null; word: CardWord | null; title; author; hasCover: boolean; host: string }`
  - `type CardLayout = { width; height; fontSize; fits: boolean; items: Array<CardItem>; hits: Array<CardHit> }`
  - `breakLines(widths: ReadonlyArray<number>, space: number, maxWidth: number): Array<Array<number>>`
  - `layoutCard(input: CardInput, measure: Measure): CardLayout`

- [ ] **Step 1: Tulis test font yang gagal**

`src/lib/quote-card/fonts.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { HAND, SERIF, cardFontsReady, font } from "./fonts"

afterEach(() => {
  Reflect.deleteProperty(document, "fonts")
})

describe("font", () => {
  it("writes a canvas font", () => {
    expect(font(76, SERIF, { bold: true })).toBe(
      '700 76px "Libre Caslon Text", Georgia, serif'
    )
    expect(font(30.04, HAND, { italic: true })).toBe(
      'italic 400 30px "Caveat Variable", cursive'
    )
  })
})

describe("cardFontsReady", () => {
  it("is ready at once without the Font Loading API", async () => {
    await expect(cardFontsReady()).resolves.toBeUndefined()
  })

  it("waits for the card's fonts", async () => {
    const load = vi.fn(async () => [])
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { load },
    })
    await cardFontsReady()
    expect(load).toHaveBeenCalled()
  })

  it("stops waiting after the time given", async () => {
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { load: () => new Promise(() => undefined) },
    })
    await expect(cardFontsReady(10)).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/quote-card/fonts.test.ts`
Expected: FAIL (`Failed to resolve import "./fonts"`).

- [ ] **Step 3: Tulis `fonts.ts`**

```ts
/** The app's own fonts (fontsource, loaded by styles.css), as canvas families. */
export const SERIF = '"Libre Caslon Text", Georgia, serif'
export const SANS = '"Atkinson Hyperlegible", system-ui, sans-serif'
export const HAND = '"Caveat Variable", cursive'
/** How long a card waits for its fonts before it is drawn anyway (spec kartu kutipan §7). */
export const FONT_WAIT_MS = 3000

/** A canvas font string, the size rounded to a tenth of a pixel. */
export function font(
  size: number,
  family: string,
  style: { bold?: boolean; italic?: boolean } = {}
): string {
  const px = Math.round(size * 10) / 10
  return `${style.italic ? "italic " : ""}${style.bold ? 700 : 400} ${px}px ${family}`
}

const CARD_FONTS = [
  font(40, SERIF),
  font(40, SERIF, { bold: true }),
  font(40, SANS),
  font(40, SANS, { bold: true }),
  font(40, SANS, { italic: true }),
  font(40, HAND),
]

/**
 * Resolves once the card's fonts are loaded, or after `waitMs`, so a canvas
 * never draws with a stand-in font it could have avoided. Never rejects.
 */
export async function cardFontsReady(waitMs = FONT_WAIT_MS): Promise<void> {
  const fonts = (document as Partial<Pick<Document, "fonts">>).fonts
  if (!fonts) return
  const loaded = Promise.all(
    CARD_FONTS.map((name) => fonts.load(name).catch(() => []))
  ).then(() => undefined)
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, waitMs)
  })
  await Promise.race([loaded, late])
  clearTimeout(timer)
}
```

- [ ] **Step 4: Jalankan test font, pastikan lulus**

Run: `npx vitest run src/lib/quote-card/fonts.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Tulis test layout yang gagal**

`src/lib/quote-card/layout.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { SITE_TAGLINE } from "@/lib/site"
import { HAND } from "./fonts"
import {
  CARD_LAYOUTS,
  CARD_SIZES,
  type CardInput,
  type CardItem,
  type Measure,
  breakLines,
  layoutCard,
} from "./layout"
import { prepareQuote, quoteTokens } from "./quote-text"

/** Half the font size per character, like the canvas stub in src/test/canvas.ts. */
const measure: Measure = (text, fontName) =>
  text.length * Number(/([\d.]+)px/.exec(fontName)?.[1] ?? 10) * 0.5

const SHORT = "It is a capital mistake to theorize before one has data."
const LONG = prepareQuote(
  "You see, but you do not observe. The distinction is clear. ".repeat(6)
).text
const CAPITAL = { label: "capital", pos: "kata sifat", meanings: "utama, besar" }

function input(overrides: Partial<CardInput> = {}): CardInput {
  return {
    layout: "kutipan",
    size: "story",
    tokens: quoteTokens(SHORT),
    highlight: 3,
    word: CAPITAL,
    title: "A Scandal in Bohemia",
    author: "Arthur Conan Doyle",
    hasCover: true,
    host: "glos-a.tech",
    ...overrides,
  }
}

type TextItem = Extract<CardItem, { kind: "text" }>
const textsOf = (items: Array<CardItem>) =>
  items.filter((item): item is TextItem => item.kind === "text")
const textOf = (items: Array<CardItem>, text: string) =>
  textsOf(items).find((item) => item.text === text)

describe("breakLines", () => {
  it("balances the lines", () => {
    const lines = breakLines(Array(10).fill(152), 38, 888)
    expect(lines).toHaveLength(3)
    expect(lines.map((line) => line.length).sort()).toEqual([3, 3, 4])
    expect(lines.flat()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it("puts a piece wider than the line on its own", () => {
    expect(breakLines([100, 2000, 100], 10, 888)).toEqual([[0], [1], [2]])
  })

  it("has no lines for no pieces", () => {
    expect(breakLines([], 10, 888)).toEqual([])
  })
})

describe("layoutCard", () => {
  it("draws a short quote at the largest size", () => {
    const card = layoutCard(input(), measure)
    expect(card).toMatchObject({ width: 1080, height: 1920, fontSize: 76, fits: true })
    expect(textOf(card.items, "“It")).toBeDefined()
    expect(textOf(card.items, "data.”")).toBeDefined()
  })

  it.each(CARD_LAYOUTS.flatMap((layout) => CARD_SIZES.map((size) => [layout, size] as const)))(
    "fits a 300-character quote in %s, %s",
    (layout, size) => {
      const card = layoutCard(
        input({ layout, size, tokens: quoteTokens(LONG), highlight: 2 }),
        measure
      )
      expect(card.fits).toBe(true)
    }
  )

  it("Kutipan: the word stands out in the quote, and its meaning sits below", () => {
    const card = layoutCard(input(), measure)
    const inQuote = textsOf(card.items).filter((item) => item.text === "capital")
    expect(inQuote).toHaveLength(2)
    expect(inQuote[0]).toMatchObject({ color: "accent" })
    expect(inQuote[0].font.startsWith("700 ")).toBe(true)
    expect(textOf(card.items, "kata sifat")).toMatchObject({ color: "soft" })
    const meaning = textOf(card.items, "utama, besar")
    expect(meaning).toMatchObject({ color: "accent" })
    expect(meaning?.font.endsWith(HAND)).toBe(true)
    expect(card.items.some((item) => item.kind === "rule")).toBe(true)
    expect(meaning && meaning.y > inQuote[0].y).toBe(true)
  })

  it("Glosa: a highlighter behind the word, the meaning written above it", () => {
    const card = layoutCard(input({ layout: "glosa" }), measure)
    const mark = card.items.find((item) => item.kind === "mark")
    const hit = card.hits.find((candidate) => candidate.token === 3)
    if (mark?.kind !== "mark" || !hit) throw new Error("no mark or hit")
    expect(mark.x).toBeLessThanOrEqual(hit.x)
    expect(mark.x + mark.width).toBeGreaterThanOrEqual(hit.x + hit.width)
    const word = textOf(card.items, "capital")
    const gloss = textOf(card.items, "utama, besar")
    expect(textOf(card.items, "(kata sifat)")).toBeDefined()
    expect(gloss && word && gloss.y < word.y).toBe(true)
    expect(card.items.some((item) => item.kind === "rule")).toBe(false)
    expect(card.items.indexOf(mark)).toBeLessThan(card.items.indexOf(word as CardItem))
  })

  it("Glosa: the handwriting stays inside the card at the end of a line", () => {
    const word = { ...CAPITAL, meanings: "sangat penting sekali, utama, besar" }
    const tokens = quoteTokens(SHORT)
    const card = layoutCard(
      input({ layout: "glosa", word, highlight: tokens.length - 1 }),
      measure
    )
    const hand = textsOf(card.items).filter((item) => item.font.endsWith(HAND))
    expect(hand).toHaveLength(2)
    for (const item of hand) {
      expect(item.x).toBeGreaterThanOrEqual(96)
      expect(item.x + measure(item.text, item.font)).toBeLessThanOrEqual(1080 - 96 + 0.5)
    }
  })

  it("knows where each word is, for a tap", () => {
    const card = layoutCard(input(), measure)
    expect(card.hits.map((hit) => hit.token)).toEqual(
      quoteTokens(SHORT).map((_, i) => i)
    )
    for (const hit of card.hits) expect(hit.width).toBeGreaterThan(0)
  })

  it("without a word: no highlighter, no rule, no meaning", () => {
    for (const layout of CARD_LAYOUTS) {
      const card = layoutCard(input({ layout, highlight: null }), measure)
      expect(card.items.some((item) => item.kind === "mark" || item.kind === "rule"))
        .toBe(false)
      expect(textOf(card.items, "utama, besar")).toBeUndefined()
    }
  })

  it("puts the title beside the cover, or at the edge without one", () => {
    const withCover = layoutCard(input(), measure)
    expect(withCover.items.find((item) => item.kind === "cover")).toMatchObject({
      x: 96,
      width: 64,
    })
    expect(textOf(withCover.items, "A Scandal in Bohemia")?.x).toBe(96 + 64 + 28)
    const without = layoutCard(input({ hasCover: false }), measure)
    expect(without.items.some((item) => item.kind === "cover")).toBe(false)
    expect(textOf(without.items, "A Scandal in Bohemia")?.x).toBe(96)
  })

  it("shortens a long title with an ellipsis", () => {
    const card = layoutCard(input({ title: "Supercalifragilistic ".repeat(10) }), measure)
    const title = textsOf(card.items)[0]
    expect(title.text.endsWith("…")).toBe(true)
    expect(title.x + measure(title.text, title.font)).toBeLessThanOrEqual(1080 - 96)
  })

  it("signs with Glosa and the site, the tagline only on a Kutipan story", () => {
    const story = layoutCard(input(), measure)
    expect(textOf(story.items, "Glosa")).toMatchObject({ x: 96, y: 1920 - 90 })
    const host = textOf(story.items, "glos-a.tech")
    expect(host && host.x + measure(host.text, host.font)).toBeCloseTo(1080 - 96)
    expect(textOf(story.items, SITE_TAGLINE)).toBeDefined()
    expect(textOf(layoutCard(input({ size: "square" }), measure).items, SITE_TAGLINE))
      .toBeUndefined()
    expect(textOf(layoutCard(input({ layout: "glosa" }), measure).items, SITE_TAGLINE))
      .toBeUndefined()
  })
})
```

- [ ] **Step 6: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/quote-card/layout.test.ts`
Expected: FAIL (`Failed to resolve import "./layout"`).

- [ ] **Step 7: Tulis `layout.ts`**

```ts
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site"
import { HAND, SANS, SERIF, font } from "./fonts"
import type { QuoteToken } from "./quote-text"

/** The two layouts (spec kartu kutipan §3.2). */
export const CARD_LAYOUTS = ["kutipan", "glosa"] as const
export type CardLayoutKind = (typeof CARD_LAYOUTS)[number]
/** Story 9:16 and Persegi 1:1 (spec kartu kutipan, decision 5). */
export const CARD_SIZES = ["story", "square"] as const
export type CardSize = (typeof CARD_SIZES)[number]
export const CARD_DIMENSIONS: Record<
  CardSize,
  { width: number; height: number }
> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
}

/** A text's width in a canvas font; the dialog passes the canvas's own. */
export type Measure = (text: string, font: string) => number
/** A theme colour: themes.ts says which. */
export type CardColor = "text" | "soft" | "accent"
/** A turn of `angle` radians around (x, y). */
export type CardTurn = { angle: number; x: number; y: number }
/** Something to draw, in the card's own pixels; y of a text is its baseline. */
export type CardItem =
  | {
      kind: "text"
      text: string
      x: number
      y: number
      font: string
      color: CardColor
      turn?: CardTurn
    }
  | {
      kind: "mark"
      x: number
      y: number
      width: number
      height: number
      turn: CardTurn
    }
  | { kind: "rule"; x: number; y: number; width: number; height: number }
  | { kind: "cover"; x: number; y: number; width: number; height: number }
/** Where a quote token is, for a tap on the preview. */
export type CardHit = {
  token: number
  x: number
  y: number
  width: number
  height: number
}
/** The highlighted word as the card writes it. */
export type CardWord = { label: string; pos: string; meanings: string }
export type CardInput = {
  layout: CardLayoutKind
  size: CardSize
  tokens: ReadonlyArray<QuoteToken>
  /** The highlighted token; ignored without a word. */
  highlight: number | null
  word: CardWord | null
  title: string
  author: string
  hasCover: boolean
  /** The site's address, e.g. glos-a.tech. */
  host: string
}
export type CardLayout = {
  width: number
  height: number
  /** The quote's font size. */
  fontSize: number
  /** False when even the smallest size overflows the room for the quote. */
  fits: boolean
  /** In drawing order. */
  items: Array<CardItem>
  hits: Array<CardHit>
}

const PAD = 96
const TOP = 110
const BOTTOM = 90
const COVER_WIDTH = 64
const COVER_HEIGHT = 94
const COVER_GAP = 28
const QUOTE_SIZES: Record<
  CardLayoutKind,
  Record<CardSize, { max: number; min: number }>
> = {
  kutipan: { story: { max: 76, min: 40 }, square: { max: 60, min: 32 } },
  glosa: { story: { max: 68, min: 36 }, square: { max: 54, min: 30 } },
}
const SIZE_STEP = 2
/** Room between the header and the quote, and between the quote and the footer. */
const GAPS: Record<CardSize, { head: number; foot: number }> = {
  story: { head: 110, foot: 80 },
  square: { head: 64, foot: 48 },
}
const RULE_GAP = 56
const RULE_WIDTH = 84
const RULE_HEIGHT = 6
const LABEL_SIZE = 54
const POS_SIZE = 30
const MEANING_SIZES = [56, 44] as const
const GLOSS_TURN = -0.05
const MARK_TURN = -0.02

type Piece = {
  token: number
  text: string
  font: string
  width: number
  color: CardColor
}
type Metrics = { lineHeight: number; first: number; tail: number }
type SetQuote = {
  size: number
  pieces: Array<Piece>
  lines: Array<Array<number>>
  space: number
  metrics: Metrics
  height: number
}

/** The text cut to fit `maxWidth`, with an ellipsis when cut. */
function fitText(
  text: string,
  fontName: string,
  maxWidth: number,
  measure: Measure
): string {
  if (measure(text, fontName) <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && measure(`${cut}…`, fontName) > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return `${cut.trimEnd()}…`
}

/**
 * Line breaks that keep lines about as long as each other, like CSS
 * `text-wrap: balance`: the least sum of squared slack. A piece wider than
 * the line sits alone. Each line lists its piece indexes.
 */
export function breakLines(
  widths: ReadonlyArray<number>,
  space: number,
  maxWidth: number
): Array<Array<number>> {
  const count = widths.length
  const cost = Array<number>(count + 1).fill(Number.POSITIVE_INFINITY)
  const from = Array<number>(count + 1).fill(0)
  cost[0] = 0
  for (let end = 1; end <= count; end++) {
    let width = -space
    for (let start = end - 1; start >= 0; start--) {
      width += widths[start] + space
      if (width > maxWidth && start < end - 1) break
      const slack = maxWidth - width
      const total = cost[start] + slack * slack
      if (total < cost[end]) {
        cost[end] = total
        from[end] = start
      }
    }
  }
  const lines: Array<Array<number>> = []
  for (let end = count; end > 0; end = from[end]) {
    lines.unshift(
      Array.from({ length: end - from[end] }, (_, i) => from[end] + i)
    )
  }
  return lines
}

function litToken(input: CardInput): number | null {
  return input.word && input.highlight !== null ? input.highlight : null
}

function quotePieces(
  input: CardInput,
  size: number,
  maxWidth: number,
  measure: Measure
): Array<Piece> {
  const last = input.tokens.length - 1
  const lit = input.layout === "kutipan" ? litToken(input) : null
  return input.tokens.map((token, i) => {
    const text = `${i === 0 ? "“" : ""}${token.text}${i === last ? "”" : ""}`
    const bold = i === lit
    let pieceFont = font(size, SERIF, { bold })
    let width = measure(text, pieceFont)
    // A word wider than the line is made smaller, never cut (spec §3.3).
    if (width > maxWidth) {
      pieceFont = font((size * maxWidth) / width, SERIF, { bold })
      width = measure(text, pieceFont)
    }
    return {
      token: i,
      text,
      font: pieceFont,
      width,
      color: bold ? "accent" : "text",
    }
  })
}

/** Glosa with a word leaves room above each line for the handwriting. */
function metricsOf(layout: CardLayoutKind, size: number, gloss: boolean): Metrics {
  if (gloss) return { lineHeight: size * 2.1, first: size * 1.75, tail: size * 0.35 }
  const lineHeight = size * (layout === "glosa" ? 1.3 : 1.25)
  return { lineHeight, first: size * 0.95, tail: size * 0.3 }
}

function setQuote(
  input: CardInput,
  size: number,
  maxWidth: number,
  gloss: boolean,
  measure: Measure
): SetQuote {
  const pieces = quotePieces(input, size, maxWidth, measure)
  const space = measure(" ", font(size, SERIF))
  const lines = breakLines(
    pieces.map((piece) => piece.width),
    space,
    maxWidth
  )
  const metrics = metricsOf(input.layout, size, gloss)
  const height =
    lines.length === 0
      ? 0
      : metrics.first + (lines.length - 1) * metrics.lineHeight + metrics.tail
  return { size, pieces, lines, space, metrics, height }
}

/** The largest size whose quote, and word below it, fit the room (spec §3.3). */
function fitQuote(
  input: CardInput,
  maxWidth: number,
  room: number,
  below: number,
  gloss: boolean,
  measure: Measure
): SetQuote {
  const { max, min } = QUOTE_SIZES[input.layout][input.size]
  for (let size = max; ; size -= SIZE_STEP) {
    const quote = setQuote(input, size, maxWidth, gloss, measure)
    if (quote.height + below <= room || size - SIZE_STEP < min) return quote
  }
}

function meaningLines(
  meanings: string,
  size: number,
  maxWidth: number,
  measure: Measure
): Array<string> {
  const words = meanings.split(" ")
  const handFont = font(size, HAND)
  return breakLines(
    words.map((word) => measure(word, handFont)),
    measure(" ", handFont),
    maxWidth
  ).map((line) => line.map((i) => words[i]).join(" "))
}

/** Kutipan's word under the quote: a rule, the word and its part of speech, the meanings. */
function wordBlock(
  word: CardWord,
  maxWidth: number,
  measure: Measure
): { height: number; items: (top: number) => Array<CardItem> } {
  const labelFont = font(LABEL_SIZE, SERIF, { bold: true })
  const label = fitText(word.label, labelFont, maxWidth * 0.6, measure)
  const labelWidth = measure(label, labelFont)
  const posFont = font(POS_SIZE, SANS, { italic: true })
  const pos = fitText(word.pos, posFont, maxWidth - labelWidth - 18, measure)
  let size: number = MEANING_SIZES[0]
  let lines = meaningLines(word.meanings, size, maxWidth, measure)
  if (lines.length > 2) {
    size = MEANING_SIZES[1]
    lines = meaningLines(word.meanings, size, maxWidth, measure)
  }
  if (lines.length > 2) {
    lines = [
      lines[0],
      fitText(lines.slice(1).join(" "), font(size, HAND), maxWidth, measure),
    ]
  }
  const labelBase = RULE_GAP + RULE_HEIGHT + 64
  const bases = lines.map((_, i) => labelBase + 16 + size + i * size * 1.1)
  const height = (bases.at(-1) ?? labelBase) + size * 0.3
  return {
    height,
    items: (top) => [
      { kind: "rule", x: PAD, y: top + RULE_GAP, width: RULE_WIDTH, height: RULE_HEIGHT },
      { kind: "text", text: label, x: PAD, y: top + labelBase, font: labelFont, color: "text" },
      {
        kind: "text",
        text: pos,
        x: PAD + labelWidth + 18,
        y: top + labelBase,
        font: posFont,
        color: "soft",
      },
      ...lines.map(
        (line, i): CardItem => ({
          kind: "text",
          text: line,
          x: PAD,
          y: top + bases[i],
          font: font(size, HAND),
          color: "accent",
        })
      ),
    ],
  }
}

/** Glosa's handwriting above the word, moved in from the card's edges. */
function glossItems(
  word: CardWord,
  x: number,
  baseline: number,
  size: number,
  width: number,
  measure: Measure
): Array<CardItem> {
  const room = width - 2 * PAD
  const gap = size * 0.15
  const posText = `(${word.pos})`
  let scale = 1
  const widths = () => {
    const meaningFont = font(size * 0.62 * scale, HAND)
    const posFont = font(size * 0.44 * scale, HAND)
    const meaningWidth = measure(word.meanings, meaningFont)
    const total = meaningWidth + gap * scale + measure(posText, posFont)
    return { meaningFont, posFont, meaningWidth, total }
  }
  let sized = widths()
  if (sized.total > room) {
    scale = room / sized.total
    sized = widths()
  }
  const left = Math.max(PAD, Math.min(x - size * 0.1, width - PAD - sized.total))
  const y = baseline - size * 1.05
  const turn = { angle: GLOSS_TURN, x: left, y }
  return [
    { kind: "text", text: word.meanings, x: left, y, font: sized.meaningFont, color: "accent", turn },
    {
      kind: "text",
      text: posText,
      x: left + sized.meaningWidth + gap * scale,
      y,
      font: sized.posFont,
      color: "accent",
      turn,
    },
  ]
}

/** Cover, title and author; returns the header's bottom. */
function header(
  input: CardInput,
  width: number,
  measure: Measure,
  items: Array<CardItem>
): number {
  let textX = PAD
  if (input.hasCover) {
    items.push({ kind: "cover", x: PAD, y: TOP, width: COVER_WIDTH, height: COVER_HEIGHT })
    textX = PAD + COVER_WIDTH + COVER_GAP
  }
  const room = width - PAD - textX
  const titleFont = font(36, SANS, { bold: true })
  items.push({
    kind: "text",
    text: fitText(input.title, titleFont, room, measure),
    x: textX,
    y: TOP + 40,
    font: titleFont,
    color: "text",
  })
  if (input.author) {
    const authorFont = font(30, SANS)
    items.push({
      kind: "text",
      text: fitText(input.author, authorFont, room, measure),
      x: textX,
      y: TOP + 84,
      font: authorFont,
      color: "soft",
    })
  }
  return TOP + COVER_HEIGHT
}

/** Glosa, the site and (Kutipan story only) the tagline; returns the footer's top. */
function footer(
  input: CardInput,
  width: number,
  height: number,
  measure: Measure,
  items: Array<CardItem>
): number {
  const base = height - BOTTOM
  const logoFont = font(52, SERIF, { bold: true })
  items.push({ kind: "text", text: SITE_NAME, x: PAD, y: base, font: logoFont, color: "text" })
  const hostFont = font(30, SANS)
  const host = fitText(
    input.host,
    hostFont,
    width - 2 * PAD - measure(SITE_NAME, logoFont) - 32,
    measure
  )
  items.push({
    kind: "text",
    text: host,
    x: width - PAD - measure(host, hostFont),
    y: base,
    font: hostFont,
    color: "soft",
  })
  let top = base - 52
  if (input.layout === "kutipan" && input.size === "story") {
    const taglineFont = font(28, SANS)
    items.push({
      kind: "text",
      text: SITE_TAGLINE,
      x: width - PAD - measure(SITE_TAGLINE, taglineFont),
      y: base - 46,
      font: taglineFont,
      color: "soft",
    })
    top -= 46
  }
  return top
}

/** Where everything on a card goes (spec kartu kutipan §3). */
export function layoutCard(input: CardInput, measure: Measure): CardLayout {
  const { width, height } = CARD_DIMENSIONS[input.size]
  const maxWidth = width - 2 * PAD
  const frame: Array<CardItem> = []
  const gaps = GAPS[input.size]
  const top = header(input, width, measure, frame) + gaps.head
  const room = footer(input, width, height, measure, frame) - gaps.foot - top

  const lit = litToken(input)
  const word = lit === null ? null : input.word
  const gloss = input.layout === "glosa" && word !== null
  const block =
    input.layout === "kutipan" && word ? wordBlock(word, maxWidth, measure) : null
  const quote = fitQuote(input, maxWidth, room, block?.height ?? 0, gloss, measure)
  const total = quote.height + (block?.height ?? 0)
  const blockTop = top + Math.max(0, (room - total) / 2)

  const marks: Array<CardItem> = []
  const texts: Array<CardItem> = []
  const glosses: Array<CardItem> = []
  const hits: Array<CardHit> = []
  quote.lines.forEach((line, row) => {
    const baseline = blockTop + quote.metrics.first + row * quote.metrics.lineHeight
    let x = PAD
    for (const index of line) {
      const piece = quote.pieces[index]
      texts.push({ kind: "text", text: piece.text, x, y: baseline, font: piece.font, color: piece.color })
      hits.push({
        token: piece.token,
        x,
        y: baseline - quote.size,
        width: piece.width,
        height: quote.metrics.lineHeight,
      })
      if (gloss && word && piece.token === lit) {
        const markY = baseline - quote.size * 0.45
        const markHeight = quote.size * 0.5
        marks.push({
          kind: "mark",
          x: x - quote.size * 0.08,
          y: markY,
          width: piece.width + quote.size * 0.16,
          height: markHeight,
          turn: { angle: MARK_TURN, x: x + piece.width / 2, y: markY + markHeight / 2 },
        })
        glosses.push(...glossItems(word, x, baseline, quote.size, width, measure))
      }
      x += piece.width + quote.space
    }
  })

  return {
    width,
    height,
    fontSize: quote.size,
    fits: total <= room,
    items: [
      ...frame,
      ...marks,
      ...texts,
      ...glosses,
      ...(block ? block.items(blockTop + quote.height) : []),
    ],
    hits,
  }
}
```

- [ ] **Step 8: Jalankan test layout, pastikan lulus**

Run: `npx vitest run src/lib/quote-card/layout.test.ts`
Expected: PASS (13 test, termasuk 4 kasus `it.each`).

Kalau test "fits a 300-character quote" gagal di salah satu kombinasi, turunkan `min` untuk kombinasi itu di `QUOTE_SIZES` sebanyak 2 sampai lulus, dan catat nilainya di laporan. Jangan melonggarkan test.

- [ ] **Step 9: Format, typecheck, lint**

Run: `npx prettier --write src/lib/quote-card && npm run typecheck && npm run lint`
Expected: tanpa error.

- [ ] **Step 10: Commit**

```bash
git add src/lib/quote-card/fonts.ts src/lib/quote-card/fonts.test.ts src/lib/quote-card/layout.ts src/lib/quote-card/layout.test.ts
git commit -m "feat(quote-card): lay out a card in two layouts and two sizes"
```

---

### Task 3: Tema dan menggambar ke canvas

**Files:**
- Create: `src/lib/quote-card/themes.ts`
- Create: `src/lib/quote-card/draw.ts`
- Create: `src/test/canvas.ts`
- Test: `src/lib/quote-card/themes.test.ts`
- Test: `src/lib/quote-card/draw.test.ts`

**Interfaces:**
- Consumes: `CardLayout`, `CardColor`, `CardTurn`, `CardInput`, `layoutCard`, `Measure` dari Task 2; `quoteTokens` dari Task 1.
- Produces (`themes.ts`):
  - `CARD_THEMES = ["sampul", "kertas", "malam"]`, `type CardThemeId`
  - `type CardTheme = { label: string; text: string; soft: string; accent: string }`
  - `THEMES: Record<CardThemeId, CardTheme>`
  - `DEFAULT_COVER_COLORS`, `PAPER`, `NIGHT`, `MARK_ALPHA`
  - `luminance(rgb: readonly [number, number, number]): number`
  - `coverPalette(pixels: ArrayLike<number>, width: number, height: number): Array<string> | null`
  - `type Star = { x: number; y: number; radius: number; alpha: number }`
  - `starField(seed: string, width: number, height: number, count?: number): Array<Star>`
- Produces (`draw.ts`):
  - `type CardArt = { cover: CanvasImageSource | null; palette: ReadonlyArray<string> | null; seed: string }`
  - `drawCard(context: CanvasRenderingContext2D, layout: CardLayout, themeId: CardThemeId, art: CardArt): void`
- Produces (`src/test/canvas.ts`):
  - `fakeMeasure: Measure`
  - `type FakeCanvas = { context: CanvasRenderingContext2D; calls: Array<{ name: string; args: Array<unknown> }>; texts: () => Array<string> }`
  - `fakeContext(): FakeCanvas`
  - `stubCanvas(): FakeCanvas`, yang memasang context palsu ke setiap canvas jsdom dan `toBlob` yang langsung memberi blob PNG kecil.

- [ ] **Step 1: Tulis `src/test/canvas.ts`**

Ini helper test, bukan kode produksi, jadi tidak perlu test sendiri.

```ts
import { vi } from "vitest"
import type { Measure } from "@/lib/quote-card/layout"

/** Half the font size per character: what the fake canvas measures. */
export const fakeMeasure: Measure = (text, font) =>
  text.length * Number(/([\d.]+)px/.exec(font)?.[1] ?? 10) * 0.5

export type FakeCanvas = {
  context: CanvasRenderingContext2D
  calls: Array<{ name: string; args: Array<unknown> }>
  /** Every text drawn so far, in order. */
  texts: () => Array<string>
}

/** A 2D context that records its calls and measures with fakeMeasure. */
export function fakeContext(): FakeCanvas {
  const calls: FakeCanvas["calls"] = []
  const state: Record<string | symbol, unknown> = { font: "10px sans-serif" }
  const gradient = { addColorStop: () => undefined }
  const context = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key]
      // Not a thenable: nothing should await a context.
      if (key === "then") return undefined
      if (key === "measureText") {
        return (text: string) => ({ width: fakeMeasure(text, String(target.font)) })
      }
      return (...args: Array<unknown>) => {
        calls.push({ name: String(key), args })
        return key === "createLinearGradient" || key === "createRadialGradient"
          ? gradient
          : undefined
      }
    },
    set(target, key, value) {
      target[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return {
    context,
    calls,
    texts: () =>
      calls
        .filter((call) => call.name === "fillText")
        .map((call) => String(call.args[0])),
  }
}

/** jsdom has no canvas: every canvas gets one fake context, and toBlob a tiny PNG. */
export function stubCanvas(): FakeCanvas {
  const fake = fakeContext()
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    (() => fake.context) as never
  )
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback: BlobCallback) => {
      callback(new Blob(["png"], { type: "image/png" }))
    }
  )
  return fake
}
```

- [ ] **Step 2: Tulis test tema yang gagal**

`src/lib/quote-card/themes.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { CARD_THEMES, THEMES, coverPalette, luminance, starField } from "./themes"

const rgbOf = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
]
/** Contrast of white text on the colour. */
const contrast = (hex: string) => 1.05 / (luminance(rgbOf(hex)) + 0.05)

/** An image `rows` tall and 4 wide, one colour per row. */
function image(rows: Array<[number, number, number]>): Uint8ClampedArray {
  return Uint8ClampedArray.from(
    rows.flatMap((rgb) => Array.from({ length: 4 }, () => [...rgb, 255]).flat())
  )
}

describe("THEMES", () => {
  it("has Sampul, Kertas and Malam", () => {
    expect(CARD_THEMES.map((id) => THEMES[id].label)).toEqual([
      "Sampul",
      "Kertas",
      "Malam",
    ])
  })
})

describe("coverPalette", () => {
  it("takes the cover's colours from top to bottom", () => {
    const palette = coverPalette(
      image([[150, 20, 20], [150, 20, 20], [20, 120, 20], [20, 120, 20], [20, 20, 150], [20, 20, 150]]),
      4,
      6
    )
    expect(palette).toHaveLength(3)
    const [top, middle, bottom] = (palette ?? []).map(rgbOf)
    expect(top[0]).toBeGreaterThan(top[2])
    expect(middle[1]).toBeGreaterThan(middle[0])
    expect(bottom[2]).toBeGreaterThan(bottom[0])
  })

  it("darkens a light cover until white text reads on it", () => {
    const palette = coverPalette(image(Array(6).fill([250, 250, 245])), 4, 6)
    for (const color of palette ?? []) expect(contrast(color)).toBeGreaterThanOrEqual(4.5)
  })

  it("has none without pixels", () => {
    expect(coverPalette([], 0, 0)).toBeNull()
  })
})

describe("starField", () => {
  it("places the same stars for the same book, others for another", () => {
    const one = starField("book-1", 1080, 1920)
    expect(starField("book-1", 1080, 1920)).toEqual(one)
    expect(starField("book-2", 1080, 1920)).not.toEqual(one)
    for (const star of one) {
      expect(star.x).toBeGreaterThanOrEqual(0)
      expect(star.x).toBeLessThan(1080)
      expect(star.y).toBeLessThan(1920)
    }
  })
})
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/quote-card/themes.test.ts`
Expected: FAIL (`Failed to resolve import "./themes"`).

- [ ] **Step 4: Tulis `themes.ts`**

```ts
/** The three themes (spec kartu kutipan §3.4): colours only, so any fits either layout. */
export const CARD_THEMES = ["sampul", "kertas", "malam"] as const
export type CardThemeId = (typeof CARD_THEMES)[number]
export type CardTheme = { label: string; text: string; soft: string; accent: string }

export const THEMES: Record<CardThemeId, CardTheme> = {
  sampul: {
    label: "Sampul",
    text: "#ffffff",
    soft: "rgba(255, 255, 255, 0.72)",
    accent: "#ffd666",
  },
  kertas: { label: "Kertas", text: "#2b2118", soft: "#7a6650", accent: "#b4532a" },
  malam: {
    label: "Malam",
    text: "#e8ecff",
    soft: "rgba(220, 226, 255, 0.7)",
    accent: "#9fb0ff",
  },
}
/** Sampul without a cover: Glosa's teal, dark enough for white text. */
export const DEFAULT_COVER_COLORS: ReadonlyArray<string> = [
  "#0b1f24",
  "#12423f",
  "#17675a",
]
export const PAPER = { background: "#f3ead6", grain: "rgba(120, 90, 50, 0.06)" }
export const NIGHT = { background: "#0a0f24", glow: "#26306a" }
/** The highlighter's ink: the accent, this opaque. */
export const MARK_ALPHA = 0.45

/** White text has a contrast of at least 4.5:1 on a colour this dark or darker. */
const MAX_LUMINANCE = 0.18
const DARKEN = 0.85
const BANDS = 3

const channel = (value: number) => {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance of an sRGB colour. */
export function luminance([r, g, b]: readonly [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

const hex = (rgb: readonly [number, number, number]) =>
  `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`

/**
 * Sampul's gradient from a small RGBA image of the cover: the average colour
 * of its top, middle and bottom thirds, darkened until white text reads.
 */
export function coverPalette(
  pixels: ArrayLike<number>,
  width: number,
  height: number
): Array<string> | null {
  if (width < 1 || height < 1 || pixels.length < width * height * 4) return null
  const colors: Array<string> = []
  for (let band = 0; band < BANDS; band++) {
    const from = Math.floor((band * height) / BANDS)
    const to = Math.min(height, Math.max(from + 1, Math.floor(((band + 1) * height) / BANDS)))
    let r = 0
    let g = 0
    let b = 0
    let weight = 0
    for (let y = from; y < to; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        const alpha = pixels[i + 3] / 255
        r += pixels[i] * alpha
        g += pixels[i + 1] * alpha
        b += pixels[i + 2] * alpha
        weight += alpha
      }
    }
    let rgb: [number, number, number] =
      weight > 0 ? [r / weight, g / weight, b / weight] : [0, 0, 0]
    for (let step = 0; step < 40 && luminance(rgb) > MAX_LUMINANCE; step++) {
      rgb = [rgb[0] * DARKEN, rgb[1] * DARKEN, rgb[2] * DARKEN]
    }
    colors.push(hex(rgb))
  }
  return colors
}

export type Star = { x: number; y: number; radius: number; alpha: number }

/** Malam's stars, the same for the same seed (the book's id), so a card never changes. */
export function starField(
  seed: string,
  width: number,
  height: number,
  count = 90
): Array<Star> {
  // FNV-1a for the seed, then mulberry32.
  let state = 2166136261
  for (const char of seed) {
    state = Math.imul(state ^ (char.codePointAt(0) ?? 0), 16777619)
  }
  const next = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return Array.from({ length: count }, () => ({
    x: next() * width,
    y: next() * height,
    radius: 1 + next() * 2.2,
    alpha: 0.35 + next() * 0.65,
  }))
}
```

- [ ] **Step 5: Jalankan test tema, pastikan lulus**

Run: `npx vitest run src/lib/quote-card/themes.test.ts`
Expected: PASS (5 test).

- [ ] **Step 6: Tulis test draw yang gagal**

`src/lib/quote-card/draw.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { fakeContext, fakeMeasure } from "@/test/canvas"
import { drawCard } from "./draw"
import { layoutCard } from "./layout"
import { quoteTokens } from "./quote-text"

const layout = layoutCard(
  {
    layout: "glosa",
    size: "story",
    tokens: quoteTokens("It is a capital mistake."),
    highlight: 3,
    word: { label: "capital", pos: "kata sifat", meanings: "utama" },
    title: "A Scandal in Bohemia",
    author: "Arthur Conan Doyle",
    hasCover: true,
    host: "glos-a.tech",
  },
  fakeMeasure
)

describe("drawCard", () => {
  it("draws every text of the layout", () => {
    const fake = fakeContext()
    drawCard(fake.context, layout, "kertas", { cover: null, palette: null, seed: "a" })
    expect(fake.texts()).toEqual(
      layout.items.flatMap((item) => (item.kind === "text" ? [item.text] : []))
    )
  })

  it("draws the cover only when there is one", () => {
    const without = fakeContext()
    drawCard(without.context, layout, "kertas", { cover: null, palette: null, seed: "a" })
    expect(without.calls.some((call) => call.name === "drawImage")).toBe(false)

    const cover = {} as CanvasImageSource
    const withCover = fakeContext()
    drawCard(withCover.context, layout, "kertas", { cover, palette: null, seed: "a" })
    const drawn = withCover.calls.filter((call) => call.name === "drawImage")
    expect(drawn).toHaveLength(1)
    expect(drawn[0].args.slice(1)).toEqual([96, 110, 64, 94])
  })

  it("paints Sampul as a gradient and Malam with stars", () => {
    const sampul = fakeContext()
    drawCard(sampul.context, layout, "sampul", { cover: null, palette: ["#102030", "#203040"], seed: "a" })
    expect(sampul.calls.some((call) => call.name === "createLinearGradient")).toBe(true)

    const malam = fakeContext()
    drawCard(malam.context, layout, "malam", { cover: null, palette: null, seed: "a" })
    expect(malam.calls.some((call) => call.name === "createRadialGradient")).toBe(true)
    expect(malam.calls.filter((call) => call.name === "arc").length).toBeGreaterThan(50)
  })
})
```

- [ ] **Step 7: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/quote-card/draw.test.ts`
Expected: FAIL (`Failed to resolve import "./draw"`).

- [ ] **Step 8: Tulis `draw.ts`**

```ts
import type { CardColor, CardLayout, CardTurn } from "./layout"
import {
  type CardThemeId,
  DEFAULT_COVER_COLORS,
  MARK_ALPHA,
  NIGHT,
  PAPER,
  THEMES,
  starField,
} from "./themes"

/** What a card shows besides its layout: the cover, its colours, and the seed of Malam's stars. */
export type CardArt = {
  cover: CanvasImageSource | null
  palette: ReadonlyArray<string> | null
  seed: string
}

const GRAIN_STEP = 8
const COVER_RADIUS = 8

function turn(context: CanvasRenderingContext2D, by: CardTurn | undefined) {
  if (!by) return
  context.translate(by.x, by.y)
  context.rotate(by.angle)
  context.translate(-by.x, -by.y)
}

function rounded(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath()
  // Safari before 16 has no roundRect: a plain rectangle then.
  const round = (context as Partial<Pick<CanvasRenderingContext2D, "roundRect">>).roundRect
  if (round) round.call(context, x, y, width, height, radius)
  else context.rect(x, y, width, height)
}

function paintBackground(
  context: CanvasRenderingContext2D,
  themeId: CardThemeId,
  width: number,
  height: number,
  art: CardArt
) {
  if (themeId === "sampul") {
    const colors = art.palette ?? DEFAULT_COVER_COLORS
    const gradient = context.createLinearGradient(0, 0, width * 0.6, height)
    colors.forEach((color, i) => {
      gradient.addColorStop(colors.length === 1 ? 0 : i / (colors.length - 1), color)
    })
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
    return
  }
  if (themeId === "kertas") {
    context.fillStyle = PAPER.background
    context.fillRect(0, 0, width, height)
    context.fillStyle = PAPER.grain
    for (let y = 0; y < height; y += GRAIN_STEP) {
      const shift = (y / GRAIN_STEP) % 2 === 0 ? 0 : GRAIN_STEP / 2
      for (let x = shift; x < width; x += GRAIN_STEP) context.fillRect(x, y, 2, 2)
    }
    return
  }
  context.fillStyle = NIGHT.background
  context.fillRect(0, 0, width, height)
  const glow = context.createRadialGradient(
    width / 2,
    height * 1.15,
    0,
    width / 2,
    height * 1.15,
    height * 0.75
  )
  glow.addColorStop(0, NIGHT.glow)
  glow.addColorStop(1, "rgba(38, 48, 106, 0)")
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)
  context.fillStyle = "#ffffff"
  for (const star of starField(art.seed, width, height)) {
    context.globalAlpha = star.alpha
    context.beginPath()
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
    context.fill()
  }
  context.globalAlpha = 1
}

/** Draws a laid-out card in a theme (spec kartu kutipan §3, §6.2). */
export function drawCard(
  context: CanvasRenderingContext2D,
  layout: CardLayout,
  themeId: CardThemeId,
  art: CardArt
): void {
  const theme = THEMES[themeId]
  const colors: Record<CardColor, string> = {
    text: theme.text,
    soft: theme.soft,
    accent: theme.accent,
  }
  context.save()
  paintBackground(context, themeId, layout.width, layout.height, art)
  for (const item of layout.items) {
    context.save()
    switch (item.kind) {
      case "text":
        turn(context, item.turn)
        context.font = item.font
        context.fillStyle = colors[item.color]
        context.textBaseline = "alphabetic"
        context.fillText(item.text, item.x, item.y)
        break
      case "mark":
        turn(context, item.turn)
        context.globalAlpha = MARK_ALPHA
        context.fillStyle = theme.accent
        rounded(context, item.x, item.y, item.width, item.height, item.height * 0.3)
        context.fill()
        break
      case "rule":
        context.fillStyle = theme.accent
        rounded(context, item.x, item.y, item.width, item.height, item.height / 2)
        context.fill()
        break
      case "cover":
        if (art.cover) {
          rounded(context, item.x, item.y, item.width, item.height, COVER_RADIUS)
          context.clip()
          context.drawImage(art.cover, item.x, item.y, item.width, item.height)
        }
        break
    }
    context.restore()
  }
  context.restore()
}
```

- [ ] **Step 9: Jalankan test draw dan tema, pastikan lulus**

Run: `npx vitest run src/lib/quote-card`
Expected: PASS (semua file di `src/lib/quote-card`).

- [ ] **Step 10: Format, typecheck, lint, commit**

```bash
npx prettier --write src/lib/quote-card src/test/canvas.ts
npm run typecheck && npm run lint
git add src/lib/quote-card/themes.ts src/lib/quote-card/themes.test.ts src/lib/quote-card/draw.ts src/lib/quote-card/draw.test.ts src/test/canvas.ts
git commit -m "feat(quote-card): three themes and drawing a card on a canvas"
```

---

### Task 4: Berbagi, menyimpan, menyalin, dan pilihan yang diingat

**Files:**
- Create: `src/lib/quote-card/share.ts`
- Create: `src/lib/quote-card/prefs.ts`
- Modify: `src/lib/local/keys.ts` (tambah `QUOTE_CARD_KEY`)
- Test: `src/lib/quote-card/share.test.ts`
- Test: `src/lib/quote-card/prefs.test.ts`

**Interfaces:**
- Consumes: `CARD_LAYOUTS`, `CARD_SIZES`, `CardLayoutKind`, `CardSize` (Task 2); `CARD_THEMES`, `CardThemeId` (Task 3).
- Produces (`share.ts`):
  - `type Sharing = Partial<Pick<Navigator, "canShare" | "share" | "clipboard">>`
  - `type ShareResult = "shared" | "cancelled" | "failed"`
  - `canShareFiles(nav?: Sharing): boolean`
  - `canCopyImage(nav?: Sharing): boolean`
  - `shareCard(file: File, text: string, link: string, nav?: Sharing): Promise<ShareResult>`, yang memanggil `clipboard.writeText` dan `share` tanpa `await` di antaranya, demi Safari iOS.
  - `saveCard(blob: Blob, name: string): void`
  - `copyCard(blob: Blob, nav?: Sharing): Promise<boolean>`
  - `cardFileName(title: string): string`
  - `shareText(title: string, origin: string): string`
- Produces (`prefs.ts`):
  - `type CardPrefs = { layout: CardLayoutKind; theme: CardThemeId; size: CardSize }`
  - `DEFAULT_CARD_PREFS: CardPrefs = { layout: "kutipan", theme: "sampul", size: "story" }`
  - `loadCardPrefs(): CardPrefs`
  - `saveCardPrefs(prefs: CardPrefs): void`
- Produces (`keys.ts`): `QUOTE_CARD_KEY = "glosa:quote-card"`

- [ ] **Step 1: Tulis test share yang gagal**

`src/lib/quote-card/share.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  canCopyImage,
  canShareFiles,
  cardFileName,
  copyCard,
  saveCard,
  shareCard,
  shareText,
} from "./share"

const file = new File(["png"], "glosa-a.png", { type: "image/png" })

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("canShareFiles", () => {
  it("asks the browser whether a PNG can be shared", () => {
    expect(canShareFiles({})).toBe(false)
    expect(canShareFiles({ canShare: () => true, share: vi.fn() })).toBe(true)
    expect(canShareFiles({ canShare: () => false, share: vi.fn() })).toBe(false)
    expect(
      canShareFiles({
        canShare: () => {
          throw new TypeError("no files")
        },
        share: vi.fn(),
      })
    ).toBe(false)
  })
})

describe("canCopyImage", () => {
  it("needs ClipboardItem and clipboard.write", () => {
    const clipboard = { write: vi.fn() } as unknown as Clipboard
    expect(canCopyImage({ clipboard })).toBe(false)
    vi.stubGlobal("ClipboardItem", class {})
    expect(canCopyImage({ clipboard })).toBe(true)
    expect(canCopyImage({})).toBe(false)
  })
})

describe("shareCard", () => {
  it("copies the link, then opens the share sheet with the card and the text", async () => {
    const writeText = vi.fn(async () => undefined)
    const share = vi.fn(async () => undefined)
    const clipboard = { writeText } as unknown as Clipboard
    const result = await shareCard(file, "Dari A", "https://glos-a.tech", { clipboard, share })
    expect(result).toBe("shared")
    expect(writeText).toHaveBeenCalledWith("https://glos-a.tech")
    expect(share).toHaveBeenCalledWith({ files: [file], text: "Dari A" })
    expect(writeText.mock.invocationCallOrder[0]).toBeLessThan(
      share.mock.invocationCallOrder[0]
    )
  })

  it("shares even when the link cannot be copied", async () => {
    const clipboard = {
      writeText: vi.fn(async () => {
        throw new Error("denied")
      }),
    } as unknown as Clipboard
    const share = vi.fn(async () => undefined)
    await expect(shareCard(file, "t", "l", { clipboard, share })).resolves.toBe("shared")
    await expect(shareCard(file, "t", "l", { share })).resolves.toBe("shared")
  })

  it("tells a closed sheet from a failure", async () => {
    const cancel = vi.fn(async () => {
      throw new DOMException("closed", "AbortError")
    })
    await expect(shareCard(file, "t", "l", { share: cancel })).resolves.toBe("cancelled")
    const fail = vi.fn(async () => {
      throw new DOMException("no", "NotAllowedError")
    })
    await expect(shareCard(file, "t", "l", { share: fail })).resolves.toBe("failed")
    await expect(shareCard(file, "t", "l", {})).resolves.toBe("failed")
  })
})

describe("copyCard", () => {
  it("writes the PNG to the clipboard", async () => {
    vi.stubGlobal("ClipboardItem", class {
      constructor(readonly items: Record<string, Blob>) {}
    })
    const write = vi.fn(async () => undefined)
    const clipboard = { write } as unknown as Clipboard
    await expect(copyCard(file, { clipboard })).resolves.toBe(true)
    expect(write).toHaveBeenCalledTimes(1)
    const failing = { write: vi.fn(async () => { throw new Error("denied") }) } as unknown as Clipboard
    await expect(copyCard(file, { clipboard: failing })).resolves.toBe(false)
    await expect(copyCard(file, {})).resolves.toBe(false)
  })
})

describe("saveCard", () => {
  it("downloads the PNG under its name", () => {
    URL.createObjectURL = vi.fn(() => "blob:card")
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      expect(this.download).toBe("glosa-a.png")
      expect(this.href).toBe("blob:card")
    })
    saveCard(file, "glosa-a.png")
    expect(click).toHaveBeenCalledTimes(1)
    expect(document.querySelector("a[download]")).toBeNull()
  })
})

describe("names and text", () => {
  it("names the file after the book", () => {
    expect(cardFileName("A Scandal in Bohemia")).toBe("glosa-a-scandal-in-bohemia.png")
    expect(cardFileName("Café Société")).toBe("glosa-cafe-societe.png")
    expect(cardFileName("!!!")).toBe("glosa-kutipan.png")
    expect(cardFileName("word ".repeat(30)).length).toBeLessThanOrEqual(
      "glosa-".length + 40 + ".png".length
    )
  })

  it("says where the card comes from", () => {
    expect(shareText("A Scandal in Bohemia", "https://glos-a.tech")).toBe(
      "Dari A Scandal in Bohemia, dibaca di Glosa → https://glos-a.tech"
    )
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/quote-card/share.test.ts`
Expected: FAIL (`Failed to resolve import "./share"`).

- [ ] **Step 3: Tulis `share.ts`**

```ts
/** The parts of navigator a card uses; any may be missing. */
export type Sharing = Partial<Pick<Navigator, "canShare" | "share" | "clipboard">>
export type ShareResult = "shared" | "cancelled" | "failed"

const MAX_NAME = 40

/** Whether the share sheet can take a PNG (spec kartu kutipan §4: Bagikan shows only then). */
export function canShareFiles(nav: Sharing = navigator): boolean {
  if (!nav.canShare || !nav.share) return false
  try {
    const probe = new File([""], "kartu.png", { type: "image/png" })
    return nav.canShare({ files: [probe] })
  } catch {
    return false
  }
}

/** Whether an image can go to the clipboard (Salin gambar shows only then). */
export function canCopyImage(nav: Sharing = navigator): boolean {
  return "ClipboardItem" in globalThis && typeof nav.clipboard?.write === "function"
}

/**
 * Copies the link for Instagram's Link sticker, then opens the share sheet
 * with the card and its text (spec kartu kutipan §6.5). Nothing is awaited
 * before share(): Safari opens the sheet only within the tap.
 */
export async function shareCard(
  file: File,
  text: string,
  link: string,
  nav: Sharing = navigator
): Promise<ShareResult> {
  try {
    nav.clipboard?.writeText(link).catch(() => undefined)
  } catch {
    // No clipboard: the card goes anyway.
  }
  if (!nav.share) return "failed"
  try {
    await nav.share({ files: [file], text })
    return "shared"
  } catch (error) {
    return (error as { name?: unknown }).name === "AbortError" ? "cancelled" : "failed"
  }
}

/** Downloads the card. */
export function saveCard(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.rel = "noopener"
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Puts the card on the clipboard; false when the browser refuses. */
export async function copyCard(blob: Blob, nav: Sharing = navigator): Promise<boolean> {
  if (!nav.clipboard) return false
  try {
    await nav.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })])
    return true
  } catch {
    return false
  }
}

/** glosa-{short title}.png, in plain letters. */
export function cardFileName(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_NAME)
    .replace(/-+$/, "")
  return `glosa-${slug || "kutipan"}.png`
}

/** What goes with the card: the book, and where Glosa is. */
export function shareText(title: string, origin: string): string {
  return `Dari ${title}, dibaca di Glosa → ${origin}`
}
```

- [ ] **Step 4: Jalankan test share, pastikan lulus**

Run: `npx vitest run src/lib/quote-card/share.test.ts`
Expected: PASS (9 test).

- [ ] **Step 5: Tambah key dan tulis test prefs yang gagal**

Di `src/lib/local/keys.ts`, tambah baris ini setelah `READER_SETTINGS_KEY`:

```ts
export const QUOTE_CARD_KEY = "glosa:quote-card"
```

`src/lib/quote-card/prefs.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QUOTE_CARD_KEY } from "@/lib/local/keys"
import { DEFAULT_CARD_PREFS, loadCardPrefs, saveCardPrefs } from "./prefs"

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe("card prefs", () => {
  it("starts with Kutipan, Sampul, Story", () => {
    expect(loadCardPrefs()).toEqual({ layout: "kutipan", theme: "sampul", size: "story" })
  })

  it("remembers the last choice", () => {
    saveCardPrefs({ layout: "glosa", theme: "malam", size: "square" })
    expect(loadCardPrefs()).toEqual({ layout: "glosa", theme: "malam", size: "square" })
  })

  it("falls back per field on values it does not know", () => {
    localStorage.setItem(QUOTE_CARD_KEY, JSON.stringify({ layout: "glosa", theme: "neon", size: 3 }))
    expect(loadCardPrefs()).toEqual({ ...DEFAULT_CARD_PREFS, layout: "glosa" })
    localStorage.setItem(QUOTE_CARD_KEY, "{broken")
    expect(loadCardPrefs()).toEqual(DEFAULT_CARD_PREFS)
    localStorage.setItem(QUOTE_CARD_KEY, "null")
    expect(loadCardPrefs()).toEqual(DEFAULT_CARD_PREFS)
  })

  it("works without storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(loadCardPrefs()).toEqual(DEFAULT_CARD_PREFS)
    expect(() => saveCardPrefs(DEFAULT_CARD_PREFS)).not.toThrow()
  })
})
```

- [ ] **Step 6: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/quote-card/prefs.test.ts`
Expected: FAIL (`Failed to resolve import "./prefs"`).

- [ ] **Step 7: Tulis `prefs.ts`**

```ts
import { QUOTE_CARD_KEY } from "@/lib/local/keys"
import { CARD_LAYOUTS, CARD_SIZES, type CardLayoutKind, type CardSize } from "./layout"
import { CARD_THEMES, type CardThemeId } from "./themes"

/** The last layout, theme and size, per device (spec kartu kutipan, decision 12). */
export type CardPrefs = { layout: CardLayoutKind; theme: CardThemeId; size: CardSize }

export const DEFAULT_CARD_PREFS: CardPrefs = {
  layout: "kutipan",
  theme: "sampul",
  size: "story",
}

function oneOf<T extends string>(options: ReadonlyArray<T>, value: unknown, fallback: T): T {
  return (options as ReadonlyArray<unknown>).includes(value) ? (value as T) : fallback
}

export function loadCardPrefs(): CardPrefs {
  try {
    const raw = localStorage.getItem(QUOTE_CARD_KEY)
    if (!raw) return DEFAULT_CARD_PREFS
    const value = JSON.parse(raw) as Partial<Record<keyof CardPrefs, unknown>> | null
    return {
      layout: oneOf(CARD_LAYOUTS, value?.layout, DEFAULT_CARD_PREFS.layout),
      theme: oneOf(CARD_THEMES, value?.theme, DEFAULT_CARD_PREFS.theme),
      size: oneOf(CARD_SIZES, value?.size, DEFAULT_CARD_PREFS.size),
    }
  } catch {
    return DEFAULT_CARD_PREFS
  }
}

export function saveCardPrefs(prefs: CardPrefs): void {
  try {
    localStorage.setItem(QUOTE_CARD_KEY, JSON.stringify(prefs))
  } catch {
    // No storage: the choice holds until the dialog closes.
  }
}
```

- [ ] **Step 8: Jalankan test, format, typecheck, lint**

Run: `npx vitest run src/lib/quote-card && npx prettier --write src/lib/quote-card src/lib/local/keys.ts && npm run typecheck && npm run lint`
Expected: PASS dan tanpa error.

- [ ] **Step 9: Commit**

```bash
git add src/lib/quote-card/share.ts src/lib/quote-card/share.test.ts src/lib/quote-card/prefs.ts src/lib/quote-card/prefs.test.ts src/lib/local/keys.ts
git commit -m "feat(quote-card): share, save and copy a card; remember the last choice"
```

---

### Task 5: Dialog "Bagikan kutipan"

**Files:**
- Create: `src/components/reader/QuoteCardDialog.tsx`
- Modify: `src/styles.css` (aturan `.quote-*`, sebelum baris `/* Annotations (spec 2 §6.6). */`)
- Test: `src/components/reader/QuoteCardDialog.test.tsx`

**Interfaces:**
- Consumes:
  - semua modul `src/lib/quote-card/*` dari Task 1–4;
  - `lookUp(word, next)` dan `LookupOutcome` dari `src/lib/words/lookup.ts`;
  - `POS_LABELS` dari `src/lib/words/labels.ts`;
  - `SavedForms` dan `savedFormsOf` dari `src/lib/words/saved-marks.ts`;
  - `ReaderBook` (`{ id; title; author }`) dari `src/lib/reader-types.ts`;
  - `useWideScreen`;
  - `stubCanvas` dan `fakeMeasure` dari `src/test/canvas.ts`;
  - `stubWideScreen` dan `unstubWideScreen` dari `src/test/media.ts`.
- Produces:

  ```ts
  QuoteCardDialog(props: {
    quote: string | null            // raw selection or highlight text; null = closed
    book: ReaderBook
    savedForms: SavedForms
    loadCover: () => Promise<Blob | null>   // stable reference (useCallback)
    onClose: () => void
    finalFocus: () => HTMLElement | null
    lookup?: (word: string) => Promise<LookupOutcome>  // tests only; default lookUp(word, [])
  })
  ```

- [ ] **Step 1: Tulis test yang gagal**

`src/components/reader/QuoteCardDialog.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QUOTE_CARD_KEY } from "@/lib/local/keys"
import { layoutCard } from "@/lib/quote-card/layout"
import { quoteTokens } from "@/lib/quote-card/quote-text"
import type { LookupOutcome } from "@/lib/words/lookup"
import { savedFormsOf } from "@/lib/words/saved-marks"
import { type FakeCanvas, fakeMeasure, stubCanvas } from "@/test/canvas"
import { stubWideScreen, unstubWideScreen } from "@/test/media"
import { QuoteCardDialog } from "./QuoteCardDialog"

const QUOTE = "It is a capital mistake to theorize before one has data."
const book = {
  id: "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e",
  title: "A Scandal in Bohemia",
  author: "Arthur Conan Doyle",
}
const CAPITAL: LookupOutcome = {
  kind: "result",
  result: {
    word: "capital",
    version: null,
    phrases: [],
    entries: [
      { headword: "capital", pos: "noun", meanings: ["ibu kota", "modal"] },
      { headword: "capital", pos: "adj", meanings: ["utama", "besar", "sangat penting", "pokok"] },
    ],
  },
}
const EMPTY = (word: string): LookupOutcome => ({
  kind: "result",
  result: { word, version: null, phrases: [], entries: [] },
})
const SAVED_CAPITAL = savedFormsOf({ capital: ["capital"] })
const MEANINGS = "Arti di kartu (pilih 1–3)"

function show(extra: Partial<Parameters<typeof QuoteCardDialog>[0]> = {}) {
  const props = {
    quote: QUOTE,
    book,
    savedForms: savedFormsOf({}),
    loadCover: () => Promise.resolve(null),
    lookup: vi.fn(async (word: string) => (word === "capital" ? CAPITAL : EMPTY(word))),
    onClose: vi.fn(),
    finalFocus: () => null,
    ...extra,
  }
  render(<QuoteCardDialog {...props} />)
  return props
}

/** Navigator features jsdom lacks, put back after the test. */
function stubNavigator(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(navigator, key, { configurable: true, value })
  }
  return () => {
    for (const key of Object.keys(values)) Reflect.deleteProperty(navigator, key)
  }
}

let canvas: FakeCanvas
beforeEach(() => {
  stubWideScreen(true)
  canvas = stubCanvas()
  localStorage.clear()
})
afterEach(() => {
  unstubWideScreen()
  vi.restoreAllMocks()
})

describe("QuoteCardDialog", () => {
  it("draws the quote and offers Simpan gambar once the image is ready", async () => {
    show()
    const dialog = await screen.findByRole("dialog", { name: "Bagikan kutipan" })
    expect(
      within(dialog).getByRole("img", { name: /^Kartu kutipan: “It is a capital mistake/ })
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Simpan gambar" })).toBeEnabled()
    )
    expect(canvas.texts()).toContain("“It")
    expect(within(dialog).queryByRole("button", { name: "Bagikan" })).toBeNull()
    expect(within(dialog).queryByRole("button", { name: "Salin gambar" })).toBeNull()
  })

  it("starts with a word from Kosakata and its first meaning", async () => {
    const props = show({ savedForms: SAVED_CAPITAL })
    const meanings = await screen.findByRole("group", { name: MEANINGS })
    expect(props.lookup).toHaveBeenCalledWith("capital")
    expect(within(meanings).getByRole("button", { name: "ibu kota" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "capital" })).toHaveAttribute("aria-pressed", "true")
  })

  it("takes up to three meanings of one part of speech", async () => {
    show({ savedForms: SAVED_CAPITAL })
    const meanings = await screen.findByRole("group", { name: MEANINGS })
    const chip = (name: string) => within(meanings).getByRole("button", { name })
    fireEvent.click(chip("utama"))
    expect(chip("ibu kota")).toHaveAttribute("aria-pressed", "false")
    expect(chip("utama")).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(chip("besar"))
    fireEvent.click(chip("sangat penting"))
    expect(chip("pokok")).toBeDisabled()
    fireEvent.click(chip("besar"))
    expect(chip("pokok")).toBeEnabled()
    await waitFor(() => expect(canvas.texts()).toContain("utama, sangat penting"))
  })

  it("says when a word has no meaning, and picks another", async () => {
    show()
    fireEvent.click(await screen.findByRole("button", { name: "data" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Belum ada arti untuk kata ini.")
    expect(screen.getByRole("button", { name: "data" })).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(screen.getByRole("button", { name: "capital" }))
    expect(await screen.findByRole("group", { name: MEANINGS })).toBeInTheDocument()
  })

  it("says when meanings cannot load", async () => {
    show({ lookup: vi.fn(async (): Promise<LookupOutcome> => ({ kind: "offline" })) })
    fireEvent.click(await screen.findByRole("button", { name: "capital" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Arti belum bisa dimuat.")
  })

  it("Tanpa kata takes the word off the card", async () => {
    show({ savedForms: SAVED_CAPITAL })
    await screen.findByRole("group", { name: MEANINGS })
    fireEvent.click(screen.getByRole("button", { name: "Tanpa kata" }))
    expect(screen.queryByRole("group", { name: MEANINGS })).toBeNull()
  })

  it("a tap on the preview picks the word under it", async () => {
    show()
    const preview = await screen.findByRole("img", { name: /^Kartu kutipan/ })
    await waitFor(() => expect(preview).toHaveAttribute("height", "1920"))
    // Drawn at 1080×1920, shown at half that.
    vi.spyOn(preview, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, right: 540, bottom: 960, width: 540, height: 960, x: 0, y: 0,
      toJSON: () => ({}),
    })
    const layout = layoutCard(
      {
        layout: "kutipan",
        size: "story",
        tokens: quoteTokens(QUOTE),
        highlight: null,
        word: null,
        title: book.title,
        author: book.author,
        hasCover: false,
        host: location.host,
      },
      fakeMeasure
    )
    const hit = layout.hits.find((candidate) => candidate.token === 3)
    if (!hit) throw new Error("capital is not on the card")
    fireEvent.click(preview, {
      clientX: (hit.x + hit.width / 2) / 2,
      clientY: (hit.y + hit.height / 2) / 2,
    })
    expect(await screen.findByRole("group", { name: MEANINGS })).toBeInTheDocument()
  })

  it("shares through the share sheet and copies the link first", async () => {
    const share = vi.fn(async (_data: ShareData) => undefined)
    const writeText = vi.fn(async () => undefined)
    const restore = stubNavigator({ canShare: () => true, share, clipboard: { writeText } })
    try {
      show()
      const button = await screen.findByRole("button", { name: "Bagikan" })
      await waitFor(() => expect(button).toBeEnabled())
      fireEvent.click(button)
      await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
      const data = share.mock.calls[0][0]
      expect(data.files?.[0].name).toBe("glosa-a-scandal-in-bohemia.png")
      expect(data.text).toBe(`Dari A Scandal in Bohemia, dibaca di Glosa → ${location.origin}`)
      expect(writeText).toHaveBeenCalledWith(location.origin)
      expect(screen.getByRole("status")).toHaveTextContent(
        "Link Glosa sudah disalin, tempel di stiker Link Instagram."
      )
    } finally {
      restore()
    }
  })

  it("says when the quote was shortened", async () => {
    show({ quote: "word ".repeat(100) })
    expect(await screen.findByText("Kutipan dipendekkan menjadi 300 karakter.")).toBeInTheDocument()
  })

  it("remembers the layout chosen", async () => {
    show()
    const layout = await screen.findByRole("group", { name: "Layout" })
    fireEvent.click(within(layout).getByRole("button", { name: "Glosa" }))
    expect(within(layout).getByRole("button", { name: "Glosa" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(JSON.parse(localStorage.getItem(QUOTE_CARD_KEY) ?? "{}")).toMatchObject({
      layout: "glosa",
    })
  })

  it("closes", async () => {
    const props = show()
    fireEvent.click(await screen.findByRole("button", { name: "Tutup" }))
    expect(props.onClose).toHaveBeenCalled()
  })

  it("shows nothing without a quote", () => {
    show({ quote: null })
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/components/reader/QuoteCardDialog.test.tsx`
Expected: FAIL (`Failed to resolve import "./QuoteCardDialog"`).

- [ ] **Step 3: Tulis `QuoteCardDialog.tsx`**

```tsx
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { drawCard } from "@/lib/quote-card/draw"
import { cardFontsReady } from "@/lib/quote-card/fonts"
import {
  CARD_DIMENSIONS,
  type CardHit,
  type CardInput,
  type CardLayoutKind,
  type CardSize,
  layoutCard,
} from "@/lib/quote-card/layout"
import { type CardPrefs, loadCardPrefs, saveCardPrefs } from "@/lib/quote-card/prefs"
import { defaultWord, prepareQuote, quoteTokens } from "@/lib/quote-card/quote-text"
import {
  canCopyImage,
  canShareFiles,
  cardFileName,
  copyCard,
  saveCard,
  shareCard,
  shareText,
} from "@/lib/quote-card/share"
import { CARD_THEMES, THEMES, coverPalette } from "@/lib/quote-card/themes"
import type { ReaderBook } from "@/lib/reader-types"
import { useWideScreen } from "@/lib/use-wide-screen"
import { POS_LABELS } from "@/lib/words/labels"
import { type LookupOutcome, lookUp } from "@/lib/words/lookup"
import type { SavedForms } from "@/lib/words/saved-marks"
import type { LookupEntry } from "@/lib/words/types"

/** Meanings a card carries at most (spec kartu kutipan, decision 3). */
const MAX_CARD_MEANINGS = 3
/** The PNG is made this long after the last change, ready before Bagikan is tapped. */
const PNG_DELAY_MS = 250
/** The cover is shrunk to this many pixels a side to read its colours. */
const PALETTE_SIZE = 12

const LAYOUT_OPTIONS: ReadonlyArray<[CardLayoutKind, string]> = [
  ["glosa", "Glosa"],
  ["kutipan", "Kutipan"],
]
const SIZE_OPTIONS: ReadonlyArray<[CardSize, string]> = [
  ["story", "Story"],
  ["square", "Persegi"],
]

type WordState =
  | { kind: "none" }
  | { kind: "loading"; token: number }
  | {
      kind: "ready"
      token: number
      entries: Array<LookupEntry>
      /** The entry (part of speech) the meanings come from. */
      entry: number
      meanings: Array<string>
    }
type Art = { cover: ImageBitmap | null; palette: Array<string> | null }

const lookUpWord = (word: string) => lookUp(word, [])

function paletteOf(bitmap: ImageBitmap): Array<string> | null {
  try {
    const small = document.createElement("canvas")
    small.width = PALETTE_SIZE
    small.height = PALETTE_SIZE
    const context = small.getContext("2d")
    if (!context) return null
    context.drawImage(bitmap, 0, 0, PALETTE_SIZE, PALETTE_SIZE)
    const { data } = context.getImageData(0, 0, PALETTE_SIZE, PALETTE_SIZE)
    return coverPalette(data, PALETTE_SIZE, PALETTE_SIZE)
  } catch {
    return null
  }
}

function Segments<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: ReadonlyArray<[T, string]>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div>
      <p className="quote-label">{label}</p>
      <div role="group" aria-label={label} className="quote-segment">
        {options.map(([option, name]) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Bagikan kutipan (spec kartu kutipan §4): a card of the quote drawn on a
 * canvas, a word of it highlighted with meanings from the dictionary, to
 * share, save or copy. Give it a `key` per quote.
 */
export function QuoteCardDialog({
  quote,
  book,
  savedForms,
  loadCover,
  onClose,
  finalFocus,
  lookup = lookUpWord,
}: {
  quote: string | null
  book: ReaderBook
  savedForms: SavedForms
  loadCover: () => Promise<Blob | null>
  onClose: () => void
  finalFocus: () => HTMLElement | null
  lookup?: (word: string) => Promise<LookupOutcome>
}) {
  const wide = useWideScreen()
  const prepared = useMemo(() => prepareQuote(quote ?? ""), [quote])
  const tokens = useMemo(() => quoteTokens(prepared.text), [prepared])
  const [prefs, setPrefs] = useState<CardPrefs>(loadCardPrefs)
  const [word, setWord] = useState<WordState>(() => {
    const token = defaultWord(tokens, savedForms)
    return token === null ? { kind: "none" } : { kind: "loading", token }
  })
  const [notice, setNotice] = useState<string | null>(null)
  const [art, setArt] = useState<Art>({ cover: null, palette: null })
  const [fontsReady, setFontsReady] = useState(false)
  const [png, setPng] = useState<Blob | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hitsRef = useRef<Array<CardHit>>([])
  const [shareable] = useState(() => canShareFiles())
  const [copyable] = useState(() => canCopyImage())

  useEffect(() => {
    let live = true
    void cardFontsReady().then(() => {
      if (live) setFontsReady(true)
    })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    let live = true
    let bitmap: ImageBitmap | null = null
    loadCover()
      .then(async (blob) => {
        if (!blob || !("createImageBitmap" in globalThis)) return
        bitmap = await createImageBitmap(blob)
        if (live) setArt({ cover: bitmap, palette: paletteOf(bitmap) })
        else bitmap.close()
      })
      .catch(() => undefined)
    return () => {
      live = false
      bitmap?.close()
    }
  }, [loadCover])

  useEffect(() => {
    if (word.kind !== "loading") return
    let live = true
    void lookup(tokens[word.token].word ?? "").then((outcome) => {
      if (!live) return
      if (outcome.kind !== "result") {
        setNotice("Arti belum bisa dimuat.")
        setWord({ kind: "none" })
        return
      }
      const entries = outcome.result.entries.filter((entry) => entry.meanings.length > 0)
      if (entries.length === 0) {
        setNotice("Belum ada arti untuk kata ini.")
        setWord({ kind: "none" })
        return
      }
      setWord({
        kind: "ready",
        token: word.token,
        entries,
        entry: 0,
        meanings: [entries[0].meanings[0]],
      })
    })
    return () => {
      live = false
    }
  }, [word, tokens, lookup])

  const chosen = word.kind === "ready" ? word : null
  const input = useMemo((): CardInput => {
    const entry = chosen ? chosen.entries[chosen.entry] : null
    return {
      layout: prefs.layout,
      size: prefs.size,
      tokens,
      highlight: chosen ? chosen.token : null,
      word:
        chosen && entry
          ? { label: entry.headword, pos: POS_LABELS[entry.pos], meanings: chosen.meanings.join(", ") }
          : null,
      title: book.title,
      author: book.author,
      hasCover: art.cover !== null,
      host: location.host,
    }
  }, [prefs.layout, prefs.size, tokens, chosen, book.title, book.author, art.cover])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !fontsReady) return
    const context = canvas.getContext("2d")
    if (!context) return
    const { width, height } = CARD_DIMENSIONS[input.size]
    canvas.width = width
    canvas.height = height
    const measure = (text: string, name: string) => {
      context.font = name
      return context.measureText(text).width
    }
    const layout = layoutCard(input, measure)
    hitsRef.current = layout.hits
    drawCard(context, layout, prefs.theme, { cover: art.cover, palette: art.palette, seed: book.id })
    setPng(null)
    let live = true
    const timer = setTimeout(() => {
      canvas.toBlob((blob) => {
        if (live) setPng(blob)
      }, "image/png")
    }, PNG_DELAY_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [input, prefs.theme, art, fontsReady, book.id])

  if (quote === null) return null

  const change = (next: Partial<CardPrefs>) => {
    const merged = { ...prefs, ...next }
    saveCardPrefs(merged)
    setPrefs(merged)
  }
  const pick = (token: number | null) => {
    setNotice(null)
    if (token === null) setWord({ kind: "none" })
    else if (tokens[token]?.word) setWord({ kind: "loading", token })
  }
  const toggleMeaning = (entry: number, meaning: string) => {
    if (word.kind !== "ready") return
    if (entry !== word.entry) {
      setWord({ ...word, entry, meanings: [meaning] })
      return
    }
    const picked = new Set(word.meanings)
    if (picked.has(meaning)) {
      if (picked.size === 1) return
      picked.delete(meaning)
    } else {
      if (picked.size >= MAX_CARD_MEANINGS) return
      picked.add(meaning)
    }
    const order = word.entries[entry].meanings
    setWord({ ...word, meanings: order.filter((candidate) => picked.has(candidate)) })
  }
  const onPreviewClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    const box = canvas.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return
    const x = ((event.clientX - box.left) * canvas.width) / box.width
    const y = ((event.clientY - box.top) * canvas.height) / box.height
    const hit = hitsRef.current.find(
      (candidate) =>
        x >= candidate.x &&
        x <= candidate.x + candidate.width &&
        y >= candidate.y &&
        y <= candidate.y + candidate.height
    )
    if (hit) pick(hit.token)
  }
  const fileOf = (blob: Blob) =>
    new File([blob], cardFileName(book.title), { type: "image/png" })
  const share = () => {
    if (!png) return
    setNotice("Link Glosa sudah disalin, tempel di stiker Link Instagram.")
    void shareCard(fileOf(png), shareText(book.title, location.origin), location.origin).then(
      (result) => {
        if (result === "failed") setNotice("Gagal membagikan. Coba Simpan gambar.")
      }
    )
  }
  const save = () => {
    if (png) saveCard(png, cardFileName(book.title))
  }
  const copy = () => {
    if (!png) return
    void copyCard(png).then((copied) => {
      setNotice(copied ? "Gambar sudah disalin." : "Gagal menyalin gambar. Coba Simpan gambar.")
    })
  }

  const lit = word.kind === "none" ? null : word.token
  const description = `Kartu kutipan: “${prepared.text}”${
    input.word ? `. ${input.word.label}, ${input.word.pos}: ${input.word.meanings}` : ""
  }`

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="word-sheet-backdrop" />
        <DialogPrimitive.Popup
          aria-label="Bagikan kutipan"
          className={wide ? "quote-dialog" : "quote-sheet"}
          finalFocus={finalFocus}
        >
          <div className="quote-head">
            <DialogPrimitive.Title className="font-heading text-lg">
              Bagikan kutipan
            </DialogPrimitive.Title>
            <Button variant="ghost" size="icon-lg" aria-label="Tutup" onClick={onClose}>
              <XIcon aria-hidden="true" />
            </Button>
          </div>
          <div className="quote-body">
            <div className="quote-preview">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={description}
                className={`quote-canvas quote-canvas-${prefs.size}`}
                onClick={onPreviewClick}
              />
              <p className="quote-hint">Ketuk kata di kutipan untuk menyorotnya</p>
              <div
                role="group"
                aria-label="Kata di kutipan"
                className="quote-words sr-only focus-within:not-sr-only"
              >
                {tokens.map((token, i) =>
                  token.word ? (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={lit === i}
                      onClick={() => pick(i)}
                    >
                      {token.word}
                    </button>
                  ) : null
                )}
              </div>
            </div>
            <div className="quote-controls">
              <Segments
                label="Layout"
                options={LAYOUT_OPTIONS}
                value={prefs.layout}
                onChange={(layout) => change({ layout })}
              />
              <Segments
                label="Ukuran"
                options={SIZE_OPTIONS}
                value={prefs.size}
                onChange={(size) => change({ size })}
              />
              <div>
                <p className="quote-label">Tema</p>
                <div role="group" aria-label="Tema" className="quote-themes">
                  {CARD_THEMES.map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-label={`Tema ${THEMES[id].label}`}
                      aria-pressed={prefs.theme === id}
                      className={`quote-swatch quote-swatch-${id}`}
                      onClick={() => change({ theme: id })}
                    />
                  ))}
                </div>
              </div>
              <div className="quote-word">
                <div className="quote-word-head">
                  <span>
                    {lit === null ? "Tanpa kata sorotan" : `Kata: ${tokens[lit].word ?? ""}`}
                  </span>
                  {lit !== null && (
                    <Button variant="ghost" size="sm" onClick={() => pick(null)}>
                      Tanpa kata
                    </Button>
                  )}
                </div>
                {word.kind === "loading" && (
                  <div className="word-skeleton" aria-label="Memuat arti">
                    <span />
                    <span />
                  </div>
                )}
                {word.kind === "ready" && (
                  <div role="group" aria-label="Arti di kartu (pilih 1–3)">
                    <p className="quote-label">Arti di kartu (pilih 1–3)</p>
                    {word.entries.map((entry, e) => (
                      <div key={`${entry.headword} ${entry.pos}`} className="quote-sense">
                        <p className="quote-pos">
                          {entry.headword === tokens[word.token].word
                            ? POS_LABELS[entry.pos]
                            : `${POS_LABELS[entry.pos]} · ${entry.headword}`}
                        </p>
                        <div className="quote-chips">
                          {entry.meanings.map((meaning) => {
                            const on = e === word.entry && word.meanings.includes(meaning)
                            const full =
                              e === word.entry && word.meanings.length >= MAX_CARD_MEANINGS
                            return (
                              <button
                                key={meaning}
                                type="button"
                                className="quote-chip"
                                aria-pressed={on}
                                disabled={!on && full}
                                onClick={() => toggleMeaning(e, meaning)}
                              >
                                {meaning}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {prepared.cut && (
                <p className="quote-note">Kutipan dipendekkan menjadi 300 karakter.</p>
              )}
              {notice && (
                <p role="status" className="quote-note">
                  {notice}
                </p>
              )}
            </div>
          </div>
          <div className="quote-actions">
            {copyable && (
              <Button size="lg" variant="outline" disabled={!png} onClick={copy}>
                Salin gambar
              </Button>
            )}
            <Button size="lg" variant="outline" disabled={!png} onClick={save}>
              Simpan gambar
            </Button>
            {shareable && (
              <Button size="lg" disabled={!png} onClick={share}>
                Bagikan
              </Button>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
```

Catatan untuk implementer:
- `useMemo` untuk `input` bergantung pada `chosen`, yang berubah setiap kali `word` berubah. Ini memang dimaksudkan, karena setiap perubahan pilihan menggambar ulang kartu.
- Kalau `react-hooks/exhaustive-deps` meminta dependensi lain, tambahkan dependensi itu. Jangan menonaktifkan aturannya.

- [ ] **Step 4: Tambah CSS**

Di `src/styles.css`, tepat **sebelum** baris `  /* Annotations (spec 2 §6.6). */`, sisipkan blok berikut dengan indentasi yang sama (dua spasi):

```css
  /* A quote card to share (spec kartu kutipan §4). */
  .quote-sheet,
  .quote-dialog {
    position: fixed;
    z-index: 50;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    border: 1px solid var(--border);
    background: var(--background);
    color: var(--foreground);
    outline: none;
  }
  .quote-sheet {
    inset: 0;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .quote-dialog {
    top: 50%;
    left: 50%;
    width: min(56rem, calc(100vw - 2rem));
    max-height: min(46rem, calc(100dvh - 2rem));
    transform: translate(-50%, -50%);
    border-radius: 1rem;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.35);
  }
  .quote-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--border);
    padding: 0.75rem 1rem;
  }
  .quote-body {
    display: grid;
    overflow-y: auto;
  }
  .quote-dialog .quote-body {
    grid-template-columns: minmax(0, 22rem) minmax(0, 1fr);
  }
  .quote-preview {
    display: grid;
    align-content: start;
    justify-items: center;
    gap: 0.5rem;
    background: rgb(0 0 0 / 0.25);
    padding: 1rem;
  }
  .quote-canvas {
    display: block;
    max-width: 100%;
    border-radius: 0.75rem;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.4);
    cursor: pointer;
  }
  .quote-canvas-story {
    height: min(48dvh, 36rem);
    aspect-ratio: 9 / 16;
  }
  .quote-canvas-square {
    height: min(40dvh, 22rem);
    aspect-ratio: 1;
  }
  .quote-hint,
  .quote-note {
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }
  .quote-words {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .quote-words button,
  .quote-chip {
    border: 1px solid var(--border);
    border-radius: 9999px;
    padding: 0.25rem 0.7rem;
    font-size: 0.8rem;
  }
  .quote-words button[aria-pressed="true"],
  .quote-chip[aria-pressed="true"] {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 22%, transparent);
  }
  .quote-chip:disabled {
    opacity: 0.45;
  }
  .quote-controls {
    display: grid;
    align-content: start;
    gap: 1rem;
    padding: 1rem;
  }
  .quote-label {
    margin-bottom: 0.35rem;
    font-size: 0.7rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }
  .quote-segment {
    display: flex;
    gap: 0.25rem;
    border-radius: 0.6rem;
    background: var(--muted);
    padding: 0.2rem;
  }
  .quote-segment button {
    flex: 1;
    border-radius: 0.45rem;
    padding: 0.4rem 0;
    font-size: 0.85rem;
    color: var(--muted-foreground);
  }
  .quote-segment button[aria-pressed="true"] {
    background: var(--card);
    color: var(--foreground);
    box-shadow: 0 0 0 1px var(--border);
  }
  .quote-themes {
    display: flex;
    gap: 0.6rem;
  }
  .quote-swatch {
    width: 2.25rem;
    height: 2.25rem;
    border: 2px solid transparent;
    border-radius: 9999px;
  }
  .quote-swatch[aria-pressed="true"] {
    border-color: var(--primary);
    box-shadow: inset 0 0 0 2px var(--background);
  }
  .quote-swatch-sampul {
    background: linear-gradient(160deg, #1f4e5a, #3b2f5c, #7a2e3a);
  }
  .quote-swatch-kertas {
    background: #f3ead6;
  }
  .quote-swatch-malam {
    background:
      radial-gradient(1px 1px at 30% 30%, #fff 50%, transparent 51%),
      radial-gradient(1px 1px at 70% 60%, #fff 50%, transparent 51%),
      #0a0f24;
  }
  .quote-word-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.9rem;
  }
  .quote-sense {
    display: grid;
    gap: 0.3rem;
    margin-top: 0.5rem;
  }
  .quote-pos {
    font-size: 0.75rem;
    font-style: italic;
    color: var(--muted-foreground);
  }
  .quote-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .quote-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
    border-top: 1px solid var(--border);
    padding: 0.75rem 1rem;
  }
```

- [ ] **Step 5: Jalankan test dialog, pastikan lulus**

Run: `npx vitest run src/components/reader/QuoteCardDialog.test.tsx`
Expected: PASS (12 test).

Test "a tap on the preview" menunggu canvas berukuran 1080×1920 sebelum mengklik, karena efek gambar baru berjalan setelah `fontsReady`. Kalau test ini tetap gagal, periksa bahwa `fakeMeasure` di test dan `measureText` dari `stubCanvas` memberi lebar yang sama.

- [ ] **Step 6: Format, typecheck, lint, semua unit test**

Run: `npx prettier --write src/components/reader/QuoteCardDialog.tsx src/components/reader/QuoteCardDialog.test.tsx src/styles.css && npm run typecheck && npm run lint && npm test`
Expected: tanpa error, dan semua test lulus.

- [ ] **Step 7: Commit**

```bash
git add src/components/reader/QuoteCardDialog.tsx src/components/reader/QuoteCardDialog.test.tsx src/styles.css
git commit -m "feat(reader): the Bagikan kutipan dialog with a live card preview"
```

---

### Task 6: Tiga pintu masuk dan sampul dari EPUB

**Files:**
- Modify: `src/components/reader/SelectionMenu.tsx`, `src/components/reader/SelectionMenu.test.tsx`
- Modify: `src/components/reader/AnnotationPopup.tsx`, `src/components/reader/AnnotationPopup.test.tsx`
- Modify: `src/components/reader/AnnotationList.tsx`, `src/components/reader/AnnotationList.test.tsx`
- Modify: `src/components/reader/TocPanel.tsx`, `src/components/reader/TocPanel.test.tsx`
- Modify: `src/components/reader/ReaderView.tsx` (`ReaderControls.cover`)
- Modify: `src/routes/_member/read.$bookId.tsx`
- Modify: `src/styles.css` (`.selection-menu` boleh membungkus baris)

**Interfaces:**
- Consumes: `QuoteCardDialog` dari Task 5.
- Produces:
  - `SelectionMenu` mendapat prop `onShare: () => void`. Tombol **Bagikan** hanya tampil kalau teks seleksi memuat huruf atau angka.
  - `AnnotationPopup` mendapat prop `onShare: () => void`. Tombol **Bagikan** hanya tampil kalau `annotation.excerpt.trim()` tidak kosong.
  - `AnnotationList` mendapat prop `onShare: (annotation: Annotation) => void`. Tombol ikon **Bagikan highlight "…"** hanya ada untuk highlight yang punya teks.
  - `TocPanel` mendapat prop `onShareAnnotation: (annotation: Annotation) => void`, yang diteruskan ke `AnnotationList`.
  - `ReaderControls` mendapat `cover: () => Promise<Blob | null>` yang tidak pernah reject.

- [ ] **Step 1: Ubah test yang ada supaya gagal**

1. `SelectionMenu.test.tsx`:
   - Ganti test pertama menjadi:

     ```tsx
     it("offers Highlight, Catatan, Salin and Bagikan", async () => {
       const actions = {
         onHighlight: vi.fn(),
         onNote: vi.fn(),
         onCopy: vi.fn(),
         onShare: vi.fn(),
         onClose: vi.fn(),
       }
       render(<SelectionMenu selection={selection} {...actions} />)
       await screen.findByRole("dialog", { name: "Teks terpilih" })
       fireEvent.click(screen.getByRole("button", { name: "Highlight" }))
       fireEvent.click(screen.getByRole("button", { name: "Catatan" }))
       fireEvent.click(screen.getByRole("button", { name: "Salin" }))
       fireEvent.click(screen.getByRole("button", { name: "Bagikan" }))
       expect(actions.onHighlight).toHaveBeenCalledTimes(1)
       expect(actions.onNote).toHaveBeenCalledTimes(1)
       expect(actions.onCopy).toHaveBeenCalledTimes(1)
       expect(actions.onShare).toHaveBeenCalledTimes(1)
     })

     it("offers no Bagikan for a selection without words", async () => {
       render(
         <SelectionMenu
           selection={{ ...selection, text: " — … " }}
           onHighlight={vi.fn()}
           onNote={vi.fn()}
           onCopy={vi.fn()}
           onShare={vi.fn()}
           onClose={vi.fn()}
         />
       )
       await screen.findByRole("dialog", { name: "Teks terpilih" })
       expect(screen.queryByRole("button", { name: "Bagikan" })).toBeNull()
     })
     ```

   - Di test "shows nothing without a selection", tambah `onShare={vi.fn()}`.

2. `AnnotationPopup.test.tsx`:
   - Di fungsi `show`, tambah `onShare: vi.fn(),` ke `props`.
   - Tambah test ini:

     ```tsx
     it("shares the highlight", async () => {
       const props = show()
       await screen.findByRole("dialog", { name: "Highlight" })
       fireEvent.click(screen.getByRole("button", { name: "Bagikan" }))
       expect(props.onShare).toHaveBeenCalledTimes(1)
     })
     ```

3. `AnnotationList.test.tsx`:
   - Tambah `onShare={vi.fn()}` di setiap `<AnnotationList`. Letaknya setelah baris `onDelete=...`, dan ada empat tempat.
   - Tambah test ini:

     ```tsx
     it("shares a highlight, and offers no sharing for a bookmark", () => {
       const onShare = vi.fn()
       render(
         <AnnotationList
           annotations={[base, later]}
           chaptersOf={null}
           onSelect={vi.fn()}
           onDelete={vi.fn()}
           onShare={onShare}
         />
       )
       fireEvent.click(
         screen.getByRole("button", { name: 'Bagikan highlight "To Sherlock Holmes"' })
       )
       expect(onShare).toHaveBeenCalledWith(base)
       expect(screen.queryByRole("button", { name: /^Bagikan bookmark/ })).toBeNull()
     })
     ```

4. `TocPanel.test.tsx`: tambah `onShareAnnotation={() => undefined}` setelah setiap baris `onDeleteAnnotation={() => undefined}`, di tiga tempat.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/components/reader/SelectionMenu.test.tsx src/components/reader/AnnotationPopup.test.tsx src/components/reader/AnnotationList.test.tsx`
Expected: FAIL (tombol Bagikan tidak ditemukan).

- [ ] **Step 3: `SelectionMenu.tsx`**

- Ganti import ikon menjadi `import { CopyIcon, HighlighterIcon, Share2Icon, StickyNoteIcon } from "lucide-react"`.
- Ganti doc comment fungsi menjadi `Highlight · Catatan · Salin · Bagikan beside a selection (spec 2 §6.6; spec kartu kutipan §5).`
- Tambah `onShare` ke props:

  ```tsx
    onShare,
  ...
    onShare: () => void
  ```

- Setelah tombol Salin, tambahkan:

  ```tsx
              {/[\p{L}\p{N}]/u.test(selection.text) && (
                <Button size="lg" variant="ghost" onClick={onShare}>
                  <Share2Icon aria-hidden="true" />
                  Bagikan
                </Button>
              )}
  ```

- [ ] **Step 4: `AnnotationPopup.tsx`**

- Tambah prop `onShare: () => void` setelah `onMeaning`, di destrukturisasi dan di tipe.
- Di `.annotation-actions`, setelah tombol Catatan, tambahkan:

  ```tsx
            {annotation.excerpt.trim() && (
              <Button size="lg" variant="outline" onClick={onShare}>
                Bagikan
              </Button>
            )}
  ```

- Ubah doc comment komponen: `What a tapped highlight can do (spec 2 §6.6): another colour, its note, sharing it as a card, deletion, and the meaning of the word tapped inside it.`

- [ ] **Step 5: `AnnotationList.tsx`**

- Ganti `deleteLabel` dengan helper umum:

  ```ts
  /** Accessible name of an item's button: the action, the kind and a short excerpt, so each is distinct. */
  function itemLabel(action: "Hapus" | "Bagikan", annotation: Annotation): string {
    const kind = annotation.kind === "bookmark" ? "bookmark" : "highlight"
    const excerpt = annotation.excerpt.trim()
    if (!excerpt) return `${action} ${kind}`
    const short =
      excerpt.length > NAME_EXCERPT_MAX
        ? `${excerpt.slice(0, NAME_EXCERPT_MAX).trimEnd()}…`
        : excerpt
    return `${action} ${kind} "${short}"`
  }
  ```

- Ganti `aria-label={deleteLabel(annotation)}` menjadi `aria-label={itemLabel("Hapus", annotation)}`.
- Tambah import `Share2Icon` dari `lucide-react`.
- Tambah prop `onShare: (annotation: Annotation) => void`, di destrukturisasi dan di tipe.
- Sebelum tombol hapus, tambahkan:

  ```tsx
              {!bookmark && annotation.excerpt.trim() && (
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="size-10"
                  aria-label={itemLabel("Bagikan", annotation)}
                  onClick={() => onShare(annotation)}
                >
                  <Share2Icon aria-hidden="true" />
                </Button>
              )}
  ```

- [ ] **Step 6: `TocPanel.tsx`**

- Tambah prop `onShareAnnotation: (annotation: Annotation) => void` setelah `onDeleteAnnotation`, di destrukturisasi dan di tipe.
- Teruskan ke daftar anotasi: `<AnnotationList ... onDelete={onDeleteAnnotation} onShare={onShareAnnotation} />`.

- [ ] **Step 7: Jalankan test komponen, pastikan lulus**

Run: `npx vitest run src/components/reader`
Expected: PASS.

- [ ] **Step 8: `ReaderView.tsx`: sampul dari EPUB**

- Di tipe `ReaderControls`, tambahkan setelah `chaptersOf`:

  ```ts
    /** The book's cover from the EPUB, or null. Never rejects. */
    cover: () => Promise<Blob | null>
  ```

- Di objek `controls` yang dikirim ke `call().onReady({...})`, tambahkan setelah `canOpen: (cfi) => canOpen(current, cfi),`:

  ```ts
              cover: () => epub.getCover().catch(() => null),
  ```

- Tepat setelah `const current = view`, tambahkan:

  ```ts
          const epub = opened.book
  ```

  Kalau TypeScript menganggap `opened` mungkin `null` di titik ini, ambil `const epub = opened.book` tepat setelah blok `if (cancelled) { ... }` yang mengikuti `opened = await openBookFile(file)`, lalu pakai `epub` itu.

- [ ] **Step 9: Rute baca**

Di `src/routes/_member/read.$bookId.tsx`:

1. Import:

   ```ts
   import { QuoteCardDialog } from "@/components/reader/QuoteCardDialog"
   ```

2. Setelah `const [footnote, setFootnote] = useState<FootnoteTap | null>(null)`:

   ```ts
     // The text being made into a quote card (spec kartu kutipan §5).
     const [sharing, setSharing] = useState<string | null>(null)
   ```

3. Setelah fungsi `copySelection`:

   ```ts
     const shareSelection = () => {
       if (!selection) return
       setSharing(selection.text)
       dropSelection()
     }
     const shareMarked = () => {
       if (markedHighlight) setSharing(markedHighlight.excerpt)
       setMarked(null)
     }
   ```

4. `loadCover` dibuat dengan `useCallback` di bagian atas `ReaderPage`, setelah baris `const [controls, setControls] = useState<ReaderControls | null>(null)`. Hook tidak boleh berada setelah return bersyarat.

   ```ts
     const loadCover = useCallback(
       () => (controls ? controls.cover() : Promise.resolve(null)),
       [controls]
     )
   ```

5. Di JSX:
   - `<SelectionMenu ...>`: tambah `onShare={shareSelection}`.
   - `<AnnotationPopup ...>`: tambah `onShare={shareMarked}`.
   - `<TocPanel ...>`: tambah

     ```tsx
             onShareAnnotation={(annotation) => {
               setPanel(null)
               setSharing(annotation.excerpt)
             }}
     ```

   - Setelah `<NoteEditor ... />`, tambahkan:

     ```tsx
           <QuoteCardDialog
             key={sharing ?? "no-quote"}
             quote={sharing}
             book={data.book}
             savedForms={savedForms}
             loadCover={loadCover}
             onClose={() => setSharing(null)}
             finalFocus={bookFocus}
           />
     ```

- [ ] **Step 10: Menu seleksi boleh membungkus baris di HP**

Di `src/styles.css`, di aturan `.selection-menu`, tambahkan setelah `display: flex;`:

```css
    flex-wrap: wrap;
    justify-content: center;
    max-width: calc(100vw - 2rem);
```

- [ ] **Step 11: Typecheck, lint, format, semua unit test**

Run: `npx prettier --write src/components/reader src/routes/_member/read.\$bookId.tsx src/styles.css && npm run typecheck && npm run lint && npm run check && npm test`
Expected: tanpa error, dan semua test lulus.

- [ ] **Step 12: Commit**

```bash
git add src/components/reader src/routes/_member/read.\$bookId.tsx src/styles.css
git commit -m "feat(reader): share a quote card from a selection, a highlight or the annotations panel"
```

---

### Task 7: E2E dan pemeriksaan akhir

**Files:**
- Create: `e2e/quote-card.spec.ts`

**Interfaces:**
- Consumes:
  - `startReading` dari `e2e/helpers/reading.ts`;
  - `selectWords` dari `e2e/helpers/annotations.ts`;
  - dialog, tombol, dan label dari Task 5–6.

- [ ] **Step 1: Tulis E2E**

`e2e/quote-card.spec.ts`:

```ts
import { readFile } from "node:fs/promises"
import { type Download, type Page, expect, test } from "@playwright/test"
import { selectWords } from "./helpers/annotations"
import { startReading } from "./helpers/reading"

/** A PNG's size, from its IHDR chunk. */
async function pngSize(download: Download) {
  const bytes = await readFile(await download.path())
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

async function saveImage(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Bagikan kutipan" })
  const save = dialog.getByRole("button", { name: "Simpan gambar" })
  await expect(save).toBeEnabled()
  const [download] = await Promise.all([page.waitForEvent("download"), save.click()])
  return download
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

test("a selection becomes a quote card, saved as a story and as a square", async ({ page }) => {
  test.setTimeout(120_000)
  await startReading(page)
  const picked = await selectWords(page)
  await page
    .getByRole("dialog", { name: "Teks terpilih" })
    .getByRole("button", { name: "Bagikan" })
    .click()

  const dialog = page.getByRole("dialog", { name: "Bagikan kutipan" })
  const preview = dialog.getByRole("img", { name: /^Kartu kutipan/ })
  await expect(preview).toHaveAttribute(
    "aria-label",
    new RegExp(escape(picked.text.replace(/\s+/g, " ")))
  )

  const story = await saveImage(page)
  expect(story.suggestedFilename()).toMatch(/^glosa-[a-z0-9-]+\.png$/)
  expect(await pngSize(story)).toEqual({ width: 1080, height: 1920 })

  await dialog.getByRole("group", { name: "Ukuran" }).getByRole("button", { name: "Persegi" }).click()
  await expect(preview).toHaveAttribute("height", "1080")
  const square = await saveImage(page)
  expect(await pngSize(square)).toEqual({ width: 1080, height: 1080 })

  await dialog.getByRole("button", { name: "Tutup" }).click()
  await expect(dialog).toBeHidden()
})

test("a highlight in the annotations panel can be made into a card", async ({ page }) => {
  test.setTimeout(120_000)
  await startReading(page)
  const picked = await selectWords(page)
  await page
    .getByRole("dialog", { name: "Teks terpilih" })
    .getByRole("button", { name: "Highlight" })
    .click()

  await page.getByRole("button", { name: "Daftar isi dan anotasi" }).click()
  const panel = page.getByRole("dialog", { name: "Daftar isi dan anotasi" })
  await panel.getByRole("tab", { name: "Anotasi" }).click()
  await panel.getByRole("button", { name: /^Bagikan highlight/ }).click()

  const dialog = page.getByRole("dialog", { name: "Bagikan kutipan" })
  await expect(dialog.getByRole("img", { name: /^Kartu kutipan/ })).toHaveAttribute(
    "aria-label",
    new RegExp(escape(picked.text.replace(/\s+/g, " ")))
  )
  expect(await pngSize(await saveImage(page))).toEqual({ width: 1080, height: 1920 })
})
```

- [ ] **Step 2: Jalankan E2E kartu kutipan**

Cek port dulu: `curl -sL localhost:3000/login | grep -o "<title>[^<]*"`.
- Kalau judulnya Glosa atau port kosong: `npx playwright test e2e/quote-card.spec.ts --project=desktop --project=mobile --workers=2`
- Kalau aplikasi lain: buat config sementara di port 3100 (lihat Global Constraints), lalu jalankan perintah yang sama dengan `--config` itu.

Expected: 4 passed (2 test × 2 project).

Kalau di proyek `mobile` tombol **Bagikan** di menu seleksi tertutup elemen lain, klik dengan `.press("Enter")` seperti di `e2e/annotations.spec.ts`.

- [ ] **Step 3: E2E reader dan anotasi tetap lulus**

Run: `npx playwright test e2e/annotations.spec.ts e2e/reader.spec.ts e2e/vocabulary.spec.ts --project=desktop --project=mobile --workers=2` (dengan `--config` port 3100 kalau perlu).
Expected: semua lulus. Kegagalan tunggal dijalankan ulang sendirian sebelum disebut regresi.

- [ ] **Step 4: Semua pemeriksaan**

Run: `npm run typecheck && npm run lint && npm run check && npm test`
Expected: semuanya bersih dan lulus.

- [ ] **Step 5: Commit**

```bash
git add e2e/quote-card.spec.ts
git commit -m "test(e2e): quote cards from a selection and from the annotations panel"
```

- [ ] **Step 6: Cek manual pemilik di dev (setelah push)**

Untuk pemilik proyek, setelah `main` di-push dan situs dev ter-deploy:

- **iPhone Safari:**
  - pilih teks → **Bagikan** → *Bagikan kutipan* → **Bagikan** → Instagram Story;
  - di Story, tambah stiker Link dan tempel; link Glosa sudah ada di clipboard.
- **Android Chrome:**
  - **Bagikan** → WhatsApp; keterangan gambar berisi *"Dari {judul}, dibaca di Glosa → …"*;
  - **Bagikan** → Instagram Story.
- **Desktop:**
  - **Salin gambar** lalu tempel di X atau Threads web;
  - **Simpan gambar**.
- **Tampilan:** keenam kombinasi (Glosa/Kutipan × Sampul/Kertas/Malam), di Story dan Persegi. Untuk setiap kombinasi:
  - kutipan pendek;
  - kutipan sekitar 300 karakter;
  - tanpa kata;
  - kata di ujung baris (tulisan tangan layout Glosa tidak terpotong).
- **Tema Sampul:** buku dengan sampul gelap, sampul sangat terang (teks tetap terbaca), dan buku tanpa sampul (gradasi teal).
- **Kata:**
  - kata yang ada di Kosakata langsung tersorot;
  - mengganti arti ke kelas kata lain, misalnya *capital* kata sifat;
  - batas 3 arti.
- **Menu seleksi di HP:** empat tombol tetap muat atau membungkus dengan rapi.
