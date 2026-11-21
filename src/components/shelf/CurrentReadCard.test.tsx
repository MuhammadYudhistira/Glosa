import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { renderWithRouter } from "@/test/router"
import { sherlock } from "./fixtures"
import { CurrentReadCard } from "./CurrentReadCard"

describe("CurrentReadCard", () => {
  it("shows the book being read with its progress and a way back in", async () => {
    const onOpen = vi.fn()
    renderWithRouter(
      <CurrentReadCard book={sherlock} percentage={15} onOpen={onOpen} />,
      "/shelf"
    )
    const card = await screen.findByRole("region", { name: "Sedang dibaca" })
    expect(card).toHaveTextContent(sherlock.title)
    expect(card).toHaveTextContent(sherlock.author)
    expect(
      screen.getByRole("progressbar", { name: "Dibaca 15%" })
    ).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "Lanjutkan · 15%" })
    expect(link).toHaveAttribute("href", `/read/${sherlock.id}`)
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(sherlock.title) })
    )
    expect(onOpen).toHaveBeenCalledWith(sherlock)
  })
})
