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
import { HotspotLayer } from "./HotspotLayer"
import { LobbyCanvas } from "./LobbyCanvas"
import { LobbyStill, STILL_SIZE, STILL_VIEW } from "./LobbyStill"
import type { HotspotModel } from "./lobby-data"
import { type HotspotId, type Point2, spotOf } from "./scene/layout"
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
import type { Stage } from "./scene/stage"

export type LobbySceneHandle = {
  /** Moves the camera to a hotspot (the map's spots). */
  showSpot: (id: HotspotId) => void
}

type Camera = { view: View; viewport: Viewport }

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
  allow3d = true,
  ref,
}: {
  hotspots: ReadonlyArray<HotspotModel>
  anda: Point2
  bubbles?: Partial<Record<HotspotId, ReactNode>>
  onActivate: (id: HotspotId) => void
  /** Whether a live 3D camera is on screen, so showSpot can move it. */
  onLiveChange?: (live: boolean) => void
  /** Behind a popup: the 3D scene keeps its last frame (spec 1F §4.5). */
  paused?: boolean
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

  useImperativeHandle(ref, () => ({
    showSpot: (id) =>
      moveCamera((current) => centerOn(current.view, spotOf(id).label)),
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

  const live = mode === "3d" && camera !== null
  useEffect(() => {
    onLiveChange?.(live)
  }, [live, onLiveChange])

  return (
    <section
      aria-label="Adegan lobi"
      tabIndex={0}
      data-quality={quality ?? undefined}
      className="lobby-scene"
      onKeyDown={onKeyDown}
    >
      {mode !== "still" && quality !== null && allow3d && (
        <LobbyCanvas
          quality={quality}
          test={test}
          anda={anda}
          paused={paused}
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
        {!live && (
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
