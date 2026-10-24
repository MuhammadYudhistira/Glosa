import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/server/database.types"

/** A deleted annotation stays this long for devices that were offline (spec 2 §4.3). */
export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Removes annotations deleted more than 30 days ago and returns how many; a
 * dry run only counts them. A device offline for longer reads the book's list
 * afresh and drops what is gone from it.
 */
export async function purgeTombstones(options: {
  admin: SupabaseClient<Database>
  now?: number
  dryRun?: boolean
  /** Limits the round to these members (integration tests). */
  onlyUserIds?: ReadonlyArray<string>
}): Promise<number> {
  const { admin, dryRun = false } = options
  const cutoff = new Date(
    (options.now ?? Date.now()) - TOMBSTONE_TTL_MS
  ).toISOString()
  const only = options.onlyUserIds ? [...options.onlyUserIds] : null

  if (dryRun) {
    const query = admin
      .from("annotations")
      .select("id", { count: "exact", head: true })
      .lt("deleted_at", cutoff)
    const { count, error } = await (only ? query.in("user_id", only) : query)
    if (error) throw error
    return count ?? 0
  }
  const query = admin
    .from("annotations")
    .delete({ count: "exact" })
    .lt("deleted_at", cutoff)
  const { count, error } = await (only ? query.in("user_id", only) : query)
  if (error) throw error
  return count ?? 0
}
