// The 3D lobby on a page of its own, served by scripts/lobby-harness.mjs: for
// looking at the scene while working on it, and for rendering the still image.
// Not part of the app.
import { ANDA_START, DECOR_SLOTS } from "@/components/lobby/scene/layout"
import {
  MAX_ZOOM,
  centerOn,
  startView,
} from "@/components/lobby/scene/projection"
import { itemOf } from "@/lib/shop/catalog"
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
// ?decor=all: one item in every slot, to check where they stand.
// ?decor=<id>: that item alone, the camera close on its slot (the shop's pictures).
const decorParam = new URLSearchParams(window.location.search).get("decor")
if (decorParam === "all") {
  stage.setDecor({
    rug: "rug_pattern",
    lamp: "lamp_arc",
    seat: "seat_sofa",
    wall: "wall_painting",
    pet: "pet_cat",
    ceiling: "ceiling_lights",
  })
} else if (decorParam) {
  const item = itemOf(decorParam)
  if (!item) throw new Error(`No shop item ${decorParam}`)
  stage.setDecor({ [item.slot]: item.id })
  const view = startView({ width: host.clientWidth, height: host.clientHeight })
  stage.setView({
    ...centerOn(view, DECOR_SLOTS[item.slot].focus),
    zoom: MAX_ZOOM,
  })
}
document.body.dataset.books = String(stage.books)
// The first frame draws the scene; the second shows it.
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    document.body.dataset.ready = "true"
  })
)
