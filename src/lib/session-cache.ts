import { USER_KEY } from "./local/keys"
import type { SessionUser } from "./session-types"

/** The last member seen online on this device, so the app still opens offline (spec §12). */
export function rememberUser(user: SessionUser): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // No localStorage (private mode): the app just will not open offline.
  }
}

export function cachedUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    return isSessionUser(value) ? value : null
  } catch {
    return null
  }
}

export function forgetUser(): void {
  try {
    localStorage.removeItem(USER_KEY)
  } catch {
    // No localStorage: nothing to forget.
  }
}

function isSessionUser(value: unknown): value is SessionUser {
  if (typeof value !== "object" || value === null) return false
  const user = value as Record<string, unknown>
  return (
    typeof user.id === "string" &&
    typeof user.username === "string" &&
    typeof user.displayName === "string" &&
    typeof user.onboarded === "boolean"
  )
}
