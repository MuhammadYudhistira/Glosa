import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { bookMessage } from "@/lib/book-messages"
import type { ShelfBook } from "@/lib/book-types"
import { formatLongDate } from "@/lib/dates"
import { useOnline } from "@/lib/use-online"
import { setBookFinishedFn } from "@/server/collections"

/** "Tandai selesai" / "Tandai belum selesai" in the book's details (spec Tahap 3 §4.4). */
export function FinishToggle({
  book,
  onSaved,
}: {
  book: ShelfBook
  onSaved: () => void
}) {
  const save = useServerFn(setBookFinishedFn)
  const online = useOnline()
  const [finishedAt, setFinishedAt] = useState(book.finishedAt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const finished = finishedAt !== null

  async function onToggle() {
    setBusy(true)
    setError(null)
    try {
      const result = await save({
        data: { bookId: book.id, finished: !finished },
      })
      if (result.ok) {
        setFinishedAt(finished ? null : new Date().toISOString())
        onSaved()
      } else {
        setError(result.code)
      }
    } catch {
      setError("unknown")
    }
    setBusy(false)
  }

  return (
    <div className="space-y-1">
      {finishedAt && (
        <p className="text-sm">
          Selesai dibaca {formatLongDate(new Date(finishedAt))}
        </p>
      )}
      <Button
        variant="outline"
        disabled={busy || !online}
        onClick={() => void onToggle()}
      >
        {finished ? "Tandai belum selesai" : "Tandai selesai"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-stamp">
          {bookMessage(error)}
        </p>
      )}
    </div>
  )
}
