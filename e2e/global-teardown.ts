import { existsSync } from "node:fs"
import { E2E_MARKER, admin } from "./helpers/members"

/** Deletes every user created by E2E runs (their emails contain the E2E marker). */
export default async function globalTeardown() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local")
  const client = admin()
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    })
    if (error) throw error
    const stale = data.users.filter((user) => user.email?.includes(E2E_MARKER))
    for (const user of stale) await client.auth.admin.deleteUser(user.id)
    if (data.users.length < 1000) break
  }
}
