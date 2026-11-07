import { useEffect, useState } from "react"
import { vocabLineText } from "@/components/shelf/BookVocabLine"
import { Button } from "@/components/ui/button"
import type { BookVocab } from "@/lib/vocab/types"
import { type LookupOutcome, lookUp } from "@/lib/words/lookup"
import { MAX_MEANINGS } from "@/lib/words/types"
import { wordSync } from "@/lib/words/word-sync-client"
import { loadBookVocabFn } from "@/server/vocab"

/** The words looked up in one book, for Kosakata's book filter (spec 3D §4.2). */
export function BookLookups({
  bookId,
  title,
  savedHeadwords,
  offline,
}: {
  bookId: string
  title: string
  savedHeadwords: ReadonlySet<string>
  offline: boolean
}) {
  const [vocab, setVocab] = useState<BookVocab | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [found, setFound] = useState<{
    word: string
    outcome: LookupOutcome
  } | null>(null)
  // Only the answer for the row that is open counts.
  const meaning = found && found.word === open ? found.outcome : null

  useEffect(() => {
    if (offline) return
    let live = true
    setVocab(null)
    setFailed(false)
    loadBookVocabFn({ data: { bookId } })
      .then((answer) => {
        if (!live) return
        if (answer.ok) setVocab(answer.vocab)
        else setFailed(true)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [bookId, offline])

  async function toggle(word: string) {
    if (open === word) {
      setOpen(null)
      return
    }
    setOpen(word)
    setFound(null)
    setFound({ word, outcome: await lookUp(word, []) })
  }

  function save(word: string) {
    if (meaning?.kind !== "result") return
    if (meaning.result.entries.length === 0) return
    const entry = meaning.result.entries[0]
    void wordSync()
      .save(
        {
          headword: entry.headword,
          pos: entry.pos,
          meanings: entry.meanings.slice(0, MAX_MEANINGS),
          bookId,
          bookTitle: title,
          sentence: "",
          cfi: null,
          createdAt: new Date().toISOString(),
        },
        [word]
      )
      .catch((error: unknown) => console.error("saving the word failed", error))
  }

  return (
    <section aria-labelledby="book-lookups" className="flex flex-col gap-2">
      <h2 id="book-lookups" className="font-heading text-xl">
        Kata di {title}
      </h2>
      {offline ? (
        <p className="text-sm">Perlu koneksi internet</p>
      ) : failed ? (
        <p className="text-sm">Kata di buku ini belum bisa dimuat.</p>
      ) : !vocab ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {vocabLineText({ read: vocab.read, lookedUp: vocab.lookedUp })}
          </p>
          <h3 id="book-lookups-list" className="font-medium">
            Dicari di buku ini
          </h3>
          <ul
            aria-labelledby="book-lookups-list"
            className="flex flex-col gap-1"
          >
            {vocab.words.map(({ word, taps }) => {
              const saved = savedHeadwords.has(word)
              return (
                <li key={word} className="rounded-lg border px-3 py-2">
                  <button
                    type="button"
                    className="flex w-full items-baseline justify-between gap-2 text-left"
                    aria-expanded={open === word}
                    onClick={() => void toggle(word)}
                  >
                    <span className="font-medium">{word}</span>
                    <span className="text-sm text-muted-foreground">
                      diketuk {taps}×
                    </span>
                  </button>
                  {saved && <span className="text-sm">Tersimpan</span>}
                  {open === word && meaning?.kind === "result" && (
                    <div className="mt-2 flex flex-col gap-1">
                      <ul className="list-disc pl-5 text-sm">
                        {meaning.result.entries.flatMap((entry) =>
                          entry.meanings.map((text) => (
                            <li key={`${entry.pos}${text}`}>{text}</li>
                          ))
                        )}
                      </ul>
                      {!saved && meaning.result.entries.length > 0 && (
                        <Button
                          size="sm"
                          className="self-start"
                          onClick={() => save(word)}
                        >
                          Simpan
                        </Button>
                      )}
                    </div>
                  )}
                  {open === word && meaning?.kind === "offline" && (
                    <p className="mt-2 text-sm">Arti butuh koneksi</p>
                  )}
                  {open === word && meaning?.kind === "failed" && (
                    <p className="mt-2 text-sm">Arti belum bisa dimuat.</p>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
