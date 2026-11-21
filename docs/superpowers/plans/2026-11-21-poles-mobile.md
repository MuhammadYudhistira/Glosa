# Glosa Poles Mobile — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rak Saya HP memakai grid besar 2 kolom dengan kartu "Sedang dibaca" dan kontrol ringkas (Cari, Saring, Bawa buku). Tab bar HP menjadi dock kaca mengambang dengan pil aktif yang bergeser. Pindah halaman di HP beranimasi "kartu di atas ruang" (View Transitions). Pengaturan memakai daftar "Akun" (Keluar, Hapus akun lewat dialog).

**Architecture:**
- **Rak:**
  - fungsi murni `currentRead(books)` di `src/lib/shelf.ts`;
  - komponen baru `CurrentReadCard`, `ShelfSearch`, `SortSelect`, `ShelfFilterSheet` (dialog);
  - `ShelfToolbar` dipecah menjadi `ShelfSearch` + `SortSelect`;
  - `ShelfHeader` menjadi judul + tombol ikon;
  - `BookGrid` mendapat lencana "Selesai".
- **Dock:**
  - `MemberDock` baru (dipakai `MemberShell`) menggantikan `.member-tabbar`;
  - pil hijau digeser dengan teknik FLIP (Web Animations, hanya `transform`);
  - hook `useTyping` menyembunyikan dock saat kolom teks fokus;
  - variabel CSS `--dock-space` menggantikan `--tabbar-h`.
- **Transisi:**
  - fungsi murni `transitionTypes(from, to, env)` di `src/lib/page-transition.ts`;
  - router memakai `defaultViewTransition: { types }`;
  - animasi di CSS dengan `:active-view-transition-type(...)` dan `::view-transition-old/new(root)`;
  - dock punya `view-transition-name: dock`.
- **Pengaturan:**
  - `DeleteAccountDialog` baru berisi formulir hapus akun yang sekarang;
  - halaman memakai daftar "Akun".

**Tech Stack:** TanStack Start + Router 1.170 (`defaultViewTransition` dengan `types`), React 19, TypeScript, Tailwind CSS 4, Base UI Dialog (`@/components/ui/dialog`), lucide-react, Vitest + Testing Library, Playwright.

**Spec:** [`docs/superpowers/specs/2026-11-21-poles-mobile-design.md`](../specs/2026-11-21-poles-mobile-design.md).

## Global Constraints

- **Bahasa:** teks UI berbahasa Indonesia, komentar kode berbahasa Inggris. Array ditulis `Array<T>`. `src/lib/wording.test.ts` harus tetap hijau: tidak ada "perpustakaan", "lobi", "anggota", "buku tamu", "petugas" di teks UI baru.
- **Dependensi:** tidak ada dependensi npm baru (ikon dari `lucide-react` yang sudah ada).
- **HP** = lebar < 1024 px (`WIDE_QUERY = "(min-width: 1024px)"` di `src/lib/use-wide-screen.ts`). Dock dan transisi hanya untuk HP; desktop (sidebar, menu mengambang, popup) tidak berubah.
- **Gerak:**
  - hanya `transform`/`opacity`/`translate` yang dianimasikan (tidak `width`, `padding`, `max-width`);
  - durasi transisi halaman 260 ms, geser pil dock 250 ms;
  - easing `cubic-bezier(0.22, 0.8, 0.24, 1)`;
  - "kurangi gerakan" (`prefers-reduced-motion: reduce`) = tanpa animasi.
- **Aksesibilitas:** setiap tab dock punya `aria-label` (nama lengkap: "Ruang baca", "Rak Saya", "Kosakata", "Pengaturan") dan tab aktif punya `aria-current="page"`. Tombol ikon Rak punya nama: "Cari", "Saring", "Bawa buku".
- **Nama yang dipakai tes lain tetap:**
  - nav "Navigasi utama";
  - label "Cari judul atau penulis", "Tampilkan genre", "Urutkan";
  - tombol "Bawa buku", "Hapus akun saya permanen";
  - label "Ketik nama penggunamu untuk konfirmasi (…)";
  - link "Keluar".
- **Tes unit:** dari PowerShell, `npx vitest run --maxWorkers=2 <path>` (di Git Bash setiap berkas gagal). **Lint/tipe/format/build:** `npm run lint`, `npx tsc --noEmit`, `npm run check` (jalankan `npx prettier --write <file>` pada berkas yang disentuh sebelum commit), `npm run build`.
- **E2E:** paling banyak `--workers=2`. Sebelum E2E, cek port 3000 tidak dipegang proyek lain (`Invoke-WebRequest http://localhost:3000/login` harus gagal atau ber-title Glosa).
- **Line ending/encoding:** LF, UTF-8. **Tidak ada push.** Pesan commit `feat(poles): ...` / `fix(poles): ...` / `test(poles): ...`, diakhiri baris kosong lalu `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Di PowerShell, tulis pesan ke berkas lalu `git commit -F <berkas>`; here-string ke stdin tidak bekerja.

## Keputusan rencana

1. **"Sedang dibaca"** = buku dengan `lastOpenedAt` terbaru dan `finishedAt === null` (spec §3.2). Kartu tampil hanya bila `koleksi`, `genre`, dan `q` kosong.
2. **Lembar Saring** memakai `Dialog` yang ada. CSS menempelkannya di bawah layar di HP (`.shelf-sheet`); di desktop ia dialog biasa.
3. **Cari:** tombol "Cari" membuka/menutup kolom cari. Terbuka sejak awal bila `q` ada. Menutupnya menghapus `q` dari URL.
4. **Titik di tombol Saring** bila genre atau urutan bukan bawaan (`data-active`).
5. **Lobi di HP:** `.lobby-page` tetap setinggi layar dikurangi `--dock-space` (ruang berhenti di atas dock, lembar "Lanjutkan membaca" tidak tertutup). Latar di bawahnya disamakan dengan latar ruang (`#1b120c`) lewat `body:has(.lobby-page:not([data-popup]))`, supaya dock melayang di atas warna yang sama.
6. **Pil dock:** `left`/`width` pil diset langsung ke tab aktif, lalu dianimasikan dari posisi lama dengan `transform: translateX(dx) scaleX(sx)` → `none` (FLIP, `transform-origin: left`). Di jsdom `element.animate` tidak ada, jadi animasi dilewati.
7. **Transisi:** `types` mengembalikan `false` bila lebar ≥ 1024 px, "kurangi gerakan", lokasi awal tidak ada, path sama (hanya query/hash berubah), atau salah satu path bukan halaman ber-dock. Halaman ber-dock = `/lobby` dan `POPUP_PATHS` (`/shelf`, `/vocabulary`, `/settings`, `/habits`, `/shop`, `/recap`, `/highlights`).
8. **Hapus akun:** `DeleteAccountDialog` menerima `onDelete(confirmUsername) => Promise<ActionResult>` sehingga bisa diuji tanpa server. Navigasi setelah berhasil tetap di `settings.tsx`.

---

### Task 1: Rak — "Sedang dibaca" dan kartu buku besar

**Files:**
- Modify: `src/lib/shelf.ts` (tambah `currentRead`)
- Test: `src/lib/shelf.test.ts` (tambah describe)
- Create: `src/components/shelf/CurrentReadCard.tsx`
- Test: `src/components/shelf/CurrentReadCard.test.tsx`
- Modify: `src/components/shelf/BookGrid.tsx`
- Create: `src/components/shelf/BookGrid.test.tsx`
- Modify: `src/styles.css` (`.shelf-grid`, `.shelf-slot`, kelas baru)

