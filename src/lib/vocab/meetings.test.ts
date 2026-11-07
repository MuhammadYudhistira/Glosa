import { describe, expect, it } from "vitest"
import { countMeetings, meetingCounts, sectionOfCfi } from "./meetings"

describe("meetings", () => {
  it("finds the section of a CFI from its spine step", () => {
    expect(sectionOfCfi("epubcfi(/6/2!/4/2/1:0)")).toBe(0)
    expect(sectionOfCfi("epubcfi(/6/14!/4/10,/1:5,/1:9)")).toBe(6)
    expect(sectionOfCfi(null)).toBeNull()
    expect(sectionOfCfi("nonsense")).toBeNull()
  })

  it("counts every form of a saved word, phrases too", () => {
    const counts = countMeetings(
      "She ran. He runs and runs; they give up, then gave up again.",
      { run: ["run", "ran", "runs"], "give up": ["give up", "gave up"] }
    )
    expect(counts).toEqual({ run: 3, "give up": 2 })
  })

  it("leaves out the section where a word was saved, and words not met", () => {
    const saved = [
      { headword: "run", bookId: "b1", cfi: "epubcfi(/6/8!/4/2/1:0)" },
      { headword: "give up", bookId: "b2", cfi: "epubcfi(/6/8!/4/2/1:0)" },
      { headword: "mat", bookId: null, cfi: null },
    ]
    const counts = { run: 3, "give up": 2, mat: 0 }
    expect(meetingCounts(counts, "b1", 3, saved)).toEqual([
      { headword: "give up", count: 2 },
    ])
    expect(meetingCounts(counts, "b1", 4, saved)).toEqual([
      { headword: "run", count: 3 },
      { headword: "give up", count: 2 },
    ])
  })
})
