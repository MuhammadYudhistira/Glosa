import { useLocation } from "@tanstack/react-router"
import { useEffect } from "react"
import { sceneStateFor } from "./scene-state"

export function SceneBackdrop() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const state = sceneStateFor(pathname)
  const hasScene = state !== null

  // Clicking anywhere skips running scene animations for a moment (spec §6).
  useEffect(() => {
    if (!hasScene) return
    const root = document.documentElement
    let timer: ReturnType<typeof setTimeout> | undefined
    const skip = () => {
      root.dataset.skipAnim = "true"
      clearTimeout(timer)
      timer = setTimeout(() => {
        delete root.dataset.skipAnim
      }, 1200)
    }
    window.addEventListener("pointerdown", skip)
    return () => {
      window.removeEventListener("pointerdown", skip)
      clearTimeout(timer)
      delete root.dataset.skipAnim
    }
  }, [hasScene])

  if (!state) return null
  return (
    <div aria-hidden="true" className="scene-viewport">
      <div
        className="scene-canvas"
        data-focus={state.focus}
        data-blur={state.blur}
      >
        <img
          src="/lobby/scene.svg"
          alt=""
          className="scene-image"
          draggable={false}
        />
        <img
          src="/lobby/scene-labels.svg"
          alt=""
          className="scene-labels"
          draggable={false}
        />
        {state.focus === "overview" && <span className="scene-pulse" />}
      </div>
      {state.dim && <div className="scene-dim" />}
    </div>
  )
}
