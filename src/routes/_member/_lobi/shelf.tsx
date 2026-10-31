import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"
import { LobbyPopup } from "@/components/lobby/LobbyPopup"
import { useMemo, useState } from "react"
import { BookActions } from "@/components/shelf/BookActions"
import { BookDetail } from "@/components/shelf/BookDetail"
import { BookGrid } from "@/components/shelf/BookGrid"
import { CollectionBar } from "@/components/shelf/CollectionBar"
import {
  CollectionDialog,
  type CollectionDone,
} from "@/components/shelf/CollectionDialog"
import { EmptyShelf } from "@/components/shelf/EmptyShelf"
import { GenreSelect } from "@/components/shelf/GenreSelect"
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
import type { Collection } from "@/lib/book-types"
import { genreLabel } from "@/lib/genre"
import {
  activeCollection,
  countBooks,
  countCollections,
  defaultSort,
  parseShelfSearch,
  shelfBooks,
} from "@/lib/shelf"
import { useOnline } from "@/lib/use-online"

const lobi = getRouteApi("/_member/_lobi")

export const Route = createFileRoute("/_member/_lobi/shelf")({
  validateSearch: parseShelfSearch,
  head: () => ({ meta: [{ title: "Rak Saya — Glosa" }] }),
  component: ShelfPage,
})

function ShelfPage() {
  const { books, usage, collections, offline } = lobi.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const online = useOnline()
  const local = useLocalShelf()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState("")
  // The collection dialog: closed, a new collection, or one to edit.
  const [editing, setEditing] = useState<Collection | "new" | null>(null)
  const koleksi = activeCollection(search.koleksi, collections)
  const ordering = defaultSort(koleksi)
  const visible = useMemo(
    () => shelfBooks(books, { ...search, koleksi }),
    [books, search, koleksi]
  )
  const counts = useMemo(() => countBooks(books), [books])
  const collectionCounts = useMemo(
    () => countCollections(books, collections),
    [books, collections]
  )
  const selected = books.find((book) => book.id === selectedId) ?? null
  const inTrolley = search.genre === "troli"
  const refresh = () => void router.invalidate()
  const bringButton = (
    <Button onClick={() => setUploading(true)}>Bawa buku</Button>
  )

  const onCollectionDone = ({
    notice: text,
    koleksi: next,
  }: CollectionDone) => {
    setEditing(null)
    setNotice(text)
    refresh()
    if (next !== undefined) {
      void navigate({
        search: (prev) => ({ ...prev, koleksi: next ?? undefined }),
      })
    }
  }

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
          <CollectionBar
            active={koleksi}
            collections={collections}
            counts={collectionCounts}
            canEdit={online && !offline}
            onCreate={() => setEditing("new")}
            onEdit={setEditing}
          />
          <ShelfToolbar
            q={search.q ?? ""}
            sort={search.sort ?? ordering}
            defaultSort={ordering}
          >
            <GenreSelect value={search.genre ?? "semua"} counts={counts} />
          </ShelfToolbar>
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
                          refresh()
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
              collections={collections}
              onGenreSaved={refresh}
              onShelved={refresh}
              onDeleted={(book) => {
                setSelectedId(null)
                setNotice(`“${book.title}” dihapus dari rak.`)
                refresh()
              }}
            />
          </>
        )}
      </BookDetail>
      <CollectionDialog
        open={editing !== null}
        editing={editing === "new" ? null : editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onDone={onCollectionDone}
      />
      <UploadPanel open={uploading} onOpenChange={setUploading} usage={usage} />
    </LobbyPopup>
  )
}
