import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { NoteBubble } from "./NoteBubble"

describe("NoteBubble", () => {
  it("is a polite status by default, with no character title", () => {
    render(<NoteBubble>Selamat datang kembali!</NoteBubble>)
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("Selamat datang kembali!")
    expect(status).not.toHaveTextContent("Petugas")
  })

  it("becomes an alert for errors", () => {
    render(<NoteBubble tone="error">Kata sandinya belum cocok.</NoteBubble>)
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kata sandinya belum cocok."
    )
  })
})
