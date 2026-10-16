import { getSessionUserFn } from "@/server/session"
import { cachedUser, forgetUser, rememberUser } from "./session-cache"
import type { SessionUser } from "./session-types"

/**
 * The root route's `user`: the signed-in member, null for guests, or undefined
 * in the offline shell, which is prerendered at build time for nobody in
 * particular (plan 1C, decision 4).
 */
export type RootUser = SessionUser | null | undefined

export async function currentUser(): Promise<RootUser> {
  if (import.meta.env.SSR) {
    if (process.env.TSS_PRERENDERING === "true") return undefined
    return getSessionUserFn()
  }
  return browserUser()
}

/** Asks the server; offline, falls back to the last member seen online. */
export async function browserUser(): Promise<SessionUser | null> {
  if (isOffline()) return cachedUser()
  try {
    const user = await getSessionUserFn()
    if (user) rememberUser(user)
    else forgetUser()
    return user
  } catch (error) {
    if (isOffline() || error instanceof TypeError) return cachedUser()
    throw error
  }
}

// Read through a function so TypeScript does not narrow the value checked above:
// the connection may drop while the request is in flight.
function isOffline(): boolean {
  return !navigator.onLine
}

/** For route guards: inside the offline shell the user is only known in the browser. */
export async function resolveUser(user: RootUser): Promise<SessionUser | null> {
  if (user !== undefined) return user
  return import.meta.env.SSR ? null : browserUser()
}
