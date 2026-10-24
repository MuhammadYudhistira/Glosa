import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Popover } from "@base-ui/react/popover"
import { Button } from "@/components/ui/button"
import { useWideScreen } from "@/lib/use-wide-screen"
import { POS_LABELS } from "@/lib/words/labels"
import type { LookupResult } from "@/lib/words/types"
import type { WordLookupState } from "./useWordLookup"

/** Where the tapped word is, in this window's coordinates. */
export type WordRect = {
  left: number
  top: number
  width: number
  height: number
}

/** A tapped word and what Simpan keeps with it (spec 2 §6.2). */
export type WordTap = {
  word: string
  sentence: string
  next: Array<string>
  cfi: string | null
  rect: WordRect
}

const WIKTIONARY = "https://en.wiktionary.org/wiki/"

/** A virtual element at the word, for the popover to sit beside. */
function anchorAt({ left, top, width, height }: WordRect) {
  const box = {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  }
  return { getBoundingClientRect: () => ({ ...box, toJSON: () => box }) }
}

type CardProps = {
  tap: WordTap
  lookup: WordLookupState
  saved: boolean
  onToggleSave: () => void
  onRetry: () => void
}

function Meanings({
  result,
  base,
}: {
  result: LookupResult
  base: string | null
}) {
  return (
    <>
      {result.phrases.map((phrase) => (
        <section key={phrase.headword} className="word-sense">
          <h3>
            <span className="font-bold">{phrase.headword}</span>{" "}
            <span className="word-tag">frasa</span>
          </h3>
          <p>{phrase.meanings.join(", ")}</p>
        </section>
      ))}
      {result.entries.map((entry) => (
        <section key={`${entry.headword} ${entry.pos}`} className="word-sense">
          <h3 className="word-pos">
            {entry.headword === base
              ? POS_LABELS[entry.pos]
              : `${POS_LABELS[entry.pos]} · ${entry.headword}`}
          </h3>
          <p>{entry.meanings.join(", ")}</p>
        </section>
      ))}
    </>
  )
}

function WordCard({ tap, lookup, saved, onToggleSave, onRetry }: CardProps) {
  const result = lookup.kind === "result" ? lookup.result : null
  const base = result?.entries.at(0)?.headword ?? null
  const empty =
    result !== null &&
    result.entries.length === 0 &&
    result.phrases.length === 0
  return (
    <div className="word-card">
      <p className="word-head">
        <span className="font-heading text-xl font-bold">{tap.word}</span>
        {base && base !== tap.word && (
          <span className="text-muted-foreground">→ {base}</span>
        )}
      </p>
      {lookup.kind === "loading" && lookup.slow && (
        <div aria-hidden="true" className="word-skeleton">
          <span />
          <span />
        </div>
      )}
      {lookup.kind === "offline" && (
        <p className="word-note">Arti butuh koneksi</p>
      )}
      {lookup.kind === "failed" && (
        <div className="word-note">
          <p>Arti tidak bisa dimuat</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Coba lagi
          </Button>
        </div>
      )}
      {empty && <p className="word-note">Belum ada arti untuk kata ini</p>}
      {result && <Meanings result={result} base={base} />}
      <div className="word-actions">
        <Button
          size="lg"
          aria-pressed={saved}
          disabled={lookup.kind === "loading"}
          onClick={onToggleSave}
        >
          {saved ? "Tersimpan" : "Simpan"}
        </Button>
        <a
          className="word-credit"
          href={`${WIKTIONARY}${encodeURIComponent(base ?? tap.word)}`}
          target="_blank"
          rel="noreferrer"
        >
          Wiktionary · CC BY-SA
        </a>
      </div>
    </div>
  )
}

/**
 * A tapped word's meanings (spec 2 §6.3): a popover beside the word on wide
 * screens, a bottom sheet on phones. Escape or a tap outside closes it, and
 * the focus goes back to the book.
 */
export function WordPopup({
  tap,
  onClose,
  finalFocus,
  ...card
}: Omit<CardProps, "tap"> & {
  tap: WordTap | null
  onClose: () => void
  finalFocus: () => HTMLElement | null
}) {
  const wide = useWideScreen()
  if (!tap) return null
  const label = `Arti ${tap.word}`
  const onOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  if (wide) {
    return (
      <Popover.Root open onOpenChange={onOpenChange}>
        <Popover.Portal>
          <Popover.Positioner
            anchor={anchorAt(tap.rect)}
            side="bottom"
            sideOffset={8}
            collisionPadding={16}
            className="word-positioner"
          >
            <Popover.Popup
              aria-label={label}
              className="word-popup"
              finalFocus={finalFocus}
            >
              <WordCard tap={tap} {...card} />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    )
  }
  return (
    <DialogPrimitive.Root open onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="word-sheet-backdrop" />
        <DialogPrimitive.Popup
          aria-label={label}
          className="word-sheet"
          finalFocus={finalFocus}
        >
          <WordCard tap={tap} {...card} />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
