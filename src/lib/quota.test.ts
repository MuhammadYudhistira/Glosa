import { describe, expect, it } from "vitest"
import { isAbandoned, usedBytes } from "./quota"

const now = Date.parse("2026-10-16T12:00:00Z")
const minutesAgo = (minutes: number) =>
  new Date(now - minutes * 60_000).toISOString()

describe("usedBytes", () => {
  it("counts ready books and pending uploads younger than an hour", () => {
    expect(
      usedBytes(
        [
          { sizeBytes: 100, status: "ready", createdAt: minutesAgo(600) },
          { sizeBytes: 20, status: "pending", createdAt: minutesAgo(10) },
          { sizeBytes: 999, status: "pending", createdAt: minutesAgo(61) },
        ],
        now
      )
    ).toBe(120)
  })

  it("is zero for an empty shelf", () => {
    expect(usedBytes([], now)).toBe(0)
  })
})

describe("isAbandoned", () => {
  it("marks only pending uploads older than an hour", () => {
    expect(
      isAbandoned({ status: "pending", createdAt: minutesAgo(60) }, now)
    ).toBe(true)
    expect(
      isAbandoned({ status: "pending", createdAt: minutesAgo(59) }, now)
    ).toBe(false)
    expect(
      isAbandoned({ status: "ready", createdAt: minutesAgo(600) }, now)
    ).toBe(false)
  })
})
