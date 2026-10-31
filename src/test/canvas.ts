import { vi } from "vitest"
import type { Measure } from "@/lib/quote-card/layout"

/** Half the font size per character: what the fake canvas measures. */
export const fakeMeasure: Measure = (text, font) =>
  text.length * Number(/([\d.]+)px/.exec(font)?.[1] ?? 10) * 0.5

export type FakeCanvas = {
  context: CanvasRenderingContext2D
  calls: Array<{ name: string; args: Array<unknown> }>
  /** Every text drawn so far, in order. */
  texts: () => Array<string>
}

/** A 2D context that records its calls and measures with fakeMeasure. */
export function fakeContext(): FakeCanvas {
  const calls: FakeCanvas["calls"] = []
  const state: Record<string | symbol, unknown> = { font: "10px sans-serif" }
  const gradient = { addColorStop: () => undefined }
  const context = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key]
      // Not a thenable: nothing should await a context.
      if (key === "then") return undefined
      if (key === "measureText") {
        return (text: string) => ({
          width: fakeMeasure(text, String(target.font)),
        })
      }
      return (...args: Array<unknown>) => {
        calls.push({ name: String(key), args })
        return key === "createLinearGradient" || key === "createRadialGradient"
          ? gradient
          : undefined
      }
    },
    set(target, key, value) {
      target[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return {
    context,
    calls,
    texts: () =>
      calls
        .filter((call) => call.name === "fillText")
        .map((call) => String(call.args[0])),
  }
}

/** jsdom has no canvas: every canvas gets one fake context, and toBlob a tiny PNG. */
export function stubCanvas(): FakeCanvas {
  const fake = fakeContext()
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    (() => fake.context) as never
  )
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback: BlobCallback) => {
      callback(new Blob(["png"], { type: "image/png" }))
    }
  )
  return fake
}
