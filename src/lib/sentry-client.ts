import type * as SentryReact from "@sentry/react"
import { NETWORK_ERROR_MESSAGES } from "./network-error"
import { SENTRY_DATA_COLLECTION, type SentryConfig } from "./sentry-env"

type BrowserSentry = typeof SentryReact

let sentry: Promise<BrowserSentry | null> | null = null

/** Loads and starts browser error reporting, only when the server sent a DSN. */
export function startBrowserSentry(config: SentryConfig | null): void {
  if (!config || sentry) return
  sentry = import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn: config.dsn,
        environment: config.environment,
        release: config.release,
        dataCollection: SENTRY_DATA_COLLECTION,
        tracesSampleRate: 0,
        // Losing the connection is expected in an offline-first app.
        ignoreErrors: [...NETWORK_ERROR_MESSAGES],
      })
      return Sentry
    })
    .catch(() => null)
}

/** Reports an unexpected error; does nothing while Sentry is off. */
export function reportError(error: unknown): void {
  void sentry?.then((Sentry) => Sentry?.captureException(error))
}

/** Tags later reports with the member's id only, never their email. */
export function setReportedUser(id: string | null): void {
  void sentry?.then((Sentry) => Sentry?.setUser(id ? { id } : null))
}

export function resetBrowserSentryForTests(): void {
  sentry = null
}
