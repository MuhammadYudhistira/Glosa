export type SentryConfig = { dsn: string; environment: string; release: string }

/** Sentry settings from the server's environment; null keeps Sentry off (spec 1E §7). */
export function readSentryEnv(
  env: Record<string, string | undefined>
): SentryConfig | null {
  const dsn = env.SENTRY_DSN?.trim()
  if (!dsn) return null
  return {
    dsn,
    environment: env.SENTRY_ENVIRONMENT?.trim() || "production",
    release: env.APP_VERSION?.trim() || "dev",
  }
}

/**
 * What Sentry may collect about a member: nothing beyond the id Glosa sets
 * itself (spec 1E §7). Sentry 11 has no sendDefaultPii and collects all of
 * this unless told otherwise; userInfo off also keeps IP addresses out.
 */
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  stackFrameVariables: false,
}

/** Inline script handing the browser its Sentry settings; none without a DSN. */
export function sentryHeadScripts(
  config: SentryConfig | null
): Array<{ children: string }> {
  if (!config) return []
  // "<" is escaped so no value can ever close the script element.
  const json = JSON.stringify(config).replace(/</g, "\\u003c")
  return [{ children: `window.__GLOSA_SENTRY__=${json}` }]
}
