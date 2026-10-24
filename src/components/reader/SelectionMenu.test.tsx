import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SelectionMenu, type TextSelection } from "./SelectionMenu"

const selection: TextSelection = {
  cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
  text: "To Sherlock",
  rect: { left: 100, top: 100, width: 50, height: 20 },
}

describe("SelectionMenu", () => {
  it("offers Highlight, Catatan and Salin", async () => {
    const actions = {
      onHighlight: vi.fn(),
      onNote: vi.fn(),
      onCopy: vi.fn(),
      onClose: vi.fn(),
    }
    render(<SelectionMenu selection={selection} {...actions} />)
    await screen.findByRole("dialog", { name: "Teks terpilih" })
    fireEvent.click(screen.getByRole("button", { name: "Highlight" }))
    fireEvent.click(screen.getByRole("button", { name: "Catatan" }))
    fireEvent.click(screen.getByRole("button", { name: "Salin" }))
    expect(actions.onHighlight).toHaveBeenCalledTimes(1)
    expect(actions.onNote).toHaveBeenCalledTimes(1)
    expect(actions.onCopy).toHaveBeenCalledTimes(1)
  })

  it("shows nothing without a selection", () => {
    render(
      <SelectionMenu
        selection={null}
        onHighlight={vi.fn()}
        onNote={vi.fn()}
        onCopy={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
