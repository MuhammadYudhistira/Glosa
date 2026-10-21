import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"
import { LobbyPopup } from "@/components/lobby/LobbyPopup"
import { useMemo, useState } from "react"
import { BookActions } from "@/components/shelf/BookActions"
import { BookDetail } from "@/components/shelf/BookDetail"
import { BookGrid } from "@/components/shelf/BookGrid"
import { EmptyShelf } from "@/components/shelf/EmptyShelf"
import { GenreFilter } from "@/components/shelf/GenreFilter"
import { ReadLink } from "@/components/shelf/ReadLink"
import { ShelfHeader } from "@/components/shelf/ShelfHeader"
import { ShelfToolbar } from "@/components/shelf/ShelfToolbar"
import { TrolleyGenrePicker } from "@/components/shelf/TrolleyGenrePicker"
import { UploadPanel } from "@/components/shelf/UploadPanel"
import {
  shelfPercentage,
  useLocalShelf,
} from "@/components/shelf/useLocalShelf"
import { Button } from "@/components/ui/button"
import { genreLabel } from "@/lib/genre"
import { countBooks, parseShelfSearch, shelfBooks } from "@/lib/shelf"

const lobi = getRouteApi("/_member/_lobi")

export const Route = createFileRoute("/_member/_lobi/shelf")({
  validateSearch: parseShelfSearch,
  head: () => ({ meta: [{ title: "Rak Saya — Glosa" }] }),
  component: ShelfPage,
})

function ShelfPage() {
  const { books, usage, offline } = lobi.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const local = useLocalShelf()
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
    <LobbyPopup label="Rak Saya" className="max-w-5xl" bodyClassName="gap-5">
      <ShelfHeader
        usage={usage}
        actions={books.length > 0 ? bringButton : undefined}
      />
      {offline && (
        <output className="block rounded-lg border bg-panel px-4 py-2 text-sm">
          Kamu sedang offline. Rak ditampilkan dari salinan terakhir di
          perangkat ini.
        </output>
      )}
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
              local={local}
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
      <BookDetail
        book={selected}
        percentage={selected ? shelfPercentage(selected, local) : 0}
        onClose={() => setSelectedId(null)}
      >
        {selected && (
          <>
            <ReadLink
              bookId={selected.id}
              percentage={shelfPercentage(selected, local)}
            />
            <BookActions
              key={selected.id}
              book={selected}
              saved={local.saved.has(selected.id)}
              onGenreSaved={() => void router.invalidate()}
              onDeleted={(book) => {
                setSelectedId(null)
                setNotice(`“${book.title}” dihapus dari rak.`)
                void router.invalidate()
              }}
            />
          </>
        )}
      </BookDetail>
      <UploadPanel open={uploading} onOpenChange={setUploading} usage={usage} />
    </LobbyPopup>
  )
}
