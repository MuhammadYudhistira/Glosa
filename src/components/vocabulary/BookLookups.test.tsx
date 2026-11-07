import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { BookLookups } from "./BookLookups"

const server = vi.hoisted(() => ({ loadBookVocabFn: vi.fn() }))
vi.mock("@/server/vocab", () => server)
const lookup = vi.hoisted(() => ({ lookUp: vi.fn() }))
vi.mock("@/lib/words/lookup", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  lookUp: lookup.lookUp,
}))
const sync = vi.hoisted(() => ({ save: vi.fn(() => Promise.resolve()) }))
vi.mock("@/lib/words/word-sync-client", () => ({ wordSync: () => sync }))

const BOOK = "00000000-0000-4000-8000-000000000001"
const answer = {
  ok: true,
  vocab: {
    read: 850,
    lookedUp: 2,
    words: [
      { word: "ubiquitous", taps: 3, lastAt: "2026-11-06T10:00:00Z" },
      { word: "mat", taps: 1, lastAt: "2026-11-05T10:00:00Z" },
    ],
  },
}

const show = (props: Partial<Parameters<typeof BookLookups>[0]> = {}) =>
  render(
    <BookLookups
      bookId={BOOK}
      title="Sherlock"
      forms={{ mat: ["mat"], run: ["run", "ran"] }}
      offline={false}
      {...props}
    />
  )

describe("BookLookups", () => {
  it("lists the words looked up in the book, the saved ones marked", async () => {
    server.loadBookVocabFn.mockResolvedValue(answer)
    show()
    expect(
      await screen.findByRole("heading", { name: "Kata di Sherlock" })
    ).toBeVisible()
    expect(
      screen.getByText("Paham 99% kata tanpa kamus · 2 kata dicari")
    ).toBeVisible()
    const list = screen.getByRole("list", { name: "Dicari di buku ini" })
    const rows = within(list).getAllByRole("listitem")
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("ubiquitous"),
      expect.stringContaining("mat"),
    ])
    expect(within(rows[0]).getByText("diketuk 3×")).toBeVisible()
    expect(within(rows[1]).getByText("Tersimpan")).toBeVisible()
  })

  it("opens a meaning and saves the word", async () => {
    server.loadBookVocabFn.mockResolvedValue(answer)
    lookup.lookUp.mockResolvedValue({
      kind: "result",
      result: {
        word: "ubiquitous",
        entries: [
          {
            headword: "ubiquitous",
            pos: "adj",
            meanings: ["ada di mana-mana"],
          },
        ],
        phrases: [],
        version: null,
      },
    })
    show()
    fireEvent.click(await screen.findByRole("button", { name: /ubiquitous/ }))
    expect(await screen.findByText("ada di mana-mana")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }))
    await waitFor(() =>
      expect(sync.save).toHaveBeenCalledWith(
        expect.objectContaining({
          headword: "ubiquitous",
          pos: "adj",
          meanings: ["ada di mana-mana"],
          bookId: BOOK,
          bookTitle: "Sherlock",
          sentence: "",
          cfi: null,
        }),
        ["ubiquitous"]
      )
    )
  })

  it("needs a connection", () => {
    show({ offline: true })
    expect(screen.getByText("Perlu koneksi internet")).toBeVisible()
    expect(server.loadBookVocabFn).not.toHaveBeenCalled()
  })

  it("marks a tapped inflection as saved through the forms of the saved word", async () => {
    server.loadBookVocabFn.mockResolvedValue({
      ok: true,
      vocab: {
        read: 850,
        lookedUp: 1,
        words: [{ word: "ran", taps: 2, lastAt: "2026-11-06T10:00:00Z" }],
      },
    })
    show()
    const row = (await screen.findByRole("button", { name: /ran/ })).closest(
      "li"
    ) as HTMLElement
    expect(within(row).getByText("Tersimpan")).toBeVisible()
  })

  it("ignores a meaning that arrives after another row was opened", async () => {
    server.loadBookVocabFn.mockResolvedValue(answer)
    const result = (headword: string, meaning: string) => ({
      kind: "result",
      result: {
        word: headword,
        entries: [{ headword, pos: "adj", meanings: [meaning] }],
        phrases: [],
        version: null,
      },
    })
    let late: (value: unknown) => void = () => {}
    lookup.lookUp.mockImplementation((word: string) =>
      word === "ubiquitous"
        ? new Promise((resolve) => {
            late = resolve
          })
        : Promise.resolve(result("mat", "tikar"))
    )
    show()
    fireEvent.click(await screen.findByRole("button", { name: /ubiquitous/ }))
    fireEvent.click(screen.getByRole("button", { name: /mat/ }))
    expect(await screen.findByText("tikar")).toBeVisible()
    late(result("ubiquitous", "ada di mana-mana"))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByText("tikar")).toBeVisible()
    expect(screen.queryByText("ada di mana-mana")).toBeNull()
  })

  it("saves the choice the reader would keep, the phrase first", async () => {
    server.loadBookVocabFn.mockResolvedValue(answer)
    lookup.lookUp.mockResolvedValue({
      kind: "result",
      result: {
        word: "ubiquitous",
        entries: [{ headword: "ubiquitous", pos: "adj", meanings: ["x"] }],
        phrases: [{ headword: "ubiquitous thing", meanings: ["barang"] }],
        version: null,
      },
    })
    show()
    fireEvent.click(await screen.findByRole("button", { name: /ubiquitous/ }))
    await screen.findByText("x")
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }))
    await waitFor(() =>
      expect(sync.save).toHaveBeenCalledWith(
        expect.objectContaining({
          headword: "ubiquitous thing",
          pos: "phrase",
          meanings: ["barang"],
        }),
        ["ubiquitous"]
      )
    )
  })
})
