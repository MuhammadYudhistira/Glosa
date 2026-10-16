import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

export const BOOKS_BUCKET = "books"
const REMOVE_BATCH = 100
const LIST_PAGE = 1000

/** Every Storage object that belongs to a book row. */
export function objectPaths(row: {
  file_path: string
  cover_path: string | null
}): Array<string> {
  return row.cover_path ? [row.file_path, row.cover_path] : [row.file_path]
}

/**
 * All access to book files goes through here, so the storage provider can be
 * swapped later (spec §5). Pass the admin client for signing uploads, stat and
 * removal; pass the member's client for signed reads so Storage RLS applies.
 */
export function bookStorage(client: SupabaseClient<Database>) {
  const bucket = () => client.storage.from(BOOKS_BUCKET)
  return {
    async createUploadUrl(path: string): Promise<string> {
      const { data, error } = await bucket().createSignedUploadUrl(path)
      if (error) throw error
      return data.signedUrl
    },

    async getReadUrls(
      paths: Array<string>,
      expiresIn = 3600
    ): Promise<Map<string, string>> {
      if (paths.length === 0) return new Map()
      const { data, error } = await bucket().createSignedUrls(paths, expiresIn)
      if (error) throw error
      return new Map(
        data.flatMap((item) =>
          item.path && item.signedUrl && !item.error
            ? [[item.path, item.signedUrl] as const]
            : []
        )
      )
    },

    /** Size in bytes, or null when the object does not exist. */
    async statObject(path: string): Promise<number | null> {
      const { data, error } = await bucket().info(path)
      if (error) return null
      return data.size ?? null
    },

    /** Paths of every object directly inside a member's folder. */
    async listFolder(folder: string): Promise<Array<string>> {
      const paths: Array<string> = []
      for (let offset = 0; ; offset += LIST_PAGE) {
        const { data, error } = await bucket().list(folder, {
          limit: LIST_PAGE,
          offset,
        })
        if (error) throw error
        paths.push(...data.map((object) => `${folder}/${object.name}`))
        if (data.length < LIST_PAGE) return paths
      }
    },

    async remove(paths: Array<string>): Promise<void> {
      for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
        const { error } = await bucket().remove(
          paths.slice(i, i + REMOVE_BATCH)
        )
        if (error) throw error
      }
    },
  }
}
