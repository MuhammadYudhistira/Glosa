import { z } from "zod"

// A lone surrogate is a valid JS string but JSON.stringify sends it as an
// unpaired \udXXX escape, which Postgres jsonb rejects for the whole call.
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

/** Text Postgres can store: no NUL, and no lone surrogate (jsonb refuses it). */
export const StoredText = z
  .string()
  .refine((text) => !text.includes("\u0000") && !LONE_SURROGATE.test(text), {
    message: "NUL or lone surrogate",
  })
