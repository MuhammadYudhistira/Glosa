import { act, fireEvent, render, screen } from "@testing-library/react"
import { type ComponentProps, createRef } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { LobbyCanvas } from "./LobbyCanvas"
import { LobbyScene, type LobbySceneHandle } from "./LobbyScene"
import { lobbyHotspots, summarizeLobby } from "./lobby-data"
import type { RoomSnapshot } from "./room-memory"
import { ANDA_START, DECOR_SLOTS, type HotspotId, spotOf } from "./scene/layout"
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

/** The room at the member's last visit. */
const MOMENT_FROM: RoomSnapshot = {
  fire: "bara",
  deskLamp: false,
  parcelOpen: false,
  plant: "tunas",
  finished: 0,
}

type SceneProps = Partial<ComponentProps<typeof LobbyScene>>

function renderScene(environment: Environment, extra: SceneProps = {}) {
  vi.mocked(detectEnvironment).mockReturnValue(environment)
  const onActivate = vi.fn()
  const onTap = vi.fn()
  const onLiveChange = vi.fn()
  const ref = createRef<LobbySceneHandle>()
  const ui = (more: SceneProps) => (
    <LobbyScene
      ref={ref}
      hotspots={hotspots}
      anda={ANDA_START}
      onActivate={onActivate}
      onTap={onTap}
      onLiveChange={onLiveChange}
      {...extra}
      {...more}
    />
  )
  const { rerender } = render(ui({}))
  const scene = screen.getByRole("region", { name: "Adegan ruang baca" })
  return {
    scene,
    onActivate,
    onTap,
    onLiveChange,
    ref,
    update: (more: SceneProps) => rerender(ui(more)),
  }
}

