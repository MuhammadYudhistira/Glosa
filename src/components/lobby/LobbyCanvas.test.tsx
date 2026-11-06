import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LobbyCanvas } from "./LobbyCanvas"
import { ANDA_START } from "./scene/layout"

// The real stage needs WebGL, which jsdom does not have.
const stage = vi.hoisted(() => ({
  books: 0,
  setView: vi.fn(),
  walkTo: vi.fn(),
  setPaused: vi.fn(),
  setShowcase: vi.fn(),
  setPlant: vi.fn(),
  setDecor: vi.fn(),
  dispose: vi.fn(),
}))
vi.mock("./scene/stage", () => ({ createStage: vi.fn(() => stage) }))

function canvasWith(paused: boolean, onReady = vi.fn()) {
  return (
    <LobbyCanvas
      quality="tinggi"
      test={false}
      anda={ANDA_START}
      paused={paused}
      showcase={[]}
      plant="tunas"
      decor={{}}
      onReady={onReady}
      onView={vi.fn()}
      onQuality={vi.fn()}
      onFail={vi.fn()}
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
    const canvas = (decor: Record<string, string>) => (
      <LobbyCanvas
        quality="tinggi"
        test={false}
        anda={ANDA_START}
        paused={false}
        showcase={[]}
        plant="tunas"
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
})
