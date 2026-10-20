import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  reportError,
  resetBrowserSentryForTests,
  setReportedUser,
  startBrowserSentry,
} from "./sentry-client"

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  setUser: vi.fn(),
}))
vi.mock("@sentry/react", () => sentry)

const config = {
  dsn: "https://key@o1.ingest.sentry.io/1",
  environment: "production",
  release: "abc123",
}

beforeEach(() => {
  resetBrowserSentryForTests()
  vi.clearAllMocks()
})

describe("browser Sentry", () => {
  it("stays off without a DSN", async () => {
    startBrowserSentry(null)
    reportError(new Error("boom"))
    await vi.dynamicImportSettled()
    expect(sentry.init).not.toHaveBeenCalled()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })

  it("starts once, without personal data or tracing", async () => {
    startBrowserSentry(config)
    startBrowserSentry(config)
    await vi.waitFor(() => expect(sentry.init).toHaveBeenCalledTimes(1))
    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: config.dsn,
        environment: "production",
        release: "abc123",
        dataCollection: expect.objectContaining({
          userInfo: false,
          cookies: false,
          httpHeaders: false,
        }),
        tracesSampleRate: 0,
      })
    )
  })

  it("reports errors and tags only the member id", async () => {
    startBrowserSentry(config)
    const error = new Error("boom")
    reportError(error)
    setReportedUser("user-1")
    setReportedUser(null)
    await vi.waitFor(() => expect(sentry.setUser).toHaveBeenCalledTimes(2))
    expect(sentry.captureException).toHaveBeenCalledWith(error)
    expect(sentry.setUser).toHaveBeenNthCalledWith(1, { id: "user-1" })
    expect(sentry.setUser).toHaveBeenNthCalledWith(2, null)
  })
})
