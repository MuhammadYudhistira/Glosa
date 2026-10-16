import { describe, expect, it } from "vitest"
import {
  ProgressEntrySchema,
  formatPercent,
  jumpOffer,
  toPercentage,
} from "./progress"

const position = (percentage: number, updatedAt: string) => ({
  cfi: `epubcfi(/6/${Math.round(percentage)}!/4/2)`,
  percentage,
  updatedAt,
})

describe("toPercentage", () => {
  it("turns foliate's fraction into a percentage with two decimals", () => {
    expect(toPercentage(0.4567)).toBe(45.67)
    expect(toPercentage(1 / 3)).toBe(33.33)
    expect(toPercentage(-1)).toBe(0)
    expect(toPercentage(2)).toBe(100)
    expect(toPercentage(Number.NaN)).toBe(0)
  })
})

describe("formatPercent", () => {
  it("shows whole percents, rounded down", () => {
    expect(formatPercent(45.99)).toBe("45%")
    expect(formatPercent(100)).toBe("100%")
  })
})

describe("jumpOffer", () => {
  const earlier = "2026-10-17T08:00:00.000Z"
  const later = "2026-10-17T09:00:00.000Z"

  it("offers a newer server position more than one point away", () => {
    const server = position(47, later)
    expect(jumpOffer(position(45, earlier), server)).toBe(server)
  })

  it("stays quiet when the server is not newer", () => {
    expect(jumpOffer(position(10, later), position(50, earlier))).toBeNull()
    expect(jumpOffer(position(10, later), position(50, later))).toBeNull()
  })

  it("stays quiet when the positions are within one point", () => {
    expect(jumpOffer(position(45, earlier), position(45.8, later))).toBeNull()
  })

  it("stays quiet when the positions are exactly one point apart", () => {
    expect(jumpOffer(position(45, earlier), position(46, later))).toBeNull()
  })

  it("treats a device without a position as 0% from the beginning of time", () => {
    const server = position(3, earlier)
    expect(jumpOffer(null, server)).toBe(server)
    expect(jumpOffer(null, position(0.5, earlier))).toBeNull()
  })

  it("offers nothing without a server position", () => {
    expect(jumpOffer(position(10, earlier), null)).toBeNull()
  })
})

describe("ProgressEntrySchema", () => {
  const entry = {
    bookId: "0f9f5c1e-8a4b-4c2e-9d3a-1b2c3d4e5f60",
    cfi: "epubcfi(/6/4!/4/2)",
    percentage: 12.5,
    updatedAt: "2026-10-17T08:00:00.000Z",
  }

  it("accepts a valid entry", () => {
    expect(ProgressEntrySchema.safeParse(entry).success).toBe(true)
  })

  it("rejects a cfi longer than the maximum", () => {
    expect(
      ProgressEntrySchema.safeParse({ ...entry, cfi: "a".repeat(2001) }).success
    ).toBe(false)
  })

  it("rejects a negative percentage", () => {
    expect(
      ProgressEntrySchema.safeParse({ ...entry, percentage: -1 }).success
    ).toBe(false)
  })

  it("rejects out-of-range or malformed values", () => {
    expect(
      ProgressEntrySchema.safeParse({ ...entry, percentage: 101 }).success
    ).toBe(false)
    expect(ProgressEntrySchema.safeParse({ ...entry, cfi: "" }).success).toBe(
      false
    )
    expect(
      ProgressEntrySchema.safeParse({ ...entry, bookId: "buku" }).success
    ).toBe(false)
    expect(
      ProgressEntrySchema.safeParse({ ...entry, updatedAt: "kemarin" }).success
    ).toBe(false)
  })
})
