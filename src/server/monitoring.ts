import { isNotFound, isRedirect } from "@tanstack/react-router"
import type * as SentryNode from "@sentry/node"
import { SENTRY_DATA_COLLECTION, readSentryEnv } from "@/lib/sentry-env"

type NodeSentry = typeof SentryNode

let sentry: Promise<NodeSentry | null> | undefined

async function startServerSentry(): Promise<NodeSentry | null> {
  const config = readSentryEnv(process.env)
  if (!config) return null
  try {
    const Sentry = await import("@sentry/node")
    Sentry.init({
      ...config,
      dataCollection: SENTRY_DATA_COLLECTION,
      tracesSampleRate: 0,
    })
    return Sentry
  } catch (error) {
    console.error("starting Sentry failed", error)
    return null
  }
}

function serverSentry(): Promise<NodeSentry | null> {
  sentry ??= startServerSentry()
  return sentry
}

/** Logs an unexpected server failure and reports it when Sentry is on (spec 1E §7). */
export function logServerError(message: string, error: unknown): void {
  console.error(message, error)
  void serverSentry().then((Sentry) =>
    Sentry?.captureException(error, { extra: { message } })
  )
}

/** Waits for queued reports; call before a short-lived process exits. */
export async function flushServerErrors(timeoutMs = 2000): Promise<void> {
  const Sentry = await serverSentry()
  await Sentry?.flush(timeoutMs)
}

/** Redirects and not-found are control flow, not failures. */
export function isServerFailure(error: unknown): boolean {
  return !isRedirect(error) && !isNotFound(error)
}

export function resetServerSentryForTests(): void {
  sentry = undefined
}
