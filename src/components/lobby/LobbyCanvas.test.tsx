import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LobbyCanvas } from "./LobbyCanvas"
import type { HighlightColor } from "@/lib/annotations/types"
import { NEUTRAL_SIGNALS, type RoomSignals } from "./room-signals"
import { ANDA_START } from "./scene/layout"
import { EMPTY_HUES, type GenreHues } from "./scene/shelf-books"
import { type Stage, createStage } from "./scene/stage"

// The real stage needs WebGL, which jsdom does not have.
const stage = vi.hoisted(() => ({
  books: 0,
  setView: vi.fn(),
  walkTo: vi.fn(),
  setPaused: vi.fn(),
  setShowcase: vi.fn(),
  setPlant: vi.fn(),
  setSignals: vi.fn(),
  setNotes: vi.fn(),
  setShelves: vi.fn(),
  setDecor: vi.fn(),
  setMood: vi.fn(),
  dispose: vi.fn(),
}))
vi.mock("./scene/stage", () => ({
  createStage: vi.fn(() => Promise.resolve(stage)),
}))

function canvasWith(paused: boolean, onReady = vi.fn(), onFail = vi.fn()) {
  return (
    <LobbyCanvas
      quality="tinggi"
      test={false}
      anda={ANDA_START}
      paused={paused}
      showcase={[]}
      plant="tunas"
      signals={NEUTRAL_SIGNALS}
      decor={{}}
      onReady={onReady}
      onView={vi.fn()}
      onQuality={vi.fn()}
      onFail={onFail}
    />
  )
}

