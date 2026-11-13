import * as THREE from "three"
import { describe, expect, it } from "vitest"
import { createKit } from "./kit"
import { ANDA_START, type Point2 } from "./layout"
import { createMotion } from "./motion"
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
