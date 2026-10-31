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
        onShare={vi.fn()}
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
        onShare={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /^Highlight/ }))
    expect(onSelect).toHaveBeenCalledWith(base.cfi)
    fireEvent.click(
      screen.getByRole("button", {
        name: 'Hapus highlight "To Sherlock Holmes"',
      })
    )
    expect(onDelete).toHaveBeenCalledWith(base)
  })

  it("gives each delete button its own name, with the excerpt shortened", () => {
    const long: Annotation = {
      ...base,
      id: "c",
      excerpt: "A very long excerpt that goes on well past the limit",
    }
    render(
      <AnnotationList
        annotations={[later, long]}
        chaptersOf={null}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
      />
    )
    expect(
      screen.getByRole("button", {
        name: 'Hapus bookmark "Chapter two begins"',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: 'Hapus highlight "A very long excerpt that…"',
      })
    ).toBeInTheDocument()
  })

  it("says how to make one when there are none", () => {
    render(
      <AnnotationList
        annotations={[]}
        chaptersOf={null}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
      />
    )
    expect(screen.getByText(/Belum ada anotasi/)).toBeInTheDocument()
  })

  it("offers no sharing for a highlight without words", () => {
    render(
      <AnnotationList
        annotations={[{ ...base, excerpt: " — … " }]}
        chaptersOf={null}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
      />
    )
    expect(screen.queryByRole("button", { name: /^Bagikan/ })).toBeNull()
  })

  it("shares a highlight, and offers no sharing for a bookmark", () => {
    const onShare = vi.fn()
    render(
      <AnnotationList
        annotations={[base, later]}
        chaptersOf={null}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onShare={onShare}
      />
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: 'Bagikan highlight "To Sherlock Holmes"',
      })
    )
    expect(onShare).toHaveBeenCalledWith(base)
    expect(
      screen.queryByRole("button", { name: /^Bagikan bookmark/ })
    ).toBeNull()
  })
})
