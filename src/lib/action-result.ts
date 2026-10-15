/** Result of a server action. `code` is looked up with authMessage(). */
export type ActionResult = { ok: true } | { ok: false; code: string }
