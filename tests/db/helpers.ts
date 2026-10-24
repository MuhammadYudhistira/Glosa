import { createHash, randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/server/database.types"

export const TEST_PASSWORD = "rahasia-123"
const createdIds: Array<string> = []

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name} in .env.local`)
  return value
}

export function adminClient() {
  return createClient<Database>(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
}

export async function createTestMember(opts: {
  email: string
  metadata?: Record<string, string>
}) {
  const { data, error } = await adminClient().auth.admin.createUser({
    email: opts.email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: opts.metadata ?? {},
  })
  if (error) throw error
  createdIds.push(data.user.id)
  return data.user
}

/** For a member a test already deleted, so the clean-up does not retry it. */
export function forgetTestMember(id: string) {
  const index = createdIds.indexOf(id)
  if (index >= 0) createdIds.splice(index, 1)
}

/** A client with the publishable key and no session (RLS applies as anon). */
export function anonClient() {
  return createClient<Database>(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_PUBLISHABLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

/** A client signed in as the given member (publishable key, RLS applies). */
export async function signedInClient(email: string) {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  })
  if (error) throw error
  return client
}

export async function deleteTestMembers() {
  const admin = adminClient()
  const failed: Array<string> = []
  for (const id of createdIds.splice(0)) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) failed.push(id)
  }
  createdIds.push(...failed)
  if (failed.length > 0) {
    throw new Error(
      `Failed to delete ${failed.length} test member(s): ${failed.join(", ")}`
    )
  }
}

/** A book on the member's shelf (ready unless asked otherwise), reserved as the server does. */
export async function newTestBook(
  userId: string,
  options: { ready?: boolean; title?: string } = {}
): Promise<string> {
  const bookId = randomUUID()
  const admin = adminClient()
  const { error } = await admin
    .rpc("reserve_book_upload", {
      p_user_id: userId,
      p_book_id: bookId,
      p_sha256: createHash("sha256").update(bookId).digest("hex"),
      p_epub_bytes: 1000,
      p_title: options.title ?? "Buku Uji",
      p_author: "Penulis Uji",
      p_subjects: [],
    })
    .single()
  if (error) throw error
  if (options.ready ?? true) {
    const { error: readyError } = await admin
      .from("books")
      .update({ status: "ready" })
      .eq("id", bookId)
    if (readyError) throw readyError
  }
  return bookId
}
