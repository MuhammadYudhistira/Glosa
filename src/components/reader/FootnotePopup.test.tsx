import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FootnotePopup } from "./FootnotePopup"

const rect = { left: 100, top: 200, width: 10, height: 16 }

describe("FootnotePopup", () => {
  it("shows nothing without a note", () => {
    render(
      <FootnotePopup note={null} onClose={vi.fn()} finalFocus={() => null} />
    )
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("shows the note's paragraphs and closes with Escape", async () => {
    const onClose = vi.fn()
    render(
      <FootnotePopup
        note={{ paragraphs: ["Satu dua.", "Tiga."], rect }}
        onClose={onClose}
        finalFocus={() => null}
      />
    )
    const dialog = await screen.findByRole("dialog", { name: "Catatan kaki" })
    expect(dialog).toHaveTextContent("Satu dua.")
    expect(dialog).toHaveTextContent("Tiga.")
    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })
})
