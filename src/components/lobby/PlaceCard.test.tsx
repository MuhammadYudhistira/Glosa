import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PlaceCard } from "./PlaceCard"

function renderCard(onOpen = vi.fn()) {
  render(
    <PlaceCard
      name="Kilas balik"
      status="Rangkuman bacaanmu"
      statusId="status-1"
      onOpen={onOpen}
    />
  )
  return onOpen
}

describe("PlaceCard", () => {
  it("shows the place's name and its one line", () => {
    renderCard()
    const card = screen.getByRole("group", { name: "Tempat dipilih" })
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
})
