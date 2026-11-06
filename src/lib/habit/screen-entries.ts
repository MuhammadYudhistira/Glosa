import type { QueueResult } from "@/lib/sync/queue-sync"
import { ReadingTimeEntrySchema } from "./schemas"
import type { ReadingTimeEntry } from "./types"

/**
 * One broken entry must not reject the batch, or the queue would send the
 * same batch for ever: the valid entries go on, the others are 'invalid'.
 */
export function screenEntries(entries: ReadonlyArray<unknown>): {
  valid: Array<ReadingTimeEntry>
  /** The answers for the whole batch, given the answers for the valid ones. */
  merge: (answers: ReadonlyArray<QueueResult>) => Array<QueueResult>
} {
  const parsed = entries.map((entry) => ReadingTimeEntrySchema.safeParse(entry))
  const valid = parsed.flatMap((result) =>
    result.success ? [result.data] : []
  )
  return {
    valid,
    merge(answers) {
      let next = 0
      return parsed.map((result) =>
        result.success ? (answers[next++] ?? "invalid") : "invalid"
      )
    },
  }
}
