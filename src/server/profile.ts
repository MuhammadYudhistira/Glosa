import { createServerFn } from "@tanstack/react-start"
import type { ActionResult } from "@/lib/action-result"
import { type UsernameProblem, validateUsername } from "@/lib/username"
import { getSupabaseAdminClient, getSupabaseServerClient } from "./supabase"

const UNIQUE_VIOLATION = "23505"

export const checkUsernameFn = createServerFn({ method: "GET" })
  .validator((data: { username: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{ available: boolean; problem: UsernameProblem | null }> => {
      const problem = validateUsername(data.username)
      if (problem) return { available: false, problem }
      const { data: available, error } = await getSupabaseServerClient().rpc(
        "username_available",
        {
          candidate: data.username,
        }
      )
      if (error) {
        console.error("username_available failed", error)
        throw new Error("Username check failed")
      }
      return { available: available === true, problem: null }
    }
  )

export const visitorsTodayFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<number> => {
    const { data, error } =
      await getSupabaseServerClient().rpc("visitors_today")
    if (error) console.error("visitors_today failed", error)
    return data ?? 0
  }
)

export const completeOnboardingFn = createServerFn({ method: "POST" })
  .validator((data: { username?: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, code: "not_authenticated" }

    const patch: { onboarded_at: string; username?: string } = {
      onboarded_at: new Date().toISOString(),
    }
    if (data.username !== undefined) {
      if (validateUsername(data.username))
        return { ok: false, code: "username_invalid" }
      patch.username = data.username
    }
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id)
    if (error) {
      return {
        ok: false,
        code: error.code === UNIQUE_VIOLATION ? "username_taken" : "unknown",
      }
    }
    return { ok: true }
  })

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator((data: { displayName: string; username: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    const displayName = data.displayName.trim()
    if (displayName.length === 0 || displayName.length > 60) {
      return { ok: false, code: "display_name_invalid" }
    }
    if (validateUsername(data.username))
      return { ok: false, code: "username_invalid" }

    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, code: "not_authenticated" }

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, username: data.username })
      .eq("id", user.id)
    if (error) {
      return {
        ok: false,
        code: error.code === UNIQUE_VIOLATION ? "username_taken" : "unknown",
      }
    }
    return { ok: true }
  })

export const deleteAccountFn = createServerFn({ method: "POST" })
  .validator((data: { confirmUsername: string }) => data)
  .handler(async ({ data }): Promise<ActionResult> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, code: "not_authenticated" }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single()
    if (profileError) {
      console.error("profile lookup failed", profileError)
      return { ok: false, code: "unknown" }
    }
    if (profile.username !== data.confirmUsername.trim()) {
      return { ok: false, code: "confirm_mismatch" }
    }

    // Plan 1B adds: remove the member's Storage objects before deleting the user.
    const { error } = await getSupabaseAdminClient().auth.admin.deleteUser(
      user.id
    )
    if (error) return { ok: false, code: "unknown" }

    // The user no longer exists server-side; just clear the session cookies.
    await supabase.auth.signOut({ scope: "local" })
    return { ok: true }
  })
