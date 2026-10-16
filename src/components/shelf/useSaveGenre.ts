import { useServerFn } from "@tanstack/react-start"
import { useCallback, useState } from "react"
import type { ActionResult } from "@/lib/action-result"
import type { Genre } from "@/lib/genre"
import { updateBookGenreFn } from "@/server/books"

/** Sets a book's genre (genre_source becomes 'user'); a thrown call becomes "unknown". */
export function useSaveGenre() {
  const updateGenre = useServerFn(updateBookGenreFn)
  const [saving, setSaving] = useState(false)

  const save = useCallback(
    async (bookId: string, genre: Genre): Promise<ActionResult> => {
      setSaving(true)
      try {
        return await updateGenre({ data: { bookId, genre } })
      } catch {
        return { ok: false, code: "unknown" }
      } finally {
        setSaving(false)
      }
    },
    [updateGenre]
  )

  return { save, saving }
}
