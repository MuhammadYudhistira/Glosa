import { Link } from "@tanstack/react-router"
import { useCallback, useMemo, useState } from "react"
import { ShareDialog } from "@/components/share/ShareDialog"
import { ShareImage } from "@/components/share/ShareImage"
import { BookCover } from "@/components/shelf/BookCover"
import { Button } from "@/components/ui/button"
import type { ShelfBook } from "@/lib/book-types"
import { fetchCoverBlob } from "@/lib/quote-card/cover-art"
import type { CardSize, Measure } from "@/lib/quote-card/layout"
import {
  MAX_RECAP_COVERS,
  layoutRecapCard,
} from "@/lib/quote-card/recap-layout"
import { formatReadTime } from "@/lib/recap/format"
import {
  type Period,
  currentPeriod,
  isOngoing,
  periodKey,
  periodLabel,
  periodList,
  periodRange,
} from "@/lib/recap/period"
import { recapView } from "@/lib/recap/recap"
import type { RecapState } from "@/lib/recap/recap-client"

const MAX_PAGE_COVERS = 12

/** One month or year of reading: numbers, finished books and a share image (spec 3E §5). */
export function RecapPanel({
  period,
  today,
  firstDay,
  state,
  offline,
  books,
  onPick,
  onRetry,
}: {
  period: Period
  today: string
  firstDay: string | null
  state: RecapState
  offline: boolean
  books: ReadonlyArray<ShelfBook>
  onPick: (key: string) => void
  onRetry: () => void
}) {
  const [sharing, setSharing] = useState(false)
  const label = periodLabel(period)
  const ongoing = isOngoing(period, today)
  // The period is a new object each render; its dates are stable.
  const { from, to } = periodRange(period)
  const view = useMemo(
    () =>
      state.status === "ready"
        ? recapView(state.recap, { from, to }, today)
        : null,
    [state, from, to, today]
  )
  // Finished in the period and still on the shelf, newest first.
  const onShelf = useMemo(() => {
    const found: Array<ShelfBook> = []
    for (const entry of view?.finished ?? []) {
      const book = books.find((candidate) => candidate.id === entry.id)
      if (book) found.push(book)
    }
    return found
  }, [view, books])
  const coverLoaders = useMemo(
    () =>
      onShelf
        .filter((book) => book.coverUrl !== null)
        .slice(0, MAX_RECAP_COVERS)
        .map((book) => () => fetchCoverBlob(book.coverUrl)),
    [onShelf]
  )
  const build = useCallback(
    (size: CardSize, measure: Measure, count: number) =>
      layoutRecapCard(
        {
          size,
          title: `${label} di Glosa`,
          ongoing,
          books: view?.finished.length ?? 0,
          coverCount: count,
          readTime: formatReadTime(view?.seconds ?? 0),
          days: view?.readingDays ?? 0,
          streak: view?.streak ?? 0,
          saved: view?.saved ?? 0,
          topWord: view?.topMeeting
            ? {
                headword: view.topMeeting.headword,
                meetings: view.topMeeting.meetings,
              }
            : null,
          host: location.host,
        },
        measure
      ),
    [label, ongoing, view]
  )

  const key = periodKey(period)
  const choices = periodList(period.kind, firstDay, today)
  const listed = choices.some((choice) => periodKey(choice) === key)
  const options = listed ? choices : [period, ...choices]

  return (
    <div className="habit-panel">
      <h1 className="font-heading text-2xl">Kilas balik</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={period.kind === "month" ? "default" : "outline"}
          size="sm"
          aria-pressed={period.kind === "month"}
          onClick={() => onPick(periodKey(currentPeriod(today)))}
        >
          Bulan
        </Button>
        <Button
          variant={period.kind === "year" ? "default" : "outline"}
          size="sm"
          aria-pressed={period.kind === "year"}
          onClick={() => onPick(String(Number(today.slice(0, 4))))}
        >
          Tahun
        </Button>
        <select
          aria-label="Periode"
          className="habit-select"
          value={key}
          onChange={(event) => onPick(event.target.value)}
        >
          {options.map((choice) => (
            <option key={periodKey(choice)} value={periodKey(choice)}>
              {periodLabel(choice)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <p className="font-heading text-lg">{label}</p>
        {ongoing && <p className="text-sm text-muted-foreground">sejauh ini</p>}
      </div>

      {offline ? (
        <p className="text-sm">Perlu koneksi internet</p>
      ) : state.status === "loading" ? (
        <div className="word-skeleton">
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <p className="sr-only">Memuat kilas balik…</p>
        </div>
      ) : state.status === "unavailable" ? (
        <>
          <p className="text-sm">Kilas balik belum bisa dimuat.</p>
          <Button onClick={onRetry}>Coba lagi</Button>
        </>
      ) : view?.empty ? (
        <p className="text-sm">Belum ada bacaan di {label}.</p>
      ) : (
        view && (
          <>
            <section aria-label="Buku selesai" className="habit-section">
              <p className="text-sm">{`${view.finished.length} buku selesai`}</p>
              <div className="flex flex-wrap gap-2">
                {onShelf.slice(0, MAX_PAGE_COVERS).map((book) => (
                  <Link
                    key={book.id}
                    to="/shelf"
                    search={{ koleksi: "selesai", q: book.title }}
                    aria-label={book.title}
                  >
                    <BookCover book={book} className="w-14" />
                  </Link>
                ))}
                {onShelf.length > MAX_PAGE_COVERS && (
                  <p className="self-center text-sm">
                    +{onShelf.length - MAX_PAGE_COVERS}
                  </p>
                )}
              </div>
            </section>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Stat term="Waktu baca" value={formatReadTime(view.seconds)} />
              <Stat term="Hari membaca" value={`${view.readingDays} hari`} />
              <Stat term="Streak terpanjang" value={`${view.streak} hari`} />
              <Stat term="Kata dicari" value={String(view.lookedUp)} />
              <Stat term="Kata disimpan" value={String(view.saved)} />
              {view.topMeeting && (
                <Stat
                  term="Paling sering bertemu lagi"
                  value={`${view.topMeeting.headword} · ${view.topMeeting.meetings}×`}
                />
              )}
            </dl>
            <Button onClick={() => setSharing(true)}>Bagikan</Button>
            {sharing && (
              <ShareDialog
                title="Bagikan kilas balik"
                onClose={() => setSharing(false)}
              >
                <ShareImage
                  label="Bagikan kilas balik"
                  description={`Kartu kilas balik ${label}`}
                  fileTitle={`${label} di Glosa`}
                  seed={key}
                  covers={coverLoaders}
                  build={build}
                />
              </ShareDialog>
            )}
          </>
        )
      )}
    </div>
  )
}

function Stat({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  )
}
