import type { Plan } from "./session-types"

export function formatMemberNo(n: number): string {
  return String(n).padStart(6, "0")
}

const MONTH_YEAR = new Intl.DateTimeFormat("id-ID", {
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
})

export function formatMemberSince(iso: string): string {
  return MONTH_YEAR.format(new Date(iso)).replace(".", "")
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return `${Number((mb / 1024).toFixed(1))} GB`
  return `${Math.round(mb)} MB`
}

export function planLabel(plan: Plan): string {
  return plan === "pro" ? "PRO" : "GRATIS"
}
