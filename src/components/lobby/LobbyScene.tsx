import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { Button } from "@/components/ui/button"
import type { HighlightColor } from "@/lib/annotations/types"
import type { PlantStage } from "@/lib/reading-habit"
import type { SlotId } from "@/lib/shop/catalog"
import type { Placements } from "@/lib/shop/types"
import { HotspotLayer } from "./HotspotLayer"
import { HoverName } from "./HoverName"
import { LobbyCanvas } from "./LobbyCanvas"
import { LobbyStill, STILL_SIZE, STILL_VIEW } from "./LobbyStill"
import type { HotspotModel } from "./lobby-data"
import type { RoomChange, RoomSnapshot } from "./room-memory"
import { NEUTRAL_SIGNALS, NO_NOTES, type RoomSignals } from "./room-signals"
import { viewMoved } from "./scene/frame-loop"
import {
  DECOR_SLOTS,
  type HotspotId,
  PREVIEW_SHIFT,
  type Point2,
  type ShowcaseBook,
  spotOf,
} from "./scene/layout"
import {
  type View,
  type Viewport,
  centerOn,
  isInView,
  panBy,
  startView,
} from "./scene/projection"
import {
  type Quality,
  detectEnvironment,
  initialQuality,
} from "./scene/quality"
import { EMPTY_HUES, type GenreHues } from "./scene/shelf-books"
import type { Stage } from "./scene/stage"
import { createTapTracker } from "./tap"

export type LobbySceneHandle = {
  /** Moves the camera to a hotspot (the map's spots). */
  showSpot: (id: HotspotId) => void
  /** Brings a shop slot into view, a little aside for the shop panel. */
  showDecor: (slot: SlotId) => void
  /**
   * Anda walks to the hotspot and does its activity (spec 3F §4A.1);
   * resolves when it is done, at once without a live 3D scene.
   */
  perform: (id: HotspotId, how?: { instant?: boolean }) => Promise<void>
  /** Ends the walk and the activity at once (a second tap). */
  skip: () => void
  /**
   * The room plays what changed since the last visit (spec 3F §4A.2), once
   * it has faded in; nothing without a live 3D scene.
   */
  playMoments: (from: RoomSnapshot, changes: ReadonlyArray<RoomChange>) => void
}

type Camera = { view: View; viewport: Viewport }

/** How long the still image stays under the 3D room as it fades in (the CSS fade is 0.5 s). */
const FADE_MS = 600

/** Arrow keys move the camera by 15% of the screen. */
const PAN_KEYS: Partial<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-0.15, 0],
  ArrowRight: [0.15, 0],
  ArrowUp: [0, 0.15],
  ArrowDown: [0, -0.15],
}

/** Set by the E2E camera-bounds test before the page loads (plan 1D, decision 8). */
export function lobbyTestMode(): boolean {
  return (
    (window as Window & { __GLOSA_LOBBY_TEST__?: boolean })
      .__GLOSA_LOBBY_TEST__ === true
  )
}

/**
 * The lobby scene (spec 1D §3, §6): the 3D canvas, or the still image as the
 * poster while it loads and as the fallback without WebGL, with the places'
 * buttons on top. A tap on the 3D room goes to the picker (spec 3G §3.1); a
 * drag, a pinch or the wheel moves the camera. Focus it to move the camera
 * with the arrow keys.
 */
