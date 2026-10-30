import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ReaderBack } from "./ReaderBack"

describe("ReaderBack", () => {
  it("shows only after a jump", () => {
    render(<ReaderBack shown={false} onBack={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "Kembali" })).toBeNull()
  })

  it("goes back when pressed", () => {
    const onBack = vi.fn()
    render(<ReaderBack shown onBack={onBack} />)
    fireEvent.click(screen.getByRole("button", { name: "Kembali" }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
