import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Annotation } from "@/lib/annotations/types"
import { stubWideScreen, unstubWideScreen } from "@/test/media"
import { NoteEditor } from "./NoteEditor"

const annotation: Annotation = {
  id: "8b1f7c2e-4a5d-4c3b-9e2f-1a2b3c4d5e6f",
  bookId: "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e",
  kind: "highlight",
  cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
  color: "yellow",
  note: "Lama",
  excerpt: "To Sherlock",
  createdAt: "2026-10-24T08:00:00.000Z",
  updatedAt: "2026-10-24T08:00:00.000Z",
  deletedAt: null,
}

afterEach(() => unstubWideScreen())

describe.each([true, false])("NoteEditor (wide: %s)", (wide) => {
  beforeEach(() => stubWideScreen(wide))

  it("starts from the note and gives the text back on Selesai", async () => {
    const onClose = vi.fn()
    render(
      <NoteEditor
        annotation={annotation}
        onClose={onClose}
        finalFocus={() => null}
      />
    )
    await screen.findByRole("dialog", { name: "Catatan" })
    const box = screen.getByRole("textbox", { name: "Isi catatan" })
    expect(box).toHaveValue("Lama")
    expect(screen.getByText("To Sherlock")).toBeInTheDocument()
    fireEvent.change(box, { target: { value: "Baru" } })
    fireEvent.click(screen.getByRole("button", { name: "Selesai" }))
    expect(onClose).toHaveBeenCalledWith("Baru")
  })

  it("gives the text back on Escape too", async () => {
    const onClose = vi.fn()
    render(
      <NoteEditor
        annotation={annotation}
        onClose={onClose}
        finalFocus={() => null}
      />
    )
    const box = await screen.findByRole("textbox", { name: "Isi catatan" })
    fireEvent.change(box, { target: { value: "" } })
    fireEvent.keyDown(box, { key: "Escape" })
    expect(onClose).toHaveBeenCalledWith("")
  })
})
