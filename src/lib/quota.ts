import { PENDING_TTL_MS } from "./upload-rules"

export type QuotaRow = {
  sizeBytes: number
  status: "pending" | "ready"
  createdAt: string
}

export function isAbandoned(
  row: Pick<QuotaRow, "status" | "createdAt">,
  now: number = Date.now()
): boolean {
  return (
    row.status === "pending" &&
    now - Date.parse(row.createdAt) >= PENDING_TTL_MS
  )
}

/** Storage in use is computed from the rows, never stored (spec §4). */
export function usedBytes(
  rows: ReadonlyArray<QuotaRow>,
  now: number = Date.now()
): number {
  return rows.reduce(
    (sum, row) => (isAbandoned(row, now) ? sum : sum + row.sizeBytes),
    0
  )
}
