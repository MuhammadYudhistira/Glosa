import { createMiddleware, createStart } from "@tanstack/react-start"
import { isServerFailure, logServerError } from "@/server/monitoring"

// Server functions that throw instead of returning a failure code are reported
// here; caught failures go through logServerError where they happen.
const reportServerFnErrors = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    try {
      return await next()
    } catch (error) {
      if (isServerFailure(error))
        logServerError("server function failed", error)
      throw error
    }
  }
)

export const startInstance = createStart(() => ({
  functionMiddleware: [reportServerFnErrors],
}))
