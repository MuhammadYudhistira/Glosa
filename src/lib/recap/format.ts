/** "6 jam 20 menit", "45 menit", "Kurang dari 1 menit" (spec 3E §3.2). */
export function formatReadTime(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  if (minutes < 1) return "Kurang dari 1 menit"
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const parts: Array<string> = []
  if (hours > 0) parts.push(`${hours} jam`)
  if (rest > 0) parts.push(`${rest} menit`)
  return parts.join(" ")
}
