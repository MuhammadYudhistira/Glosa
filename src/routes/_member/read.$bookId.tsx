import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnnotationNotice } from "@/components/reader/AnnotationNotice"
import {
  AnnotationPopup,
  type HighlightTap,
} from "@/components/reader/AnnotationPopup"
import {
  FootnotePopup,
  type FootnoteTap,
} from "@/components/reader/FootnotePopup"
import { NoteEditor } from "@/components/reader/NoteEditor"
import { QuoteCardDialog } from "@/components/reader/QuoteCardDialog"
import { ReaderBack } from "@/components/reader/ReaderBack"
import {
  SelectionMenu,
  type TextSelection,
} from "@/components/reader/SelectionMenu"
import {
  annotationSync,
  refreshBookAnnotations,
  useBookAnnotations,
} from "@/lib/annotations/annotation-sync-client"
import {
  deleted,
  edited,
  newBookmark,
  newHighlight,
} from "@/lib/annotations/changes"
import { onPage, pageStart } from "@/lib/annotations/places"
import type { Annotation, HighlightColor } from "@/lib/annotations/types"
import { WordPopup, type WordTap } from "@/components/reader/WordPopup"
import { useWordLookup } from "@/components/reader/useWordLookup"
import { VocabularyNotice } from "@/components/vocabulary/VocabularyNotice"
import { JumpOffer } from "@/components/reader/JumpOffer"
import { ReaderFooter } from "@/components/reader/ReaderFooter"
import { ReaderProblem } from "@/components/reader/ReaderProblem"
import { ReaderSettingsPanel } from "@/components/reader/ReaderSettingsPanel"
import { ReaderToolbar } from "@/components/reader/ReaderToolbar"
import {
  type ReaderControls,
  type ReaderLocation,
  type ReaderReady,
  ReaderView,
} from "@/components/reader/ReaderView"
import { TocPanel } from "@/components/reader/TocPanel"
import { loadReader } from "@/components/reader/load-reader"
import { useReaderSettings } from "@/components/reader/useReaderSettings"
import { useReadingSpeed } from "@/components/reader/useReadingSpeed"
import { BookLoadError } from "@/lib/book-download"
import { bookMessage } from "@/lib/book-messages"
import { claimLocalData } from "@/lib/local/device"
import { EpubError } from "@/lib/epub/zip-loader"
import { MAX_CFI_LENGTH, jumpOffer, toPercentage } from "@/lib/progress"
import { progressSync, useSyncStatus } from "@/lib/progress-sync-client"
import { THEME_COLORS } from "@/lib/reader-settings"
import type { Position, TocItem } from "@/lib/reader-types"
import { reportError } from "@/lib/sentry-client"
import { useWakeLock } from "@/lib/use-wake-lock"
import { savedChoice } from "@/lib/words/lookup"
import { savedFormsOf } from "@/lib/words/saved-marks"
import {
  refreshSavedForms,
  useSavedForms,
  wordSync,
} from "@/lib/words/word-sync-client"
import { markBookOpenedFn } from "@/server/reading"

type ReaderSearch = { cfi?: string }

const NO_WORDS: Array<string> = []
/** How long "Posisi itu tidak ditemukan di buku ini" stays. */
const NOTE_MS = 8000
/** Kembali goes after this many page turns (spec 2 §6.7). */
const BACK_TURNS = 5
/** The popup gives the focus back to the book. */
const bookFocus = () => document.querySelector<HTMLElement>(".reader-host")

