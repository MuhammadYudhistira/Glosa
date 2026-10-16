import { useRouterState } from "@tanstack/react-router"
import { useEffect } from "react"
import { sceneStateFor } from "./scene-state"

export function SceneBackdrop() {
  // Follow the resolved location, not the pending one: a navigation that a
  // route guard redirects (e.g. /lobby → /welcome) must not unmount the scene.
  const pathname = useRouterState({
    select: (state) => (state.resolvedLocation ?? state.location).pathname,
  })
  const state = sceneStateFor(pathname)
  const hasScene = state !== null

  // Clicking anywhere (or pressing Escape) jumps the animations that are
  // running right now to their end (spec §6). Animations that start after the
  // click, such as the camera zoom of the navigation it triggers, still play.
  // Infinite ones (the pulse) are left alone: finish() throws for them.
  useEffect(() => {
    if (!hasScene) return
    const skip = () => {
      for (const animation of document.getAnimations()) {
        if (animation.effect?.getComputedTiming().iterations !== Infinity) {
          animation.finish()
        }
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") skip()
    }
    window.addEventListener("pointerdown", skip)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("pointerdown", skip)
      window.removeEventListener("keydown", onKeyDown)
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
