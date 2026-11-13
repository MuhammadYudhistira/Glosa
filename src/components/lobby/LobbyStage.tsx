import { useNavigate, useRouter, useSearch } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import {
  CORKBOARD_FETCH,
  CORKBOARD_NOTES,
  CorkboardPanel,
} from "@/components/lobby/CorkboardPanel"
import { AdminDeskCard } from "@/components/lobby/AdminDeskCard"
import { BookDetailPanel } from "@/components/lobby/BookDetailPanel"
import { ContinueSheet } from "@/components/lobby/ContinueSheet"
import { LibraryMap } from "@/components/lobby/LibraryMap"
import {
  ShelfWelcome,
  ReadingHint,
  RecapBubbleNote,
} from "@/components/lobby/LobbyBubbles"
import {
  LobbyScene,
  type LobbySceneHandle,
} from "@/components/lobby/LobbyScene"
import { LobbyTopBar } from "@/components/lobby/LobbyTopBar"
import { RecentBooks } from "@/components/lobby/RecentBooks"
import { TrolleyPanel } from "@/components/lobby/TrolleyPanel"
import { lobbyHotspots, summarizeLobby } from "@/components/lobby/lobby-data"
import { roomSignals } from "@/components/lobby/room-signals"
import { type HotspotId, spotOf } from "@/components/lobby/scene/layout"
import { genreHues } from "@/components/lobby/scene/shelf-books"
import { useAndaSpot } from "@/components/lobby/useAndaSpot"
import { coverHue } from "@/components/shelf/BookCover"
import { UploadPanel } from "@/components/shelf/UploadPanel"
import { useLocalShelf } from "@/components/shelf/useLocalShelf"
import { Button } from "@/components/ui/button"
import type { Collection, ShelfBook, StorageUsage } from "@/lib/book-types"
import { pinnedHighlights } from "@/lib/annotations/pinned"
import { useHighlights } from "@/lib/annotations/highlights-client"
import { useReadingHabit } from "@/lib/habit/habit-client"
import {
  type RecapBubble,
  readShownBubbles,
  recapBubbleFor,
  rememberBubble,
} from "@/lib/recap/bubble"
import { itemOf } from "@/lib/shop/catalog"
import { useLobbyDecor, useShop } from "@/lib/shop/shop-client"
import type { SessionUser } from "@/lib/session-types"
import { useOnline } from "@/lib/use-online"
import { useWideScreen } from "@/lib/use-wide-screen"
import { useMeetingsTotal } from "@/lib/vocab/vocab-client"
import { rememberVocabSeen, useVocabSeen } from "@/lib/vocab/vocab-seen"

/**
 * The lobby (spec 1D), mounted under /lobby, /shelf, /vocabulary and /settings so the 3D
 * scene stays loaded. With a popup over it (spec 1F §3): the scene pauses
 * and hides from the keyboard, and the panels step aside; only the top bar
 * stays. On phones CSS hides it all, and WebGL stays off.
 */
