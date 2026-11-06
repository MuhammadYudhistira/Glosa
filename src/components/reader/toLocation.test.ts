import { describe, expect, it } from "vitest"
import { toLocation } from "./ReaderView"

const detail = { fraction: 0.5, cfi: "epubcfi(/6/8!/4/2)" }

describe("toLocation", () => {
  it("never passes on a NaN fraction", () => {
    expect(
      toLocation({ ...detail, fraction: Number.NaN }, null, false, false)
    ).toMatchObject({ fraction: 0 })
    expect(toLocation(detail, null, false, false).fraction).toBe(0.5)
  })

  it("carries the section index", () => {
    const place = toLocation(
      { ...detail, section: { current: 3, total: 9 } },
      null,
      false,
      false
    )
    expect(place.section).toBe(3)
    expect(toLocation(detail, null, false, false).section).toBeNull()
  })
})
