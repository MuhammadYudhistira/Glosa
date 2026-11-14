import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { useMemo, useRef, useState } from "react"
import { QuoteCardDialog } from "@/components/reader/QuoteCardDialog"
import { Button, buttonVariants } from "@/components/ui/button"
import type { HighlightsState } from "@/lib/annotations/highlights-client"
import {
  type HighlightRow,
  highlightBooks,
  highlightRows,
} from "@/lib/annotations/highlights"
import {
  HIGHLIGHT_COLORS,
  type HighlightColor,
  MAX_HIGHLIGHTS,
} from "@/lib/annotations/types"
import type { ShelfBook } from "@/lib/book-types"
import { fetchCoverBlob } from "@/lib/quote-card/cover-art"
import { cn } from "@/lib/utils"
import { savedFormsOf } from "@/lib/words/saved-marks"
import { useSavedForms } from "@/lib/words/word-sync-client"

const EDGE: Record<HighlightColor, string> = {
  yellow: "border-l-[#e8c547]",
  green: "border-l-[#6fae8d]",
  blue: "border-l-[#6f9bd1]",
  pink: "border-l-[#d98a86]",
}
const COLOR_LABEL: Record<HighlightColor, string> = {
  yellow: "Kuning",
  green: "Hijau",
  blue: "Biru",
  pink: "Merah muda",
}

const asColor = (value: unknown): HighlightColor | null =>
  HIGHLIGHT_COLORS.find((color) => color === value) ?? null

/** "Sorotan & catatan": every highlight, filtered by book and colour, each with a way into its book or onto a quote card (spec 3F §3.2). */
export function HighlightsPanel({
  state,
  books,
  onRetry,
}: {
  state: HighlightsState
  books: ReadonlyArray<ShelfBook>
  onRetry: () => void
}) {
  const search: { buku?: unknown; warna?: unknown } = useSearch({
    strict: false,
  })
  const navigate = useNavigate()
  const forms = useSavedForms()
  const savedForms = useMemo(() => savedFormsOf(forms), [forms])
  const [sharing, setSharing] = useState<HighlightRow | null>(null)
  const opener = useRef<HTMLElement | null>(null)

  if (state.status === "loading") {
    return <p className="text-sm text-muted-foreground">Memuat sorotan…</p>
  }
  if (state.status === "offline") {
    return (
      <p className="text-sm text-stamp">Sorotan bisa dilihat saat online.</p>
    )
  }
  if (state.status === "failed") {
    return (
      <div className="grid justify-items-start gap-3">
        <p className="text-sm text-stamp">Sorotan belum bisa dimuat.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Coba lagi
        </Button>
      </div>
    )
  }

  const { highlights } = state
  if (highlights.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada sorotan. Tandai kalimat yang kamu suka saat membaca, lalu
        kembali ke sini.
      </p>
    )
  }

  const bookOptions = highlightBooks(highlights, books)
  // A book that is gone, or has no highlights, is no filter at all.
  const bookId =
    typeof search.buku === "string" &&
    bookOptions.some(({ id }) => id === search.buku)
      ? search.buku
      : null
  const color = asColor(search.warna)
  const rows = highlightRows(highlights, books, { bookId, color })
  const pick = (next: { buku?: string; warna?: HighlightColor }) =>
    void navigate({
      to: "/highlights",
      search: { buku: bookId ?? undefined, warna: color ?? undefined, ...next },
      replace: true,
    })

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Buku"
          className="habit-select"
          value={bookId ?? ""}
          onChange={(event) => pick({ buku: event.target.value || undefined })}
        >
          <option value="">Semua buku</option>
          {bookOptions.map(({ id, title, count }) => (
            <option key={id} value={id}>
              {title} ({count})
            </option>
          ))}
        </select>
        <select
          aria-label="Warna"
          className="habit-select"
          value={color ?? ""}
          onChange={(event) =>
            pick({ warna: asColor(event.target.value) ?? undefined })
          }
        >
          <option value="">Semua</option>
          {HIGHLIGHT_COLORS.map((choice) => (
            <option key={choice} value={choice}>
              {COLOR_LABEL[choice]}
            </option>
          ))}
        </select>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Tidak ada sorotan dengan saringan ini.
        </p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className={cn(
                "grid gap-2 border-l-4 bg-muted/40 px-3 py-2",
                EDGE[row.color]
              )}
            >
              <p className="text-sm">{row.excerpt}</p>
              {row.note && (
                <p className="text-sm text-muted-foreground italic">
                  {row.note}
                </p>
              )}
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {row.book.title}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/read/$bookId"
                  params={{ bookId: row.book.id }}
                  search={{ cfi: row.cfi }}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Buka di buku
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    opener.current = event.currentTarget
                    setSharing(row)
                  }}
                >
                  Buat kartu kutipan
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {highlights.length >= MAX_HIGHLIGHTS && (
        <p className="text-xs text-muted-foreground">
          Menampilkan {MAX_HIGHLIGHTS} sorotan terbaru.
        </p>
      )}
      {sharing && (
        <QuoteCardDialog
          key={sharing.id}
          quote={sharing.excerpt}
          book={{
            id: sharing.book.id,
            title: sharing.book.title,
            author: sharing.book.author,
            finished: false,
            finishDeclined: true,
          }}
          savedForms={savedForms}
          loadCover={() => fetchCoverBlob(sharing.book.coverUrl)}
          onClose={() => setSharing(null)}
          finalFocus={() => opener.current}
        />
      )}
    </div>
  )
}
