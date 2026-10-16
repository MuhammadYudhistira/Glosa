import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  adminClient,
  anonClient,
  createTestMember,
  deleteTestMembers,
  signedInClient,
} from "./helpers"

// Unique per run so tests can share the dev project safely.
const run = Date.now().toString(36)
const aniEmail = `db-ani-${run}@glosa.test`
const budiEmail = `budi.santoso.${run}@glosa.test`
const budiTwinEmail = `Budi-Santoso.${run}@glosa.test`

describe("profiles", () => {
  let aniId = ""
  let budiId = ""
  let budiTwinId = ""

  beforeAll(async () => {
    aniId = (
      await createTestMember({
        email: aniEmail,
        metadata: { username: `ani_${run}`, display_name: "Ani" },
      })
    ).id
    budiId = (
      await createTestMember({
        email: budiEmail,
        metadata: { full_name: "Budi Santoso" },
      })
    ).id
    budiTwinId = (await createTestMember({ email: budiTwinEmail })).id
  })

  afterAll(deleteTestMembers)

  async function profileOf(id: string) {
    const { data, error } = await adminClient()
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single()
    if (error) throw error
    return data
  }

  it("takes username and display name from signup metadata", async () => {
    const ani = await profileOf(aniId)
    expect(ani.username).toBe(`ani_${run}`)
    expect(ani.display_name).toBe("Ani")
  })

  it("falls back to the email local part and the Google full_name", async () => {
    const budi = await profileOf(budiId)
    expect(budi.username).toBe(`budisantoso${run}`)
    expect(budi.display_name).toBe("Budi Santoso")
  })

  it("adds a numeric suffix to a taken username", async () => {
    expect((await profileOf(budiTwinId)).username).toBe(`budisantoso${run}1`)
  })

  it("numbers members in signup order and starts them on the free 100 MB plan", async () => {
    const ani = await profileOf(aniId)
    const budi = await profileOf(budiId)
    expect(budi.member_no).toBeGreaterThan(ani.member_no)
    expect(ani.plan).toBe("free")
    expect(ani.storage_limit_bytes).toBe(104857600)
  })

  it("lets a member see and edit only their own profile", async () => {
    const asAni = await signedInClient(aniEmail)
    const { data: visible } = await asAni.from("profiles").select("id")
    expect(visible?.map((row) => row.id)).toEqual([aniId])

    const { error } = await asAni
      .from("profiles")
      .update({ display_name: "Ani R" })
      .eq("id", aniId)
    expect(error).toBeNull()
    expect((await profileOf(aniId)).display_name).toBe("Ani R")
  })

  it("does not let a member change their plan or storage limit", async () => {
    const asAni = await signedInClient(aniEmail)
    const plan = await asAni
      .from("profiles")
      .update({ plan: "pro" })
      .eq("id", aniId)
    expect(plan.error?.code).toBe("42501")
    const quota = await asAni
      .from("profiles")
      .update({ storage_limit_bytes: 1 })
      .eq("id", aniId)
    expect(quota.error?.code).toBe("42501")
    const memberNo = await asAni
      .from("profiles")
      .update({ member_no: 999999 })
      .eq("id", aniId)
    expect(memberNo.error?.code).toBe("42501")
    const after = await profileOf(aniId)
    expect(after.plan).toBe("free")
    expect(after.member_no).not.toBe(999999)
  })

  it("shows nothing to a visitor without a session", async () => {
    const { data, error } = await anonClient().from("profiles").select("id")
    // The anon role has no grant at all: refused outright, never any rows.
    expect(error?.code).toBe("42501")
    expect(data ?? []).toEqual([])
  })

  it("does not let a member edit another member's profile", async () => {
    const before = await profileOf(budiId)
    const asAni = await signedInClient(aniEmail)
    const { data, error } = await asAni
      .from("profiles")
      .update({ display_name: "Diretas" })
      .eq("id", budiId)
      .select()
    expect(error).toBeNull()
    expect(data).toEqual([])
    expect(await profileOf(budiId)).toEqual(before)
  })

  it("answers whether a username is available", async () => {
    const asAni = await signedInClient(aniEmail)
    const rpc = (candidate: string) =>
      asAni.rpc("username_available", { candidate })
    expect((await rpc(`ani_${run}`)).data).toBe(false)
    expect((await rpc("Bad Name")).data).toBe(false)
    expect((await rpc(`free_${run}`)).data).toBe(true)
  })

  it("counts today's visitors without exposing names", async () => {
    await signedInClient(aniEmail)
    await signedInClient(budiEmail)
    const { data } = await adminClient().rpc("visitors_today")
    expect(data).toBeGreaterThanOrEqual(2)
  })
})
