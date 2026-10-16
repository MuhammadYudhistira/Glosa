import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { GoogleButton } from "./GoogleButton"

const { googleSignInFn } = vi.hoisted(() => ({
  googleSignInFn: vi.fn(),
}))

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}))
vi.mock("@/server/auth", () => ({ googleSignInFn }))

describe("GoogleButton", () => {
  it("recovers and shows an error when the server call throws", async () => {
    googleSignInFn.mockRejectedValueOnce(new Error("network down"))
    render(<GoogleButton label="Masuk dengan Google" />)
    const button = screen.getByRole("button", { name: "Masuk dengan Google" })

    fireEvent.click(button)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Login Google belum bisa dipakai"
    )
    expect(button).toBeEnabled()
  })

  it("stays disabled and does not call the server while disabled", () => {
    googleSignInFn.mockClear()
    render(<GoogleButton label="Daftar dengan Google" disabled />)
    const button = screen.getByRole("button", { name: "Daftar dengan Google" })

    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(googleSignInFn).not.toHaveBeenCalled()
  })
})
