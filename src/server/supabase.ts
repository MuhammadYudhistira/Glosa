import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { getCookies, setCookie } from "@tanstack/react-start/server"
import type { Database } from "./database.types"

type ServerEnvName =
  | "SUPABASE_URL"
  | "SUPABASE_PUBLISHABLE_KEY"
  | "SUPABASE_SECRET_KEY"
  | "SITE_URL"

function requireEnv(name: ServerEnvName): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

export function siteUrl(): string {
  return requireEnv("SITE_URL").replace(/\/+$/, "")
}

/** Per-request client acting as the signed-in member (cookie session, RLS applies). */
export function getSupabaseServerClient() {
  return createServerClient<Database>(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll() {
          return Object.entries(getCookies()).map(([name, value]) => ({
            name,
            value,
          }))
        },
        setAll(cookies) {
          for (const cookie of cookies) {
            // Options (path, maxAge, sameSite…) must be forwarded, otherwise the
            // session cookie is scoped to the current path only.
            setCookie(cookie.name, cookie.value, cookie.options)
          }
        },
      },
    }
  )
}

/** Service-role client. Bypasses RLS — server-only, never expose to the client. */
export function getSupabaseAdminClient() {
  return createClient<Database>(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
}