export function LobbyScene({
  hotspots,
  anda,
  bubbles,
  onActivate,
  onTap,
  onCameraGesture,
  onFocusPlace,
  onHover,
  onLiveChange,
  paused = false,
  showcase = [],
  plant = "tunas",
  signals = NEUTRAL_SIGNALS,
  notes = NO_NOTES,
  shelves = EMPTY_HUES,
  decor = {},
  highlight = null,
  describing = null,
  allow3d = true,
  ref,
}: {
  hotspots: ReadonlyArray<HotspotModel>
  anda: Point2
  bubbles?: Partial<Record<HotspotId, ReactNode>>
  /** Enter or Space on a place's button: `{ keyboard: true }`. */
  onActivate: (id: HotspotId, how: { keyboard: boolean }) => void
  /** A tap on the scene: the place under it, or null on empty space (spec 3G §3.1). */
  onTap?: (id: HotspotId | null) => void
  /** The camera starts to be dragged, pinched or zoomed. */
  onCameraGesture?: () => void
  /** A place's button took focus that is not a press. */
  onFocusPlace?: (id: HotspotId) => void
  /** The place under the mouse cursor changed (spec 3G §3.2). */
  onHover?: (id: HotspotId | null) => void
  /** Whether a live 3D camera is on screen, so showSpot can move it. */
  onLiveChange?: (live: boolean) => void
  /** Behind a popup: the 3D scene keeps its last frame (spec 1F §4.5). */
  paused?: boolean
  /** The finished books for the display cabinet. */
  showcase?: ReadonlyArray<ShowcaseBook>
  /** The habit plant's stage. */
  plant?: PlantStage
  /** What the room shows about the member's reading. */
  signals?: RoomSignals
  /** The colours of the corkboard's papers, newest highlight first. */
  notes?: ReadonlyArray<HighlightColor>
  /** Per genre, the colours of its books' covers, the newest first. */
  shelves?: GenreHues
  /** The shop's items, placed or tried on. */
  decor?: Placements | null
  /** The place whose floor ring is bright (spec 3G §3.4). */
  highlight?: HotspotId | null
  /** The place whose name card is open: its button is described by the card's line (spec 3G §3.3). */
  describing?: { id: HotspotId; domId: string } | null
  /** False keeps WebGL off, e.g. while the lobby is hidden behind a page on phones (spec 1F §5). */
  allow3d?: boolean
  ref?: Ref<LobbySceneHandle>
}) {
  const [quality, setQuality] = useState<Quality | null>(null)
  const [mode, setMode] = useState<"poster" | "3d" | "still">("poster")
  const [test, setTest] = useState(false)
  const [camera, setCamera] = useState<Camera | null>(null)
  const stageRef = useRef<Stage | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const sectionRef = useRef<HTMLElement>(null)

  // Holding WebGL back unmounts the canvas, which disposes its stage: the
  // scene is no longer live, and the poster shows until a new stage is ready.
  const [allowed, setAllowed] = useState(allow3d)
  if (allowed !== allow3d) {
    setAllowed(allow3d)
    if (!allow3d) {
      setCamera(null)
      if (mode === "3d") setMode("poster")
    }
  }
  useEffect(() => {
    if (allow3d) return
    stageRef.current = null
    cameraRef.current = null
  }, [allow3d])

  // Only the browser knows how the lobby can be drawn; the server sends the poster.
  useEffect(() => {
    const environment = detectEnvironment()
    const testing = lobbyTestMode()
    setTest(testing)
    setQuality(testing ? "diam" : initialQuality(environment))
    if (!environment.webgl) setMode("still")
  }, [])

  const moveCamera = (next: (current: Camera) => View) => {
    const current = cameraRef.current
    if (current && stageRef.current) stageRef.current.setView(next(current))
  }

  const live = mode === "3d" && camera !== null

  // The 3D room fades in over the still image: the still stays under the
  // canvas until the fade is done. Set while rendering, so no frame goes by
  // without either of them.
  const [fading, setFading] = useState(false)
  const [wasLive, setWasLive] = useState(live)
  if (wasLive !== live) {
    setWasLive(live)
    setFading(live)
  }
  useEffect(() => {
    if (!fading) return
    const timer = setTimeout(() => setFading(false), FADE_MS)
    return () => clearTimeout(timer)
  }, [fading])

  /** Moments asked for while the room fades in: they play once it is in full view. */
  const waitingMoments = useRef<{
    from: RoomSnapshot
    changes: ReadonlyArray<RoomChange>
  } | null>(null)
  useEffect(() => {
    if (fading) return
    const waiting = waitingMoments.current
    waitingMoments.current = null
    if (waiting && live) {
      stageRef.current?.playMoments(waiting.from, waiting.changes)
    }
  }, [fading, live])

  useImperativeHandle(ref, () => ({
    showSpot: (id) =>
      moveCamera((current) => centerOn(current.view, spotOf(id).label)),
    showDecor: (slot) =>
      moveCamera((current) =>
        panBy(
          centerOn(current.view, DECOR_SLOTS[slot].focus),
          PREVIEW_SHIFT,
          0,
          current.viewport
        )
      ),
    perform: (id, how) =>
      (live ? stageRef.current?.perform(id, how) : undefined) ??
      Promise.resolve(),
    skip: () => stageRef.current?.skip(),
    playMoments: (from, changes) => {
      if (!live) return
      if (fading) waitingMoments.current = { from, changes }
      else stageRef.current?.playMoments(from, changes)
    },
  }))

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const step = PAN_KEYS[event.key]
    if (event.target !== event.currentTarget || !step) return
    // Without a live camera the arrow keys keep scrolling the page.
    if (!cameraRef.current || !stageRef.current) return
    event.preventDefault()
    moveCamera((current) =>
      panBy(current.view, step[0], step[1], current.viewport)
    )
  }

  /** A focused hotspot off screen brings the camera to it (spec 1D §6). */
  function reveal(id: HotspotId) {
    const point = spotOf(id).label
    moveCamera((current) =>
      isInView(point, current.view, current.viewport)
        ? current.view
        : centerOn(current.view, point)
    )
  }

  useEffect(() => {
    onLiveChange?.(live)
  }, [live, onLiveChange])

  const [hover, setHover] = useState<{
    id: HotspotId
    x: number
    y: number
  } | null>(null)
  // Nothing is hovered behind a popup, or without a live camera; nor is the
  // name from before a pause brought back after it.
  if (hover && (paused || !live)) setHover(null)
  const shownHover = live && !paused ? hover : null
  const hoverId = shownHover?.id ?? null
  // Only a change is reported: at first nothing is under the cursor.
  const reportedHover = useRef<HotspotId | null>(null)
  useEffect(() => {
    if (reportedHover.current === hoverId) return
    reportedHover.current = hoverId
    onHover?.(hoverId)
  }, [hoverId, onHover])
  /** The pick waiting for the next frame, if any. */
  const hoverFrame = useRef<{ id: number } | null>(null)
  const hoverAt = useRef<{ x: number; y: number } | null>(null)
  useEffect(
    () => () => {
      if (hoverFrame.current) cancelAnimationFrame(hoverFrame.current.id)
    },
    []
  )
  /** The name goes, and a pick still waiting for its frame finds nothing. */
  const dropHover = () => {
    hoverAt.current = null
    setHover(null)
  }

  const tracker = useRef(createTapTracker())
  /** The scene's own pointer events; buttons and links on top of it keep theirs. */
  const overOverlay = (event: { target: EventTarget }) =>
    event.target instanceof Element &&
    event.target.closest("button, a, output") !== null
  const sample = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return {
      id: event.pointerId,
      type: event.pointerType,
      button: event.button,
      time: event.timeStamp,
      x: event.clientX - box.left,
      y: event.clientY - box.top,
    }
  }
  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (overOverlay(event)) return
    if (tracker.current.down(sample(event))) onCameraGesture?.()
  }
  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (tracker.current.move(sample(event))) onCameraGesture?.()
    if (!live || paused || event.pointerType !== "mouse") return
    // No name over a button, nor while a button is held: a drag pans the camera.
    if (event.buttons !== 0 || overOverlay(event)) {
      dropHover()
      return
    }
    hoverAt.current = sample(event)
    // At most one pick a frame, however fast the mouse moves.
    if (hoverFrame.current) return
    const frame = { id: 0 }
    hoverFrame.current = frame
    frame.id = requestAnimationFrame(() => {
      if (hoverFrame.current === frame) hoverFrame.current = null
      const at = hoverAt.current
      const id = at ? (stageRef.current?.pick(at.x, at.y) ?? null) : null
      setHover(at && id ? { id, x: at.x, y: at.y } : null)
    })
  }
  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (overOverlay(event)) {
      tracker.current.cancel()
      return
    }
    const hit = tracker.current.up(sample(event))
    if (!hit) return
    // Without a live camera (the still image) a tap on empty space is just "nowhere".
    onTap?.(live ? (stageRef.current?.pick(hit.x, hit.y) ?? null) : null)
  }

  // On a phone held upright "Pusatkan" waits for the camera to leave its
  // first view (spec 3G §3.7); elsewhere it is always there, as before.
  const upright =
    camera !== null && camera.viewport.height > camera.viewport.width
  const away =
    camera !== null && viewMoved(camera.view, startView(camera.viewport))

  return (
    <section
      ref={sectionRef}
      aria-label="Adegan ruang baca"
      tabIndex={0}
      data-quality={quality ?? undefined}
      data-live={live ? "true" : undefined}
      data-hover={shownHover ? "" : undefined}
      className="lobby-scene"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => tracker.current.cancel()}
      // A press released outside the scene never sends its pointerup here.
      onPointerLeave={() => {
        tracker.current.cancel()
        dropHover()
      }}
      onWheel={() => {
        if (!live) return
        onCameraGesture?.()
        // The camera moves under a still cursor: its name would be stale.
        dropHover()
      }}
    >
      {mode !== "still" && quality !== null && allow3d && (
        <LobbyCanvas
          quality={quality}
          test={test}
          anda={anda}
          paused={paused}
          showcase={showcase}
          plant={plant}
          signals={signals}
          notes={notes}
          shelves={shelves}
          decor={decor}
          highlight={highlight}
          onReady={(stage) => {
            stageRef.current = stage
            setMode("3d")
          }}
          onView={(view, viewport) => {
            cameraRef.current = { view, viewport }
            setCamera(cameraRef.current)
          }}
          onQuality={setQuality}
          onFail={() => {
            stageRef.current = null
            setQuality("diam")
            setMode("still")
          }}
        />
      )}
      {/* One tree position for the hotspots in every mode, so focus survives a switch. */}
      <div className={live ? "lobby-live-layer" : "lobby-still-frame"}>
        {/* The frame covers the scene: as wide as 16:9 at its full height. */}
        {(!live || fading) && (
          <LobbyStill
            className="lobby-still"
            sizes="max(100vw, 178vh)"
            loading={allow3d ? "eager" : "lazy"}
          />
        )}
        <HotspotLayer
          hotspots={hotspots}
          view={live ? camera.view : STILL_VIEW}
          viewport={live ? camera.viewport : STILL_SIZE}
          dots={!live}
          bubbles={bubbles}
          onKey={(id) => onActivate(id, { keyboard: true })}
          onTap={(id) => onTap?.(id)}
          onFocusSpot={(id) => {
            // A focused hotspot off screen brings the camera to it (spec 1D §6).
            if (live) reveal(id)
            onFocusPlace?.(id)
          }}
          describing={describing}
        />
      </div>
      {shownHover && (
        <HoverName
          name={hotspots.find((spot) => spot.id === shownHover.id)?.label ?? ""}
          x={shownHover.x}
          y={shownHover.y}
        />
      )}
      {live && (!upright || away) && (
        <Button
          variant="secondary"
          size="sm"
          className="lobby-center lobby-overlay"
          onClick={() => moveCamera((current) => startView(current.viewport))}
        >
          Pusatkan
        </Button>
      )}
    </section>
  )
}
