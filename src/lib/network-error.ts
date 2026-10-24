/** The messages browsers give when a fetch fails for lack of a connection. */
export const NETWORK_ERROR_MESSAGES = [
  "Failed to fetch",
  "NetworkError",
  "Load failed",
] as const

/** True for a TypeError from a fetch that never got a response. */
export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    NETWORK_ERROR_MESSAGES.some((message) => error.message.includes(message))
  )
}
