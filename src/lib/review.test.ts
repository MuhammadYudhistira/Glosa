import { describe, expect, it } from "vitest"
import { parseFinishSummary, reviewOf } from "./review"

const row = {
  rating: 4,
  difficulty: "hard",
  note: "Bagus",
  updated_at: "2026-11-07T01:00:00Z",
}

describe("reviewOf", () => {
  it("reads the row, or the row inside a one-item array", () => {
    const review = {
      rating: 4,
      difficulty: "hard",
      note: "Bagus",
      updatedAt: "2026-11-07T01:00:00Z",
    }
    expect(reviewOf(row)).toEqual(review)
    expect(reviewOf([row])).toEqual(review)
  })

  it("is null for nothing and for a broken row", () => {
    expect(reviewOf(null)).toBeNull()
    expect(reviewOf([])).toBeNull()
    expect(reviewOf({ ...row, rating: 6 })).toBeNull()
    expect(reviewOf({ ...row, difficulty: "tough" })).toBeNull()
  })
})

describe("parseFinishSummary", () => {
  const raw = {
    seconds: 22800,
    days: 14,
    looked_up: 30,
    saved: 9,
    words: ["alpha", "beta"],
    coins: 50,
    finished_at: "2026-11-07T01:00:00Z",
    review: null,
  }

  it("turns the server's answer into the card's numbers", () => {
    expect(parseFinishSummary(raw)).toEqual({
      seconds: 22800,
      days: 14,
      lookedUp: 30,
      saved: 9,
      words: ["alpha", "beta"],
      coins: 50,
      finishedAt: "2026-11-07T01:00:00Z",
      review: null,
    })
    expect(parseFinishSummary({ ...raw, review: row })?.review?.rating).toBe(4)
  })

  it("refuses anything else", () => {
    expect(parseFinishSummary(null)).toBeNull()
    expect(parseFinishSummary({ ...raw, seconds: "x" })).toBeNull()
  })
})
