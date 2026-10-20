import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LinkFailed } from "./LinkFailed"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))

describe("LinkFailed", () => {
  it("says sign-in was cancelled for an OAuth code, without a new-letter link", () => {
    render(<LinkFailed code="access_denied" />)
    expect(
      screen.getByRole("heading", { name: "Masuk dibatalkan" })
    ).toBeInTheDocument()
    expect(screen.queryByText("Minta surat baru")).toBeNull()
    expect(screen.getByText("Ke buku tamu")).toBeInTheDocument()
  })

  it("keeps the e-mail link wording and the new-letter link", () => {
    render(<LinkFailed code="otp_expired" />)
    expect(
      screen.getByRole("heading", { name: "Tautan tidak berlaku" })
    ).toBeInTheDocument()
    expect(screen.getByText("Minta surat baru")).toBeInTheDocument()
  })

  it("says signups are closed, without a new-letter link", () => {
    render(<LinkFailed code="signups_closed" />)
    expect(
      screen.getByRole("heading", { name: "Pendaftaran masih tertutup" })
    ).toBeInTheDocument()
    expect(screen.getByText(/uji coba tertutup/)).toBeInTheDocument()
    expect(screen.queryByText("Minta surat baru")).toBeNull()
  })
})
