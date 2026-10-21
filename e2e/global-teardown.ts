import { existsSync } from "node:fs"
import { E2E_MARKER, admin, runMarker } from "./helpers/members"

// Longer than any run can last (CI jobs stop at 50 min), so a member this old
// never belongs to a run still going on in another CI job.
const LEFT_BEHIND_AFTER_MS = 3 * 60 * 60 * 1000

/**
 * Deletes this run's E2E users, plus those earlier runs left behind, and
 * their book files.
 */
export default async function globalTeardown() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local")
  const client = admin()
  const own = runMarker()
  const leftBehind = Date.now() - LEFT_BEHIND_AFTER_MS
  const stale: Array<string> = []
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    })
    if (error) throw error
    for (const user of data.users) {
      if (!user.email?.includes(E2E_MARKER)) continue
      if (
        user.email.includes(own) ||
        Date.parse(user.created_at) < leftBehind
      ) {
        stale.push(user.id)
      }
    }
    if (data.users.length < 1000) break
  }
  const failed: Array<string> = []
  for (const id of stale) {
    if (!(await removeFiles(client, id))) {
      failed.push(id)
      continue
    }
    const { error } = await client.auth.admin.deleteUser(id)
    if (error) failed.push(id)
  }
  if (failed.length > 0) {
    throw new Error(
      `E2E teardown could not clean up ${failed.length} user(s), a run 3 hours later removes them: ${failed.join(", ")}`
    )
  }
}

/** Removes every object in the user's folder. Returns false if anything failed. */
async function removeFiles(
  client: ReturnType<typeof admin>,
  id: string
): Promise<boolean> {
  const limit = 1000
  for (;;) {
    const { data, error } = await client.storage
      .from("books")
      .list(id, { limit })
    if (error) return false
    if (data.length === 0) return true
    const { error: removeError } = await client.storage
      .from("books")
      .remove(data.map((object) => `${id}/${object.name}`))
    if (removeError) return false
    if (data.length < limit) return true
  }
}
