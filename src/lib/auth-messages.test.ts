import { describe, expect, it } from "vitest"
import { authMessage } from "./auth-messages"

describe("authMessage", () => {
  it("speaks as the librarian for known codes", () => {
    expect(authMessage("invalid_credentials").bubble).toContain("belum cocok")
    expect(authMessage("invalid_credentials").field).toBe(
      "Email atau kata sandi salah."
    )
  })

  it("falls back to a generic message", () => {
    expect(authMessage("something_new").field).toBe(
      "Terjadi kesalahan. Coba lagi."
    )
    expect(authMessage(undefined).field).toBe("Terjadi kesalahan. Coba lagi.")
  })

  it("ignores inherited object keys and falls back", () => {
    expect(authMessage("constructor").field).toBe(
      "Terjadi kesalahan. Coba lagi."
    )
    expect(authMessage("toString").field).toBe("Terjadi kesalahan. Coba lagi.")
    expect(authMessage("__proto__").field).toBe("Terjadi kesalahan. Coba lagi.")
  })
})