export const Route = createFileRoute("/_member/read/$bookId")({
  // The book, its position and the settings live in the browser (spec §9).
  ssr: false,
  // "Buka di buku" in Kosakata opens a word's place (spec 2 §6.4).
  validateSearch: (search: Record<string, unknown>): ReaderSearch =>
    typeof search.cfi === "string" &&
    search.cfi.length > 0 &&
    search.cfi.length <= MAX_CFI_LENGTH
      ? { cfi: search.cfi }
      : {},
  loader: ({ params, context }) => loadReader(params.bookId, context.user.id),
  // Keep the open book while reading; load afresh on every visit.
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: 0,
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.book.title ?? "Membaca"} — Glosa` }],
  }),
  pendingComponent: ReaderPending,
  errorComponent: ReaderError,
  notFoundComponent: () => <ReaderProblem message={bookMessage("not_found")} />,
  component: ReaderPage,
})

function ReaderPending() {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <output className="text-sm text-muted-foreground">
        Menyiapkan buku…
      </output>
    </main>
  )
}

function ReaderError({ error }: { error: unknown }) {
  const router = useRouter()
  // A missing or broken book already has its own message (spec 1E §7).
  useEffect(() => {
    if (!(error instanceof BookLoadError) && !(error instanceof EpubError))
      reportError(error)
  }, [error])
  return (
    <ReaderProblem
      message={bookMessage(error instanceof BookLoadError ? error.code : null)}
      onRetry={() => void router.invalidate()}
    />
  )
}

function putAnnotation(annotation: Annotation) {
  annotationSync()
    .put(annotation)
    .catch((error: unknown) =>
      console.error("saving the annotation failed", error)
    )
}

function ReaderPage() {
  const data = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const bookId = data.book.id
  const { settings, update } = useReaderSettings(data.settings, data.online)
  const syncStatus = useSyncStatus()
  const markOpened = useServerFn(markBookOpenedFn)
  const search = Route.useSearch()
  const navigate = useNavigate()
  // Read once: the place asked for applies only when the book opens.
  const [target] = useState(() => search.cfi ?? null)
  const [targetMissing, setTargetMissing] = useState(false)
  const [tap, setTap] = useState<WordTap | null>(null)
  const lookup = useWordLookup(tap?.word ?? null, tap?.next ?? NO_WORDS)
  const formsByHeadword = useSavedForms()
  const savedForms = useMemo(
    () => savedFormsOf(formsByHeadword),
    [formsByHeadword]
  )
  const choice = tap
    ? savedChoice(
        lookup.state.kind === "result" ? lookup.state.result : null,
        tap.word
      )
    : null
  // The forms come in when a book opens and change with every local save, so
  // a word saved on another device shows as saved too.
  const saved =
    choice !== null && Object.hasOwn(formsByHeadword, choice.headword)
  const [controls, setControls] = useState<ReaderControls | null>(null)
  const loadCover = useCallback(
    () => (controls ? controls.cover() : Promise.resolve(null)),
    [controls]
  )
  // For callbacks that must not change with the controls (onRelocate).
  const controlsRef = useRef<ReaderControls | null>(null)
  const [toc, setToc] = useState<Array<TocItem>>([])
  const [location, setLocation] = useState<ReaderLocation | null>(null)
  const annotations = useBookAnnotations(bookId)
  const highlights = useMemo(
    () => annotations.filter((annotation) => annotation.kind === "highlight"),
    [annotations]
  )
  // The bookmarks on the page shown (plan 2B, decision 16).
  const pageBookmarks = useMemo(
    () =>
      location
        ? annotations.filter(
            (annotation) =>
              annotation.kind === "bookmark" &&
              onPage(annotation.cfi, location.cfi)
          )
        : [],
    [annotations, location]
  )
  const [selection, setSelection] = useState<TextSelection | null>(null)
  const [marked, setMarked] = useState<HighlightTap | null>(null)
  const [noteFor, setNoteFor] = useState<Annotation | null>(null)
  const [footnote, setFootnote] = useState<FootnoteTap | null>(null)
  // The text being made into a quote card (spec kartu kutipan §5).
  const [sharing, setSharing] = useState<string | null>(null)
  // The place left by the last jump, and the page turns since (spec 2 §6.7).
  const [backTo, setBackTo] = useState<string | null>(null)
  const turnsSinceJump = useRef(0)
  const { ratio, record: recordSpeed } = useReadingSpeed()
  useWakeLock(true)
  const markedHighlight = marked
    ? (highlights.find((highlight) => highlight.cfi === marked.cfi) ?? null)
    : null
  const popupOpen =
    tap !== null || marked !== null || selection !== null || footnote !== null
  // The place shown now, and the place shown when the open word was tapped.
  const shownCfi = useRef<string | null>(null)
  const tappedAtCfi = useRef<string | null>(null)
  const [chromeHidden, setChromeHidden] = useState(false)
  const [panel, setPanel] = useState<"toc" | "settings" | null>(null)
  const [offer, setOffer] = useState<Position | null>(() =>
    target ? null : jumpOffer(data.local, data.server)
  )
  const [viewError, setViewError] = useState<string | null>(null)
  // Positions are saved only once the book is open and the member has moved
  // in it (plan 1C, decision 8).
  const ready = useRef(false)
  const interacted = useRef(false)

  useEffect(() => {
    if (!data.online) return
    markOpened({ data: { bookId } }).catch((error: unknown) =>
      console.error("marking the book opened failed", error)
    )
  }, [bookId, data.online, markOpened])

  // Waiting changes go when a book opens (spec 2 §7): words and annotations.
  // The forms of words saved on other devices come in for the underline, and
  // the book's annotations from other devices for the overlay. All of it
  // waits for this device to be the member's: another member's queue must
  // not go under this session.
  useEffect(() => {
    let live = true
    claimLocalData(user.id)
      .then(() => {
        if (!live) return
        void wordSync().flush()
        if (data.online) void refreshSavedForms()
        void annotationSync()
          .flush()
          .then(() =>
            data.online ? refreshBookAnnotations(bookId) : undefined
          )
      })
      .catch((error: unknown) =>
        console.error("claiming this device failed", error)
      )
    return () => {
      live = false
    }
  }, [bookId, data.online, user.id])

  const onReady = useCallback(
    (info: ReaderReady) => {
      ready.current = true
      controlsRef.current = info.controls
      setControls(info.controls)
      setToc(info.toc)
      // Reloading the page opens the last place read, not the word again.
      if (target) {
        void navigate({
          to: "/read/$bookId",
          params: { bookId },
          search: {},
          replace: true,
        })
      }
    },
    [bookId, navigate, target]
  )

  const onRelocate = useCallback(
    (next: ReaderLocation) => {
      // Turning the page closes the meaning (spec 2 §6.3). foliate also
      // relocates without moving: on a touch screen it snaps to the page after
      // every touch, the tap on the word too. Then the meaning stays.
      if (next.cfi !== tappedAtCfi.current) {
        setTap(null)
        setMarked(null)
        setFootnote(null)
      }
      // Not moving is not reading on: a tap at a word's place (spec 2 §6.4)
      // keeps the place read.
      const moved = next.cfi !== shownCfi.current
      if (moved) {
        // Hide the menu and drop the reader's own half too: its flag would
        // swallow the next click, and the text would stay selected.
        controlsRef.current?.clearSelection()
        setSelection(null)
      }
      shownCfi.current = next.cfi
      recordSpeed(next)
      if (moved && next.turned) {
        turnsSinceJump.current += 1
        if (turnsSinceJump.current >= BACK_TURNS) setBackTo(null)
      }
      setLocation(next)
      if (!ready.current || !interacted.current || !moved) return
      // The first page turn puts the missing-place note away.
      setTargetMissing(false)
      progressSync()
        .record({
          bookId,
          cfi: next.cfi,
          percentage: toPercentage(next.fraction),
          updatedAt: new Date().toISOString(),
        })
        .catch((error: unknown) =>
          console.error("saving the position failed", error)
        )
    },
    [bookId, recordSpeed]
  )

  const onInteract = useCallback(() => {
    interacted.current = true
  }, [])
  const onTapMenu = useCallback(() => setChromeHidden((hidden) => !hidden), [])
  const onError = useCallback((error: unknown) => {
    console.error("opening the book failed", error)
    setViewError(error instanceof EpubError ? error.code : "unknown")
  }, [])

  const openWord = useCallback((next: WordTap) => {
    tappedAtCfi.current = shownCfi.current
    setMarked(null)
    setFootnote(null)
    setTap(next)
  }, [])
  const closeWord = useCallback(() => setTap(null), [])
  const openHighlight = useCallback((next: HighlightTap) => {
    tappedAtCfi.current = shownCfi.current
    setTap(null)
    setFootnote(null)
    setMarked(next)
  }, [])
  const showSelection = useCallback((next: TextSelection | null) => {
    if (next) {
      setTap(null)
      setMarked(null)
      setFootnote(null)
    }
    setSelection(next)
  }, [])
  // A tap beside the words closes whatever shows.
  const closePopups = useCallback(() => {
    setTap(null)
    setMarked(null)
    setSelection(null)
    setFootnote(null)
  }, [])
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
  // A seek that follows a seek, with no turn between, keeps the first place:
  // the slider makes several seeks while it is scrubbed.
  const lastJumpWasSeek = useRef(false)
  const markJump = useCallback((seek = false) => {
    if (!shownCfi.current) return
    const from = shownCfi.current
    const keep = seek && lastJumpWasSeek.current && turnsSinceJump.current === 0
    lastJumpWasSeek.current = seek
    turnsSinceJump.current = 0
    setBackTo((current) => (keep && current !== null ? current : from))
  }, [])
  // The note goes after a while too, if no page is turned.
  useEffect(() => {
    if (!targetMissing) return
    const timer = setTimeout(() => setTargetMissing(false), NOTE_MS)
    return () => clearTimeout(timer)
  }, [targetMissing])
  const onTargetMissing = useCallback(() => {
    setTargetMissing(true)
    // The place asked for is gone, so the other device's place is offered after all.
    setOffer(jumpOffer(data.local, data.server))
  }, [data.local, data.server])

  const toggleSave = () => {
    if (!tap || !choice) return
    const sync = wordSync()
    const done = saved
      ? sync.remove(choice.headword)
      : sync.save(
          {
            ...choice,
            bookId,
            bookTitle: data.book.title,
            sentence: tap.sentence,
            cfi: tap.cfi && tap.cfi.length <= MAX_CFI_LENGTH ? tap.cfi : null,
            createdAt: new Date().toISOString(),
          },
          [tap.word]
        )
    done.catch((error: unknown) =>
      console.error("saving the word failed", error)
    )
  }

  const dropSelection = () => {
    controls?.clearSelection()
    setSelection(null)
  }
  /** Highlight · Catatan (spec 2 §6.6); the same text twice is one highlight. */
  const highlightSelection = (withNote: boolean) => {
    if (!selection) return
    const existing = highlights.find(
      (highlight) => highlight.cfi === selection.cfi
    )
    const highlight =
      existing ??
      newHighlight({ bookId, cfi: selection.cfi, text: selection.text })
    if (!existing) putAnnotation(highlight)
    dropSelection()
    if (withNote) setNoteFor(highlight)
  }
  const shareSelection = () => {
    if (!selection) return
    setSharing(selection.text)
    dropSelection()
  }
  const shareMarked = () => {
    if (markedHighlight) setSharing(markedHighlight.excerpt)
    setMarked(null)
  }
  const copySelection = () => {
    if (!selection) return
    // Without a secure context there is no clipboard; the menu closes anyway.
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(selection.text))
      .catch((error: unknown) =>
        console.error("copying the text failed", error)
      )
    dropSelection()
  }
  const recolor = (color: HighlightColor) => {
    if (markedHighlight) putAnnotation(edited(markedHighlight, { color }))
  }
  const editNote = () => {
    if (markedHighlight) setNoteFor(markedHighlight)
    setMarked(null)
  }
  const removeMarked = () => {
    if (markedHighlight) putAnnotation(deleted(markedHighlight))
    setMarked(null)
  }
  const meaningOfMarked = () => {
    if (marked?.word) setTap(marked.word)
    setMarked(null)
  }
  const saveNote = (note: string) => {
    const edit = noteFor
    setNoteFor(null)
    if (!edit) return
    // The highlight may have changed since the editor opened (a colour).
    const current =
      highlights.find((highlight) => highlight.id === edit.id) ?? edit
    if (note.trim() !== current.note) putAnnotation(edited(current, { note }))
  }
  const toggleBookmark = () => {
    if (!location) return
    if (pageBookmarks.length > 0) {
      for (const bookmark of pageBookmarks) putAnnotation(deleted(bookmark))
      return
    }
    putAnnotation(
      newBookmark({
        bookId,
        cfi: pageStart(location.cfi),
        text: location.pageText,
      })
    )
  }

  const go = useCallback(
    (action: (current: ReaderControls) => Promise<void>) => {
      if (!controls) return
      interacted.current = true
      action(controls).catch((error: unknown) =>
        console.error("moving in the book failed", error)
      )
    },
    [controls]
  )
  const onSeek = useCallback(
    (fraction: number) => {
      markJump(true)
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
    ? {
        chapter: location.time.section * ratio,
        book: location.time.total * ratio,
      }
    : null

  if (viewError) return <ReaderProblem message={bookMessage(viewError)} />

  return (
    <main
      className="reader-page"
      data-theme={settings.theme}
      style={{ background: THEME_COLORS[settings.theme].background }}
    >
      <ReaderView
        file={data.file}
        start={data.local?.cfi ?? null}
        target={target}
        settings={settings}
        wordOpen={tap !== null}
        popupOpen={popupOpen}
        savedForms={savedForms}
        highlights={highlights}
        onFootnote={openFootnote}
        onJump={() => markJump()}
        onReady={onReady}
        onRelocate={onRelocate}
        onInteract={onInteract}
        onTapMenu={onTapMenu}
        onWord={openWord}
        onHighlight={openHighlight}
        onSelection={showSelection}
        onDismiss={closePopups}
        onTargetMissing={onTargetMissing}
        onError={onError}
      />
      <ReaderToolbar
        title={data.book.title}
        hidden={chromeHidden}
        syncStatus={syncStatus}
        bookmarked={pageBookmarks.length > 0}
        onBookmark={toggleBookmark}
        onToc={() => setPanel("toc")}
        onSettings={() => setPanel("settings")}
      />
      {pageBookmarks.length > 0 && (
        <div aria-hidden="true" className="reader-ribbon" />
      )}
      {!data.saved && (
        <output className="reader-note">{bookMessage("device_full")}</output>
      )}
      {targetMissing && (
        <output className="reader-note">
          {bookMessage("position_missing")}
        </output>
      )}
      <VocabularyNotice />
      <AnnotationNotice />
      <SelectionMenu
        key={selection?.cfi ?? "no-selection"}
        selection={selection}
        onHighlight={() => highlightSelection(false)}
        onNote={() => highlightSelection(true)}
        onCopy={copySelection}
        onShare={shareSelection}
        onClose={dropSelection}
      />
      <AnnotationPopup
        key={
          marked
            ? `${marked.cfi} ${marked.rect.left} ${marked.rect.top}`
            : "no-highlight"
        }
        tap={marked}
        annotation={markedHighlight}
        onColor={recolor}
        onNote={editNote}
        onDelete={removeMarked}
        onMeaning={meaningOfMarked}
        onShare={shareMarked}
        onClose={() => setMarked(null)}
        finalFocus={bookFocus}
      />
      <NoteEditor
        key={noteFor?.id ?? "no-note"}
        annotation={noteFor}
        onClose={saveNote}
        finalFocus={bookFocus}
      />
      {sharing !== null && (
        <QuoteCardDialog
          key={sharing}
          quote={sharing}
          book={data.book}
          savedForms={savedForms}
          loadCover={loadCover}
          onClose={() => setSharing(null)}
          finalFocus={bookFocus}
        />
      )}
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
      <WordPopup
        key={tap ? `${tap.word} ${tap.rect.left} ${tap.rect.top}` : "no-word"}
        tap={tap}
        lookup={lookup.state}
        saved={saved}
        onToggleSave={toggleSave}
        onRetry={lookup.retry}
        onClose={closeWord}
        finalFocus={bookFocus}
      />
      <JumpOffer
        offer={offer}
        onJump={() => {
          if (offer) go((current) => current.goTo(offer.cfi))
          setOffer(null)
        }}
        onDismiss={() => setOffer(null)}
      />
      <ReaderBack shown={backTo !== null} onBack={goBack} />
      <ReaderFooter
        hidden={chromeHidden}
        location={location}
        timeLeft={timeLeft}
        onSeek={onSeek}
      />
      <TocPanel
        open={panel === "toc"}
        onOpenChange={(open) => setPanel(open ? "toc" : null)}
        toc={toc}
        currentHref={location?.chapterHref ?? null}
        onSelect={(href) => {
          setPanel(null)
          markJump()
          go((current) => current.goTo(href))
        }}
        annotations={annotations}
        chaptersOf={controls?.chaptersOf ?? null}
        onSelectPlace={(cfi) => {
          setPanel(null)
          // A place gone from the book (another edition): say so (spec 2 §8).
          go(async (current) => {
            if (!(await current.canOpen(cfi))) {
              setTargetMissing(true)
              return
            }
            markJump()
            await current.goTo(cfi)
          })
        }}
        onDeleteAnnotation={(annotation) => putAnnotation(deleted(annotation))}
        onShareAnnotation={(annotation) => {
          setPanel(null)
          setSharing(annotation.excerpt)
        }}
      />
      <ReaderSettingsPanel
        open={panel === "settings"}
        onOpenChange={(open) => setPanel(open ? "settings" : null)}
        settings={settings}
        onChange={update}
      />
    </main>
  )
}
