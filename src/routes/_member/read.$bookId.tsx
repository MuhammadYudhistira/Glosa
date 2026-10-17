import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useCallback, useEffect, useRef, useState } from "react"
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
import { jumpOffer, toPercentage } from "@/lib/progress"
import { progressSync, useSyncStatus } from "@/lib/progress-sync-client"
import { THEME_COLORS } from "@/lib/reader-settings"
import type { Position, TocItem } from "@/lib/reader-types"
import { markBookOpenedFn } from "@/server/reading"

export const Route = createFileRoute("/_member/read/$bookId")({
  // The book, its position and the settings live in the browser (spec §9).
  ssr: false,
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
  const [controls, setControls] = useState<ReaderControls | null>(null)
  const [toc, setToc] = useState<Array<TocItem>>([])
  const [location, setLocation] = useState<ReaderLocation | null>(null)
  const [chromeHidden, setChromeHidden] = useState(false)
  const [panel, setPanel] = useState<"toc" | "settings" | null>(null)
  const [offer, setOffer] = useState<Position | null>(() =>
    jumpOffer(data.local, data.server)
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

  const onReady = useCallback((info: ReaderReady) => {
    ready.current = true
    setControls(info.controls)
    setToc(info.toc)
  }, [])

  const onRelocate = useCallback(
    (next: ReaderLocation) => {
      setLocation(next)
      if (!ready.current || !interacted.current) return
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
        settings={settings}
        onReady={onReady}
        onRelocate={onRelocate}
        onInteract={onInteract}
        onTapMenu={onTapMenu}
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
