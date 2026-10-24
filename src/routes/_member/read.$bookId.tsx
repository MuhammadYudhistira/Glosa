import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { BookLoadError } from "@/lib/book-download"
import { bookMessage } from "@/lib/book-messages"
import { EpubError } from "@/lib/epub/zip-loader"
import { MAX_CFI_LENGTH, jumpOffer, toPercentage } from "@/lib/progress"
import { progressSync, useSyncStatus } from "@/lib/progress-sync-client"
import { THEME_COLORS } from "@/lib/reader-settings"
import type { Position, TocItem } from "@/lib/reader-types"
import { reportError } from "@/lib/sentry-client"
import { savedChoice } from "@/lib/words/lookup"
import { savedFormsOf } from "@/lib/words/saved-marks"
import {
  refreshSavedForms,
  useSavedForms,
  useSavedHeadwords,
  wordSync,
} from "@/lib/words/word-sync-client"
import { markBookOpenedFn } from "@/server/reading"

type ReaderSearch = { cfi?: string }

const NO_WORDS: Array<string> = []
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

function ReaderPage() {
  const data = Route.useLoaderData()
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
  const savedHeadwords = useSavedHeadwords()
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
  const saved = choice !== null && savedHeadwords.has(choice.headword)
  const [controls, setControls] = useState<ReaderControls | null>(null)
  const [toc, setToc] = useState<Array<TocItem>>([])
  const [location, setLocation] = useState<ReaderLocation | null>(null)
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

  // Waiting word changes go when a book opens (spec 2 §7), and the forms of
  // words saved on other devices come in for the underline.
  useEffect(() => {
    void wordSync().flush()
    if (data.online) void refreshSavedForms()
  }, [data.online])

  const onReady = useCallback(
    (info: ReaderReady) => {
      ready.current = true
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
      if (next.cfi !== tappedAtCfi.current) setTap(null)
      // Not moving is not reading on: a tap at a word's place (spec 2 §6.4)
      // keeps the place read.
      const moved = next.cfi !== shownCfi.current
      shownCfi.current = next.cfi
      setLocation(next)
      if (!ready.current || !interacted.current || !moved) return
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
    [bookId]
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
    setTap(next)
  }, [])
  const closeWord = useCallback(() => setTap(null), [])
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
    (fraction: number) => go((current) => current.goToFraction(fraction)),
    [go]
  )

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
        savedForms={savedForms}
        onReady={onReady}
        onRelocate={onRelocate}
        onInteract={onInteract}
        onTapMenu={onTapMenu}
        onWord={openWord}
        onDismissWord={closeWord}
        onTargetMissing={onTargetMissing}
        onError={onError}
      />
      <ReaderToolbar
        title={data.book.title}
        hidden={chromeHidden}
        syncStatus={syncStatus}
        onToc={() => setPanel("toc")}
        onSettings={() => setPanel("settings")}
      />
      {!data.saved && (
        <output className="reader-note">{bookMessage("device_full")}</output>
      )}
      {targetMissing && (
        <output className="reader-note">
          {bookMessage("position_missing")}
        </output>
      )}
      <VocabularyNotice />
      <WordPopup
        key={tap ? `${tap.word} ${tap.rect.left} ${tap.rect.top}` : "none"}
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
      <ReaderFooter hidden={chromeHidden} location={location} onSeek={onSeek} />
      <TocPanel
        open={panel === "toc"}
        onOpenChange={(open) => setPanel(open ? "toc" : null)}
        toc={toc}
        currentHref={location?.chapterHref ?? null}
        onSelect={(href) => {
          setPanel(null)
          go((current) => current.goTo(href))
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
