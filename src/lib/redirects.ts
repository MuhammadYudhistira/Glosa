export const DEFAULT_MEMBER_PATH = "/lobby"

type AuthState = { onboarded: boolean } | null

/** Only same-site absolute paths are allowed as post-login destinations. */
export function safeNext(next: unknown): string {
  if (typeof next !== "string") return DEFAULT_MEMBER_PATH
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return DEFAULT_MEMBER_PATH
  }
  return next
}

/** For guest-only pages (/, /login, /register, /forgot-password). */
export function guestRedirect(user: AuthState): string | null {
  if (!user) return null
  return user.onboarded ? `${DEFAULT_MEMBER_PATH}?kembali=1` : "/welcome"
}

/** For pages under the _member layout. */
export function memberRedirect(
  user: AuthState,
  pathname: string
): string | null {
  if (!user) return `/login?next=${encodeURIComponent(pathname)}`
  if (!user.onboarded && pathname !== "/welcome") return "/welcome"
  if (user.onboarded && pathname === "/welcome") return DEFAULT_MEMBER_PATH
  return null
}
