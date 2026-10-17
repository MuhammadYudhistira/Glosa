import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import { LobbyScene } from "./LobbyScene"
import { lobbyHotspots, summarizeLobby } from "./lobby-data"
import { ANDA_START } from "./scene/layout"
import type * as QualityModule from "./scene/quality"
import { type Environment, detectEnvironment } from "./scene/quality"

vi.mock("./scene/quality", async (importOriginal) => ({
  ...(await importOriginal<typeof QualityModule>()),
  detectEnvironment: vi.fn(),
}))
// The real canvas loads three.js, which jsdom cannot draw.
vi.mock("./LobbyCanvas", () => ({
  LobbyCanvas: () => <div data-testid="lobby-canvas" />,
}))

const desktop: Environment = {
  reducedMotion: false,
  webgl: true,
  coarsePointer: false,
  deviceMemory: 8,
}
const hotspots = lobbyHotspots(summarizeLobby([sherlock]).counts)

function renderScene(environment: Environment) {
  vi.mocked(detectEnvironment).mockReturnValue(environment)
  const onActivate = vi.fn()
  render(
    <LobbyScene hotspots={hotspots} anda={ANDA_START} onActivate={onActivate} />
  )
  const scene = screen.getByRole("region", { name: "Adegan lobi" })
  return { scene, onActivate }
}

describe("LobbyScene", () => {
  beforeEach(() => {
    Reflect.deleteProperty(window, "__GLOSA_LOBBY_TEST__")
  })

  it("draws the 3D scene at the tier the device allows", async () => {
    const { scene } = renderScene(desktop)
    await vi.waitFor(() =>
      expect(scene).toHaveAttribute("data-quality", "tinggi")
    )
    expect(screen.getByTestId("lobby-canvas")).toBeInTheDocument()
    expect(scene).toHaveAttribute("tabindex", "0")
  })

  it("keeps the scene still with reduced motion", async () => {
    const { scene } = renderScene({ ...desktop, reducedMotion: true })
    await vi.waitFor(() =>
      expect(scene).toHaveAttribute("data-quality", "diam")
    )
    expect(screen.getByTestId("lobby-canvas")).toBeInTheDocument()
  })

  it("shows the still image without WebGL, and its hotspots still work", async () => {
    const { scene, onActivate } = renderScene({ ...desktop, webgl: false })
    await vi.waitFor(() =>
      expect(scene).toHaveAttribute("data-quality", "diam")
    )
    expect(screen.queryByTestId("lobby-canvas")).not.toBeInTheDocument()
    expect(scene.querySelector("img")).toHaveAttribute(
      "src",
      "/lobby/lobby-still.webp"
    )
    fireEvent.click(screen.getByRole("button", { name: "Meja Admin" }))
    expect(onActivate).toHaveBeenCalledWith("meja-admin")
  })

  it("stays still in the camera-bounds test mode", async () => {
    Object.assign(window, { __GLOSA_LOBBY_TEST__: true })
    const { scene } = renderScene(desktop)
    await vi.waitFor(() =>
      expect(scene).toHaveAttribute("data-quality", "diam")
    )
  })
})
