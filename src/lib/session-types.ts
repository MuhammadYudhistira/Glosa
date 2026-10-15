export type Plan = "free" | "pro"

export function toPlan(value: string): Plan {
  return value === "pro" ? "pro" : "free"
}

export type SessionUser = {
  id: string
  email: string
  /** "email" or an OAuth provider such as "google". */
  provider: string
  username: string
  displayName: string
  memberNo: number
  plan: Plan
  storageLimitBytes: number
  memberSince: string
  onboarded: boolean
}
