import { redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { ActionResult } from "@/lib/action-result"
import { validateUsername } from "@/lib/username"
import { getSupabaseServerClient, siteUrl } from "./supabase"

export type ConfirmType = "email" | "signup" | "magiclink" | "recovery"

const Email = z.email()

function fail(code: string | undefined): ActionResult {
  return { ok: false, code: code ?? "unknown" }
}

export const signInFn = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!Email.safeParse(data.email).success || data.password.length === 0) {
      return fail("invalid_credentials")
    }
    const { error } = await getSupabaseServerClient().auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    return error ? fail(error.code) : { ok: true }
  })

export const signUpFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      email: string
      password: string
      username: string
      displayName: string
      acceptedTerms: boolean
    }) => data
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const displayName = data.displayName.trim()
    if (displayName.length === 0 || displayName.length > 60)
      return fail("display_name_invalid")
    if (validateUsername(data.username)) return fail("username_invalid")
    if (!Email.safeParse(data.email).success)
      return fail("email_address_invalid")
    if (data.password.length < 8) return fail("weak_password")
    if (!data.acceptedTerms) return fail("terms_required")

    const supabase = getSupabaseServerClient()
    const { data: available, error: rpcError } = await supabase.rpc(
      "username_available",
      { candidate: data.username }
    )
    if (rpcError) {
      console.error("username_available failed", rpcError)
      return fail("unknown")
    }
    if (!available) return fail("username_taken")

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { username: data.username, display_name: displayName } },
    })
    return error ? fail(error.code) : { ok: true }
  })

export const googleSignInFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<
    { ok: true; url: string } | { ok: false; code: string }
  > => {
    const { data, error } =
      await getSupabaseServerClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${siteUrl()}/auth/callback` },
      })
    if (error || !data.url) return { ok: false, code: error?.code ?? "unknown" }
    return { ok: true, url: data.url }
  }
)

export const requestPasswordResetFn = createServerFn({ method: "POST" })
  .validator((data: { email: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!Email.safeParse(data.email).success)
      return fail("email_address_invalid")
    const { error } =
      await getSupabaseServerClient().auth.resetPasswordForEmail(data.email)
    // Never reveal whether the address is registered; only surface rate limits.
    if (error?.code?.startsWith("over_")) return fail(error.code)
    return { ok: true }
  })

export const updatePasswordFn = createServerFn({ method: "POST" })
  .validator((data: { password: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    if (data.password.length < 8) return fail("weak_password")
    const { error } = await getSupabaseServerClient().auth.updateUser({
      password: data.password,
    })
    return error ? fail(error.code) : { ok: true }
  })

export const exchangeCodeFn = createServerFn({ method: "POST" })
  .validator((data: { code: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!data.code) return fail("otp_expired")
    const { error } =
      await getSupabaseServerClient().auth.exchangeCodeForSession(data.code)
    return error ? fail(error.code ?? "otp_expired") : { ok: true }
  })

export const verifyOtpFn = createServerFn({ method: "POST" })
  .validator((data: { tokenHash: string; type: ConfirmType }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!data.tokenHash) return fail("otp_expired")
    const { error } = await getSupabaseServerClient().auth.verifyOtp({
      type: data.type,
      token_hash: data.tokenHash,
    })
    return error ? fail(error.code ?? "otp_expired") : { ok: true }
  })

export const signOutFn = createServerFn({ method: "POST" }).handler(
  async () => {
    // "local" always clears this browser's session cookie, even if revoking fails.
    const { error } = await getSupabaseServerClient().auth.signOut({
      scope: "local",
    })
    if (error) console.error("signOut failed", error)
    throw redirect({ href: "/" })
  }
)
