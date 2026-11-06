/** The lobby shop (spec 3C §4): six fixed slots, three items each. */
export const SLOT_IDS = [
  "rug",
  "lamp",
  "seat",
  "wall",
  "pet",
  "ceiling",
] as const
export type SlotId = (typeof SLOT_IDS)[number]

export const SLOTS: ReadonlyArray<{ id: SlotId; name: string }> = [
  { id: "rug", name: "Karpet baca" },
  { id: "lamp", name: "Lampu" },
  { id: "seat", name: "Kursi santai" },
  { id: "wall", name: "Dinding" },
  { id: "pet", name: "Teman" },
  { id: "ceiling", name: "Gantungan" },
]

export type ShopItem = { id: string; slot: SlotId; name: string; price: number }

/** Same ids, slots and prices as the lobby_items rows (tests/db/shop.test.ts). */
export const SHOP_ITEMS: ReadonlyArray<ShopItem> = [
  { id: "rug_woven", slot: "rug", name: "Karpet anyaman", price: 60 },
  { id: "rug_round", slot: "rug", name: "Karpet bundar", price: 120 },
  { id: "rug_pattern", slot: "rug", name: "Karpet motif", price: 300 },
  { id: "lamp_floor", slot: "lamp", name: "Lampu lantai", price: 80 },
  { id: "lamp_arc", slot: "lamp", name: "Lampu tiang lengkung", price: 150 },
  { id: "lamp_lantern", slot: "lamp", name: "Lentera gantung", price: 250 },
  { id: "seat_beanbag", slot: "seat", name: "Bean bag", price: 100 },
  { id: "seat_armchair", slot: "seat", name: "Kursi berlengan", price: 200 },
  { id: "seat_sofa", slot: "seat", name: "Sofa jendela", price: 400 },
  { id: "wall_map", slot: "wall", name: "Peta dunia", price: 120 },
  { id: "wall_painting", slot: "wall", name: "Lukisan", price: 200 },
  { id: "wall_clock", slot: "wall", name: "Jam dinding besar", price: 300 },
  { id: "pet_cat", slot: "pet", name: "Kucing tidur", price: 250 },
  { id: "pet_bird", slot: "pet", name: "Sangkar burung", price: 300 },
  { id: "pet_aquarium", slot: "pet", name: "Akuarium", price: 400 },
  { id: "ceiling_lights", slot: "ceiling", name: "Untaian lampu", price: 150 },
  { id: "ceiling_books", slot: "ceiling", name: "Buku terbang", price: 350 },
  {
    id: "ceiling_globe",
    slot: "ceiling",
    name: "Bola dunia antik",
    price: 600,
  },
]

export const itemOf = (id: string): ShopItem | undefined =>
  SHOP_ITEMS.find((item) => item.id === id)

/** Coins for a finished book read at least MIN_BOOK_SECONDS (spec 3C §3.1). */
export const COINS_PER_BOOK = 50
export const MIN_BOOK_SECONDS = 3600
/** The most coins one day of reading earns. */
export const DAILY_COIN_CAP = 240
