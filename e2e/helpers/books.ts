import { createHash, randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { admin } from "./members"

export const SHERLOCK = {
  path: "e2e/fixtures/the-adventures-of-sherlock-holmes.epub",
  title: "The Adventures of Sherlock Holmes",
  author: "Arthur Conan Doyle",
}

/**
 * Puts an EPUB straight on a member's shelf, without the upload screen:
 * reserve, upload through the admin client, mark ready. The global teardown
 * removes it with the member.
 */
export async function seedBook(
  userId: string,
  book: { path: string; title: string; author: string } = SHERLOCK
): Promise<string> {
  const file = await readFile(book.path)
  const bookId = randomUUID()
  const client = admin()
  const { error } = await client
    .rpc("reserve_book_upload", {
      p_user_id: userId,
      p_book_id: bookId,
      p_sha256: createHash("sha256").update(file).digest("hex"),
      p_epub_bytes: file.byteLength,
      p_title: book.title,
      p_author: book.author,
      p_subjects: [],
    })
    .single()
  if (error) throw error
  const { error: uploadError } = await client.storage
    .from("books")
    .upload(`${userId}/${bookId}.epub`, file, {
      contentType: "application/epub+zip",
    })
  if (uploadError) throw uploadError
  const { error: readyError } = await client
    .from("books")
    .update({ status: "ready" })
    .eq("id", bookId)
  if (readyError) throw readyError
  return bookId
}

export async function storedPercentage(bookId: string): Promise<number | null> {
  const { data, error } = await admin()
    .from("reading_progress")
    .select("percentage")
    .eq("book_id", bookId)
    .maybeSingle()
  if (error) throw error
  return data?.percentage ?? null
}

export async function readerSettingsOf(userId: string): Promise<unknown> {
  const { data, error } = await admin()
    .from("profiles")
    .select("reader_settings")
    .eq("id", userId)
    .single()
  if (error) throw error
  return data.reader_settings
}
