import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import { renderWithRouter } from "@/test/router"
import { RecentBooks } from "./RecentBooks"

const local = {
  saved: new Set<string>(),
  percentages: new Map([[sherlock.id, 46]]),
}

describe("RecentBooks", () => {
  it("lists the books opened last with their progress", async () => {
    const onSelect = vi.fn()
    renderWithRouter(
      <RecentBooks books={[sherlock]} local={local} onSelect={onSelect} />
    )
    expect(
      await screen.findByRole("heading", { name: "Baru Dibuka" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("progressbar", { name: `Progres ${sherlock.title}` })
    ).toHaveAttribute("value", "46")
    fireEvent.click(screen.getByRole("button", { name: sherlock.title }))
    expect(onSelect).toHaveBeenCalledWith(sherlock)
  })

  it("leads to the whole shelf", async () => {
    renderWithRouter(
      <RecentBooks books={[sherlock]} local={local} onSelect={vi.fn()} />
    )
    expect(
      await screen.findByRole("link", { name: "Lihat semua di Rak Saya →" })
    ).toHaveAttribute("href", "/shelf")
  })

  it("shows nothing before any book was opened", async () => {
    const { container } = renderWithRouter(
      <RecentBooks books={[]} local={local} onSelect={vi.fn()} />
    )
    await Promise.resolve()
    expect(container.querySelector(".lobby-panel")).toBeNull()
    expect(screen.queryByText("Baru Dibuka")).toBeNull()
  })
})