**Interfaces:**
- Produces: `currentRead(books: ReadonlyArray<ShelfBook>): ShelfBook | null`; `<CurrentReadCard book percentage onOpen />` dengan `book: ShelfBook`, `percentage: number`, `onOpen: (book: ShelfBook) => void`.

- [ ] **Step 1: Tes `currentRead` (gagal)**

Tambahkan di `src/lib/shelf.test.ts` (import `currentRead` dari `./shelf` dan `sherlock` dari `@/components/shelf/fixtures`):

```ts
describe("currentRead", () => {
  const book = (id: string, lastOpenedAt: string | null, finishedAt: string | null = null) => ({
    ...sherlock,
    id,
    lastOpenedAt,
    finishedAt,
  })

  it("is the book opened last that is not finished", () => {
    const books = [
      book("a", "2026-11-01T10:00:00Z"),
      book("b", "2026-11-20T10:00:00Z", "2026-11-20T11:00:00Z"),
      book("c", "2026-11-10T10:00:00Z"),
      book("d", null),
    ]
    expect(currentRead(books)?.id).toBe("c")
  })

  it("is null when nothing is being read", () => {
    expect(currentRead([book("a", null), book("b", "2026-11-01T10:00:00Z", "2026-11-02T10:00:00Z")])).toBeNull()
    expect(currentRead([])).toBeNull()
  })
})
```

- [ ] **Step 2:** `npx vitest run --maxWorkers=2 src/lib/shelf.test.ts`. Diharapkan: GAGAL (`currentRead` tidak diekspor).

- [ ] **Step 3: Implementasi** di `src/lib/shelf.ts`:

```ts
/** The book Rak Saya puts in front (spec poles mobile §3.2): opened last, not finished. */
export function currentRead(
  books: ReadonlyArray<ShelfBook>
): ShelfBook | null {
  let best: ShelfBook | null = null
  for (const book of books) {
    if (book.finishedAt !== null || book.lastOpenedAt === null) continue
    if (!best || book.lastOpenedAt > (best.lastOpenedAt ?? "")) best = book
  }
  return best
}
```

(Bila `ShelfBook` belum diimpor di `shelf.ts`, impor tipenya dari `@/lib/book-types`.)

- [ ] **Step 4: Tes `CurrentReadCard` (gagal)** di `src/components/shelf/CurrentReadCard.test.tsx`:

```tsx
import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { renderWithRouter } from "@/test/router"
import { sherlock } from "./fixtures"
import { CurrentReadCard } from "./CurrentReadCard"

describe("CurrentReadCard", () => {
  it("shows the book being read with its progress and a way back in", async () => {
    const onOpen = vi.fn()
    renderWithRouter(
      <CurrentReadCard book={sherlock} percentage={15} onOpen={onOpen} />,
      "/shelf"
    )
    const card = await screen.findByRole("region", { name: "Sedang dibaca" })
    expect(card).toHaveTextContent(sherlock.title)
    expect(card).toHaveTextContent(sherlock.author ?? "")
    expect(screen.getByRole("progressbar", { name: "Dibaca 15%" })).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "Lanjutkan · 15%" })
    expect(link).toHaveAttribute("href", `/read/${sherlock.id}`)
    fireEvent.click(screen.getByRole("button", { name: new RegExp(sherlock.title) }))
    expect(onOpen).toHaveBeenCalledWith(sherlock)
  })
})
```

(Bila `formatPercent(15)` menghasilkan teks lain dari "15%", sesuaikan dua harapan di atas dengan keluarannya.)

- [ ] **Step 5:** `npx vitest run --maxWorkers=2 src/components/shelf/CurrentReadCard.test.tsx`. Diharapkan: GAGAL (modul tidak ada).

- [ ] **Step 6: Implementasi** `src/components/shelf/CurrentReadCard.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import { useId } from "react"
import type { ShelfBook } from "@/lib/book-types"
import { formatPercent } from "@/lib/progress"
import { BookCover } from "./BookCover"

/** The book being read, in front of the grid (spec poles mobile §3.2). */
export function CurrentReadCard({
  book,
  percentage,
  onOpen,
}: {
  book: ShelfBook
  percentage: number
  onOpen: (book: ShelfBook) => void
}) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="current-read">
      <h2 id={titleId} className="current-read-kicker">
        Sedang dibaca
      </h2>
      <div className="current-read-body">
        <button
          type="button"
          onClick={() => onOpen(book)}
          className="current-read-book"
        >
          <span className="current-read-cover">
            <BookCover book={book} />
          </span>
          <span className="min-w-0">
            <span className="line-clamp-2 block font-bold">{book.title}</span>
            {book.author && (
              <span className="line-clamp-1 block text-sm text-muted-foreground">
                {book.author}
              </span>
            )}
          </span>
        </button>
        <progress
          max={100}
          value={percentage}
          aria-label={`Dibaca ${formatPercent(percentage)}`}
          className="book-progress"
        />
        <Link
          to="/read/$bookId"
          params={{ bookId: book.id }}
          // Preloading would download the whole EPUB on hover (see ReadLink).
          preload={false}
          className="current-read-continue"
        >
          Lanjutkan · {formatPercent(percentage)}
        </Link>
      </div>
    </section>
  )
}
```

- [ ] **Step 7: Tes `BookGrid` (gagal)** di `src/components/shelf/BookGrid.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "./fixtures"
import { BookGrid } from "./BookGrid"

const local = { saved: new Set<string>(), percentages: new Map<string, number>() }

describe("BookGrid", () => {
  it("marks finished books on the cover and shows progress for the rest", () => {
    const done = { ...sherlock, id: "done", title: "Selesai Dibaca", finishedAt: "2026-11-01T00:00:00Z" }
    const reading = { ...sherlock, id: "reading", title: "Masih Dibaca", progress: 40 }
    render(<BookGrid books={[done, reading]} local={local} onOpen={vi.fn()} />)
    const finished = screen.getByRole("button", { name: /Selesai Dibaca/ })
    expect(finished).toHaveTextContent("Selesai")
    expect(screen.getByRole("progressbar", { name: /Dibaca 40/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Masih Dibaca/ })).not.toHaveTextContent(/^Selesai/)
  })
})
```

- [ ] **Step 8:** jalankan tes itu. Diharapkan: GAGAL pada `toHaveTextContent("Selesai")` (kata "Selesai" di judul tidak cukup karena judulnya "Selesai Dibaca"; kalau tes kebetulan lulus karena judul, ganti judul buku selesai menjadi "Buku Tamat" dan harapan nama `/Buku Tamat/`, lalu pastikan gagal).

- [ ] **Step 9: Implementasi `BookGrid`:**
  - bungkus `<BookCover book={book} />` dengan `<span className="shelf-cover">…</span>`;
  - di dalam bungkus itu, tambahkan `{book.finishedAt !== null && <span className="cover-badge">Selesai</span>}`;
  - progres hanya bila `percentage > 0 && percentage < 100`;
  - judul: ganti kelas `text-xs` menjadi `text-sm`, lalu buang `min-h-[2lh]`;
  - penulis: kelas `text-xs`.

- [ ] **Step 10: CSS** di `src/styles.css`.

Ganti `.shelf-grid` dan `.shelf-slot` (baris ±580):

