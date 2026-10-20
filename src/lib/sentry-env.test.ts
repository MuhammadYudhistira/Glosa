import { describe, expect, it } from "vitest"
import { readSentryEnv, sentryHeadScripts } from "./sentry-env"

const DSN = "https://key@o1.ingest.sentry.io/1"

describe("readSentryEnv", () => {
  it("is off without a DSN", () => {
    expect(readSentryEnv({})).toBeNull()
    expect(readSentryEnv({ SENTRY_DSN: "  " })).toBeNull()
  })

  it("takes the environment and the baked-in version", () => {
    expect(
      readSentryEnv({
        SENTRY_DSN: DSN,
        SENTRY_ENVIRONMENT: "staging",
        APP_VERSION: "abc123",
      })
    ).toEqual({ dsn: DSN, environment: "staging", release: "abc123" })
  })

  it("defaults to production and dev", () => {
    expect(readSentryEnv({ SENTRY_DSN: DSN })).toEqual({
      dsn: DSN,
      environment: "production",
      release: "dev",
    })
  })
})

describe("sentryHeadScripts", () => {
  it("adds no script without a DSN", () => {
    expect(sentryHeadScripts(null)).toEqual([])
  })

  it("hands the settings to the browser and cannot close the script tag", () => {
    const [script] = sentryHeadScripts({
      dsn: DSN,
      environment: "</script>",
      release: "abc123",
    })
    expect(script.children.startsWith("window.__GLOSA_SENTRY__=")).toBe(true)
    expect(script.children).not.toContain("</script>")
    const json = script.children.slice("window.__GLOSA_SENTRY__=".length)
    expect(JSON.parse(json)).toEqual({
      dsn: DSN,
      environment: "</script>",
      release: "abc123",
    })
  })
})
