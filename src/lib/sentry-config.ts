import { createIsomorphicFn } from "@tanstack/react-start"
import { type SentryConfig, readSentryEnv } from "./sentry-env"

declare global {
  interface Window {
    __GLOSA_SENTRY__?: SentryConfig
  }
}

/**
 * The server reads its environment; the browser reads what the server injected
 * into the page head, so one image serves every environment (spec 1E §7).
 */
export const sentryConfig = createIsomorphicFn()
  .server((): SentryConfig | null => readSentryEnv(process.env))
  .client((): SentryConfig | null => window.__GLOSA_SENTRY__ ?? null)
