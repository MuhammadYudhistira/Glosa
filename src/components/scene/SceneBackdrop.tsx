import { useRouterState } from "@tanstack/react-router"
import { type CSSProperties, useEffect } from "react"
import {
  LobbyStill,
  STILL_SIZE,
  STILL_VIEW,
} from "@/components/lobby/LobbyStill"
import { ADMIN_DESK } from "@/components/lobby/scene/layout"
import { project } from "@/components/lobby/scene/projection"
import { sceneStateFor } from "./scene-state"

// Where the admin desk sits in the still image; the CSS camera zooms in on it.
const desk = project([ADMIN_DESK[0], 1, ADMIN_DESK[1]], STILL_VIEW, STILL_SIZE)
const DESK_POSITION = {
  "--desk-x": `${desk.x}%`,
  "--desk-y": `${desk.y}%`,
} as CSSProperties

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
        style={DESK_POSITION}
      >
        {/* Zoomed in up to 3×: ask for the large image. */}
        <LobbyStill className="scene-image" sizes="300vw" />
        {state.focus === "overview" && <span className="scene-pulse" />}
      </div>
      {state.dim && <div className="scene-dim" />}
    </div>
  )
}
