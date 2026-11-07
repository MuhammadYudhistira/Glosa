import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { useServerFn } from "@tanstack/react-start"
import { XIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ReviewForm } from "@/components/review/ReviewForm"
import { ShareImage } from "@/components/share/ShareImage"
import { Button } from "@/components/ui/button"
import type { CardSize, Measure } from "@/lib/quote-card/layout"
import { layoutFinishCard } from "@/lib/quote-card/finish-layout"
import { formatReadTime } from "@/lib/recap/format"
import {
  type BookReview,
  DIFFICULTY_LABELS,
  type FinishSummary,
} from "@/lib/review"
import { useOnline } from "@/lib/use-online"
import { useWideScreen } from "@/lib/use-wide-screen"
import { finishSummaryFn } from "@/server/reviews"

/** How long the card waits for the reading time to be sent first. */
const BEFORE_LOAD_MS = 4_000

type View = "card" | "form" | "share"
type Loaded =
  | { status: "loading" }
  | { status: "ready"; summary: FinishSummary }
  | { status: "unavailable" }

function Stars({ review }: { review: BookReview }) {
  return (
    <p className="text-sm">
      <span aria-hidden="true">
        {"★".repeat(review.rating)}
        {"☆".repeat(5 - review.rating)}
      </span>
      <span className="sr-only">{review.rating} dari 5 bintang</span>
      {review.difficulty && ` · ${DIFFICULTY_LABELS[review.difficulty]}`}
    </p>
  )
}

/**
 * The card of a finished book, its review form and its share image in one
 * popup (spec 3E §3, §4.1). `start="form"` opens on the form and closes after
 * it is saved, deleted or cancelled.
 */
export function FinishCardDialog({
  book,
  loadCover,
  fallbackReview,
  start,
  offline = false,
  onChanged,
  onClose,
  finalFocus,
  beforeLoad,
}: {
  book: { id: string; title: string; author: string }
  loadCover: () => Promise<Blob | null>
  fallbackReview: BookReview | null
  start?: "card" | "form"
  offline?: boolean
  onChanged: () => void
  onClose: () => void
  finalFocus?: () => HTMLElement | null
  /**
   * Runs before the summary is asked for, e.g. to send the reading time still
   * waiting; its errors do not stop the summary from loading.
   */
  beforeLoad?: () => Promise<void>
}) {
  const wide = useWideScreen()
  const online = useOnline()
  const loadSummary = useServerFn(finishSummaryFn)
  const [view, setView] = useState<View>(start ?? "card")
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" })
  const [review, setReview] = useState<BookReview | null>(fallbackReview)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const blocked = offline || !online
  // Set once the form saved or deleted: a late summary must not undo that.
  const touched = useRef(false)
  const beforeLoadRef = useRef(beforeLoad)
  beforeLoadRef.current = beforeLoad

  useEffect(() => {
    let live = true
    void Promise.resolve()
      .then(() =>
        // A flush stuck on a slow network must not hold the card back.
        Promise.race([
          beforeLoadRef.current?.(),
          new Promise<void>((resolve) => setTimeout(resolve, BEFORE_LOAD_MS)),
        ])
      )
      .catch(() => undefined)
      .then(() => loadSummary({ data: { bookId: book.id } }))
      .then((result) => {
        if (!live) return
        if (result.ok) {
          setLoaded({ status: "ready", summary: result.summary })
          // The summary is the server's word on the review, unless the form
          // changed it meanwhile.
          if (!touched.current) setReview(result.summary.review)
        } else {
          setLoaded({ status: "unavailable" })
        }
      })
      .catch(() => {
        if (live) setLoaded({ status: "unavailable" })
      })
    return () => {
      live = false
    }
  }, [loadSummary, book.id])

  useEffect(() => {
    let live = true
    let url: string | null = null
    void loadCover()
      .then((blob) => {
        if (!live || !blob) return
        url = URL.createObjectURL(blob)
        setCoverUrl(url)
      })
      .catch(() => undefined)
    return () => {
      live = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [loadCover])

  const summary = loaded.status === "ready" ? loaded.summary : null
  const seconds = summary?.seconds ?? 0
  const rating = review?.rating ?? null
  const { title, author } = book
  // Stable, so the share image is not redrawn on every render.
  const covers = useMemo(() => [loadCover], [loadCover])
  const build = useCallback(
    (size: CardSize, measure: Measure, coverCount: number) =>
      layoutFinishCard(
        {
          size,
          title,
          author,
          hasCover: coverCount > 0,
          readTime: formatReadTime(seconds),
          rating,
          host: location.host,
        },
        measure
      ),
    [title, author, seconds, rating]
  )

  const back = start === "form" ? onClose : () => setView("card")
  const heading = `Selesai: ${book.title}`

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="word-sheet-backdrop" />
        <DialogPrimitive.Popup
          aria-label={heading}
          className={wide ? "quote-dialog" : "quote-sheet"}
          finalFocus={finalFocus}
        >
          <div className="quote-head">
            <DialogPrimitive.Title className="font-heading text-lg">
              {heading}
            </DialogPrimitive.Title>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Tutup"
              onClick={onClose}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
          {view === "card" && (
            <div className="space-y-4 p-4">
              <div className="flex items-center gap-3">
                {coverUrl && (
                  <img
                    src={coverUrl}
                    alt=""
                    className="h-24 w-16 rounded object-cover"
                  />
                )}
                <div>
                  <p className="font-heading text-base">{book.title}</p>
                  <p className="text-sm text-muted-foreground">{book.author}</p>
                </div>
              </div>
              {loaded.status === "loading" && (
                <div className="word-skeleton">
                  <p className="sr-only">Memuat ringkasan…</p>
                  <span />
                  <span />
                </div>
              )}
              {loaded.status === "unavailable" && (
                <p className="text-sm">Ringkasan belum bisa dimuat</p>
              )}
              {summary && (
                <>
                  <dl className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Waktu baca
                      </dt>
                      <dd className="font-heading">
                        {formatReadTime(summary.seconds)}
                      </dd>
                      <small className="text-xs text-muted-foreground">
                        dalam {summary.days} hari
                      </small>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Kata dicari
                      </dt>
                      <dd className="font-heading">{summary.lookedUp}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Kata disimpan
                      </dt>
                      <dd className="font-heading">{summary.saved}</dd>
                    </div>
                  </dl>
                  {summary.coins > 0 && (
                    <p className="text-sm font-medium">{`+${summary.coins} koin`}</p>
                  )}
                </>
              )}
              {review && <Stars review={review} />}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="lg"
                  disabled={loaded.status === "loading"}
                  onClick={() => setView("form")}
                >
                  {review ? "Ubah ulasan" : "Tulis ulasan"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  disabled={!summary}
                  onClick={() => setView("share")}
                >
                  Bagikan
                </Button>
                <Button size="lg" variant="ghost" onClick={onClose}>
                  Nanti
                </Button>
              </div>
            </div>
          )}
          {view === "form" && (
            <div className="p-4">
              <ReviewForm
                bookId={book.id}
                initial={review}
                words={summary?.words ?? []}
                offline={blocked}
                onCancel={back}
                onSaved={(next) => {
                  touched.current = true
                  setReview(next)
                  onChanged()
                  back()
                }}
              />
            </div>
          )}
          {view === "share" && summary && (
            <>
              <ShareImage
                label="Bagikan kartu"
                description={`Kartu buku selesai: ${book.title}`}
                fileTitle={book.title}
                seed={book.id}
                covers={covers}
                build={build}
              />
              <div className="px-4 pb-4">
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => setView("card")}
                >
                  Kembali
                </Button>
              </div>
            </>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
