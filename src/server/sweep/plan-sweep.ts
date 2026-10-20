import { isAbandoned } from "@/lib/quota"
import { PENDING_TTL_MS } from "@/lib/upload-rules"
import { objectPaths } from "@/server/book-storage"

export type StoredObject = { path: string; createdAt: string | null }

export type SweepBook = {
  id: string
  userId: string
  status: string
  createdAt: string
  filePath: string
  coverPath: string | null
}

export type SweepUser = { id: string; createdAt: string }

export type SweepInput = {
  now: number
  objects: ReadonlyArray<StoredObject>
  books: ReadonlyArray<SweepBook>
  profileIds: ReadonlyArray<string>
  users: ReadonlyArray<SweepUser>
}

export type ObjectReason = "folder_without_profile" | "unreferenced"

export type SweepPlan = {
  pendingBooks: Array<{ id: string; paths: Array<string> }>
  objects: Array<{ path: string; reason: ObjectReason }>
  users: Array<string>
}

const olderThanTtl = (createdAt: string, now: number) =>
  now - Date.parse(createdAt) >= PENDING_TTL_MS

/**
 * What one sweep round removes (spec 1E §6), decided from lists alone:
 * abandoned pending books with their objects, accounts left without a profile,
 * folders of members without a profile, and objects no book row refers to.
 */
export function planSweep(input: SweepInput): SweepPlan {
  const { now } = input
  const profiles = new Set(input.profileIds)
  const pathsOf = (book: SweepBook) =>
    objectPaths({ file_path: book.filePath, cover_path: book.coverPath })

  const pendingBooks = input.books
    .filter(
      (book) =>
        book.status === "pending" &&
        isAbandoned({ status: "pending", createdAt: book.createdAt }, now)
    )
    .map((book) => ({ id: book.id, paths: pathsOf(book) }))

  // Objects of every row, pending ones included: those leave with their row.
  const referenced = new Set(input.books.flatMap(pathsOf))
  const objects: SweepPlan["objects"] = []
  for (const object of input.objects) {
    if (referenced.has(object.path)) continue
    const owner = object.path.split("/")[0]
    if (!profiles.has(owner)) {
      objects.push({ path: object.path, reason: "folder_without_profile" })
    } else if (object.createdAt && olderThanTtl(object.createdAt, now)) {
      objects.push({ path: object.path, reason: "unreferenced" })
    }
  }

  // The profile is created in the same transaction as the account, so an
  // account without one was broken outside the app.
  const users = input.users
    .filter(
      (user) => !profiles.has(user.id) && olderThanTtl(user.createdAt, now)
    )
    .map((user) => user.id)

  return { pendingBooks, objects, users }
}

export function deletionCounts(plan: SweepPlan): {
  objects: number
  users: number
} {
  return {
    objects:
      plan.objects.length +
      plan.pendingBooks.reduce((sum, book) => sum + book.paths.length, 0),
    users: plan.users.length,
  }
}
