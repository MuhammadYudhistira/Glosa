import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { adminClient, anonClient } from "./helpers"

const run = Date.now().toString(36)
const invited = `db-invite-${run}@glosa.test`
const stranger = `db-stranger-${run}@glosa.test`
const CLOSED =
  "Glosa sedang dalam uji coba tertutup. Pendaftaran baru dibuka untuk umum segera."

async function setSignupsOpen(open: boolean) {
  const { error } = await adminClient()
    .from("app_settings")
    .update({ signups_open: open })
    .eq("id", true)
  if (error) throw error
}

async function hook(email: string) {
  const { data, error } = await adminClient().rpc("before_user_created", {
    event: { user: { email } },
  })
  if (error) throw error
  return data
}

describe("before_user_created", () => {
  let wasOpen = false

  beforeAll(async () => {
    const { data, error } = await adminClient()
      .from("app_settings")
      .select("signups_open")
      .eq("id", true)
      .single()
    if (error) throw error
    wasOpen = data.signups_open
    const insert = await adminClient()
      .from("signup_invites")
      .insert({ email: invited, note: "test:db" })
    if (insert.error) throw insert.error
  })

  afterAll(async () => {
    await adminClient().from("signup_invites").delete().eq("email", invited)
    await setSignupsOpen(wasOpen)
  })

  it("rejects an email without an invite while signups are closed", async () => {
    await setSignupsOpen(false)
    expect(await hook(stranger)).toEqual({
      error: { http_code: 403, message: CLOSED },
    })
  })

  it("allows an invited email, whatever its letter case", async () => {
    await setSignupsOpen(false)
    expect(await hook(invited.toUpperCase())).toEqual({})
  })

  it("allows anyone once signups are open", async () => {
    await setSignupsOpen(true)
    expect(await hook(stranger)).toEqual({})
  })

  it("keeps invites and settings away from visitors", async () => {
    const invites = await anonClient().from("signup_invites").select("email")
    const settings = await anonClient().from("app_settings").select("id")
    expect(invites.error).not.toBeNull()
    expect(settings.error).not.toBeNull()
  })
})
