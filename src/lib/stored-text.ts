import { z } from "zod"

/** Text Postgres can store: a text value cannot hold NUL. */
export const StoredText = z
  .string()
  .refine((text) => !text.includes("\u0000"), { message: "NUL" })
