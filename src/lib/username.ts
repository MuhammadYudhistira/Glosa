export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

export type UsernameProblem = "too_short" | "too_long" | "invalid_chars"

export function normalizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, USERNAME_MAX)
}

export function validateUsername(value: string): UsernameProblem | null {
  if (/[^a-z0-9_]/.test(value)) return "invalid_chars"
  if (value.length < USERNAME_MIN) return "too_short"
  if (value.length > USERNAME_MAX) return "too_long"
  return null
}

export const USERNAME_PROBLEM_TEXT: Record<UsernameProblem, string> = {
  too_short: "Minimal 3 karakter.",
  too_long: "Maksimal 20 karakter.",
  invalid_chars: "Hanya huruf kecil, angka, dan garis bawah (_).",
}
