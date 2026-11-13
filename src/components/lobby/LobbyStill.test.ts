import { describe, expect, it } from "vitest"
import { STILL_SIZE, STILL_VIEW } from "./LobbyStill"
import { ADMIN_DESK } from "./scene/layout"
import { project, startView } from "./scene/projection"

describe("the still image", () => {
  it("shows the wide-screen start view, at 16:9", () => {
    expect(STILL_SIZE.width / STILL_SIZE.height).toBeCloseTo(16 / 9)
    expect(STILL_VIEW).toEqual(startView(STILL_SIZE))
  })

  it("has the admin desk well inside it, where the sign-in pages zoom in", () => {
    const desk = project(
      [ADMIN_DESK[0], 1, ADMIN_DESK[1]],
      STILL_VIEW,
      STILL_SIZE
    )
    for (const at of [desk.x, desk.y]) {
      expect(at).toBeGreaterThan(8)
      expect(at).toBeLessThan(92)
    }
  })
})
