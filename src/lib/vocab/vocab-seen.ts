import { VOCAB_SEEN_KEY } from "@/lib/local/keys"
import type { WordMeetings } from "./types"

/** Every saved word's meetings added up: it only grows while the member reads (spec 3D). */
export function meetingsTotal(meetings: WordMeetings): number {
  let total = 0
  for (const { meetings: count } of Object.values(meetings)) total += count
  return total
}

/** The total when Kosakata was last opened on this device; null when unknown. */
export function readVocabSeen(): number | null {
  try {
    const raw = localStorage.getItem(VOCAB_SEEN_KEY)
    if (raw === null) return null
    const total = Number(raw)
    return Number.isInteger(total) && total >= 0 ? total : null
  } catch {
    return null
  }
}

export function rememberVocabSeen(total: number): void {
  try {
    localStorage.setItem(VOCAB_SEEN_KEY, String(total))
  } catch {
    // Storage can be off (private windows): the desk lamp then stays off.
  }
}
