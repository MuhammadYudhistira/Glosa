import { admin } from "./members"

/** Words read in a book, straight into the table (another device's reading). */
export async function seedWordsRead(
  userId: string,
  bookId: string,
  count: number,
  also: Array<string> = []
) {
  const words = [
    ...Array.from({ length: count }, (_, i) => `seedword${i}`),
    ...also,
  ]
  const { error } = await admin()
    .from("book_words_read")
    .insert({ user_id: userId, book_id: bookId, sections: [0], words })
  if (error) throw error
}

export async function seedLookup(
  userId: string,
  bookId: string,
  word: string,
  taps: number
) {
  const { error } = await admin()
    .from("word_lookups")
    .insert({ user_id: userId, book_id: bookId, word, taps })
  if (error) throw error
}

/** The sections of a book the server has as read, and its looked-up words. */
export async function vocabOf(userId: string, bookId: string) {
  const [read, lookups] = await Promise.all([
    admin()
      .from("book_words_read")
      .select("sections")
      .eq("user_id", userId)
      .eq("book_id", bookId),
    admin()
      .from("word_lookups")
      .select("word, taps")
      .eq("user_id", userId)
      .eq("book_id", bookId),
  ])
  if (read.error) throw read.error
  if (lookups.error) throw lookups.error
  return { sections: read.data[0]?.sections ?? [], lookups: lookups.data }
}
