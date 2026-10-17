import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { JumpOffer } from "./JumpOffer"

const offer = {
  cfi: "epubcfi(/6/8!/4/2)",
  percentage: 45.6,
  updatedAt: "2026-10-17T09:00:00.000Z",
}

describe("JumpOffer", () => {
  it("offers the other device's place without jumping by itself", () => {
    const onJump = vi.fn()
    const onDismiss = vi.fn()
    render(<JumpOffer offer={offer} onJump={onJump} onDismiss={onDismiss} />)

    expect(
      screen.getByText("Lanjutkan dari 45% (dibaca di perangkat lain)?")
    ).toBeInTheDocument()
    expect(onJump).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Lompat" }))
    expect(onJump).toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Abaikan" }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it("renders nothing without an offer", () => {
    const { container } = render(
      <JumpOffer
        offer={null}
        onJump={() => undefined}
        onDismiss={() => undefined}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
