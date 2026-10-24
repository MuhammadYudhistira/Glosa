// @vitest-environment node
import { describe, expect, it } from "vitest"
import { isNetworkError } from "./network-error"

describe("isNetworkError", () => {
  it("recognises a fetch that got no response", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true)
    expect(
      isNetworkError(
        new TypeError("NetworkError when attempting to fetch resource.")
      )
    ).toBe(true)
    expect(isNetworkError(new TypeError("Load failed"))).toBe(true)
  })

  it("leaves other errors alone", () => {
    expect(isNetworkError(new TypeError("x is not a function"))).toBe(false)
    expect(isNetworkError(new Error("Failed to fetch"))).toBe(false)
  })
})
