import { existsSync } from "node:fs"
import { E2E_MARKER, admin } from "./helpers/members"

/** Deletes every E2E user (emails contain the marker) and their book files. */
export default async function globalTeardown() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local")
  const client = admin()
  const stale: Array<string> = []
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    })
    if (error) throw error
    for (const user of data.users) {
      if (user.email?.includes(E2E_MARKER)) stale.push(user.id)
    }
    if (data.users.length < 1000) break
  }
  for (const id of stale) {
    const { data: objects } = await client.storage
      .from("books")
      .list(id, { limit: 1000 })
    if (objects && objects.length > 0) {
      await client.storage
        .from("books")
        .remove(objects.map((object) => `${id}/${object.name}`))
    }
    await client.auth.admin.deleteUser(id)
  }
}
