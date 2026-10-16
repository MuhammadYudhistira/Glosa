import { useId, useState } from "react"
import { bookMessage } from "@/lib/book-messages"
import type { ShelfBook } from "@/lib/book-types"
import { GENRE_LABELS, GENRE_VALUES, type Genre, isGenre } from "@/lib/genre"
import { useSaveGenre } from "./useSaveGenre"

/** "Susun buku": one choice per trolley book gives it a genre (spec §7). */
export function TrolleyGenrePicker({
  book,
  onSaved,
}: {
  book: ShelfBook
  onSaved: (genre: Genre) => void
}) {
  const id = useId()
  const { save, saving } = useSaveGenre()
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        Genre untuk {book.title}
      </label>
      <select
        id={id}
        value=""
        disabled={saving}
        onChange={async (event) => {
          const genre = event.target.value
          if (!isGenre(genre)) return
          setError(null)
          const result = await save(book.id, genre)
          if (result.ok) onSaved(genre)
          else setError(result.code)
        }}
        className="native-select w-full text-xs"
      >
        <option value="">Pilih genre</option>
        {GENRE_VALUES.map((value) => (
          <option key={value} value={value}>
            {GENRE_LABELS[value]}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-xs text-stamp">
          {bookMessage(error)}
        </p>
      )}
    </div>
  )
}
