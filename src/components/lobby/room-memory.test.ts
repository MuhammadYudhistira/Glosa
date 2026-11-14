import { afterEach, describe, expect, it } from "vitest"
import { ROOM_SEEN_KEY } from "@/lib/local/keys"
import { FIRE_STRENGTH } from "./room-signals"
import {
  type RoomSnapshot,
  changesSince,
  readRoomSnapshot,
  rememberRoomSnapshot,
  signalLevels,
} from "./room-memory"

const base: RoomSnapshot = {
  fire: "kecil",
  deskLamp: false,
  parcelOpen: false,
  plant: "daun",
  finished: 3,
}

describe("changesSince", () => {
  it("plays nothing on the first visit or when nothing changed", () => {
    expect(changesSince(null, base)).toEqual([])
    expect(changesSince(base, { ...base })).toEqual([])
  })
  it("lists each change once, in a fixed order", () => {
    const next: RoomSnapshot = {
      fire: "besar",
      deskLamp: true,
      parcelOpen: true,
      plant: "rimbun",
      finished: 4,
    }
    expect(changesSince(base, next)).toEqual([
      "fire",
      "deskLamp",
      "parcel",
      "plant",
      "showcase",
    ])
  })
  it("plays the fire both ways, but only a lamp or a lid that turns on", () => {
    expect(changesSince(base, { ...base, fire: "bara" })).toEqual(["fire"])
    expect(
      changesSince({ ...base, deskLamp: true, parcelOpen: true }, base)
    ).toEqual([])
  })
  it("plays only growth and new finished books", () => {
    expect(changesSince(base, { ...base, plant: "tunas" })).toEqual([])
    expect(changesSince(base, { ...base, finished: 2 })).toEqual([])
  })
})

describe("room snapshot on this device", () => {
  afterEach(() => localStorage.clear())
  it("keeps the last snapshot and ignores a broken one", () => {
    expect(readRoomSnapshot()).toBeNull()
    rememberRoomSnapshot(base)
    expect(readRoomSnapshot()).toEqual(base)
    localStorage.setItem(ROOM_SEEN_KEY, '{"fire":"api"}')
    expect(readRoomSnapshot()).toBeNull()
  })
})

describe("signalLevels", () => {
  const lit = { fire: "besar", deskLamp: true, parcelOpen: true } as const

  it("shows the signals as they are without a moment", () => {
    expect(signalLevels(lit, null)).toEqual({
      fire: FIRE_STRENGTH.besar,
      desk: 1,
      lid: 1,
    })
    expect(
      signalLevels({ fire: "bara", deskLamp: false, parcelOpen: false }, null)
    ).toEqual({ fire: FIRE_STRENGTH.bara, desk: 0, lid: 0 })
  })

  it("blends only what changed, from the last visit's room to this one", () => {
    const from: RoomSnapshot = { ...base, fire: "bara" }
    const start = signalLevels(lit, {
      from,
      changes: ["fire", "deskLamp", "parcel"],
      k: 0,
    })
    expect(start).toEqual({ fire: FIRE_STRENGTH.bara, desk: 0, lid: 0 })
    const half = signalLevels(lit, { from, changes: ["fire"], k: 0.5 })
    expect(half.fire).toBeCloseTo(
      (FIRE_STRENGTH.bara + FIRE_STRENGTH.besar) / 2
    )
    // The lamp and the lid were not in the moment: already as they are.
    expect(half).toMatchObject({ desk: 1, lid: 1 })
    expect(
      signalLevels(lit, { from, changes: ["fire", "deskLamp"], k: 1 })
    ).toEqual(signalLevels(lit, null))
  })
})
