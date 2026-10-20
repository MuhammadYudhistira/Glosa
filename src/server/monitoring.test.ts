// @vitest-environment node
import { notFound, redirect } from "@tanstack/react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  flushServerErrors,
  isServerFailure,
  logServerError,
  resetServerSentryForTests,
} from "./monitoring"

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  flush: vi.fn(() => Promise.resolve(true)),
}))
vi.mock("@sentry/node", () => sentry)

beforeEach(() => {
  resetServerSentryForTests()
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("logServerError", () => {
  it("only logs while Sentry is off", async () => {
    vi.stubEnv("SENTRY_DSN", "")
    const error = new Error("boom")
    logServerError("lookup failed", error)
    await flushServerErrors()
    expect(console.error).toHaveBeenCalledWith("lookup failed", error)
    expect(sentry.init).not.toHaveBeenCalled()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })

  it("logs and reports with the message, without personal data", async () => {
    vi.stubEnv("SENTRY_DSN", "https://key@o1.ingest.sentry.io/1")
    vi.stubEnv("APP_VERSION", "abc123")
    const error = new Error("boom")
    logServerError("lookup failed", error)
    await flushServerErrors()
    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        release: "abc123",
        dataCollection: expect.objectContaining({
          userInfo: false,
          cookies: false,
          httpHeaders: false,
        }),
        tracesSampleRate: 0,
      })
    )
    expect(sentry.captureException).toHaveBeenCalledWith(error, {
      extra: { message: "lookup failed" },
    })
    expect(sentry.flush).toHaveBeenCalled()
  })
})

describe("isServerFailure", () => {
  it("ignores redirects and not-found, which are control flow", () => {
    expect(isServerFailure(redirect({ href: "/" }))).toBe(false)
    expect(isServerFailure(notFound())).toBe(false)
    expect(isServerFailure(new Error("boom"))).toBe(true)
  })
})
