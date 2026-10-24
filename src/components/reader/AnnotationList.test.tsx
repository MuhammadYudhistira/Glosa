import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Annotation } from "@/lib/annotations/types"
import { AnnotationList } from "./AnnotationList"

const base: Annotation = {
  id: "a",
  bookId: "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e",
  kind: "highlight",
  cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
  color: "green",
  note: "Penting",
  excerpt: "To Sherlock Holmes",
  createdAt: "2026-10-24T08:00:00.000Z",
  updatedAt: "2026-10-24T08:00:00.000Z",
  deletedAt: null,
}
const later: Annotation = {
  ...base,
  id: "b",
  kind: "bookmark",
  cfi: "epubcfi(/6/8!/4/2/1:0)",
  color: null,
  note: "",
  excerpt: "Chapter two begins",
}

describe("AnnotationList", () => {
  it("lists annotations in book order with their chapters", async () => {
    const chaptersOf = vi.fn(async (cfis: ReadonlyArray<string>) =>
      cfis.map((cfi) => (cfi.includes("/6/4!") ? "Bab Satu" : null))
    )
    render(
      <AnnotationList
        annotations={[later, base]}
        chaptersOf={chaptersOf}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    const items = screen.getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("To Sherlock Holmes")
    expect(items[0]).toHaveTextContent("Penting")
    expect(items[1]).toHaveTextContent("Bookmark")
    expect(await within(items[0]).findByText(/Bab Satu/)).toBeInTheDocument()
  })

  it("goes to an annotation and deletes one", () => {
    const onSelect = vi.fn()
    const onDelete = vi.fn()
    render(
      <AnnotationList
        annotations={[base]}
        chaptersOf={null}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /To Sherlock Holmes/ }))
    expect(onSelect).toHaveBeenCalledWith(base.cfi)
    fireEvent.click(screen.getByRole("button", { name: "Hapus anotasi" }))
    expect(onDelete).toHaveBeenCalledWith(base)
  })

  it("says how to make one when there are none", () => {
    render(
      <AnnotationList
        annotations={[]}
        chaptersOf={null}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText(/Belum ada anotasi/)).toBeInTheDocument()
  })
})
