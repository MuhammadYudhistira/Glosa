// The 3D lobby on a page of its own, served by scripts/lobby-harness.mjs: for
// looking at the scene while working on it, and for rendering the still image.
// Not part of the app.
import { ANDA_START } from "@/components/lobby/scene/layout"
import { startView } from "@/components/lobby/scene/projection"
import { type StageMode, createStage } from "@/components/lobby/scene/stage"

const requested = new URLSearchParams(window.location.search).get("mode")
const mode: StageMode =
  requested === "still" || requested === "test" ? requested : "normal"
const host = document.getElementById("stage")
if (!host) throw new Error("#stage is missing")

const stage = createStage({
  host,
  mode,
  quality: mode === "test" ? "diam" : "tinggi",
  view: startView({ width: host.clientWidth, height: host.clientHeight }),
  anda: ANDA_START,
  onView: () => undefined,
  onQuality: (quality) => {
    document.body.dataset.quality = quality
  },
  onLost: () => {
    document.body.dataset.lost = "true"
  },
})
document.body.dataset.books = String(stage.books)
// The first frame draws the scene; the second shows it.
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    document.body.dataset.ready = "true"
  })
)