```css
  /* Rak Saya (spec poles mobile §3.4): two big covers a row on phones. */
  .shelf-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.125rem 1rem;
  }
  @media (min-width: 640px) {
    .shelf-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @media (min-width: 1024px) {
    .shelf-grid {
      grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    }
  }
  .shelf-slot {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .shelf-cover {
    position: relative;
    display: block;
  }
  .cover-badge {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    border-radius: 0.4rem;
    background: rgb(0 0 0 / 0.6);
    padding: 0.1rem 0.45rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-mint);
  }
  .current-read {
    border: 1px solid rgb(47 224 184 / 0.22);
    border-radius: 1rem;
    background: linear-gradient(135deg, rgb(19 58 51 / 0.9), rgb(16 34 38 / 0.9));
    padding: 0.9rem;
  }
  .current-read-kicker {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-mint);
  }
  .current-read-body {
    display: grid;
    gap: 0.6rem;
    margin-top: 0.5rem;
  }
  .current-read-book {
    display: flex;
    gap: 0.9rem;
    align-items: center;
    text-align: left;
  }
  .current-read-cover {
    width: 4.25rem;
    flex: none;
  }
  .current-read-continue {
    justify-self: start;
    border-radius: 0.6rem;
    background: var(--color-mint);
    padding: 0.45rem 0.9rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: #04110e;
  }
```

- [ ] **Step 11:** jalankan ketiga tes, lalu `npx vitest run --maxWorkers=2 src/components/shelf src/lib/shelf.test.ts`. Diharapkan: LULUS semua.
- [ ] **Step 12:** prettier pada berkas yang disentuh, `npm run lint`, `npx tsc --noEmit`, lalu commit `feat(poles): Rak Saya's book being read and big covers`.

---

### Task 2: Rak — tombol ikon, Cari, lembar Saring, dan susunan halaman

**Files:**
- Create: `src/components/shelf/ShelfSearch.tsx`, `src/components/shelf/SortSelect.tsx`, `src/components/shelf/ShelfFilterSheet.tsx`
- Delete: `src/components/shelf/ShelfToolbar.tsx`; Rename test: `ShelfToolbar.test.tsx` → `ShelfSearch.test.tsx` + `SortSelect.test.tsx`
- Modify: `src/components/shelf/ShelfHeader.tsx`, `src/routes/_member/_lobi/shelf.tsx`
- Test: `src/components/shelf/ShelfHeader.test.tsx` (baru), `src/components/shelf/ShelfFilterSheet.test.tsx` (baru)
- Modify: `e2e/shelf.spec.ts` (genre lewat lembar Saring), `src/styles.css`

**Interfaces:**
- Consumes: `currentRead`, `CurrentReadCard` (Task 1).
- Produces:
  - `<ShelfSearch q autoFocus? />`, isi lama `ShelfToolbar` tanpa urutan;
  - `<SortSelect sort defaultSort />`;
  - `<ShelfFilterSheet open onOpenChange genre counts sort defaultSort usage />`;
  - `<ShelfHeader searching onSearch onFilter filtersActive onBring? />`.

- [ ] **Step 1: Pecah tes lama (gagal).**
  - Pindahkan dua tes pertama `ShelfToolbar.test.tsx` ke `ShelfSearch.test.tsx`: ganti `ShelfToolbar` dengan `ShelfSearch`, props menjadi `q="…"` saja. Rerender `<ShelfSearch q="bob" />`.
  - Pindahkan tes ketiga ke `SortSelect.test.tsx` dengan `<SortSelect sort="finished" defaultSort="finished" />`.
  - Mock `@tanstack/react-router` yang sama dipakai di kedua berkas.
  - Hapus `ShelfToolbar.test.tsx`.

Tambahkan satu tes di `ShelfSearch.test.tsx`:

```tsx
  it("takes the focus when opened from the search button", () => {
    render(<ShelfSearch q="" autoFocus />)
    expect(screen.getByLabelText("Cari judul atau penulis")).toHaveFocus()
  })
```

- [ ] **Step 2:** jalankan kedua tes. Diharapkan: GAGAL (modul tidak ada).

- [ ] **Step 3: Implementasi.**
  - `ShelfSearch.tsx` = isi `ShelfToolbar.tsx` dengan perubahan:
    - props `{ q: string; autoFocus?: boolean }`;
    - buang `sort`, `defaultSort`, `children`, dan blok `<select>` urutan;
    - `Input` mendapat `autoFocus={autoFocus}`;
    - pembungkus luar menjadi `<div>` biasa (label + input selebar penuh).
  - `SortSelect.tsx` = blok "Urutkan" dari `ShelfToolbar` (label, `select`, `navigate` yang sama) sebagai komponen sendiri, props `{ sort: ShelfSort; defaultSort: ShelfSort }`, dibungkus `<div>`.
  - Hapus `ShelfToolbar.tsx`.

- [ ] **Step 4: Tes `ShelfHeader` dan `ShelfFilterSheet` (gagal).**

`src/components/shelf/ShelfHeader.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ShelfHeader } from "./ShelfHeader"

describe("ShelfHeader", () => {
  it("names its icon buttons and says when the search is open", () => {
    const onSearch = vi.fn()
    const onFilter = vi.fn()
    const onBring = vi.fn()
    render(
      <ShelfHeader searching={false} onSearch={onSearch} onFilter={onFilter} filtersActive onBring={onBring} />
    )
    expect(screen.getByRole("heading", { name: "Rak Saya" })).toBeInTheDocument()
    const search = screen.getByRole("button", { name: "Cari" })
    expect(search).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(search)
    fireEvent.click(screen.getByRole("button", { name: "Saring" }))
    fireEvent.click(screen.getByRole("button", { name: "Bawa buku" }))
    expect(onSearch).toHaveBeenCalledOnce()
    expect(onFilter).toHaveBeenCalledOnce()
    expect(onBring).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: "Saring" })).toHaveAttribute("data-active")
  })

  it("has no bring button on an empty shelf", () => {
    render(<ShelfHeader searching onSearch={vi.fn()} onFilter={vi.fn()} filtersActive={false} />)
    expect(screen.queryByRole("button", { name: "Bawa buku" })).toBeNull()
    expect(screen.getByRole("button", { name: "Cari" })).toHaveAttribute("aria-expanded", "true")
  })
})
```

`src/components/shelf/ShelfFilterSheet.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { countBooks } from "@/lib/shelf"
import { sherlock } from "./fixtures"
import { ShelfFilterSheet } from "./ShelfFilterSheet"

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))

describe("ShelfFilterSheet", () => {
  it("holds the genre, the order and the storage", async () => {
    render(
      <ShelfFilterSheet
        open
        onOpenChange={vi.fn()}
        genre="semua"
        counts={countBooks([sherlock])}
        sort="opened"
        defaultSort="opened"
        usage={{ usedBytes: 0, limitBytes: 104857600, plan: "free" }}
      />
    )
    const sheet = await screen.findByRole("dialog", { name: "Saring rak" })
    expect(sheet).toContainElement(screen.getByLabelText("Tampilkan genre"))
    expect(sheet).toContainElement(screen.getByLabelText("Urutkan"))
    expect(sheet).toHaveTextContent("Penyimpanan")
  })
})
```

(Sesuaikan objek `usage` dengan tipe `StorageUsage` di `src/lib/book-types.ts` bila nama kolomnya berbeda.)

- [ ] **Step 5:** jalankan kedua tes. Diharapkan: GAGAL.

