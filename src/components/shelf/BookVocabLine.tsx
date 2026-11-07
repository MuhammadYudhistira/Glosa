import { Link } from "@tanstack/react-router"
import { type VocabSummary, comprehension } from "@/lib/vocab/comprehension"
import { useBookVocab } from "@/lib/vocab/vocab-client"

/** The line for a book's details (spec 3D §4.1). */
export function vocabLineText(summary: VocabSummary): string {
  const share = comprehension(summary)
  if (share === null) return "Baca lebih banyak untuk melihat angkanya"
  const base = `Paham ${share}% kata tanpa kamus`
  return summary.lookedUp > 0
    ? `${base} · ${summary.lookedUp} kata dicari`
    : base
}

/** How much of a book was understood without the dictionary; nothing before it was read. */
export function BookVocabLine({ bookId }: { bookId: string }) {
  const summary = useBookVocab(bookId)
  if (!summary) return null
  return (
    <p className="text-sm text-muted-foreground">
      {vocabLineText(summary)}{" "}
      <Link
        to="/vocabulary"
        search={{ buku: bookId }}
        className="font-medium text-foreground underline underline-offset-2"
      >
        Lihat kata
      </Link>
    </p>
  )
}
