import { type View, type Viewport, startView } from "./scene/projection"

/** The still image's size; scripts/lobby-harness.mjs renders it at this size. */
export const STILL_SIZE: Viewport = { width: 2560, height: 1440 }
/** What the still image shows: the wide-screen start view. */
export const STILL_VIEW: View = startView(STILL_SIZE)

/**
 * The lobby drawn once (spec 1D §3.1): the poster while the 3D scene loads,
 * the scene itself without WebGL, and the backdrop of the welcome and sign-in
 * pages.
 */
export function LobbyStill({
  className,
  sizes = "100vw",
  loading = "eager",
}: {
  className?: string
  sizes?: string
  /** Lazy where the lobby may stay hidden (behind a page on phones), so it is not fetched. */
  loading?: "eager" | "lazy"
}) {
  return (
    <picture>
      <source
        type="image/avif"
        srcSet="/lobby/lobby-still-1280.avif 1280w, /lobby/lobby-still.avif 2560w"
        sizes={sizes}
      />
      <source
        type="image/webp"
        srcSet="/lobby/lobby-still-1280.webp 1280w, /lobby/lobby-still.webp 2560w"
        sizes={sizes}
      />
      <img
        src="/lobby/lobby-still.webp"
        alt=""
        width={STILL_SIZE.width}
        height={STILL_SIZE.height}
        loading={loading}
        decoding="async"
        draggable={false}
        className={className}
      />
    </picture>
  )
}