- [ ] **Step 6: Implementasi `ShelfHeader.tsx`** (ganti seluruh isi):

```tsx
import { PlusIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react"

/** Rak Saya's title with its three icon buttons (spec poles mobile §3.1). */
export function ShelfHeader({
  searching,
  onSearch,
  onFilter,
  filtersActive,
  onBring,
}: {
  searching: boolean
  onSearch: () => void
  onFilter: () => void
  /** A genre or an order other than the default is chosen. */
  filtersActive: boolean
  /** Missing on an empty shelf, which has its own button. */
  onBring?: () => void
}) {
  return (
    <header className="flex items-center justify-between gap-3">
      <h1 className="font-heading text-3xl font-bold">Rak Saya</h1>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="shelf-icon-button"
          aria-label="Cari"
          aria-expanded={searching}
          onClick={onSearch}
        >
          <SearchIcon aria-hidden="true" />
        </button>
        <button
          type="button"
          className="shelf-icon-button"
          aria-label="Saring"
          data-active={filtersActive ? "" : undefined}
          onClick={onFilter}
        >
          <SlidersHorizontalIcon aria-hidden="true" />
        </button>
        {onBring && (
          <button
            type="button"
            className="shelf-icon-button"
            data-primary=""
            aria-label="Bawa buku"
            onClick={onBring}
          >
            <PlusIcon aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  )
}
```

- [ ] **Step 7: Implementasi `ShelfFilterSheet.tsx`:**

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { StorageUsage } from "@/lib/book-types"
import type { ShelfFilter, ShelfSort } from "@/lib/shelf"
import { GenreSelect } from "./GenreSelect"
import { SortSelect } from "./SortSelect"
import { StorageMeter } from "./StorageMeter"

