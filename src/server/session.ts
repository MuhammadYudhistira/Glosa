import { createServerFn } from "@tanstack/react-start"
import { type SessionUser, toPlan } from "@/lib/session-types"
import { getSupabaseServerClient } from "./supabase"

export const getSessionUserFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "username, display_name, member_no, plan, storage_limit_bytes, created_at, onboarded_at"
      )
      .eq("id", user.id)
      .single()
    if (!profile) return null

    return {
      id: user.id,
      email: user.email ?? "",
      provider: user.app_metadata.provider ?? "email",
      username: profile.username,
      displayName: profile.display_name,
      memberNo: profile.member_no,
      plan: toPlan(profile.plan),
      storageLimitBytes: profile.storage_limit_bytes,
      memberSince: profile.created_at,
      onboarded: profile.onboarded_at !== null,
    }
  }
)
