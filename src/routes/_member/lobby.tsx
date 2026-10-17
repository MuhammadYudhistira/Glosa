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
