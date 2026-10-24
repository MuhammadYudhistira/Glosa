import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { LookupResult } from "@/lib/words/types"
import { stubWideScreen, unstubWideScreen } from "@/test/media"
import { type WordTap, WordPopup } from "./WordPopup"
import type { WordLookupState } from "./useWordLookup"

const tap: WordTap = {
  word: "running",
  sentence: "He was running.",
  next: [],
  cfi: null,
  rect: { left: 100, top: 100, width: 50, height: 20 },
}
const result: LookupResult = {
  word: "running",
  entries: [
    { headword: "run", pos: "verb", meanings: ["berlari", "menjalankan"] },
    { headword: "running", pos: "noun", meanings: ["lari"] },
  ],
  phrases: [{ headword: "run up", meanings: ["menaikkan"] }],
  version: null,
}

function show(
  lookup: WordLookupState,
  extra: Partial<Parameters<typeof WordPopup>[0]> = {}
) {
  const props = {
    tap,
    lookup,
    saved: false,
    onToggleSave: vi.fn(),
    onRetry: vi.fn(),
    onClose: vi.fn(),
    finalFocus: () => null,
    ...extra,
  }
  render(<WordPopup {...props} />)
  return props
}

const popup = () => screen.findByRole("dialog", { name: "Arti running" })

beforeEach(() => {
  stubWideScreen(false)
})

afterEach(() => {
  unstubWideScreen()
})

describe("WordPopup", () => {
  it("shows the base form, the phrasal verb and the meanings per part of speech", async () => {
    show({ kind: "result", result })
    const dialog = await popup()
    expect(within(dialog).getByText("→ run")).toBeInTheDocument()
    expect(within(dialog).getByText("run up")).toBeInTheDocument()
    expect(within(dialog).getByText("frasa")).toBeInTheDocument()
    expect(within(dialog).getByText("menaikkan")).toBeInTheDocument()
    expect(within(dialog).getByText("kata kerja")).toBeInTheDocument()
    expect(within(dialog).getByText("berlari, menjalankan")).toBeInTheDocument()
    expect(within(dialog).getByText("kata benda · running")).toBeInTheDocument()
    expect(
      within(dialog).getByRole("link", { name: "Wiktionary · CC BY-SA" })
    ).toHaveAttribute("href", "https://en.wiktionary.org/wiki/run")
  })

  it("says when there is no meaning yet, and still saves", async () => {
    const props = show({
      kind: "result",
      result: { word: "running", entries: [], phrases: [], version: null },
    })
    const dialog = await popup()
    expect(
      within(dialog).getByText("Belum ada arti untuk kata ini")
    ).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }))
    expect(props.onToggleSave).toHaveBeenCalledOnce()
  })

  it("needs a connection for a new word offline", async () => {
    show({ kind: "offline" })
    expect(
      within(await popup()).getByText("Arti butuh koneksi")
    ).toBeInTheDocument()
  })

  it("offers another try after a failure", async () => {
    const props = show({ kind: "failed" })
    const dialog = await popup()
    expect(
      within(dialog).getByText("Arti tidak bisa dimuat")
    ).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Coba lagi" }))
    expect(props.onRetry).toHaveBeenCalledOnce()
  })

  it("shows no skeleton while loading is quick, and saves only after", async () => {
    show({ kind: "loading", slow: false })
    const dialog = await popup()
    expect(dialog.querySelector(".word-skeleton")).toBeNull()
    expect(
      within(dialog).getByRole("button", { name: "Simpan" })
    ).toBeDisabled()
  })

  it("shows a skeleton once loading is slow", async () => {
    show({ kind: "loading", slow: true })
    expect((await popup()).querySelector(".word-skeleton")).not.toBeNull()
  })

  it("marks a saved word", async () => {
    show({ kind: "result", result }, { saved: true })
    expect(
      within(await popup()).getByRole("button", { name: "Tersimpan" })
    ).toHaveAttribute("aria-pressed", "true")
  })

  it("closes on Escape", async () => {
    const props = show({ kind: "result", result })
    fireEvent.keyDown(await popup(), { key: "Escape" })
    expect(props.onClose).toHaveBeenCalled()
  })

  it("opens beside the word on wide screens", async () => {
    stubWideScreen(true)
    show({ kind: "result", result })
    expect(within(await popup()).getByText("→ run")).toBeInTheDocument()
  })

  it("closes on Escape on wide screens", async () => {
    stubWideScreen(true)
    const props = show({ kind: "result", result })
    fireEvent.keyDown(await popup(), { key: "Escape" })
    expect(props.onClose).toHaveBeenCalled()
  })

  it("returns focus to the book when it closes on wide screens", async () => {
    stubWideScreen(true)
    const target = document.createElement("button")
    document.body.append(target)
    const props = {
      tap,
      lookup: { kind: "result", result } as WordLookupState,
      saved: false,
      onToggleSave: vi.fn(),
      onRetry: vi.fn(),
      onClose: vi.fn(),
      finalFocus: () => target,
    }
    const { rerender } = render(<WordPopup {...props} />)
    fireEvent.keyDown(await popup(), { key: "Escape" })
    rerender(<WordPopup {...props} tap={null} />)
    await waitFor(() => expect(target).toHaveFocus())
    target.remove()
  })
})
