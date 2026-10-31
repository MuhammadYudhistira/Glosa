import { Button } from "@/components/ui/button"
import { bookMessage } from "@/lib/book-messages"

/** "Sudah selesai membaca buku ini?" at the end of the book (spec Tahap 3 §4.4). */
export function FinishPrompt({
  busy,
  error,
  raised,
  onAnswer,
  onLater,
}: {
  busy: boolean
  error: string | null
  /** Kembali shows above the bottom bar: the prompt goes above it. */
  raised: boolean
  onAnswer: (finished: boolean) => void
  /** Hide the prompt for this visit only; nothing is saved. */
  onLater: () => void
}) {
  return (
    <aside
      aria-label="Buku selesai"
      className="reader-toast"
      data-raised={raised}
    >
      <output className="text-sm">Sudah selesai membaca buku ini?</output>
      <div className="flex gap-2">
        <Button size="lg" disabled={busy} onClick={() => onAnswer(true)}>
          Ya, selesai
        </Button>
        <Button
          size="lg"
          variant="ghost"
          disabled={busy}
          onClick={() => onAnswer(false)}
        >
          Belum
        </Button>
        <Button size="lg" variant="ghost" disabled={busy} onClick={onLater}>
          Nanti
        </Button>
      </div>
      {error && (
        <p role="alert" className="w-full text-xs text-stamp">
          {bookMessage(error)}
        </p>
      )}
    </aside>
  )
}
