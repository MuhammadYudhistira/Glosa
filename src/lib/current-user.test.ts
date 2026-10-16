import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { browserUser, resolveUser } from "./current-user"
import { cachedUser, rememberUser } from "./session-cache"
import type { SessionUser } from "./session-types"

const { getSessionUserFn } = vi.hoisted(() => ({ getSessionUserFn: vi.fn() }))
vi.mock("@/server/session", () => ({ getSessionUserFn }))

const ani: SessionUser = {
  id: "7c1c3f40-5a52-4a43-9c5e-0d4c1d1f9a10",
  email: "ani@glosa.test",
  provider: "email",
  username: "ani",
  displayName: "Ani",
  memberNo: 7,
  plan: "free",
  storageLimitBytes: 104857600,
  memberSince: "2026-10-15T03:00:00+00:00",
  onboarded: true,
}

beforeEach(() => {
  localStorage.clear()
  getSessionUserFn.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("browserUser", () => {
  it("remembers the member it gets online, and forgets them after sign-out", async () => {
    getSessionUserFn.mockResolvedValueOnce(ani)
    expect(await browserUser()).toEqual(ani)
    expect(cachedUser()).toEqual(ani)

    getSessionUserFn.mockResolvedValueOnce(null)
    expect(await browserUser()).toBeNull()
    expect(cachedUser()).toBeNull()
  })

  it("uses the last member seen online when the device is offline", async () => {
    rememberUser(ani)
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    expect(await browserUser()).toEqual(ani)
    expect(getSessionUserFn).not.toHaveBeenCalled()
  })

  it("uses the last member when the request cannot reach the server", async () => {
    rememberUser(ani)
    getSessionUserFn.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    expect(await browserUser()).toEqual(ani)
  })

  it("rethrows other errors", async () => {
    getSessionUserFn.mockRejectedValueOnce(new Error("rusak"))
    await expect(browserUser()).rejects.toThrow("rusak")
  })
})

describe("cachedUser", () => {
  it("ignores values that are not a member", () => {
    localStorage.setItem("glosa:user", JSON.stringify({ id: 1 }))
    expect(cachedUser()).toBeNull()
    localStorage.setItem("glosa:user", "{bukan json")
    expect(cachedUser()).toBeNull()
  })
})

describe("resolveUser", () => {
  it("keeps a user the server already resolved", async () => {
    expect(await resolveUser(ani)).toBe(ani)
    expect(await resolveUser(null)).toBeNull()
    expect(getSessionUserFn).not.toHaveBeenCalled()
  })

  it("looks the user up in the browser inside the offline shell", async () => {
    getSessionUserFn.mockResolvedValueOnce(ani)
    expect(await resolveUser(undefined)).toEqual(ani)
  })
})
