import { describe, expect, it } from "vitest"
import { sceneStateFor } from "./scene-state"

describe("sceneStateFor", () => {
  it("shows the dimmed overview on the welcome page", () => {
    expect(sceneStateFor("/")).toEqual({
      focus: "overview",
      dim: true,
      blur: false,
    })
  })

  it.each([
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/auth/confirm",
  ])("zooms to the admin desk on %s", (path) => {
    expect(sceneStateFor(path)).toEqual({
      focus: "admin",
      dim: false,
      blur: false,
    })
  })

  it("blurs the admin desk behind the membership card", () => {
    expect(sceneStateFor("/welcome")).toEqual({
      focus: "admin",
      dim: true,
      blur: true,
    })
  })

  it("ignores a trailing slash", () => {
    expect(sceneStateFor("/login/")).toEqual({
      focus: "admin",
      dim: false,
      blur: false,
    })
  })

  it("has no backdrop on other pages", () => {
    expect(sceneStateFor("/lobby")).toBeNull()
    expect(sceneStateFor("/privacy")).toBeNull()
  })
})
