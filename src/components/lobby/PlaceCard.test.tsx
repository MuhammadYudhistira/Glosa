import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PlaceCard } from "./PlaceCard"

function renderCard(
  onOpen = vi.fn(),
  more: Partial<Parameters<typeof PlaceCard>[0]> = {}
) {
  render(
    <PlaceCard
      name="Kilas balik"
      status="Rangkuman bacaanmu"
      statusId="status-1"
      onOpen={onOpen}
      {...more}
    />
  )
  return onOpen
}

describe("PlaceCard", () => {
  it("shows the place's name and its one line", () => {
    renderCard()
    // Named by the place itself (its name element), not a fixed label.
    const card = screen.getByRole("group", { name: "Kilas balik" })
    expect(card).toHaveTextContent("Kilas balik")
    expect(screen.getByText("Rangkuman bacaanmu")).toHaveAttribute(
      "id",
      "status-1"
    )
  })

  it("opens the place from Buka, telling a click from a key press", () => {
    const onOpen = renderCard()
    const open = screen.getByRole("button", { name: "Buka" })
    fireEvent.click(open, { detail: 1 })
    expect(onOpen).toHaveBeenLastCalledWith({ keyboard: false })
    fireEvent.click(open, { detail: 0 })
    expect(onOpen).toHaveBeenLastCalledWith({ keyboard: true })
  })

  it("closes on Escape, and says where the focus went when it leaves the card", () => {
    const onClose = vi.fn()
    const onLeave = vi.fn()
    renderCard(vi.fn(), { onClose, onLeave })
    const open = screen.getByRole("button", { name: "Buka" })
    open.focus()
    fireEvent.keyDown(open, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
    open.blur()
    expect(onLeave).toHaveBeenCalledWith(null)
  })
})
