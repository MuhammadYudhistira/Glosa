import type { SupabaseClient } from "@supabase/supabase-js"
import { PENDING_TTL_MS } from "@/lib/upload-rules"
import { bookStorage, objectPaths } from "@/server/book-storage"
import type { Database } from "@/server/database.types"
import {
  type StoredObject,
  type SweepPlan,
  type SweepUser,
  deletionCounts,
  planSweep,
} from "./plan-sweep"

type Admin = SupabaseClient<Database>

const PAGE = 1000

/** A round that would delete more stops and reports instead (spec 1E §6). */
export const SWEEP_LIMITS = { objects: 50, users: 5 }

export type SweepOptions = {
  admin: Admin
  now?: number
  dryRun?: boolean
  limits?: { objects: number; users: number }
  /** Limits the round to these members (integration tests). */
  onlyUserIds?: ReadonlyArray<string>
}

export type SweepResult = {
  status: "done" | "dry_run" | "too_many"
  plan: SweepPlan
}

async function allRows<T>(
  page: (
    from: number,
    to: number
  ) => PromiseLike<{ data: Array<T> | null; error: unknown }>
): Promise<Array<T>> {
  const rows: Array<T> = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

async function allUsers(admin: Admin): Promise<Array<SweepUser>> {
  const users: Array<SweepUser> = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PAGE,
    })
    if (error) throw error
    users.push(
      ...data.users.map((user) => ({ id: user.id, createdAt: user.created_at }))
    )
    if (data.users.length < PAGE) return users
  }
}

async function allObjects(
  admin: Admin,
  onlyUserIds: ReadonlyArray<string> | undefined
): Promise<Array<StoredObject>> {
  const storage = bookStorage(admin)
  const folders = onlyUserIds ?? (await storage.listFolders())
  const objects: Array<StoredObject> = []
  for (const folder of folders)
    objects.push(...(await storage.listFiles(folder)))
  return objects
}

async function applyPlan(admin: Admin, plan: SweepPlan, now: number) {
  const storage = bookStorage(admin)
  if (plan.pendingBooks.length > 0) {
    // Only rows that are still pending and still old leave.
    const { data, error } = await admin
      .from("books")
      .delete()
      .in(
        "id",
        plan.pendingBooks.map((book) => book.id)
      )
      .eq("status", "pending")
      .lt("created_at", new Date(now - PENDING_TTL_MS).toISOString())
      .select("file_path, cover_path")
    if (error) throw error
    await storage.remove(data.flatMap(objectPaths))
  }
  await storage.remove(plan.objects.map((object) => object.path))
  for (const id of plan.users) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw error
  }
}

/**
 * One sweep round (spec 1E §6). Every list is read before anything is
 * deleted, and a failed list throws: it is never taken as empty.
 */
export async function runSweep(options: SweepOptions): Promise<SweepResult> {
  const { admin, dryRun = false, limits = SWEEP_LIMITS, onlyUserIds } = options
  const now = options.now ?? Date.now()
  const only = onlyUserIds ? [...onlyUserIds] : undefined

  // Objects first: every object listed here belongs to a member whose profile
  // and book row already existed, so the lists read after cannot miss them.
  const objects = await allObjects(admin, only)
  const books = await allRows((from, to) => {
    const query = admin
      .from("books")
      .select("id, user_id, status, created_at, file_path, cover_path")
    return (only ? query.in("user_id", only) : query)
      .order("id")
      .range(from, to)
  })
  const profiles = await allRows((from, to) => {
    const query = admin.from("profiles").select("id")
    return (only ? query.in("id", only) : query).order("id").range(from, to)
  })
  const users = (await allUsers(admin)).filter(
    (user) => !only || only.includes(user.id)
  )

  const plan = planSweep({
    now,
    objects,
    books: books.map((row) => ({
      id: row.id,
      userId: row.user_id,
      status: row.status,
      createdAt: row.created_at,
      filePath: row.file_path,
      coverPath: row.cover_path,
    })),
    profileIds: profiles.map((row) => row.id),
    users,
  })

  const counts = deletionCounts(plan)
  if (counts.objects > limits.objects || counts.users > limits.users)
    return { status: "too_many", plan }
  if (dryRun) return { status: "dry_run", plan }
  await applyPlan(admin, plan, now)
  return { status: "done", plan }
}

export function summarize(result: SweepResult) {
  const counts = deletionCounts(result.plan)
  return {
    status: result.status,
    books: result.plan.pendingBooks.length,
    objects: counts.objects,
    users: counts.users,
  }
}
