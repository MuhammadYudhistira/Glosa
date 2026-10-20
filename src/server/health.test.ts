// @vitest-environment node
import { describe, expect, it } from "vitest"
import { healthResponse } from "./health"

describe("healthResponse", () => {
  it("reports ok with the running version and is never cached", async () => {
    const response = healthResponse("abc123")
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({ status: "ok", version: "abc123" })
  })

  it("says dev when no version was baked in", async () => {
    expect(await healthResponse(undefined).json()).toEqual({
      status: "ok",
      version: "dev",
    })
    expect(await healthResponse("").json()).toEqual({
      status: "ok",
      version: "dev",
    })
  })
})
