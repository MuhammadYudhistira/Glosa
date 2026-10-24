import { fireEvent, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { SavedWord } from "@/lib/words/types"
import { renderWithRouter } from "@/test/router"
import { VocabularyList } from "./VocabularyList"

const cfi = "epubcfi(/6/4!/4/2/1:0)"
const run: SavedWord = {
  headword: "run",
  pos: "verb",
  meanings: ["berlari", "menjalankan", "mengelola", "mencalonkan"],
  bookId: "b1",
  bookTitle: "The Adventures of Sherlock Holmes",
  sentence: "He ran to the door.",
  cfi,
  createdAt: "2026-10-24T08:00:00.000Z",
}
const walk: SavedWord = {
  ...run,
  headword: "walk",
  meanings: ["berjalan"],
  bookId: "b2",
  bookTitle: "Alice",
  sentence: "",
}

function show(
  words: Array<SavedWord>,
  shelfIds: ReadonlySet<string> = new Set(["b1", "b2"])
) {
  const onDelete = vi.fn()
  renderWithRouter(
    <VocabularyList
      words={words}
      forms={{ run: ["run", "ran"], walk: ["walk"] }}
      shelfIds={shelfIds}
      onDelete={onDelete}
    />
  )
  return onDelete
}

const card = (headword: string) =>
  screen.findByRole("article", { name: headword })

describe("VocabularyList", () => {
  it("says how words get here while there are none", async () => {
    show([])
    expect(
      await screen.findByText(
        "Ketuk kata yang sulit saat membaca, lalu simpan. Kata itu akan muncul di sini."
      )
    ).toBeInTheDocument()
  })

  it("shows the word, its first three meanings, its sentence and its book", async () => {
    show([run])
    const item = await card("run")
    expect(within(item).getByText("kata kerja")).toBeInTheDocument()
    expect(
      within(item).getByText("berlari, menjalankan, mengelola")
    ).toBeInTheDocument()
    expect(within(item).getByText("ran").tagName).toBe("B")
    expect(
      within(item).getByText("The Adventures of Sherlock Holmes")
    ).toBeInTheDocument()
    expect(
      within(item).getByRole("link", { name: "Buka di buku" })
    ).toHaveAttribute("href", expect.stringContaining("/read/b1?cfi="))
  })

  it("leaves out Buka di buku once the book or the place is gone", async () => {
    show([run, { ...walk, cfi: null }], new Set(["b2"]))
    expect(
      within(await card("run")).queryByRole("link", { name: "Buka di buku" })
    ).toBeNull()
    expect(
      within(await card("walk")).queryByRole("link", { name: "Buka di buku" })
    ).toBeNull()
  })

  it("searches the words and filters them by book", async () => {
    show([run, walk])
    fireEvent.change(await screen.findByLabelText("Cari kata"), {
      target: { value: "berjalan" },
    })
    expect(screen.queryByRole("article", { name: "run" })).toBeNull()
    expect(await card("walk")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Cari kata"), {
      target: { value: "" },
    })
    fireEvent.change(screen.getByLabelText("Buku"), { target: { value: "b1" } })
    expect(await card("run")).toBeInTheDocument()
    expect(screen.queryByRole("article", { name: "walk" })).toBeNull()
  })

  it("deletes a word", async () => {
    const onDelete = show([run])
    fireEvent.click(
      within(await card("run")).getByRole("button", { name: "Hapus run" })
    )
    expect(onDelete).toHaveBeenCalledWith(run)
  })
})
