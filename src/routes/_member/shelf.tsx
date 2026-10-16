import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { BookActions } from "@/components/shelf/BookActions"
import { BookDetail } from "@/components/shelf/BookDetail"
import { BookGrid } from "@/components/shelf/BookGrid"
import { EmptyShelf } from "@/components/shelf/EmptyShelf"
import { GenreFilter } from "@/components/shelf/GenreFilter"
import { ShelfHeader } from "@/components/shelf/ShelfHeader"
import { ShelfToolbar } from "@/components/shelf/ShelfToolbar"
import { TrolleyGenrePicker } from "@/components/shelf/TrolleyGenrePicker"
import { UploadPanel } from "@/components/shelf/UploadPanel"
import { Button } from "@/components/ui/button"
import { genreLabel } from "@/lib/genre"
import { countBooks, parseShelfSearch, shelfBooks } from "@/lib/shelf"
import { listBooksFn } from "@/server/books"

export const Route = createFileRoute("/_member/shelf")({
  validateSearch: parseShelfSearch,
  loader: () => listBooksFn(),
  // Filtering happens in the browser; reload only on invalidate or after a minute.
  staleTime: 60_000,
  head: () => ({ meta: [{ title: "Rak Saya — Glosa" }] }),
  component: ShelfPage,
})

function ShelfPage() {
  const { books, usage } = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState("")
  const visible = useMemo(() => shelfBooks(books, search), [books, search])
  const counts = useMemo(() => countBooks(books), [books])
  const selected = books.find((book) => book.id === selectedId) ?? null
  const inTrolley = search.genre === "troli"
  const bringButton = (
    <Button onClick={() => setUploading(true)}>Bawa buku</Button>
  )

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-5 p-4 sm:p-8">
      <ShelfHeader
        usage={usage}
        actions={books.length > 0 ? bringButton : undefined}
      />
      <output className="block min-h-5 text-sm text-mint">{notice}</output>
      {books.length === 0 ? (
        <EmptyShelf action={bringButton} />
      ) : (
        <>
          <GenreFilter active={search.genre ?? "semua"} counts={counts} />
          <ShelfToolbar q={search.q ?? ""} sort={search.sort ?? "opened"} />
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {search.q
                ? "Tidak ada buku yang cocok dengan pencarianmu."
                : "Belum ada buku di bagian ini."}
            </p>
          ) : (
            <BookGrid
              books={visible}
              onOpen={(book) => setSelectedId(book.id)}
              footer={
                inTrolley
                  ? (book) => (
                      <TrolleyGenrePicker
                        book={book}
                        onSaved={(genre) => {
                          setNotice(`Dipindahkan ke ${genreLabel(genre)}.`)
                          void router.invalidate()
                        }}
                      />
                    )
                  : undefined
              }
            />
          )}
        </>
      )}
      <BookDetail book={selected} onClose={() => setSelectedId(null)}>
        {selected && (
          <BookActions
            key={selected.id}
            book={selected}
            onGenreSaved={() => void router.invalidate()}
            onDeleted={(book) => {
              setSelectedId(null)
              setNotice(`“${book.title}” dihapus dari rak.`)
              void router.invalidate()
            }}
          />
        )}
      </BookDetail>
      <UploadPanel open={uploading} onOpenChange={setUploading} usage={usage} />
    </main>
  )
}
