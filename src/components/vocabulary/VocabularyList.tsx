import { Link } from "@tanstack/react-router"
import { Trash2Icon } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { FormsByHeadword } from "@/lib/local/saved-words"
import { POS_LABELS } from "@/lib/words/labels"
import type { SavedWord } from "@/lib/words/types"
import {
  ALL_BOOKS,
  bookOptions,
  filterWords,
  sentenceParts,
} from "@/lib/words/vocabulary"

const SHOWN_MEANINGS = 3

function VocabularyCard({
  word,
  forms,
  onShelf,
  onDelete,
}: {
  word: SavedWord
  forms: Array<string>
  /** The book is still on the shelf, so its place can open. */
  onShelf: boolean
  onDelete: () => void
}) {
  const headingId = useId()
  return (
    <article aria-labelledby={headingId} className="vocab-card">
      <header className="flex items-baseline gap-2">
        <h2 id={headingId} className="font-heading text-xl font-bold">
          {word.headword}
        </h2>
        {word.pos && (
          <span className="text-xs text-muted-foreground">
            {POS_LABELS[word.pos]}
          </span>
        )}
      </header>
      {word.meanings.length > 0 && (
        <p>{word.meanings.slice(0, SHOWN_MEANINGS).join(", ")}</p>
      )}
      {word.sentence && (
        <blockquote className="vocab-sentence">
          {sentenceParts(word.sentence, forms).map((part, index) =>
            part.bold ? (
              <b key={index}>{part.text}</b>
            ) : (
              <span key={index}>{part.text}</span>
            )
          )}
        </blockquote>
      )}
      <footer className="vocab-card-footer">
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {word.bookTitle}
        </span>
        <div className="flex shrink-0 gap-1">
          {onShelf && word.bookId && word.cfi && (
            <Link
              to="/read/$bookId"
              params={{ bookId: word.bookId }}
              search={{ cfi: word.cfi }}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Buka di buku
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Hapus ${word.headword}`}
            onClick={onDelete}
          >
            <Trash2Icon />
          </Button>
        </div>
      </footer>
    </article>
  )
}

/** Kosakata's words, newest first, with a search and a book filter (spec 2 §6.4). */
export function VocabularyList({
  words,
  forms,
  shelfIds,
  onDelete,
}: {
  words: Array<SavedWord>
  forms: FormsByHeadword
  shelfIds: ReadonlySet<string>
  onDelete: (word: SavedWord) => void
}) {
  const [q, setQ] = useState("")
  const [book, setBook] = useState(ALL_BOOKS)
  const options = useMemo(() => bookOptions(words), [words])
  const visible = useMemo(
    () => filterWords(words, { q, book }),
    [words, q, book]
  )

  if (words.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ketuk kata yang sulit saat membaca, lalu simpan. Kata itu akan muncul di
        sini.
      </p>
    )
  }
  return (
    <>
      <div className="vocab-toolbar">
        <Label htmlFor="vocab-q" className="sr-only">
          Cari kata
        </Label>
        <Input
          id="vocab-q"
          type="search"
          placeholder="Cari kata atau arti"
          autoComplete="off"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <Label htmlFor="vocab-book" className="sr-only">
          Buku
        </Label>
        <select
          id="vocab-book"
          className="vocab-select"
          value={book}
          onChange={(event) => setBook(event.target.value)}
        >
          <option value={ALL_BOOKS}>Semua buku</option>
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.title}
            </option>
          ))}
        </select>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Tidak ada kata yang cocok.
        </p>
      ) : (
        <ul className="vocab-list">
          {visible.map((word) => (
            <li key={word.headword}>
              <VocabularyCard
                word={word}
                forms={forms[word.headword] ?? [word.headword]}
                onShelf={word.bookId !== null && shelfIds.has(word.bookId)}
                onDelete={() => onDelete(word)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
