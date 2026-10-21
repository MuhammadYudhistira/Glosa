import { useEffect, useRef } from "react"
import type { Point2 } from "./scene/layout"
import { type View, type Viewport, startView } from "./scene/projection"
import type { Quality } from "./scene/quality"
import type { Stage } from "./scene/stage"

/**
 * The 3D scene. three.js arrives in its own chunk, loaded only here (spec 1D
 * §3.1). Any failure (no chunk offline, no WebGL) calls onFail, and the lobby
 * keeps the still image.
 */
export function LobbyCanvas({
  quality,
  test,
  anda,
  paused,
  onReady,
  onView,
  onQuality,
  onFail,
}: {
  /** Read once, when the stage is created. */
  quality: Quality
  test: boolean
  anda: Point2
  /** Behind a popup: the stage keeps its last frame (spec 1F §4.5). */
  paused: boolean
  onReady: (stage: Stage) => void
  onView: (view: View, viewport: Viewport) => void
  onQuality: (quality: Quality) => void
  onFail: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Stage | null>(null)
  const andaRef = useRef(anda)
  const pausedRef = useRef(paused)
  const callbacks = useRef({ onReady, onView, onQuality, onFail })
  const initial = useRef({ quality, test })

  useEffect(() => {
    callbacks.current = { onReady, onView, onQuality, onFail }
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    import("./scene/stage")
      .then(({ createStage }) => {
        if (cancelled) return
        const viewport = { width: host.clientWidth, height: host.clientHeight }
        const stage = createStage({
          host,
          mode: initial.current.test ? "test" : "normal",
          quality: initial.current.quality,
          view: startView(viewport),
          anda: andaRef.current,
          onView: (view, size) => callbacks.current.onView(view, size),
          onQuality: (next) => callbacks.current.onQuality(next),
          onLost: () => callbacks.current.onFail(),
        })
        stage.setPaused(pausedRef.current)
        stageRef.current = stage
        callbacks.current.onReady(stage)
      })
      .catch((error: unknown) => {
        console.error("the 3D lobby could not start", error)
        if (!cancelled) callbacks.current.onFail()
      })
    return () => {
      cancelled = true
      stageRef.current?.dispose()
      stageRef.current = null
    }
  }, [])

  // "Anda" walks wherever the page sends them.
  useEffect(() => {
    andaRef.current = anda
    stageRef.current?.walkTo(anda)
  }, [anda])

  useEffect(() => {
    pausedRef.current = paused
    stageRef.current?.setPaused(paused)
  }, [paused])

  return <div ref={hostRef} className="lobby-canvas-host" />
}
