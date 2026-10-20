import { describe, expect, it } from "vitest"
import { authErrorCode, authMessage, oauthCallbackError } from "./auth-messages"

const CLOSED =
  "Glosa sedang dalam uji coba tertutup. Pendaftaran baru dibuka untuk umum segera."

describe("authMessage", () => {
  it("speaks as the librarian for known codes", () => {
    expect(authMessage("invalid_credentials").bubble).toContain("belum cocok")
    expect(authMessage("invalid_credentials").field).toBe(
      "Email atau kata sandi salah."
    )
  })

  it("explains a cancelled Google sign-in and a pending username check", () => {
    expect(authMessage("access_denied").bubble).toContain("dibatalkan")
    expect(authMessage("username_checking").field).toContain("dicek")
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

describe("signups_closed", () => {
  it("tells the visitor the trial is closed", () => {
    expect(authMessage("signups_closed").bubble).toBe(CLOSED)
    expect(authMessage("signups_closed").field).toBe(
      "Pendaftaran masih tertutup."
    )
  })
})

describe("authErrorCode", () => {
  it("recognises the closed-trial hook by its message", () => {
    expect(authErrorCode({ code: "unexpected_failure", message: CLOSED })).toBe(
      "signups_closed"
    )
  })

  it("keeps other Supabase codes", () => {
    expect(
      authErrorCode({ code: "user_already_exists", message: "User exists" })
    ).toBe("user_already_exists")
  })

  it("falls back to unknown", () => {
    expect(authErrorCode({ message: "boom" })).toBe("unknown")
    expect(authErrorCode(null)).toBe("unknown")
  })
})

describe("oauthCallbackError", () => {
  it("is empty when the provider sent no error", () => {
    expect(oauthCallbackError({ code: "abc" })).toBe("")
  })

  it("prefers error_code over error", () => {
    expect(
      oauthCallbackError({ error: "access_denied", error_code: "otp_expired" })
    ).toBe("otp_expired")
    expect(oauthCallbackError({ error: "access_denied" })).toBe("access_denied")
  })

  it("maps a Google sign-up refused by the hook", () => {
    expect(
      oauthCallbackError({
        error: "server_error",
        error_description: CLOSED,
      })
    ).toBe("signups_closed")
  })
})
