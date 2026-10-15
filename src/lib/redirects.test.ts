import { describe, expect, it } from "vitest"
import { guestRedirect, memberRedirect, safeNext } from "./redirects"

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/settings")).toBe("/settings")
    expect(safeNext("/shelf?genre=anak_remaja")).toBe(
      "/shelf?genre=anak_remaja"
    )
  })

  it("falls back to the lobby for anything else", () => {
    expect(safeNext(undefined)).toBe("/lobby")
    expect(safeNext("https://evil.example")).toBe("/lobby")
    expect(safeNext("//evil.example")).toBe("/lobby")
    expect(safeNext("/\\evil.example")).toBe("/lobby")
    expect(safeNext(42)).toBe("/lobby")
  })
})

describe("guestRedirect", () => {
  it("lets guests stay", () => {
    expect(guestRedirect(null)).toBeNull()
  })

  it("sends onboarded members to the lobby with a welcome-back flag", () => {
    expect(guestRedirect({ onboarded: true })).toBe("/lobby?kembali=1")
  })

  it("sends new members to their membership card", () => {
    expect(guestRedirect({ onboarded: false })).toBe("/welcome")
  })
})

describe("memberRedirect", () => {
  it("sends guests to the guest book, remembering where they were going", () => {
    expect(memberRedirect(null, "/settings")).toBe("/login?next=%2Fsettings")
  })

  it("sends members without a card to /welcome first", () => {
    expect(memberRedirect({ onboarded: false }, "/lobby")).toBe("/welcome")
    expect(memberRedirect({ onboarded: false }, "/welcome")).toBeNull()
  })

  it("keeps onboarded members away from /welcome", () => {
    expect(memberRedirect({ onboarded: true }, "/welcome")).toBe("/lobby")
    expect(memberRedirect({ onboarded: true }, "/settings")).toBeNull()
  })
})
