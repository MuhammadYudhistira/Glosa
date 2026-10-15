import { describe, expect, it } from "vitest"
import {
  formatBytes,
  formatMemberNo,
  formatMemberSince,
  planLabel,
} from "./member"

describe("member formatting", () => {
  it("pads member numbers to six digits", () => {
    expect(formatMemberNo(342)).toBe("000342")
    expect(formatMemberNo(1234567)).toBe("1234567")
  })

  it("shows the month and year in Indonesian, Jakarta time", () => {
    expect(formatMemberSince("2026-10-15T03:00:00Z")).toBe("Okt 2026")
    expect(formatMemberSince("2026-10-31T20:00:00Z")).toBe("Nov 2026")
  })

  it("formats storage sizes", () => {
    expect(formatBytes(104857600)).toBe("100 MB")
    expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe("5 GB")
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB")
  })

  it("labels plans", () => {
    expect(planLabel("free")).toBe("GRATIS")
    expect(planLabel("pro")).toBe("PRO")
  })
})