describe("LobbyScene", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("holds the 3D scene back until it may start, with a lazy poster meanwhile", async () => {
    const { scene, update } = renderScene(desktop, { allow3d: false })
    await vi.waitFor(() =>
      expect(scene).toHaveAttribute("data-quality", "tinggi")
    )
    expect(screen.queryByTestId("lobby-canvas")).toBeNull()
    expect(scene.querySelector("img")).toHaveAttribute("loading", "lazy")

    update({ allow3d: true })
    expect(screen.getByTestId("lobby-canvas")).toBeInTheDocument()
    expect(scene.querySelector("img")).toHaveAttribute("loading", "eager")
  })

  it("passes the pause on to the canvas", async () => {
    const { update } = renderScene(desktop, { paused: true })
    await vi.waitFor(() => expect(canvas.props?.paused).toBe(true))
    update({ paused: false })
    expect(canvas.props?.paused).toBe(false)
  })

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
    const { scene, onActivate, onTap } = renderScene({
      ...desktop,
      webgl: false,
    })
    await vi.waitFor(() =>
      expect(scene).toHaveAttribute("data-quality", "diam")
    )
    expect(screen.queryByTestId("lobby-canvas")).not.toBeInTheDocument()
    expect(scene.querySelector("img")?.getAttribute("src")).toMatch(
      /lobby-still\.webp/
    )
    fireEvent.click(screen.getByRole("button", { name: "Meja tulis" }), {
      detail: 1,
    })
    expect(onTap).toHaveBeenCalledWith("meja-admin")
    fireEvent.click(screen.getByRole("button", { name: "Meja tulis" }), {
      detail: 0,
    })
    expect(onActivate).toHaveBeenCalledWith("meja-admin", { keyboard: true })
  })

  it("has Anda's activity over at once without a live 3D scene", async () => {
    const { scene, ref } = renderScene({ ...desktop, webgl: false })
    await vi.waitFor(() =>
      expect(scene).toHaveAttribute("data-quality", "diam")
    )
    await expect(ref.current?.perform("perapian")).resolves.toBeUndefined()
    expect(() => ref.current?.skip()).not.toThrow()
    expect(() => ref.current?.playMoments(MOMENT_FROM, ["fire"])).not.toThrow()
  })

  it("fills the frame's width with the still image, not just the screen's", async () => {
    const { scene } = renderScene({ ...desktop, webgl: false })
    await vi.waitFor(() =>
      expect(scene).toHaveAttribute("data-quality", "diam")
    )
    for (const source of scene.querySelectorAll("source")) {
      expect(source).toHaveAttribute("sizes", "max(100vw, 178vh)")
    }
  })

  it("stays still in the camera-bounds test mode", async () => {
    Object.assign(window, { __GLOSA_LOBBY_TEST__: true })
    const { scene } = renderScene(desktop)
    await vi.waitFor(() =>
      expect(scene).toHaveAttribute("data-quality", "diam")
    )
  })

  describe("with the 3D scene running", () => {
    async function goLive(view = startView(viewport), extra: SceneProps = {}) {
      const rendered = renderScene(desktop, extra)
      await vi.waitFor(() => expect(canvas.props).not.toBeNull())
      const stage = {
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
        perform: vi.fn((_id: string) => Promise.resolve()),
        skip: vi.fn(),
        pick: vi.fn(() => null as HotspotId | null),
        setHighlight: vi.fn(),
        playMoments: vi.fn(),
        dispose: vi.fn(),
      }
      act(() => {
        canvas.props?.onView(view, viewport)
        canvas.props?.onReady(stage)
      })
      return { ...rendered, stage, view }
    }
    const goLiveWith = (extra: SceneProps) => goLive(startView(viewport), extra)

    it("pans with the arrow keys while the scene has focus", async () => {
      const { scene, stage, view } = await goLive()
      fireEvent.keyDown(scene, { key: "ArrowRight" })
      expect(stage.setView).toHaveBeenCalledWith(panBy(view, 0.15, 0, viewport))
    })

    it("leaves the arrow keys alone when a hotspot has focus", async () => {
      const { stage } = await goLive()
      fireEvent.keyDown(screen.getByRole("button", { name: "Kursi baca" }), {
        key: "ArrowRight",
      })
      expect(stage.setView).not.toHaveBeenCalled()
    })

    it("recentres with Pusatkan", async () => {
      const { stage } = await goLive()
      fireEvent.click(screen.getByRole("button", { name: "Pusatkan" }))
      expect(stage.setView).toHaveBeenCalledWith(startView(viewport))
    })

    it("hands Anda's activity and its skip to the live stage", async () => {
      const { stage, ref } = await goLive()
      await ref.current?.perform("tanaman")
      expect(stage.perform).toHaveBeenCalledWith("tanaman", undefined)
      await ref.current?.perform("tanaman", { instant: true })
      expect(stage.perform).toHaveBeenCalledWith("tanaman", { instant: true })
      ref.current?.skip()
      expect(stage.skip).toHaveBeenCalledTimes(1)
    })

    it("moves the camera to a spot on showSpot", async () => {
      const { stage, view, ref } = await goLive()
      act(() => ref.current?.showSpot("meja-baca"))
      expect(stage.setView).toHaveBeenCalledWith(
        centerOn(view, spotOf("meja-baca").label)
      )
    })

    it("brings a shop slot into view, shifted aside for the panel", async () => {
      const { stage, view, ref } = await goLive()
      act(() => ref.current?.showDecor("pet"))
      expect(stage.setView).toHaveBeenCalledTimes(1)
      const [shown] = stage.setView.mock.calls[0]
      expect(shown.target).not.toEqual(
        centerOn(view, DECOR_SLOTS.pet.focus).target
      )
    })

    it("brings an off-screen hotspot into view on focus, but not on a press", async () => {
      const zoomed = { ...startView(viewport), zoom: MAX_ZOOM }
      const hidden = hotspots.find(
        ({ id }) => !isInView(spotOf(id).label, zoomed, viewport)
      )
      expect(hidden).toBeDefined()
      const { stage } = await goLive(zoomed)
      const button = screen.getByRole("button", {
        name: new RegExp(`^${hidden?.label}`),
      })

      // A press focuses the button before its click: the camera stays.
      fireEvent.pointerDown(button)
      act(() => button.focus())
      expect(stage.setView).not.toHaveBeenCalled()

      act(() => button.blur())
      act(() => button.focus())
      expect(stage.setView).toHaveBeenCalledWith(
        centerOn(zoomed, spotOf(hidden?.id ?? "meja-baca").label)
      )
    })

    describe("taps on the scene", () => {
      const down = (el: Element, x: number, y: number, id = 1) =>
        fireEvent.pointerDown(el, {
          pointerId: id,
          pointerType: "touch",
          clientX: x,
          clientY: y,
        })
      const up = (el: Element, x: number, y: number, id = 1) =>
        fireEvent.pointerUp(el, {
          pointerId: id,
          pointerType: "touch",
          clientX: x,
          clientY: y,
        })

      it("hands a quick tap to the picker and reports the place it found", async () => {
        const onTap = vi.fn()
        const { stage } = await goLiveWith({ onTap })
        stage.pick.mockReturnValue("troli")
        const canvasEl = screen.getByTestId("lobby-canvas")
        down(canvasEl, 120, 80)
        up(canvasEl, 122, 81)
        expect(stage.pick).toHaveBeenCalledWith(120, 80)
        expect(onTap).toHaveBeenCalledWith("troli")
      })

      it("reports null for a tap on empty space", async () => {
        const onTap = vi.fn()
        const { stage } = await goLiveWith({ onTap })
        stage.pick.mockReturnValue(null)
        const canvasEl = screen.getByTestId("lobby-canvas")
        down(canvasEl, 10, 10)
        up(canvasEl, 10, 10)
        expect(onTap).toHaveBeenCalledWith(null)
      })

      it("takes a drag of 10 px or more as the camera, not a tap", async () => {
        const onTap = vi.fn()
        const onCameraGesture = vi.fn()
        await goLiveWith({ onTap, onCameraGesture })
        const canvasEl = screen.getByTestId("lobby-canvas")
        down(canvasEl, 100, 100)
        fireEvent.pointerMove(canvasEl, {
          pointerId: 1,
          pointerType: "touch",
          clientX: 130,
          clientY: 100,
        })
        up(canvasEl, 130, 100)
        expect(onCameraGesture).toHaveBeenCalledTimes(1)
        expect(onTap).not.toHaveBeenCalled()
      })

      it("takes a second finger and the wheel as the camera too", async () => {
        const onTap = vi.fn()
        const onCameraGesture = vi.fn()
        const { scene } = await goLiveWith({ onTap, onCameraGesture })
        const canvasEl = screen.getByTestId("lobby-canvas")
        down(canvasEl, 100, 100, 1)
        down(canvasEl, 150, 150, 2)
        expect(onCameraGesture).toHaveBeenCalledTimes(1)
        up(canvasEl, 150, 150, 2)
        up(canvasEl, 100, 100, 1)
        expect(onTap).not.toHaveBeenCalled()
        fireEvent.wheel(scene, { deltaY: -100 })
        expect(onCameraGesture).toHaveBeenCalledTimes(2)
      })

      it("takes only a click of the main mouse button as a tap", async () => {
        const onTap = vi.fn()
        const { stage } = await goLiveWith({ onTap })
        stage.pick.mockReturnValue("troli")
        const canvasEl = screen.getByTestId("lobby-canvas")
        const click = (button: number) => {
          const at = { pointerId: 1, pointerType: "mouse", button }
          fireEvent.pointerDown(canvasEl, { ...at, clientX: 50, clientY: 50 })
          fireEvent.pointerUp(canvasEl, { ...at, clientX: 50, clientY: 50 })
        }
        click(1)
        click(2)
        expect(onTap).not.toHaveBeenCalled()
        click(0)
        expect(onTap).toHaveBeenCalledWith("troli")
      })

      it("forgets a press released outside the scene", async () => {
        const onTap = vi.fn()
        const onCameraGesture = vi.fn()
        const { scene, stage } = await goLiveWith({ onTap, onCameraGesture })
        stage.pick.mockReturnValue("troli")
        const canvasEl = screen.getByTestId("lobby-canvas")
        down(canvasEl, 10, 10)
        // Its pointerup lands outside the scene: only the leave is seen.
        fireEvent.pointerLeave(scene, { pointerId: 1, pointerType: "touch" })
        down(canvasEl, 60, 60)
        up(canvasEl, 60, 60)
        expect(onCameraGesture).not.toHaveBeenCalled()
        expect(onTap).toHaveBeenCalledWith("troli")
      })

      it("leaves a press on a button to the button", async () => {
        const onTap = vi.fn()
        const { stage } = await goLiveWith({ onTap })
        const button = screen.getByRole("button", { name: "Pusatkan" })
        down(button, 5, 5)
        up(button, 5, 5)
        expect(stage.pick).not.toHaveBeenCalled()
        expect(onTap).not.toHaveBeenCalled()
      })
    })

    describe("on a phone held upright", () => {
      const phone = { width: 390, height: 700 }
      async function goPhone() {
        const rendered = renderScene(desktop)
        await vi.waitFor(() => expect(canvas.props).not.toBeNull())
        const stage = {
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
          perform: vi.fn(() => Promise.resolve()),
          skip: vi.fn(),
          playMoments: vi.fn(),
          dispose: vi.fn(),
          pick: vi.fn(() => null),
          setHighlight: vi.fn(),
        }
        act(() => {
          canvas.props?.onView(startView(phone), phone)
          canvas.props?.onReady(stage)
        })
        return { ...rendered, stage }
      }

      it("hands focus to the scene when Pusatkan, which then goes, is pressed", async () => {
        await goPhone()
        act(() => {
          canvas.props?.onView(panBy(startView(phone), 0.2, 0, phone), phone)
        })
        const button = screen.getByRole("button", { name: "Pusatkan" })
        button.focus()
        fireEvent.click(button)
        expect(screen.getByLabelText("Adegan ruang baca")).toHaveFocus()
      })

      it("shows Pusatkan only after the camera left its first view", async () => {
        await goPhone()
        expect(screen.queryByRole("button", { name: "Pusatkan" })).toBeNull()
        act(() => {
          canvas.props?.onView(panBy(startView(phone), 0.2, 0, phone), phone)
        })
        expect(screen.getByRole("button", { name: "Pusatkan" })).toBeVisible()
        act(() => canvas.props?.onView(startView(phone), phone))
        expect(screen.queryByRole("button", { name: "Pusatkan" })).toBeNull()
      })
    })

    describe("the mouse over the scene", () => {
      beforeEach(() => {
        vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => {
          run(0)
          return 1
        })
        vi.stubGlobal("cancelAnimationFrame", () => undefined)
      })
      afterEach(() => vi.unstubAllGlobals())
      const move = (el: Element, x: number, y: number, buttons = 0) =>
        fireEvent.pointerMove(el, {
          pointerId: 1,
          pointerType: "mouse",
          clientX: x,
          clientY: y,
          buttons,
        })

      it("names the place under the cursor and reports it once", async () => {
        const onHover = vi.fn()
        const { scene, stage } = await goLiveWith({ onHover })
        stage.pick.mockReturnValue("troli")
        move(screen.getByTestId("lobby-canvas"), 200, 120)
        expect(stage.pick).toHaveBeenCalledWith(200, 120)
        expect(
          screen.getByText("Kotak buku baru", { selector: ".lobby-hover-name" })
        ).toBeVisible()
        expect(scene).toHaveAttribute("data-hover")
        move(screen.getByTestId("lobby-canvas"), 205, 124)
        expect(onHover).toHaveBeenCalledTimes(1)
        expect(onHover).toHaveBeenLastCalledWith("troli")
      })

      it("drops the name when the cursor leaves the place, or the scene", async () => {
        const onHover = vi.fn()
        const { scene, stage } = await goLiveWith({ onHover })
        stage.pick.mockReturnValue("troli")
        move(screen.getByTestId("lobby-canvas"), 200, 120)
        stage.pick.mockReturnValue(null)
        move(screen.getByTestId("lobby-canvas"), 10, 10)
        expect(document.querySelector(".lobby-hover-name")).toBeNull()
        expect(onHover).toHaveBeenLastCalledWith(null)
        stage.pick.mockReturnValue("troli")
        move(screen.getByTestId("lobby-canvas"), 200, 120)
        fireEvent.pointerLeave(scene)
        expect(document.querySelector(".lobby-hover-name")).toBeNull()
      })

      it("drops the name when the wheel moves the camera under a still cursor", async () => {
        const onHover = vi.fn()
        const { scene, stage } = await goLiveWith({ onHover })
        stage.pick.mockReturnValue("troli")
        move(screen.getByTestId("lobby-canvas"), 200, 120)
        expect(onHover).toHaveBeenLastCalledWith("troli")
        fireEvent.wheel(scene, { deltaY: -100 })
        expect(document.querySelector(".lobby-hover-name")).toBeNull()
        expect(onHover).toHaveBeenLastCalledWith(null)
      })

      it("drops the name over a button on the scene", async () => {
        const { stage } = await goLiveWith({})
        stage.pick.mockReturnValue("troli")
        move(screen.getByTestId("lobby-canvas"), 200, 120)
        move(screen.getByRole("button", { name: "Pusatkan" }), 20, 20)
        expect(document.querySelector(".lobby-hover-name")).toBeNull()
      })

      it("ignores touch, a dragged camera and a paused scene", async () => {
        const { stage, update } = await goLiveWith({})
        stage.pick.mockReturnValue("troli")
        fireEvent.pointerMove(screen.getByTestId("lobby-canvas"), {
          pointerId: 2,
          pointerType: "touch",
          clientX: 50,
          clientY: 50,
        })
        move(screen.getByTestId("lobby-canvas"), 60, 60, 1)
        expect(stage.pick).not.toHaveBeenCalled()
        update({ paused: true })
        move(screen.getByTestId("lobby-canvas"), 60, 60)
        expect(document.querySelector(".lobby-hover-name")).toBeNull()
      })

      it("does not bring a name back after a pause from before it", async () => {
        const onHover = vi.fn()
        const { stage, update } = await goLiveWith({ onHover })
        stage.pick.mockReturnValue("troli")
        move(screen.getByTestId("lobby-canvas"), 200, 120)
        update({ paused: true })
        expect(onHover).toHaveBeenLastCalledWith(null)
        update({ paused: false })
        expect(document.querySelector(".lobby-hover-name")).toBeNull()
        expect(onHover).toHaveBeenLastCalledWith(null)
      })
    })

    it("keeps the same focused hotspot when the scene goes live", async () => {
      renderScene(desktop)
      await vi.waitFor(() => expect(canvas.props).not.toBeNull())
      const button = screen.getByRole("button", { name: "Meja tulis" })
      act(() => button.focus())
      act(() => {
        canvas.props?.onView(startView(viewport), viewport)
        canvas.props?.onReady({
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
          perform: vi.fn(() => Promise.resolve()),
          skip: vi.fn(),
          pick: vi.fn(() => null),
          setHighlight: vi.fn(),
          playMoments: vi.fn(),
          dispose: vi.fn(),
        })
      })
      expect(screen.getByRole("button", { name: "Pusatkan" })).toBeVisible()
      expect(screen.getByRole("button", { name: "Meja tulis" })).toBe(button)
      expect(document.activeElement).toBe(button)
    })

    it("says when its camera is live, for the map", async () => {
      const { onLiveChange } = await goLive()
      expect(onLiveChange).toHaveBeenLastCalledWith(true)
      act(() => canvas.props?.onFail())
      expect(onLiveChange).toHaveBeenLastCalledWith(false)
    })

    it("goes back to the poster when WebGL is held back, until a new stage is ready", async () => {
      const { scene, onLiveChange, update, stage } = await goLive()
      // Once the scene has faded in over it.
      await vi.waitFor(() => expect(scene.querySelector("img")).toBeNull())

      update({ allow3d: false })
      expect(screen.queryByTestId("lobby-canvas")).toBeNull()
      expect(scene.querySelector("img")).toBeInTheDocument()
      expect(onLiveChange).toHaveBeenLastCalledWith(false)
      expect(screen.queryByRole("button", { name: "Pusatkan" })).toBeNull()
      // No camera any more: the arrow keys keep scrolling the page.
      expect(fireEvent.keyDown(scene, { key: "ArrowRight" })).toBe(true)
      expect(stage.setView).not.toHaveBeenCalled()

      update({ allow3d: true })
      expect(screen.getByTestId("lobby-canvas")).toBeInTheDocument()
      expect(scene.querySelector("img")).toBeInTheDocument()
      expect(onLiveChange).toHaveBeenLastCalledWith(false)
    })

    it("falls back to the still image when the scene fails", async () => {
      const { scene } = await goLive()
      act(() => canvas.props?.onFail())
      expect(scene).toHaveAttribute("data-quality", "diam")
      expect(scene.querySelector("img")).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Pusatkan" })).toBeNull()
    })

    describe("fading in over the still image", () => {
      afterEach(() => {
        vi.useRealTimers()
      })

      it("plays the moments of change once the room has faded in", async () => {
        vi.useFakeTimers()
        const { stage, ref } = await goLive()
        ref.current?.playMoments(MOMENT_FROM, ["fire", "plant"])
        expect(stage.playMoments).not.toHaveBeenCalled()
        act(() => vi.advanceTimersByTime(600))
        expect(stage.playMoments).toHaveBeenCalledTimes(1)
        expect(stage.playMoments).toHaveBeenCalledWith(MOMENT_FROM, [
          "fire",
          "plant",
        ])
        // In full view, at once.
        ref.current?.playMoments(MOMENT_FROM, ["parcel"])
        expect(stage.playMoments).toHaveBeenLastCalledWith(MOMENT_FROM, [
          "parcel",
        ])
      })

      it("drops the moments when the 3D scene goes before the fade is done", async () => {
        vi.useFakeTimers()
        const { stage, ref, update } = await goLive()
        ref.current?.playMoments(MOMENT_FROM, ["fire"])
        update({ allow3d: false })
        act(() => vi.advanceTimersByTime(600))
        expect(stage.playMoments).not.toHaveBeenCalled()
      })

      it("shows the still image and its hotspots until the scene is ready", async () => {
        const { scene } = renderScene(desktop)
        await vi.waitFor(() => expect(canvas.props).not.toBeNull())
        expect(scene.querySelector("img")).toBeInTheDocument()
        expect(
          screen.getByRole("button", { name: "Meja tulis" })
        ).toBeInTheDocument()
        expect(scene).not.toHaveAttribute("data-live")
      })

      it("keeps the still image under the scene while it fades in, with the same hotspots", async () => {
        vi.useFakeTimers()
        const { scene } = renderScene(desktop)
        await vi.waitFor(() => expect(canvas.props).not.toBeNull())
        const button = screen.getByRole("button", { name: "Meja tulis" })
        act(() => button.focus())
        act(() => {
          canvas.props?.onReady({
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
            perform: vi.fn(() => Promise.resolve()),
            skip: vi.fn(),
            pick: vi.fn(() => null),
            setHighlight: vi.fn(),
            playMoments: vi.fn(),
            dispose: vi.fn(),
          })
          canvas.props?.onView(startView(viewport), viewport)
        })
        expect(scene).toHaveAttribute("data-live", "true")
        expect(scene.querySelector("img")).toBeInTheDocument()

        act(() => vi.advanceTimersByTime(599))
        expect(scene.querySelector("img")).toBeInTheDocument()
        act(() => vi.advanceTimersByTime(1))
        expect(scene.querySelector("img")).toBeNull()
        expect(scene).toHaveAttribute("data-live", "true")
        expect(screen.getByRole("button", { name: "Meja tulis" })).toBe(button)
        expect(document.activeElement).toBe(button)
      })

      it("stays on the still image, without a message, when the scene fails to load", async () => {
        const { scene } = renderScene(desktop)
        await vi.waitFor(() => expect(canvas.props).not.toBeNull())
        act(() => canvas.props?.onFail())
        expect(scene).toHaveAttribute("data-quality", "diam")
        expect(scene).not.toHaveAttribute("data-live")
        expect(scene.querySelector("img")).toBeInTheDocument()
        expect(screen.queryByTestId("lobby-canvas")).toBeNull()
        expect(screen.queryByRole("alert")).toBeNull()
        expect(scene).not.toHaveTextContent(/gagal|error/i)
      })
    })

    it("does not swallow the arrow keys before the scene is live", async () => {
      const { scene } = renderScene(desktop)
      await vi.waitFor(() => expect(canvas.props).not.toBeNull())
      expect(fireEvent.keyDown(scene, { key: "ArrowRight" })).toBe(true)
    })
  })
})
