import { describe, expect, it } from "vitest"
import {
  type Environment,
  initialQuality,
  nextQuality,
  walkerShare,
} from "./quality"

const desktop: Environment = {
  reducedMotion: false,
  webgl: true,
  coarsePointer: false,
  deviceMemory: 8,
}

describe("initialQuality", () => {
  it("starts desktops high", () => {
    expect(initialQuality(desktop)).toBe("tinggi")
    expect(initialQuality({ ...desktop, deviceMemory: undefined })).toBe(
      "tinggi"
    )
  })

  it("starts phones and small devices low", () => {
    expect(initialQuality({ ...desktop, coarsePointer: true })).toBe("rendah")
    expect(initialQuality({ ...desktop, deviceMemory: 4 })).toBe("rendah")
  })

  it("keeps the scene still with reduced motion or without WebGL", () => {
    expect(initialQuality({ ...desktop, reducedMotion: true })).toBe("diam")
    expect(initialQuality({ ...desktop, webgl: false })).toBe("diam")
  })
})

describe("nextQuality", () => {
  it("steps down when the frame rate is too low", () => {
    expect(nextQuality("tinggi", 39)).toBe("rendah")
    expect(nextQuality("tinggi", 40)).toBe("tinggi")
    expect(nextQuality("rendah", 19)).toBe("diam")
    expect(nextQuality("rendah", 20)).toBe("rendah")
    expect(nextQuality("diam", 5)).toBe("diam")
  })
})

describe("walkerShare", () => {
  it("shows half the walkers on the low tier", () => {
    expect(walkerShare("tinggi")).toBe(1)
    expect(walkerShare("rendah")).toBe(0.5)
    expect(walkerShare("diam")).toBe(1)
  })
})
