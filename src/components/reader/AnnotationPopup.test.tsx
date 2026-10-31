import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Annotation } from "@/lib/annotations/types"
import { stubWideScreen, unstubWideScreen } from "@/test/media"
import { AnnotationPopup, type HighlightTap } from "./AnnotationPopup"

const annotation: Annotation = {
  id: "8b1f7c2e-4a5d-4c3b-9e2f-1a2b3c4d5e6f",
  bookId: "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e",
  kind: "highlight",
  cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
  color: "yellow",
  note: "Penting untuk bab 2",
  excerpt: "To Sherlock",
  createdAt: "2026-10-24T08:00:00.000Z",
  updatedAt: "2026-10-24T08:00:00.000Z",
  deletedAt: null,
}
const rect = { left: 100, top: 100, width: 50, height: 20 }
const tap: HighlightTap = {
  cfi: annotation.cfi,
  rect,
  word: {
    word: "sherlock",
    sentence: "To Sherlock.",
    next: [],
    cfi: null,
    rect,
  },
}

function show(extra: Partial<Parameters<typeof AnnotationPopup>[0]> = {}) {
  const props = {
    onShare: vi.fn(),
    tap,
    annotation,
    onColor: vi.fn(),
    onNote: vi.fn(),
    onDelete: vi.fn(),
    onMeaning: vi.fn(),
    onClose: vi.fn(),
    finalFocus: () => null,
    ...extra,
  }
  render(<AnnotationPopup {...props} />)
  return props
}

beforeEach(() => stubWideScreen(true))
afterEach(() => unstubWideScreen())

describe("AnnotationPopup", () => {
  it("shows the colours, the note and what can be done", async () => {
    const props = show()
    await screen.findByRole("dialog", { name: "Highlight" })
    expect(screen.getByText("Penting untuk bab 2")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Kuning" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    fireEvent.click(screen.getByRole("button", { name: "Hijau" }))
    expect(props.onColor).toHaveBeenCalledWith("green")
    fireEvent.click(screen.getByRole("button", { name: "Catatan" }))
    expect(props.onNote).toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Hapus" }))
    expect(props.onDelete).toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: 'Arti "sherlock"' }))
    expect(props.onMeaning).toHaveBeenCalled()
  })

  it("has no meaning button when no word was tapped", async () => {
    show({ tap: { ...tap, word: null } })
    await screen.findByRole("dialog", { name: "Highlight" })
    expect(screen.queryByRole("button", { name: /^Arti/ })).toBeNull()
  })

  it("shows nothing once the highlight is gone", () => {
    show({ annotation: null })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("shares the highlight", async () => {
    const props = show()
    await screen.findByRole("dialog", { name: "Highlight" })
    fireEvent.click(screen.getByRole("button", { name: "Bagikan" }))
    expect(props.onShare).toHaveBeenCalledTimes(1)
  })
})
