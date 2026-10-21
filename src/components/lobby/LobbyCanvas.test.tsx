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
})
