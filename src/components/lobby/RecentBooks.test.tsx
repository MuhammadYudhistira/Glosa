import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import { RecentBooks } from "./RecentBooks"

const local = {
  saved: new Set<string>(),
  percentages: new Map([[sherlock.id, 46]]),
}

describe("RecentBooks", () => {
  it("lists the books opened last with their progress", () => {
    const onSelect = vi.fn()
    render(<RecentBooks books={[sherlock]} local={local} onSelect={onSelect} />)
    expect(
      screen.getByRole("heading", { name: "Baru Dibuka" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("progressbar", { name: `Progres ${sherlock.title}` })
    ).toHaveAttribute("value", "46")
    fireEvent.click(screen.getByRole("button", { name: sherlock.title }))
    expect(onSelect).toHaveBeenCalledWith(sherlock)
  })

  it("shows nothing before any book was opened", () => {
    const { container } = render(
      <RecentBooks books={[]} local={local} onSelect={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
