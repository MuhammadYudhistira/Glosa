import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "./fixtures"
import { BookGrid } from "./BookGrid"

const local = {
  saved: new Set<string>(),
  percentages: new Map<string, number>(),
}

describe("BookGrid", () => {
  it("marks finished books on the cover and shows progress for the rest", () => {
    const done = {
      ...sherlock,
      id: "done",
      title: "Buku Tamat",
      finishedAt: "2026-11-01T00:00:00Z",
    }
    const reading = {
      ...sherlock,
      id: "reading",
      title: "Masih Dibaca",
      progress: 40,
    }
    render(<BookGrid books={[done, reading]} local={local} onOpen={vi.fn()} />)
    const finished = screen.getByRole("button", { name: /Buku Tamat/ })
    expect(finished).toHaveTextContent("Selesai")
    expect(
      screen.getByRole("progressbar", { name: /Dibaca 40/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Masih Dibaca/ })
    ).not.toHaveTextContent(/Selesai/)
  })
})
