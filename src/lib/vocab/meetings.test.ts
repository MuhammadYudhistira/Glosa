import { describe, expect, it } from "vitest"
import { countMeetings } from "./meetings"

describe("meetings", () => {
  it("counts every form of a saved word, phrases too", () => {
    const counts = countMeetings(
      "She ran. He runs and runs; they give up, then gave up again.",
      { run: ["run", "ran", "runs"], "give up": ["give up", "gave up"] }
    )
    expect(counts).toEqual({ run: 3, "give up": 2 })
  })
})
