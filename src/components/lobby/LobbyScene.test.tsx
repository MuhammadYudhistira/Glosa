import { act, fireEvent, render, screen } from "@testing-library/react"
import { type ComponentProps, createRef } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { LobbyCanvas } from "./LobbyCanvas"
import { LobbyScene, type LobbySceneHandle } from "./LobbyScene"
import { lobbyHotspots, summarizeLobby } from "./lobby-data"
import { ANDA_START, spotOf } from "./scene/layout"
import {
  MAX_ZOOM,
  centerOn,
  isInView,
  panBy,
  startView,
} from "./scene/projection"
import type * as QualityModule from "./scene/quality"
import { type Environment, detectEnvironment } from "./scene/quality"

vi.mock("./scene/quality", async (importOriginal) => ({
  ...(await importOriginal<typeof QualityModule>()),
  detectEnvironment: vi.fn(),
}))
// The real canvas loads three.js, which jsdom cannot draw.
const canvas = vi.hoisted(() => ({
  props: null as ComponentProps<typeof LobbyCanvas> | null,
}))
vi.mock("./LobbyCanvas", () => ({
  LobbyCanvas: (props: ComponentProps<typeof LobbyCanvas>) => {
    canvas.props = props
    return <div data-testid="lobby-canvas" />
  },
}))

const desktop: Environment = {
  reducedMotion: false,
  webgl: true,
  coarsePointer: false,
  deviceMemory: 8,
}
const hotspots = lobbyHotspots(summarizeLobby([sherlock]).counts)

const viewport = { width: 1280, height: 720 }

function renderScene(environment: Environment) {
  vi.mocked(detectEnvironment).mockReturnValue(environment)
  const onActivate = vi.fn()
  const ref = createRef<LobbySceneHandle>()
  render(
    <LobbyScene
      ref={ref}
      hotspots={hotspots}
      anda={ANDA_START}
      onActivate={onActivate}
    />
  )
  const scene = screen.getByRole("region", { name: "Adegan lobi" })
  return { scene, onActivate, ref }
}

describe("LobbyScene", () => {
  beforeEach(() => {
    canvas.props = null
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

  describe("with the 3D scene running", () => {
    async function goLive(view = startView(viewport)) {
      const rendered = renderScene(desktop)
      await vi.waitFor(() => expect(canvas.props).not.toBeNull())
      const stage = {
        books: 0,
        setView: vi.fn(),
        walkTo: vi.fn(),
        dispose: vi.fn(),
      }
      act(() => {
        canvas.props?.onView(view, viewport)
        canvas.props?.onReady(stage)
      })
      return { ...rendered, stage, view }
    }

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it("pans with the arrow keys while the scene has focus", async () => {
      const { scene, stage, view } = await goLive()
      fireEvent.keyDown(scene, { key: "ArrowRight" })
      expect(stage.setView).toHaveBeenCalledWith(panBy(view, 0.15, 0, viewport))
    })

    it("leaves the arrow keys alone when a hotspot has focus", async () => {
      const { stage } = await goLive()
      fireEvent.keyDown(screen.getByRole("button", { name: "Meja Baca" }), {
        key: "ArrowRight",
      })
      expect(stage.setView).not.toHaveBeenCalled()
    })

    it("recentres with Pusatkan", async () => {
      const { stage } = await goLive()
      fireEvent.click(screen.getByRole("button", { name: "Pusatkan" }))
      expect(stage.setView).toHaveBeenCalledWith(startView(viewport))
    })

    it("moves the camera to a spot on showSpot", async () => {
      const { stage, view, ref } = await goLive()
      act(() => ref.current?.showSpot("meja-baca"))
      expect(stage.setView).toHaveBeenCalledWith(
        centerOn(view, spotOf("meja-baca").label)
      )
    })

    it("brings an off-screen hotspot into view on keyboard focus only", async () => {
      const zoomed = { ...startView(viewport), zoom: MAX_ZOOM }
      const hidden = hotspots.find(
        ({ id }) => !isInView(spotOf(id).label, zoomed, viewport)
      )
      expect(hidden).toBeDefined()
      const { stage } = await goLive(zoomed)
      const button = screen.getByRole("button", {
        name: new RegExp(`^${hidden?.label}`),
      })

      act(() => button.focus())
      expect(stage.setView).not.toHaveBeenCalled()

      act(() => button.blur())
      vi.spyOn(HTMLElement.prototype, "matches").mockImplementation(
        (selector) => selector === ":focus-visible"
      )
      act(() => button.focus())
      expect(stage.setView).toHaveBeenCalledWith(
        centerOn(zoomed, spotOf(hidden?.id ?? "meja-baca").label)
      )
    })

    it("keeps the same focused hotspot when the scene goes live", async () => {
      renderScene(desktop)
      await vi.waitFor(() => expect(canvas.props).not.toBeNull())
      const button = screen.getByRole("button", { name: "Meja Admin" })
      act(() => button.focus())
      act(() => {
        canvas.props?.onView(startView(viewport), viewport)
        canvas.props?.onReady({
          books: 0,
          setView: vi.fn(),
          walkTo: vi.fn(),
          dispose: vi.fn(),
        })
      })
      expect(screen.getByRole("button", { name: "Meja Admin" })).toBe(button)
      expect(document.activeElement).toBe(button)
    })

    it("falls back to the still image when the scene fails", async () => {
      const { scene } = await goLive()
      act(() => canvas.props?.onFail())
      expect(scene).toHaveAttribute("data-quality", "diam")
      expect(scene.querySelector("img")).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Pusatkan" })).toBeNull()
    })

    it("does not swallow the arrow keys before the scene is live", async () => {
      const { scene } = renderScene(desktop)
      await vi.waitFor(() => expect(canvas.props).not.toBeNull())
      expect(fireEvent.keyDown(scene, { key: "ArrowRight" })).toBe(true)
    })
  })
})
