// The 3D lobby on a page of its own, served by scripts/lobby-harness.mjs: for
// looking at the scene while working on it, and for rendering the still image.
// Not part of the app.
import { ANDA_START, DECOR_SLOTS } from "@/components/lobby/scene/layout"
import { genreHues } from "@/components/lobby/scene/shelf-books"
import {
  MAX_ZOOM,
  centerOn,
  startView,
} from "@/components/lobby/scene/projection"
import { HIGHLIGHT_COLORS, type HighlightColor } from "@/lib/annotations/types"
import { itemOf } from "@/lib/shop/catalog"
import type { Mood } from "@/components/lobby/scene/daylight"
import { NEUTRAL_SIGNALS } from "@/components/lobby/room-signals"
import { type StageMode, createStage } from "@/components/lobby/scene/stage"

const params = new URLSearchParams(window.location.search)
const requested = params.get("mode")
const mode: StageMode =
  requested === "still" || requested === "test" ? requested : "normal"
// ?mood=day|dusk|night: the light to draw (night by default, like the still image).
const moodParam = params.get("mood")
const mood: Mood =
  moodParam === "day" || moodParam === "dusk" ? moodParam : "night"
const host = document.getElementById("stage")
if (!host) throw new Error("#stage is missing")

const stage = await createStage({
  host,
  mode,
  mood,
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
// ?fire=bara|kecil|besar, ?lamp=1, ?parcel=1: the room's reading signals.
const fireParam = params.get("fire")
stage.setSignals({
  fire:
    fireParam === "bara" || fireParam === "kecil" || fireParam === "besar"
      ? fireParam
      : NEUTRAL_SIGNALS.fire,
  deskLamp: params.get("lamp") === "1",
  parcelOpen: params.get("parcel") === "1",
})
// ?notes=yellow,green,pink: the corkboard's papers (up to three).
const noteColors = (params.get("notes") ?? "")
  .split(",")
  .filter((color): color is HighlightColor =>
    (HIGHLIGHT_COLORS as ReadonlyArray<string>).includes(color)
  )
stage.setNotes(noteColors)
// ?books=1: sample books on the shelves, 0 to 120 per genre (past a
// section's capacity), so full, part-filled and empty (dim) sections show.
if (params.get("books") === "1") {
  const counts = [0, 120, 35, 0, 78, 12, 54, 3]
  stage.setShelves(
    genreHues((_, g) =>
      Array.from({ length: counts[g] }, (_book, i) => (i * 47 + g * 29) % 360)
    )
  )
}
// ?decor=all: one item in every slot, to check where they stand.
// ?decor=<id>: that item alone, the camera close on its slot (the shop's pictures).
const decorParam = params.get("decor")
if (decorParam === "all") {
  stage.setDecor({
    rug: "rug_pattern",
    lamp: "lamp_arc",
    seat: "seat_sofa",
    wall: "wall_painting",
    pet: "pet_cat",
    ceiling: "ceiling_lights",
  })
} else if (decorParam?.includes(",")) {
  // ?decor=<id>,<id>,...: these items together, the whole room in view.
  const placed: Partial<Record<string, string>> = {}
  for (const id of decorParam.split(",")) {
    const item = itemOf(id)
    if (!item) throw new Error(`No shop item ${id}`)
    placed[item.slot] = item.id
  }
  stage.setDecor(placed)
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
// ?focus=x,y,z: the camera close on a point, to look at details.
const focusParam = params.get("focus")
if (focusParam) {
  const [x = 0, y = 0, z = 0] = focusParam.split(",").map(Number)
  const view = startView({ width: host.clientWidth, height: host.clientHeight })
  stage.setView({ ...centerOn(view, [x, y, z]), zoom: MAX_ZOOM })
}
document.body.dataset.books = String(stage.books)
// The first frame draws the scene; the second shows it.
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    document.body.dataset.ready = "true"
  })
)
