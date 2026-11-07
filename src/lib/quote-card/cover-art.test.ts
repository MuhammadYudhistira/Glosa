import { afterEach, describe, expect, it, vi } from "vitest"
import { decodeCover } from "./cover-art"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubBitmap(width: number, height: number) {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(() => Promise.resolve({ width, height, close: vi.fn() }))
  )
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(12 * 12 * 4) })),
  } as unknown as CanvasRenderingContext2D)
}

describe("decodeCover", () => {
  it("shrinks to 200 px wide by default", async () => {
    stubBitmap(1000, 1500)
    const decoded = await decodeCover(new Blob(["x"]))
    expect((decoded?.image as HTMLCanvasElement).width).toBe(200)
    expect((decoded?.image as HTMLCanvasElement).height).toBe(300)
  })

  it("follows the width it is given", async () => {
    stubBitmap(1000, 1500)
    const decoded = await decodeCover(new Blob(["x"]), 600)
    expect((decoded?.image as HTMLCanvasElement).width).toBe(600)
    expect((decoded?.image as HTMLCanvasElement).height).toBe(900)
  })

  it("never enlarges a small cover", async () => {
    stubBitmap(100, 150)
    const decoded = await decodeCover(new Blob(["x"]), 600)
    expect((decoded?.image as HTMLCanvasElement).width).toBe(100)
  })
})
