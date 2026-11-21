import { describe, expect, it } from "vitest"
import { transitionTypes } from "./page-transition"

const phone = { wide: false, reducedMotion: false }

describe("transitionTypes", () => {
  it("raises a page over the room and drops it back", () => {
    expect(transitionTypes("/lobby", "/shelf", phone)).toEqual(["ke-halaman"])
    expect(transitionTypes("/settings", "/lobby", phone)).toEqual(["ke-ruang"])
  })

  it("fades between pages", () => {
    expect(transitionTypes("/shelf", "/vocabulary", phone)).toEqual([
      "antar-halaman",
    ])
    expect(transitionTypes("/habits", "/settings", phone)).toEqual([
      "antar-halaman",
    ])
  })

  it("does nothing on a wide screen, with reduced motion, or for the same page", () => {
    expect(
      transitionTypes("/lobby", "/shelf", { wide: true, reducedMotion: false })
    ).toBe(false)
    expect(
      transitionTypes("/lobby", "/shelf", { wide: false, reducedMotion: true })
    ).toBe(false)
    expect(transitionTypes("/shelf", "/shelf", phone)).toBe(false)
    expect(transitionTypes(undefined, "/shelf", phone)).toBe(false)
  })

  it("leaves the reader and the pages without the dock alone", () => {
    expect(transitionTypes("/shelf", "/read/abc", phone)).toBe(false)
    expect(transitionTypes("/read/abc", "/lobby", phone)).toBe(false)
    expect(transitionTypes("/login", "/lobby", phone)).toBe(false)
    expect(transitionTypes("/welcome", "/lobby", phone)).toBe(false)
  })
})
