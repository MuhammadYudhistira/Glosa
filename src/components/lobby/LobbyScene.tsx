import {
  type KeyboardEvent,
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
import { useWideScreen } from "@/lib/use-wide-screen"
import { HotspotLayer } from "./HotspotLayer"
import { LobbyCanvas } from "./LobbyCanvas"
import { LobbyStill, STILL_SIZE, STILL_VIEW } from "./LobbyStill"
import { stillFrame } from "./label-layout"
import type { HotspotModel } from "./lobby-data"
import type { RoomChange, RoomSnapshot } from "./room-memory"
import { NEUTRAL_SIGNALS, NO_NOTES, type RoomSignals } from "./room-signals"
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
 * poster while it loads and as the fallback without WebGL, with the hotspots
 * on top. Focus it to move the camera with the arrow keys.
 */
export function LobbyScene({
  hotspots,
  anda,
  bubbles,
  onActivate,
  onLiveChange,
  paused = false,
  showcase = [],
  plant = "tunas",
  signals = NEUTRAL_SIGNALS,
  notes = NO_NOTES,
  shelves = EMPTY_HUES,
  decor = {},
  allow3d = true,
  ref,
}: {
  hotspots: ReadonlyArray<HotspotModel>
  anda: Point2
  bubbles?: Partial<Record<HotspotId, ReactNode>>
  onActivate: (id: HotspotId, how: { keyboard: boolean }) => void
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
  const wide = useWideScreen()
  // The scene's size, for the still image's frame: the labels keep apart in
  // screen pixels (label-layout.ts), and wait unseen until it is known.
  const [size, setSize] = useState<Viewport | null>(null)
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const measure = () => {
      const { clientWidth: width, clientHeight: height } = section
      // Hidden (behind a page on phones): nothing to keep apart.
      setSize((current) =>
        width > 0 && height > 0
          ? current?.width === width && current.height === height
            ? current
            : { width, height }
          : null
      )
    }
    if (typeof ResizeObserver === "undefined") {
      // Older browsers: once now, and whenever the window changes size.
      measure()
      window.addEventListener("resize", measure)
      return () => window.removeEventListener("resize", measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

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

  return (
    <section
      ref={sectionRef}
      aria-label="Adegan ruang baca"
      tabIndex={0}
      data-quality={quality ?? undefined}
      data-live={live ? "true" : undefined}
      className="lobby-scene"
      onKeyDown={onKeyDown}
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
          frame={live ? camera.viewport : size && stillFrame(size)}
          scene={live ? null : size}
          fontPx={wide ? 14 : 12}
          bubbles={bubbles}
          onActivate={onActivate}
          onFocusSpot={live ? reveal : undefined}
        />
      </div>
      {live && (
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
