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
  const { kembali } = useSearch({ strict: false })
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
  // A popup opening closes the book's details, or they would come back after
  // it and take its focus. A book picked over a popup stays: popup was on.
  const [wasPopup, setWasPopup] = useState(popup)
  if (wasPopup !== popup) {
    setWasPopup(popup)
    if (popup) setSelectedId(null)
  }
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
