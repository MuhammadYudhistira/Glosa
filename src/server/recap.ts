import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { parseRecap } from "@/lib/recap/recap"
import type { RecapData } from "@/lib/recap/types"
import { logServerError } from "./monitoring"
import { getSupabaseServerClient } from "./supabase"

const fail = (code: string) => ({ ok: false as const, code })
const DAY = /^\d{4}-\d{2}-\d{2}$/
const RecapInput = z.object({
  from: z.string().regex(DAY),
  to: z.string().regex(DAY),
  timeZone: z.string().min(1).max(64),
})

/** The recap of local days from..to in the device's zone (spec 3E §5, §6.2). */
export const loadRecapFn = createServerFn({ method: "GET" })
  .validator((data: z.input<typeof RecapInput>) => RecapInput.parse(data))
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; recap: RecapData } | { ok: false; code: string }
    > => {
      const supabase = getSupabaseServerClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return fail("not_authenticated")
      const { data: answer, error } = await supabase.rpc("reading_recap", {
        p_from: data.from,
        p_to: data.to,
        p_tz: data.timeZone,
      })
      if (error) {
        if (error.message === "invalid") return fail("recap_invalid")
        logServerError("reading_recap failed", error)
        return fail("unknown")
      }
      const recap = parseRecap(answer)
      return recap ? { ok: true, recap } : fail("unknown")
    }
  )