export function LobbyStage({
  user,
  books,
  usage,
  collections,
  offline,
  popup,
}: {
  user: SessionUser
  books: Array<ShelfBook>
  usage: StorageUsage
  /** The member's collections, for the book details' checklist. */
  collections: Array<Collection>
  offline: boolean
  /** Rak Saya or Pengaturan is open over the lobby. */
  popup: boolean
}) {
  const { kembali } = useSearch({ strict: false })
  const navigate = useNavigate()
  const router = useRouter()
  const wide = useWideScreen()
  const local = useLocalShelf()
  const habit = useReadingHabit()
  const decor = useLobbyDecor()
  const shop = useShop()
  const online = useOnline()
  const highlights = useHighlights(CORKBOARD_FETCH, online && !offline)
  // The papers on the board: the newest highlights of books still on the shelf.
  const notes = useMemo(
    () =>
      highlights.state.status === "ready"
        ? pinnedHighlights(
            highlights.state.highlights,
            books,
            CORKBOARD_NOTES
          ).map(({ highlight }) => highlight.color)
        : [],
    [highlights.state, books]
  )
  const summary = useMemo(() => summarizeLobby(books), [books])
  const meetingsTotal = useMeetingsTotal()
  const vocabSeen = useVocabSeen()
  useEffect(() => {
    // No record yet: this visit becomes the starting point, the lamp stays off.
    if (meetingsTotal !== null && vocabSeen === null) {
      rememberVocabSeen(meetingsTotal)
    }
  }, [meetingsTotal, vocabSeen])
  const signals = useMemo(
    () =>
      roomSignals({
        days: habit.days,
        today: habit.today,
        meetingsTotal,
        vocabSeen,
        trolley: summary.trolley.length,
      }),
    [habit.days, habit.today, meetingsTotal, vocabSeen, summary.trolley.length]
  )
  const hotspots = useMemo(
    () => lobbyHotspots(summary.counts, summary.finishedCount),
    [summary]
  )
  const showcase = useMemo(
    () =>
      summary.finished.map((book) => ({
        id: book.id,
        coverUrl: book.coverUrl,
        hue: coverHue(book.title),
      })),
    [summary]
  )
  // The books on each genre's shelf, the newest added first, by cover colour.
  const shelves = useMemo(() => {
    const newest = [...books].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    )
    return genreHues((genre) =>
      newest
        .filter((book) => book.genre === genre)
        .map((book) => coverHue(book.title))
    )
  }, [books])
  const [anda, moveAnda] = useAndaSpot()
  const sceneRef = useRef<LobbySceneHandle>(null)

  // A preview from the shop brings its slot into view beside the panel (plan 3C, decision 5).
  // Keyed on the item, not its slot: a second item in the same slot recentres after a pan.
  const previewId = shop.preview
  useEffect(() => {
    const slot = previewId ? itemOf(previewId)?.slot : undefined
    if (slot && wide) sceneRef.current?.showDecor(slot)
  }, [previewId, wide])
  const searchRef = useRef<HTMLInputElement>(null)
  // What had the focus when a book was picked; "Tutup detail" returns there.
  const openerRef = useRef<HTMLElement | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sorting, setSorting] = useState(false)
  const [corkboard, setCorkboard] = useState(false)
  const [readingHint, setReadingHint] = useState(false)
  const [sceneLive, setSceneLive] = useState(false)
  const [recapBubble, setRecapBubble] = useState<RecapBubble | null>(null)

  // "Kilas balik ... sudah siap" once per period, from the habit cache (spec 3E §5.4).
  useEffect(() => {
    if (
      recapBubble ||
      habit.status === "loading" ||
      habit.status === "failed"
    ) {
      return
    }
    const next = recapBubbleFor(habit.today, habit.days, readShownBubbles())
    if (next) setRecapBubble(next)
  }, [recapBubble, habit.status, habit.today, habit.days])
  // Remembered once it is on screen: behind a popup nobody sees it.
  const shownBubbleKey = !popup && recapBubble ? recapBubble.key : null
  useEffect(() => {
    if (shownBubbleKey) rememberBubble(shownBubbleKey)
  }, [shownBubbleKey])
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

  /** Whether Anda is on the way to a hotspot or doing its activity. */
  const running = useRef(false)
  // True while a page covers the lobby or once it is gone: a popup or a
  // page opened during the activity ends it (the scene pauses or goes), and
  // the tapped hotspot's page must not open over it.
  // The scene pauses for a popup or the corkboard's dialog alike.
  const paused = popup || corkboard
  const covered = useRef(paused)
  useEffect(() => {
    covered.current = paused
    return () => {
      covered.current = true
    }
  }, [paused])
  /** The hotspot tapped during the activity, whose page opens instead. */
  const newer = useRef<HotspotId | null>(null)
  /** The hotspot Anda is on the way to. */
  const target = useRef<HotspotId | null>(null)

  /** Anda walks over and does the activity, then the page opens (spec 3F §4A.1; replaces 1D §5.1). */
  async function activate(id: HotspotId, how: { keyboard: boolean }) {
    // A second tap while Anda is on the way: skip to the page (spec 3F §4A.1).
    if (running.current) {
      // Another hotspot: its page opens instead of the first one's.
      if (id !== target.current) newer.current = id
      sceneRef.current?.skip()
      return
    }
    moveAnda(spotOf(id).stand)
    setReadingHint(false)
    // From the keyboard the page opens at once, without the activity.
    if (!how.keyboard && sceneRef.current) {
      running.current = true
      target.current = id
      newer.current = null
      try {
        await sceneRef.current.perform(id)
      } finally {
        running.current = false
      }
      // Set by a tap during the await, which the compiler cannot see.
      const next = (newer.current as HotspotId | null) ?? id
      newer.current = null
      if (covered.current) return
      open(next)
      return
    }
    open(id)
  }

  /** What each hotspot opens. */
  function open(id: HotspotId) {
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
    } else if (id === "katalog") {
      void navigate({ to: "/vocabulary", search: { buku: undefined } })
    } else if (id === "tanaman") {
      void navigate({ to: "/habits" })
    } else if (id === "toko") {
      void navigate({ to: "/shop" })
    } else if (id === "lemari") {
      void navigate({ to: "/shelf", search: { koleksi: "selesai" } })
    } else if (id === "perapian") {
      void navigate({ to: "/recap", search: { periode: undefined } })
    } else if (id === "papan") {
      setCorkboard(true)
    } else if (id === "pintu") {
      void navigate({ to: "/settings" })
    } else {
      void navigate({ to: "/shelf", search: { genre: id } })
    }
  }

  // Behind a popup the scene says nothing: its words would repeat the page's.
  const bubbles: Partial<Record<HotspotId, ReactNode>> = {}
  if (!popup && readingHint) bubbles["meja-baca"] = <ReadingHint />
  if (!popup && recapBubble) {
    bubbles.tanaman = <RecapBubbleNote bubble={recapBubble} />
  }
  // Phones greet in the sheet instead: their first view leaves the desk out.
  if (!popup && books.length === 0) {
    bubbles["meja-admin"] = <ShelfWelcome className="hidden lg:grid" />
  }

  // One element for every mode, so switching never remounts the WebGL scene.
  return (
    <div
      className="lobby-page"
      role={popup ? undefined : "main"}
      data-popup={popup ? "" : undefined}
    >
      {!popup && <h1 className="sr-only">Ruang baca</h1>}
      <div
        className="contents"
        inert={popup}
        aria-hidden={popup ? "true" : undefined}
      >
        <LobbyScene
          ref={sceneRef}
          hotspots={hotspots}
          showcase={showcase}
          plant={habit.summary.stage}
          signals={signals}
          notes={notes}
          shelves={shelves}
          decor={decor}
          anda={anda}
          bubbles={bubbles}
          onActivate={(id, how) => void activate(id, how)}
          onLiveChange={setSceneLive}
          // The corkboard's dialog covers the scene like a route popup.
          paused={paused}
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
          <aside
            aria-label="Panel ruang baca"
            className="lobby-side lobby-overlay"
          >
            <LibraryMap
              hotspots={hotspots}
              anda={anda}
              interactive={sceneLive}
              onRecap={() =>
                void navigate({ to: "/recap", search: { periode: undefined } })
              }
              onSelect={(id) => sceneRef.current?.showSpot(id)}
              className="lobby-at-map"
            />
            {selected && (
              <BookDetailPanel
                book={selected}
                local={local}
                collections={collections}
                offline={offline}
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
            collections={collections}
            offline={offline}
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
      <CorkboardPanel
        open={corkboard}
        onOpenChange={setCorkboard}
        state={highlights.state}
        books={books}
        onRetry={highlights.retry}
      />
    </div>
  )
}
