/** Pure data: which glTF model (if any) stands behind each logical room object. */
export type ModelSource = "kaykit" | "polypizza" | "code"
export type ModelEntry = {
  file: string | null
  source: ModelSource
  credit: string
}

export const MODEL_DIR = "/lobby/models/"

export const MODEL_KEYS = [
  "armchair",
  "readingLamp",
  "desk",
  "deskChair",
  "laptop",
  "notebook",
  "sideTable",
  "catalogue",
  "parcelBox",
  "door",
  "fireplace",
  "glassCabinet",
  "windowFrame",
  "corkboard",
  "plantPot",
  "anda",
  "decor_rug_woven",
  "decor_rug_round",
  "decor_rug_pattern",
  "decor_lamp_floor",
  "decor_lamp_arc",
  "decor_lamp_lantern",
  "decor_seat_beanbag",
  "decor_seat_armchair",
  "decor_seat_sofa",
  "decor_wall_map",
  "decor_wall_painting",
  "decor_wall_clock",
  "decor_pet_cat",
  "decor_pet_bird",
  "decor_pet_aquarium",
  "decor_ceiling_lights",
  "decor_ceiling_books",
  "decor_ceiling_globe",
] as const

export type ModelKey = (typeof MODEL_KEYS)[number]

const kay = (file: string, credit: string): ModelEntry => ({
  file,
  source: "kaykit",
  credit,
})
const code: ModelEntry = {
  file: null,
  source: "code",
  credit: "dibuat lewat kode",
}

export const MODELS: Record<ModelKey, ModelEntry> = {
  armchair: kay("armchair.glb", "armchair"),
  readingLamp: kay("lamp-table.glb", "lamp_table"),
  desk: kay("table-medium-long.glb", "table_medium_long"),
  deskChair: kay("chair-a-wood.glb", "chair_A_wood"),
  laptop: code,
  notebook: kay("book-single.glb", "book_single"),
  sideTable: kay("table-small.glb", "table_small"),
  catalogue: kay("book-set.glb", "book_set"),
  // Prototype Bits (same author and style as Furniture Bits)
  parcelBox: kay("box-b.glb", "Prototype Bits Box_B"),
  door: kay("door-a.glb", "Prototype Bits Door_A"),
  fireplace: code,
  glassCabinet: code,
  windowFrame: code,
  corkboard: code,
  plantPot: kay("cactus-medium-a.glb", "cactus_medium_A"),
  anda: code,
  decor_rug_woven: kay(
    "rug-rectangle-stripes-a.glb",
    "rug_rectangle_stripes_A"
  ),
  decor_rug_round: kay("rug-oval-a.glb", "rug_oval_A"),
  decor_rug_pattern: kay("rug-rectangle-b.glb", "rug_rectangle_B"),
  decor_lamp_floor: kay("lamp-standing.glb", "lamp_standing"),
  decor_lamp_arc: code,
  // Halloween Bits
  decor_lamp_lantern: kay(
    "lantern-standing.glb",
    "Halloween Bits lantern_standing"
  ),
  decor_seat_beanbag: code,
  decor_seat_armchair: kay("armchair-pillows.glb", "armchair_pillows"),
  decor_seat_sofa: kay("couch-pillows.glb", "couch_pillows"),
  decor_wall_map: code,
  decor_wall_painting: kay("pictureframe-large-a.glb", "pictureframe_large_A"),
  decor_wall_clock: code,
  decor_pet_cat: code,
  decor_pet_bird: code,
  decor_pet_aquarium: code,
  decor_ceiling_lights: code,
  decor_ceiling_books: code,
  decor_ceiling_globe: code,
}
