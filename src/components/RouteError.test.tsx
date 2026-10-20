import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RouteError } from "./RouteError"

const report = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sentry-client", () => ({ reportError: report }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

describe("RouteError", () => {
  it("reports the error it shows", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const error = new Error("boom")
    render(<RouteError error={error} />)
    expect(report).toHaveBeenCalledWith(error)
  })
})