describe("LobbyCanvas", () => {
  it("starts the stage paused behind a popup, and passes later changes on", async () => {
    const onReady = vi.fn()
    const { rerender, unmount } = render(canvasWith(true, onReady))
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledWith(stage))
    expect(stage.setPaused).toHaveBeenLastCalledWith(true)

    rerender(canvasWith(false, onReady))
    expect(stage.setPaused).toHaveBeenLastCalledWith(false)

    unmount()
    expect(stage.dispose).toHaveBeenCalled()
  })

  it("hands the finished books to the stage, now and when they change", async () => {
    const books = [{ id: "a", coverUrl: null, hue: 120 }]
    const { rerender } = render(
      <LobbyCanvas
        quality="tinggi"
        test={false}
        anda={ANDA_START}
        paused={false}
        showcase={books}
        plant="tunas"
        signals={NEUTRAL_SIGNALS}
        decor={{}}
        onReady={vi.fn()}
        onView={vi.fn()}
        onQuality={vi.fn()}
        onFail={vi.fn()}
      />
    )
    await vi.waitFor(() =>
      expect(stage.setShowcase).toHaveBeenCalledWith(books)
    )
    const more = [...books, { id: "b", coverUrl: null, hue: 40 }]
    rerender(
      <LobbyCanvas
        quality="tinggi"
        test={false}
        anda={ANDA_START}
        paused={false}
        showcase={more}
        plant="berbunga"
        signals={NEUTRAL_SIGNALS}
        decor={{}}
        onReady={vi.fn()}
        onView={vi.fn()}
        onQuality={vi.fn()}
        onFail={vi.fn()}
      />
    )
    expect(stage.setShowcase).toHaveBeenLastCalledWith(more)
    expect(stage.setPlant).toHaveBeenCalledWith("tunas")
    expect(stage.setPlant).toHaveBeenLastCalledWith("berbunga")
  })

  it("passes the shop's items to the stage, at start and on change", async () => {
    const canvas = (decor: Record<string, string> | null) => (
      <LobbyCanvas
        quality="tinggi"
        test={false}
        anda={ANDA_START}
        paused={false}
        showcase={[]}
        plant="tunas"
        signals={NEUTRAL_SIGNALS}
        decor={decor}
        onReady={vi.fn()}
        onView={vi.fn()}
        onQuality={vi.fn()}
        onFail={vi.fn()}
      />
    )
    const { rerender } = render(canvas({ rug: "rug_woven" }))
    await vi.waitFor(() =>
      expect(stage.setDecor).toHaveBeenCalledWith({ rug: "rug_woven" })
    )
    rerender(canvas({ rug: "rug_round", pet: "pet_cat" }))
    expect(stage.setDecor).toHaveBeenLastCalledWith({
      rug: "rug_round",
      pet: "pet_cat",
    })
  })

  it("leaves the stage's items alone while the shop state is unknown", async () => {
    const canvas = (decor: Record<string, string> | null) => (
      <LobbyCanvas
        quality="tinggi"
        test={false}
        anda={ANDA_START}
        paused={false}
        showcase={[]}
        plant="tunas"
        signals={NEUTRAL_SIGNALS}
        decor={decor}
        onReady={vi.fn()}
        onView={vi.fn()}
        onQuality={vi.fn()}
        onFail={vi.fn()}
      />
    )
    const { rerender } = render(canvas(null))
    await vi.waitFor(() => expect(stage.setPlant).toHaveBeenCalled())
    expect(stage.setDecor).not.toHaveBeenCalled()
    rerender(canvas({ rug: "rug_woven" }))
    expect(stage.setDecor).toHaveBeenCalledTimes(1)
    expect(stage.setDecor).toHaveBeenCalledWith({ rug: "rug_woven" })
  })

  it("hands the room's signals to the stage, now and on change", async () => {
    const canvas = (signals: RoomSignals) => (
      <LobbyCanvas
        quality="tinggi"
        test={false}
        anda={ANDA_START}
        paused={false}
        showcase={[]}
        plant="tunas"
        signals={signals}
        decor={{}}
        onReady={vi.fn()}
        onView={vi.fn()}
        onQuality={vi.fn()}
        onFail={vi.fn()}
      />
    )
    const { rerender } = render(canvas(NEUTRAL_SIGNALS))
    await vi.waitFor(() =>
      expect(stage.setSignals).toHaveBeenCalledWith(NEUTRAL_SIGNALS)
    )
    const lit: RoomSignals = { fire: "besar", deskLamp: true, parcelOpen: true }
    rerender(canvas(lit))
    expect(stage.setSignals).toHaveBeenLastCalledWith(lit)
  })

  it("hands the corkboard's colours to the stage, now and on change", async () => {
    const canvas = (notes: ReadonlyArray<HighlightColor>) => (
      <LobbyCanvas
        quality="tinggi"
        test={false}
        anda={ANDA_START}
        paused={false}
        showcase={[]}
        plant="tunas"
        signals={NEUTRAL_SIGNALS}
        notes={notes}
        decor={{}}
        onReady={vi.fn()}
        onView={vi.fn()}
        onQuality={vi.fn()}
        onFail={vi.fn()}
      />
    )
    const { rerender } = render(canvas(["yellow"]))
    await vi.waitFor(() =>
      expect(stage.setNotes).toHaveBeenCalledWith(["yellow"])
    )
    rerender(canvas(["pink", "blue"]))
    expect(stage.setNotes).toHaveBeenLastCalledWith(["pink", "blue"])
  })

  it("hands the shelves' book colours to the stage, now and on change", async () => {
    const canvas = (shelves?: GenreHues) => (
      <LobbyCanvas
        quality="tinggi"
        test={false}
        anda={ANDA_START}
        paused={false}
        showcase={[]}
        plant="tunas"
        signals={NEUTRAL_SIGNALS}
        shelves={shelves}
        decor={{}}
        onReady={vi.fn()}
        onView={vi.fn()}
        onQuality={vi.fn()}
        onFail={vi.fn()}
      />
    )
    const { rerender } = render(canvas())
    await vi.waitFor(() =>
      expect(stage.setShelves).toHaveBeenCalledWith(EMPTY_HUES)
    )
    const filled: GenreHues = { ...EMPTY_HUES, fiksi_sastra: [12, 200] }
    rerender(canvas(filled))
    expect(stage.setShelves).toHaveBeenLastCalledWith(filled)
  })

  it("frees a stage that finishes loading after the canvas is gone", async () => {
    let finish: (value: Stage) => void = () => undefined
    vi.mocked(createStage).mockImplementationOnce(
      () => new Promise<Stage>((resolve) => (finish = resolve))
    )
    const onReady = vi.fn()
    const { unmount } = render(canvasWith(false, onReady))
    await vi.waitFor(() => expect(createStage).toHaveBeenCalled())
    stage.dispose.mockClear()
    unmount()
    finish(stage)
    await vi.waitFor(() => expect(stage.dispose).toHaveBeenCalled())
    expect(onReady).not.toHaveBeenCalled()
  })

  it("falls back to the still image when the models do not load", async () => {
    vi.mocked(createStage).mockImplementationOnce(() =>
      Promise.reject(new Error("model fetch failed"))
    )
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const onReady = vi.fn()
    const onFail = vi.fn()
    render(canvasWith(false, onReady, onFail))
    await vi.waitFor(() => expect(onFail).toHaveBeenCalledTimes(1))
    expect(onReady).not.toHaveBeenCalled()
    error.mockRestore()
  })
})