/** Genre, order and storage, out of the page's way (spec poles mobile §3.1). */
export function ShelfFilterSheet({
  open,
  onOpenChange,
  genre,
  counts,
  sort,
  defaultSort,
  usage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  genre: ShelfFilter
  counts: Record<ShelfFilter, number>
  sort: ShelfSort
  defaultSort: ShelfSort
  usage: StorageUsage
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shelf-sheet">
        <DialogHeader>
          <DialogTitle>Saring rak</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <GenreSelect value={genre} counts={counts} />
          <SortSelect sort={sort} defaultSort={defaultSort} />
          <StorageMeter usage={usage} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

(`StorageMeter` sudah menulis "Penyimpanan"; bila tidak, tes Step 4 menunjukkannya. Dalam hal itu tambahkan `<h3>Penyimpanan</h3>` di atas meter.)

- [ ] **Step 8: Susun ulang `shelf.tsx`.**
  - State baru:
    - `const [searching, setSearching] = useState(Boolean(search.q))`;
    - `const [filtering, setFiltering] = useState(false)`.
  - `const reading = !koleksi && !search.genre && !search.q ? currentRead(books) : null`.
  - `filtersActive = Boolean(search.genre) || Boolean(search.sort)`.
  - Ganti `<ShelfHeader usage actions />` dengan:

    ```tsx
    <ShelfHeader
      searching={searching}
      onSearch={() => {
        if (searching && search.q)
          void navigate({ search: (prev) => ({ ...prev, q: undefined }), replace: true })
        setSearching(!searching)
      }}
      onFilter={() => setFiltering(true)}
      filtersActive={filtersActive}
      onBring={books.length > 0 ? () => setUploading(true) : undefined}
    />
    ```

  - Di bawahnya, `{searching && <ShelfSearch q={search.q ?? ""} autoFocus={!search.q} />}`.
  - Pesan offline dan `notice` tetap di tempatnya.
  - Di cabang berbuku, urutannya:
    1. `{reading && <CurrentReadCard book={reading} percentage={shelfPercentage(reading, local)} onOpen={(book) => setSelectedId(book.id)} />}`;
    2. `CollectionBar`;
    3. grid atau pesan kosong.

    Hapus `ShelfToolbar` beserta `GenreSelect` di halaman.
  - Tambahkan sebelum `BookDetail`:

    ```tsx
    <ShelfFilterSheet
      open={filtering}
      onOpenChange={setFiltering}
      genre={search.genre ?? "semua"}
      counts={counts}
      sort={search.sort ?? ordering}
      defaultSort={ordering}
      usage={usage}
    />
    ```

  - `LobbyPopup` `bodyClassName` menjadi `"gap-6"`.
  - Hapus impor yang tak terpakai (`Button` tetap untuk `EmptyShelf`).

- [ ] **Step 9: CSS** (di dekat `.shelf-grid`):

```css
  .shelf-icon-button {
    position: relative;
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--color-panel);
  }
  .shelf-icon-button svg {
    width: 1.15rem;
    height: 1.15rem;
  }
  .shelf-icon-button[data-primary] {
    border-color: transparent;
    background: var(--color-mint);
    color: #04110e;
  }
  .shelf-icon-button[aria-expanded="true"] {
    color: var(--color-mint);
  }
  .shelf-icon-button[data-active]::after {
    content: "";
    position: absolute;
    top: 0.35rem;
    right: 0.35rem;
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 9999px;
    background: var(--color-mint);
  }
  /* The filter dialog sits at the foot of a phone's screen. */
  @media (max-width: 1023px) {
    .shelf-sheet {
      top: auto;
      bottom: 0;
      translate: -50% 0;
      border-radius: 1.25rem 1.25rem 0 0;
      padding-bottom: calc(1.25rem + env(safe-area-inset-bottom));
    }
  }
```

(Periksa di `src/components/ui/dialog.tsx` bagaimana `DialogContent` diposisikan. Bila ia memakai kelas Tailwind `top-1/2 -translate-y-1/2`, buat kelas `.shelf-sheet` di atas mengalahkannya dengan menambah `!important` pada `top`, `bottom`, dan `translate`, atau gunakan varian kelas Tailwind yang setara di `className`.)

- [ ] **Step 10: Perbarui E2E `e2e/shelf.spec.ts`.**
  - Di dua tes yang memakai `page.getByLabel("Tampilkan genre")`, buka lembar dulu dengan `await page.getByRole("button", { name: "Saring" }).click()`, lalu ambil `genre` dari `page.getByRole("dialog", { name: "Saring rak" }).getByLabel("Tampilkan genre")`.
  - Setelah memilih genre, tutup lembar (`await page.keyboard.press("Escape")`) sebelum mengetuk buku. Buka lagi sebelum pemilihan genre berikutnya.
  - Untuk "0.7/0.8 MB / 100 MB" dan "0 MB / 100 MB", buka lembar Saring dulu, lalu periksa teksnya di dalam lembar.
  - Pastikan tidak ada pemakaian lain `ShelfToolbar` atau "Cari judul atau penulis" di E2E (`Grep`). Bila ada, ketuk tombol "Cari" dulu.

- [ ] **Step 11: Verifikasi.**
  - `npx vitest run --maxWorkers=2 src/components/shelf src/routes`;
  - `npx playwright test e2e/shelf.spec.ts e2e/collections.spec.ts --project=desktop --project=mobile --workers=2`.

  Diharapkan: semua LULUS.
- [ ] **Step 12:** prettier, lint, tsc, lalu commit `feat(poles): Rak Saya's icon buttons, search on demand and the filter sheet`.

---

### Task 3: Dock mengambang

**Files:**
- Create: `src/lib/use-typing.ts`, `src/lib/use-typing.test.ts`
- Create: `src/components/member/MemberDock.tsx`
- Modify: `src/components/member/MemberShell.tsx` (ganti `<nav className="member-tabbar">` dengan `<MemberDock pathname={pathname} />`; ekspor `LINKS` dan `isCurrent`)
- Modify: `src/components/member/MemberShell.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces:
  - `isTypingTarget(element: Element | null): boolean`;
  - `useTyping(): boolean`;
  - `<MemberDock pathname />` (nav "Navigasi utama", kelas `member-dock`);
  - variabel CSS `--dock-space`.

- [ ] **Step 1: Tes `use-typing` (gagal)** di `src/lib/use-typing.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { isTypingTarget, useTyping } from "./use-typing"

afterEach(() => {
  document.body.innerHTML = ""
})

describe("isTypingTarget", () => {
  it("is a field that opens the keyboard", () => {
    const make = (html: string) => {
      document.body.innerHTML = html
      return document.body.firstElementChild
    }
    expect(isTypingTarget(make('<input type="text">'))).toBe(true)
    expect(isTypingTarget(make('<input type="search">'))).toBe(true)
    expect(isTypingTarget(make("<input>"))).toBe(true)
    expect(isTypingTarget(make("<textarea></textarea>"))).toBe(true)
    expect(isTypingTarget(make('<div contenteditable="true"></div>'))).toBe(true)
    expect(isTypingTarget(make('<input type="checkbox">'))).toBe(false)
    expect(isTypingTarget(make("<select></select>"))).toBe(false)
    expect(isTypingTarget(make("<button></button>"))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe("useTyping", () => {
  it("follows the focus into and out of a text field", () => {
    document.body.innerHTML = '<input type="text"><button>ok</button>'
    const input = document.querySelector("input")!
    const button = document.querySelector("button")!
    const { result } = renderHook(() => useTyping())
    expect(result.current).toBe(false)
    act(() => input.focus())
    expect(result.current).toBe(true)
    act(() => button.focus())
    expect(result.current).toBe(false)
  })
})
```

- [ ] **Step 2:** jalankan. Diharapkan: GAGAL.

- [ ] **Step 3: Implementasi** `src/lib/use-typing.ts`:

```ts
import { useEffect, useState } from "react"

/** Input types that do not open a keyboard. */
const NO_KEYBOARD = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
])

/** Whether focusing this element opens the phone's keyboard. */
export function isTypingTarget(element: Element | null): boolean {
  if (!element) return false
  if (element instanceof HTMLTextAreaElement) return true
  if (element instanceof HTMLInputElement) return !NO_KEYBOARD.has(element.type)
  return element instanceof HTMLElement && element.isContentEditable
}

/** True while a field that opens the keyboard has the focus (spec poles mobile §4.5). */
export function useTyping(): boolean {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) =>
      setTyping(isTypingTarget(event.target as Element | null))
    // The element that gets the focus next, or nothing.
    const onFocusOut = (event: FocusEvent) =>
      setTyping(isTypingTarget(event.relatedTarget as Element | null))
    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("focusout", onFocusOut)
    return () => {
      document.removeEventListener("focusin", onFocusIn)
      document.removeEventListener("focusout", onFocusOut)
    }
  }, [])
  return typing
}
```

Catatan: di jsdom, `isContentEditable` bisa `undefined`. Bila tes contenteditable gagal karena itu, ganti baris terakhir menjadi `return element instanceof HTMLElement && (element.isContentEditable || element.getAttribute("contenteditable") === "true")`.

- [ ] **Step 4: Tes dock (gagal).** Di `MemberShell.test.tsx`, tambahkan tes baru (tes lama tetap: dua nav "Navigasi utama", nama link, `aria-current`):

```tsx
  it("floats the phone's dock, naming every tab and labelling only the current one", async () => {
    const { container } = renderAt("/shelf")
    await screen.findAllByRole("navigation", { name: "Navigasi utama" })
    const dock = container.querySelector(".member-dock")
    expect(dock).not.toBeNull()
    const tabs = within(dock as HTMLElement).getAllByRole("link")
    expect(tabs.map((tab) => tab.getAttribute("aria-label"))).toEqual([
      "Ruang baca",
      "Rak Saya",
      "Kosakata",
      "Pengaturan",
    ])
    const labels = dock!.querySelectorAll(".member-dock-label")
    expect([...labels].map((label) => label.textContent)).toEqual(["Rak"])
  })

  it("hides the dock while a text field has the focus", async () => {
    const { container } = renderAt("/settings")
    await screen.findAllByRole("navigation", { name: "Navigasi utama" })
    const field = document.createElement("input")
    document.body.append(field)
    act(() => field.focus())
    expect(container.querySelector(".member-dock")).toHaveAttribute("data-typing")
    act(() => field.blur())
    expect(container.querySelector(".member-dock")).not.toHaveAttribute("data-typing")
    field.remove()
  })
```

- [ ] **Step 5:** jalankan `MemberShell.test.tsx`. Diharapkan: GAGAL.

- [ ] **Step 6: Implementasi `MemberDock.tsx`:**

```tsx
import { Link } from "@tanstack/react-router"
import { useLayoutEffect, useRef } from "react"
import { useTyping } from "@/lib/use-typing"
import { LINKS, isCurrent } from "./MemberShell"

const SLIDE_MS = 250
const EASE = "cubic-bezier(0.22, 0.8, 0.24, 1)"

/**
 * The phone's floating dock (spec poles mobile §4): a glass pill; only the
 * current tab shows its name, on a green pill that slides between tabs.
 */
export function MemberDock({ pathname }: { pathname: string }) {
  const typing = useTyping()
  const navRef = useRef<HTMLElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const last = useRef<{ left: number; width: number } | null>(null)
  const current = LINKS.findIndex(({ to }) => isCurrent(pathname, to))

  useLayoutEffect(() => {
    const nav = navRef.current
    const pill = pillRef.current
    if (!nav || !pill) return
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]')
    if (!active) {
      pill.hidden = true
      last.current = null
      return
    }
    pill.hidden = false
    const box = { left: active.offsetLeft, width: active.offsetWidth }
    pill.style.left = `${box.left}px`
    pill.style.width = `${box.width}px`
    const before = last.current
    last.current = box
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (!before || still || typeof pill.animate !== "function" || box.width === 0) return
    const dx = before.left - box.left
    const sx = before.width / box.width
    if (dx === 0 && sx === 1) return
    pill.animate(
      [{ transform: `translateX(${dx}px) scaleX(${sx})` }, { transform: "none" }],
      { duration: SLIDE_MS, easing: EASE }
    )
  }, [current])

  return (
    <nav
      ref={navRef}
      aria-label="Navigasi utama"
      className="member-dock"
      data-typing={typing ? "" : undefined}
    >
      <span ref={pillRef} className="member-dock-pill" aria-hidden="true" />
      {LINKS.map(({ to, label, short, Icon }) => {
        const here = isCurrent(pathname, to)
        return (
          <Link
            key={to}
            to={to}
            className="member-dock-tab"
            aria-label={label}
            aria-current={here ? "page" : undefined}
          >
            <Icon aria-hidden="true" className="size-5" />
            {here && <span className="member-dock-label">{short}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
```

Di `MemberShell.tsx`:
- ekspor `LINKS` dan `isCurrent` (`export const LINKS`, `export const isCurrent`);
- ganti blok `{shown && (<nav aria-label="Navigasi utama" className="member-tabbar">…</nav>)}` dengan `{shown && <MemberDock pathname={pathname} />}`;
- impor `MemberDock`.

Impor melingkar `MemberDock` ↔ `MemberShell` hanya dipakai saat render. Bila linter menolaknya, pindahkan `LINKS` dan `isCurrent` ke `src/components/member/nav-links.ts` dan impor dari sana di kedua berkas.

- [ ] **Step 7: CSS.**
  - Ganti `--tabbar-h: calc(3.5rem + env(safe-area-inset-bottom));` (baris ±112) dengan:

    ```css
      /* The floating dock and its gap above the phone's gesture area (spec poles mobile §4). */
      --dock-space: calc(3.5rem + 1.5rem + env(safe-area-inset-bottom));
    ```

  - Ganti semua `var(--tabbar-h)` dengan `var(--dock-space)`: `.member-main[data-shell]` padding, `.lobby-page` height, `.update-notice` bottom, dan `min-height` di `main` (±baris 2204).
  - Hapus aturan `.member-tabbar`, `.member-tab`, `.member-tab[aria-current="page"]` (pertahankan `.member-nav-link[aria-current="page"]`) dan `.member-tabbar { display: none }` di media desktop.
  - Tambahkan:

```css
  .member-dock {
    position: fixed;
    left: 50%;
    bottom: calc(0.75rem + env(safe-area-inset-bottom));
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: space-around;
    width: min(100% - 2rem, 22.5rem);
    height: 3.5rem;
    padding: 0 0.5rem;
    translate: -50% 0;
    border: 1px solid rgb(120 200 180 / 0.16);
    border-radius: 9999px;
    background: rgb(16 31 34 / 0.78);
    backdrop-filter: blur(14px);
    box-shadow: 0 12px 28px rgb(0 0 0 / 0.5);
    view-transition-name: dock;
    transition:
      opacity 0.2s,
      translate 0.2s;
  }
  .member-dock[data-typing] {
    opacity: 0;
    translate: -50% 1rem;
    pointer-events: none;
  }
  .member-dock-pill {
    position: absolute;
    top: 0.5rem;
    bottom: 0.5rem;
    left: 0;
    border-radius: 9999px;
    background: var(--color-mint);
    transform-origin: left center;
  }
  .member-dock-tab {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    height: 2.5rem;
    padding: 0 0.8rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--muted-foreground);
  }
  .member-dock-tab[aria-current="page"] {
    color: #04110e;
  }
  .member-dock-tab:focus-visible {
    outline: 2px solid var(--color-mint);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .member-dock {
      transition: none;
    }
  }
  /* The room's own colour under the dock, while the room is shown on a phone. */
  @media (max-width: 1023px) {
    body:has(.lobby-page:not([data-popup])) {
      background: #1b120c;
    }
  }
```

Di blok `@media (min-width: 1024px)` yang menyembunyikan tab bar, ganti `.member-tabbar { display: none; }` dengan `.member-dock { display: none; }`.

- [ ] **Step 8: Verifikasi.**
  - `npx vitest run --maxWorkers=2 src/components/member src/lib/use-typing.test.ts src/components/lobby`;
  - `npx playwright test e2e/lobby-popup.spec.ts e2e/vocabulary.spec.ts e2e/lobby.spec.ts --project=mobile --workers=2`.

  Diharapkan: LULUS. Tes E2E memakai nav "Navigasi utama" dan link bernama, yang tetap sama.
- [ ] **Step 9:** prettier, lint, tsc, lalu commit `feat(poles): the phone's floating dock`.

---

### Task 4: Transisi halaman "kartu di atas ruang"

**Files:**
- Create: `src/lib/page-transition.ts`, `src/lib/page-transition.test.ts`
- Modify: `src/router.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `POPUP_PATHS` dari `src/components/lobby/LobbyPopup.tsx`; `WIDE_QUERY` dari `src/lib/use-wide-screen.ts`; dock `view-transition-name: dock` (Task 3).
- Produces: `transitionTypes(from: string | undefined, to: string, env: { wide: boolean; reducedMotion: boolean }): Array<PageTransition> | false`, dengan `type PageTransition = "ke-halaman" | "ke-ruang" | "antar-halaman"`.

- [ ] **Step 1: Tes (gagal)** di `src/lib/page-transition.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { transitionTypes } from "./page-transition"

const phone = { wide: false, reducedMotion: false }

describe("transitionTypes", () => {
  it("raises a page over the room and drops it back", () => {
    expect(transitionTypes("/lobby", "/shelf", phone)).toEqual(["ke-halaman"])
    expect(transitionTypes("/settings", "/lobby", phone)).toEqual(["ke-ruang"])
  })

  it("fades between pages", () => {
    expect(transitionTypes("/shelf", "/vocabulary", phone)).toEqual(["antar-halaman"])
    expect(transitionTypes("/habits", "/settings", phone)).toEqual(["antar-halaman"])
  })

  it("does nothing on a wide screen, with reduced motion, or for the same page", () => {
    expect(transitionTypes("/lobby", "/shelf", { wide: true, reducedMotion: false })).toBe(false)
    expect(transitionTypes("/lobby", "/shelf", { wide: false, reducedMotion: true })).toBe(false)
    expect(transitionTypes("/shelf", "/shelf", phone)).toBe(false)
    expect(transitionTypes(undefined, "/shelf", phone)).toBe(false)
  })

  it("leaves the reader and the pages without the dock alone", () => {
    expect(transitionTypes("/shelf", "/read/abc", phone)).toBe(false)
    expect(transitionTypes("/read/abc", "/lobby", phone)).toBe(false)
    expect(transitionTypes("/login", "/lobby", phone)).toBe(false)
    expect(transitionTypes("/welcome", "/lobby", phone)).toBe(false)
  })
})
```

- [ ] **Step 2:** jalankan. Diharapkan: GAGAL.

- [ ] **Step 3: Implementasi** `src/lib/page-transition.ts`:

```ts
import { POPUP_PATHS } from "@/components/lobby/LobbyPopup"

export type PageTransition = "ke-halaman" | "ke-ruang" | "antar-halaman"

const ROOM = "/lobby"
/** The pages with the phone's dock: the room and the pages over it. */
const DOCK_PAGES = new Set([ROOM, ...POPUP_PATHS])

/**
 * The view transition for a navigation on a phone (spec poles mobile §5), or
 * false for none: wide screens, reduced motion, a change of query only, and
 * pages without the dock (the reader, sign-in, the card page).
 */
export function transitionTypes(
  from: string | undefined,
  to: string,
  env: { wide: boolean; reducedMotion: boolean }
): Array<PageTransition> | false {
  if (env.wide || env.reducedMotion || from === undefined || from === to) {
    return false
  }
  if (!DOCK_PAGES.has(from) || !DOCK_PAGES.has(to)) return false
  if (from === ROOM) return ["ke-halaman"]
  if (to === ROOM) return ["ke-ruang"]
  return ["antar-halaman"]
}
```

Bila mengimpor `LobbyPopup.tsx` menarik terlalu banyak modul ke router (impor melingkar atau error SSR), pindahkan `POPUP_PATHS` dan `isPopupPath` ke `src/lib/popup-paths.ts`, ekspor ulang dari `LobbyPopup.tsx`, lalu impor dari berkas baru itu.

- [ ] **Step 4:** jalankan tes. Diharapkan: LULUS.

- [ ] **Step 5: Router.** Di `src/router.tsx`, tambahkan ke opsi `createTanStackRouter`:

```ts
    // Phones animate between the room and its pages (spec poles mobile §5).
    defaultViewTransition: {
      types: ({ fromLocation, toLocation }) =>
        transitionTypes(fromLocation?.pathname, toLocation.pathname, {
          wide: window.matchMedia(WIDE_QUERY).matches,
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches,
        }),
    },
```

Impor `transitionTypes` dari `@/lib/page-transition` dan `WIDE_QUERY` dari `@/lib/use-wide-screen`. Fungsi ini hanya dipanggil di browser. Bila tipe `types` menolak `Array<PageTransition>`, kembalikan `Array<string>` (ubah tipe kembali `transitionTypes` menjadi `Array<string> | false`).

- [ ] **Step 6: CSS** (di akhir `@layer components` atau di luar layer, setelah aturan dock):

```css
/* Page transitions on phones (spec poles mobile §5). The router names the
   kind; wide screens and reduced motion get none (src/lib/page-transition.ts). */
@media (max-width: 1023px) {
  :active-view-transition-type(ke-halaman)::view-transition-old(root) {
    animation: vt-room-back 260ms cubic-bezier(0.22, 0.8, 0.24, 1) both;
  }
  :active-view-transition-type(ke-halaman)::view-transition-new(root) {
    animation: vt-card-up 260ms cubic-bezier(0.22, 0.8, 0.24, 1) both;
  }
  :active-view-transition-type(ke-ruang)::view-transition-old(root) {
    z-index: 1;
    animation: vt-card-down 260ms cubic-bezier(0.22, 0.8, 0.24, 1) both;
  }
  :active-view-transition-type(ke-ruang)::view-transition-new(root) {
    animation: vt-room-forward 260ms cubic-bezier(0.22, 0.8, 0.24, 1) both;
  }
  :active-view-transition-type(antar-halaman)::view-transition-old(root) {
    animation: vt-fade-out 260ms cubic-bezier(0.22, 0.8, 0.24, 1) both;
  }
  :active-view-transition-type(antar-halaman)::view-transition-new(root) {
    animation: vt-rise-in 260ms cubic-bezier(0.22, 0.8, 0.24, 1) both;
  }
}
@keyframes vt-card-up {
  from {
    transform: translateY(100%);
    border-radius: 1.5rem 1.5rem 0 0;
  }
}
@keyframes vt-card-down {
  to {
    transform: translateY(100%);
    border-radius: 1.5rem 1.5rem 0 0;
  }
}
@keyframes vt-room-back {
  to {
    transform: scale(0.94);
    filter: brightness(0.6);
  }
}
@keyframes vt-room-forward {
  from {
    transform: scale(0.94);
    filter: brightness(0.6);
  }
}
@keyframes vt-fade-out {
  to {
    opacity: 0;
  }
}
@keyframes vt-rise-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}
```

- [ ] **Step 7: Cek di browser HP-emulasi.** Jalankan `npm run dev`, buka Chrome DevTools dalam mode perangkat Pixel 7, masuk, lalu ketuk dock:
  - Ruang → Rak: kartu naik dan ruang mengecil;
  - Rak → Kosakata: pudar dan naik;
  - → Ruang: kartu turun;
  - di DevTools "Rendering → Emulate prefers-reduced-motion: reduce": tanpa animasi;
  - lebar 1280: tanpa animasi.

  Catat hasilnya di laporan task. Bila animasi tidak muncul, periksa di konsol bahwa `document.startViewTransition` ada dan `types` terpanggil.
- [ ] **Step 8: Verifikasi.**
  - `npx vitest run --maxWorkers=2 src/lib/page-transition.test.ts src/components/member`;
  - `npx playwright test e2e/lobby-popup.spec.ts e2e/lobby.spec.ts --project=mobile --project=desktop --workers=2`.

  Diharapkan: LULUS, karena transisi tidak boleh memperlambat atau memecah navigasi.
- [ ] **Step 9:** prettier, lint, tsc, lalu commit `feat(poles): page transitions on phones, the page as a card over the room`.

---

### Task 5: Pengaturan — daftar "Akun" dan dialog Hapus akun

**Files:**
- Create: `src/components/settings/DeleteAccountDialog.tsx`, `src/components/settings/DeleteAccountDialog.test.tsx`
- Modify: `src/routes/_member/_lobi/settings.tsx`, `src/styles.css`
- Modify: `e2e/auth.spec.ts` (±baris 98), `e2e/shelf.spec.ts` (±baris 207)

**Interfaces:**
- Consumes: `authMessage(code).field` (`@/lib/auth-messages`); `ActionResult` (`@/lib/action-result`).
- Produces: `<DeleteAccountDialog open onOpenChange username onDelete />` dengan `onDelete: (confirmUsername: string) => Promise<ActionResult>`.

- [ ] **Step 1: Tes (gagal)** di `src/components/settings/DeleteAccountDialog.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { authMessage } from "@/lib/auth-messages"
import { DeleteAccountDialog } from "./DeleteAccountDialog"

describe("DeleteAccountDialog", () => {
  it("asks for the username and shows why the deletion was refused", async () => {
    const onDelete = vi.fn().mockResolvedValue({ ok: false, code: "username_mismatch" })
    render(<DeleteAccountDialog open onOpenChange={vi.fn()} username="ani" onDelete={onDelete} />)
    const dialog = await screen.findByRole("dialog", { name: "Hapus akun" })
    fireEvent.change(
      screen.getByLabelText("Ketik nama penggunamu untuk konfirmasi (ani)"),
      { target: { value: "anu" } }
    )
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Hapus akun saya permanen" }))
    })
    expect(onDelete).toHaveBeenCalledWith("anu")
    expect(dialog).toHaveTextContent(authMessage("username_mismatch").field)
  })
})
```

(Pakai kode galat yang benar-benar dikirim `deleteAccountFn` untuk nama yang salah. Cari di `src/server/profile.ts`; E2E mengharapkan teks "Ketik nama penggunamu persis.".)

- [ ] **Step 2:** jalankan. Diharapkan: GAGAL.

- [ ] **Step 3: Implementasi** `DeleteAccountDialog.tsx`. Pindahkan formulir hapus akun dari `settings.tsx` (label, input `confirmUsername`, `p role="alert"`, tombol destruktif, state `deleting`/`deleteError`) ke dalam `Dialog`:

```tsx
import { type FormEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ActionResult } from "@/lib/action-result"
import { authMessage } from "@/lib/auth-messages"

/** Deleting the account, behind a confirmation (spec poles mobile §6). */
export function DeleteAccountDialog({
  open,
  onOpenChange,
  username,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  username: string
  /** Resolves only on refusal; success leaves the page. */
  onDelete: (confirmUsername: string) => Promise<ActionResult>
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setDeleting(true)
    setError(null)
    let result: ActionResult
    try {
      result = await onDelete(String(form.get("confirmUsername") ?? ""))
    } catch {
      result = { ok: false, code: "unknown" }
    }
    if (!result.ok) {
      setDeleting(false)
      setError(result.code)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shelf-sheet">
        <DialogHeader>
          <DialogTitle>Hapus akun</DialogTitle>
          <DialogDescription>
            Semua data milikmu akan dihapus permanen dan tidak bisa
            dikembalikan.
          </DialogDescription>
        </DialogHeader>
        <form method="post" onSubmit={onSubmit} className="space-y-3 text-sm">
          <div className="space-y-1">
            <Label htmlFor="confirmUsername">
              Ketik nama penggunamu untuk konfirmasi ({username})
            </Label>
            <Input
              id="confirmUsername"
              name="confirmUsername"
              autoComplete="off"
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {authMessage(error).field}
            </p>
          )}
          <Button type="submit" variant="destructive" size="lg" disabled={deleting}>
            {deleting ? "Menghapus…" : "Hapus akun saya permanen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

(Bila tipe `ActionResult` tidak memiliki bentuk `{ ok: false; code: string }`, sesuaikan dengan definisinya di `src/lib/action-result.ts`.)

- [ ] **Step 4: `settings.tsx`.**
  - Hapus panel Keluar dan panel Hapus akun, beserta state dan handler `deleting`/`deleteError` (pindah ke dialog).
  - `onDelete` menjadi fungsi yang mengembalikan hasil:

    ```tsx
      async function deleteAccountAndLeave(confirmUsername: string) {
        const result = await deleteAccount({ data: { confirmUsername } })
        if (!result.ok) return result
        await clearLocalData().catch((error: unknown) =>
          console.error("clearing this device failed", error)
        )
        await router.navigate({ href: "/" })
        return result
      }
    ```

    Pertahankan komentar navigasi yang ada.
  - Tambahkan `const [deletingOpen, setDeletingOpen] = useState(false)` dan, setelah panel Profil:

```tsx
      <section aria-labelledby="akun-title" className="space-y-2">
        <h2 id="akun-title" className="settings-section-title">
          Akun
        </h2>
        <ul className="settings-rows">
          <li>
            <Link to="/logout" className="settings-row">
              <LogOutIcon aria-hidden="true" />
              Keluar
              <ChevronRightIcon aria-hidden="true" className="ml-auto" />
            </Link>
          </li>
          <li>
            <button
              type="button"
              className="settings-row"
              data-danger=""
              onClick={() => setDeletingOpen(true)}
            >
              <Trash2Icon aria-hidden="true" />
              Hapus akun
              <ChevronRightIcon aria-hidden="true" className="ml-auto" />
            </button>
          </li>
        </ul>
      </section>
      <DeleteAccountDialog
        open={deletingOpen}
        onOpenChange={setDeletingOpen}
        username={user.username}
        onDelete={deleteAccountAndLeave}
      />
```

  - Impor ikon dari `lucide-react`. Buang impor yang tak terpakai (`buttonVariants`, dan `FormEvent` bila tak terpakai lagi).

- [ ] **Step 5: CSS:**

```css
  .settings-section-title {
    padding-inline: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }
  .settings-rows {
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 1rem;
    background: var(--color-panel);
  }
  .settings-rows > li + li {
    border-top: 1px solid var(--border);
  }
  .settings-row {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.75rem;
    padding: 0.9rem 1rem;
    font-size: 0.95rem;
    text-align: left;
  }
  .settings-row svg {
    width: 1.1rem;
    height: 1.1rem;
  }
  .settings-row:hover {
    background: var(--muted);
  }
  .settings-row[data-danger] {
    color: var(--destructive);
  }
```

- [ ] **Step 6: E2E.** Di `e2e/auth.spec.ts` (±98) dan `e2e/shelf.spec.ts` (±207), sebelum mengisi label "Ketik nama penggunamu untuk konfirmasi", tambahkan `await page.getByRole("button", { name: "Hapus akun" }).click()`. Pastikan `e2e/lobby.spec.ts:179` (`getByRole("main").getByRole("link", { name: "Keluar" })`) masih cocok. Link Keluar ada di dalam `LobbyPopup`; bila popup bukan `main` di HP, sesuaikan locator-nya ke `page.getByRole("link", { name: "Keluar", exact: true })`.
- [ ] **Step 7: Verifikasi.**
  - `npx vitest run --maxWorkers=2 src/components/settings src/routes`;
  - `npx playwright test e2e/auth.spec.ts e2e/shelf.spec.ts e2e/lobby.spec.ts --project=desktop --project=mobile --workers=2`.

  Diharapkan: LULUS.
- [ ] **Step 8:** prettier, lint, tsc, lalu commit `feat(poles): Pengaturan's Akun list, account deletion in a dialog`.

---

### Task 6: E2E navigasi dock dan verifikasi akhir

**Files:**
- Modify: `e2e/lobby-popup.spec.ts` (tambah satu tes untuk project `mobile`)

**Interfaces:**
- Consumes: semua task sebelumnya.

- [ ] **Step 1: Tes E2E dock.** Tambahkan di `e2e/lobby-popup.spec.ts` (ikuti pola masuk anggota dan helper yang dipakai berkas itu):

```ts
test("the phone's dock moves between the room and its pages, and hides while typing", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "the dock is the phone's navigation")
  await signInAndOnboard(page, await createConfirmedMember())
  const dock = page.locator("nav.member-dock")
  await expect(dock.getByRole("link", { name: "Ruang baca" })).toHaveAttribute("aria-current", "page")
  await dock.getByRole("link", { name: "Rak Saya" }).click()
  await expect(page).toHaveURL(/\/shelf$/)
  await expect(dock.getByRole("link", { name: "Rak Saya" })).toHaveAttribute("aria-current", "page")
  await expect(dock.locator(".member-dock-label")).toHaveText("Rak")
  await page.getByRole("button", { name: "Cari" }).click()
  await expect(page.getByLabel("Cari judul atau penulis")).toBeFocused()
  await expect(dock).toHaveAttribute("data-typing", "")
  await page.getByLabel("Cari judul atau penulis").blur()
  await expect(dock).not.toHaveAttribute("data-typing")
  await dock.getByRole("link", { name: "Pengaturan" }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await dock.getByRole("link", { name: "Ruang baca" }).click()
  await expect(page).toHaveURL(/\/lobby$/)
})
```

(Impor `createConfirmedMember`, `signInAndOnboard` dari `./helpers/members` bila belum.)

- [ ] **Step 2:** `npx playwright test e2e/lobby-popup.spec.ts --project=mobile --project=desktop --workers=2`. Diharapkan: LULUS (desktop melewati tes ini).
- [ ] **Step 3: Verifikasi penuh.**
  - `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run check`, `npm run build`;
  - `npx playwright test --project=desktop --project=mobile --project=offline --workers=2`;
  - `npx playwright test --project=lobby-3d --no-deps --workers=1`.

  Diharapkan: semua LULUS. Bila ada E2E lain yang mencari kontrol lama, perbaiki locator-nya ke letak baru, lalu ulangi:
  - "Tampilkan genre"/"Urutkan" → lembar Saring;
  - "Cari judul atau penulis" → tombol Cari dulu;
  - Hapus akun → dialog.
- [ ] **Step 4:** commit `test(poles): E2E for the phone's dock`.
- [ ] **Step 5: Daftar cek HP pemilik** (laporkan di akhir, tidak dikerjakan agen):
  - dock melayang dan pilnya bergeser;
  - Ruang → Rak: kartu naik dan ruang terlihat di belakang;
  - kembali ke Ruang: kartu turun;
  - antarhalaman: pudar dan naik;
  - dock tersembunyi saat mengetik;
  - Rak: kartu "Sedang dibaca", grid 2 kolom, Saring, Cari;
  - Pengaturan: daftar Akun dan dialog Hapus akun.
