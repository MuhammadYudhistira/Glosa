import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { ACTIVITY_SECONDS, POSES, WALK_MAX_SECONDS } from "./activities"
import { createKit } from "./kit"
import { ANDA_START, type Point2 } from "./layout"
import { createMotion, handAway } from "./motion"
import { buildPeople } from "./people"

function setup() {
  const people = buildPeople(createKit(new THREE.Scene()), ANDA_START)
  const motion = createMotion(people)
  const at = (): Point2 => [
    people.anda.root.position.x,
    people.anda.root.position.z,
  ]
  return { motion, at }
}

// A free spot a few steps from the start.
const NEAR: Point2 = [ANDA_START[0] - 1.5, ANDA_START[1]]

describe("motion", () => {
  it("stands still until sent somewhere", () => {
    const { motion } = setup()
    expect(motion.walking()).toBe(false)
  })

  it("walks while under way and stops on the spot", () => {
    const { motion, at } = setup()
    motion.walkTo(NEAR, false)
    expect(motion.walking()).toBe(true)
    let t = 0
    for (let i = 0; i < 600 && motion.walking(); i++) {
      t += 0.02
      motion.update(t, 0.02)
    }
    expect(motion.walking()).toBe(false)
    expect(at()[0]).toBeCloseTo(NEAR[0])
    expect(at()[1]).toBeCloseTo(NEAR[1])
  })

  it("is there at once when the walk is instant or finished early", () => {
    const instant = setup()
    instant.motion.walkTo(NEAR, true)
    expect(instant.motion.walking()).toBe(false)
    expect(instant.at()[0]).toBeCloseTo(NEAR[0])

    const cut = setup()
    cut.motion.walkTo(NEAR, false)
    cut.motion.finishWalk()
    expect(cut.motion.walking()).toBe(false)
    expect(cut.at()[0]).toBeCloseTo(NEAR[0])
  })
})

describe("motion: the activity after a tap (spec 3F §4A.1)", () => {
  function people() {
    const built = buildPeople(createKit(new THREE.Scene()), ANDA_START)
    return { built, motion: createMotion(built) }
  }
  const tick = (motion: ReturnType<typeof createMotion>, frames: number) => {
    for (let i = 0; i < frames; i++) motion.update(i * 0.02, 0.02)
  }

  it("walks there first, then takes the pose, then resolves and stops", async () => {
    const { built, motion } = people()
    const done = vi.fn()
    void motion.perform("menyiram", [NEAR[0], NEAR[1] - 2]).then(done)
    motion.walkTo(NEAR, false)
    expect(motion.acting()).toBe(true)
    // The walk takes at most 0.9 s, the activity 0.6 s.
    tick(motion, 10)
    expect(motion.walking()).toBe(true)
    expect(built.held.kaleng.visible).toBe(false)
    tick(motion, (WALK_MAX_SECONDS + ACTIVITY_SECONDS) / 0.02 + 2)
    expect(motion.walking()).toBe(false)
    expect(motion.acting()).toBe(false)
    await Promise.resolve()
    expect(done).toHaveBeenCalledTimes(1)
    // In the pose, facing the plant (-Z), the can in hand.
    expect(built.anda.torso.rotation.x).toBeCloseTo(POSES.menyiram.lean)
    expect(Math.abs(built.anda.root.rotation.y)).toBeCloseTo(Math.PI)
    expect(built.held.kaleng.visible).toBe(true)
    expect(built.held.buku.visible).toBe(false)
  })

  it("skip: in the pose at once, the promise kept", async () => {
    const { built, motion } = people()
    const done = vi.fn()
    void motion.perform("hangatkan", [NEAR[0], NEAR[1] - 2]).then(done)
    motion.walkTo(NEAR, false)
    tick(motion, 3)
    motion.skip()
    await Promise.resolve()
    expect(done).toHaveBeenCalledTimes(1)
    expect(motion.acting()).toBe(false)
    expect(motion.walking()).toBe(false)
    expect(built.anda.body.position.y).toBeCloseTo(-POSES.hangatkan.drop)
    expect(built.anda.root.position.x).toBeCloseTo(NEAR[0])
  })

  it("a new tap resolves the one before", async () => {
    const { motion } = people()
    const first = vi.fn()
    void motion.perform("menyiram", NEAR).then(first)
    void motion.perform("hangatkan", NEAR)
    await Promise.resolve()
    expect(first).toHaveBeenCalledTimes(1)
    expect(motion.acting()).toBe(true)
  })

  it("sits in the chair, and gets up where the walk ended before walking on", () => {
    const { built, motion } = people()
    const seat: Point2 = [NEAR[0], NEAR[1] - 0.8]
    void motion.perform("duduk-baca", [NEAR[0], 9], seat)
    motion.walkTo(NEAR, true)
    motion.skip()
    expect(built.anda.root.position.x).toBeCloseTo(seat[0])
    expect(built.anda.root.position.z).toBeCloseTo(seat[1])
    expect(built.held.buku.visible).toBe(true)
    motion.walkTo(ANDA_START, false)
    expect(built.anda.body.position.y).toBeCloseTo(0)
    expect(built.held.buku.visible).toBe(false)
    expect(motion.walking()).toBe(true)
    // It walks from the stand point, not through the chair.
    motion.update(0, 0)
    expect(built.anda.root.position.z).toBeCloseTo(NEAR[1])
  })

  it("never poses at a broken time", () => {
    const { built, motion } = people()
    void motion.perform("bungkuk", NEAR)
    motion.update(0, Number.NaN)
    motion.update(0, Number.NaN)
    expect(Number.isNaN(built.anda.torso.rotation.x)).toBe(false)
    expect(Number.isNaN(built.anda.body.position.y)).toBe(false)
  })
})

describe("motion: an activity done at once", () => {
  it("keeps the pose when the walk to that same spot comes after", () => {
    const built = buildPeople(createKit(new THREE.Scene()), ANDA_START)
    const motion = createMotion(built)
    motion.walkTo(NEAR, true)
    void motion.perform("hangatkan", [NEAR[0], NEAR[1] - 2])
    motion.skip()
    motion.walkTo(NEAR, true)
    expect(built.anda.body.position.y).toBeCloseTo(-POSES.hangatkan.drop)
    // Somewhere else: up and away.
    motion.walkTo(ANDA_START, true)
    expect(built.anda.body.position.y).toBeCloseTo(0)
    expect(built.anda.root.position.x).toBeCloseTo(ANDA_START[0])
  })
})

describe("handAway (the camera looks from +X +Z)", () => {
  it("is false facing the room or the shelf wall, true facing the window wall", () => {
    expect(handAway(0)).toBe(false) // +Z, out of the armchair
    expect(handAway(-Math.PI / 2)).toBe(false) // -X, the shelves and the door
    expect(handAway(Math.PI)).toBe(true) // -Z, the plant and the cabinet
    expect(handAway(Math.PI / 2)).toBe(true) // +X
  })
})
