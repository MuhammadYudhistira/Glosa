import { createHash, randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { bookStorage } from "@/server/book-storage"
import { runSweep } from "@/server/sweep/run-sweep"
import {
  adminClient,
  createTestMember,
  deleteTestMembers,
  forgetTestMember,
} from "./helpers"

const run = Date.now().toString(36)
const HOUR = 60 * 60 * 1000
const sha = (n: number) =>
  createHash("sha256").update(`${run}-${n}`).digest("hex")

async function put(path: string) {
  const { error } = await adminClient()
    .storage.from("books")
    .upload(
      path,
      new Blob([new Uint8Array(64)], { type: "application/epub+zip" }),
      {
        contentType: "application/epub+zip",
      }
    )
  if (error) throw error
}

async function present(path: string) {
  return (await bookStorage(adminClient()).statObject(path)) !== null
}

async function bookExists(id: string) {
  const { data, error } = await adminClient()
    .from("books")
    .select("id")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data !== null
}

describe("runSweep (limited to test members)", () => {
  let keeper = ""
  let gone = ""
  const readyId = randomUUID()
  const pendingId = randomUUID()
  let readyPath = ""
  let pendingPath = ""
  let strayPath = ""
  let gonePath = ""
  // Two hours ahead, so objects uploaded just now count as older than an hour.
  const later = () => Date.now() + 2 * HOUR

  beforeAll(async () => {
    keeper = (await createTestMember({ email: `db-sweep-${run}@glosa.test` }))
      .id
    gone = (
      await createTestMember({ email: `db-sweep-gone-${run}@glosa.test` })
    ).id
    readyPath = `${keeper}/${readyId}.epub`
    pendingPath = `${keeper}/${pendingId}.epub`
    strayPath = `${keeper}/${randomUUID()}.epub`
    gonePath = `${gone}/${randomUUID()}.epub`

    const { error } = await adminClient()
      .from("books")
      .insert(
        [
          {
            id: readyId,
            user_id: keeper,
            title: "Siap",
            file_path: readyPath,
            size_bytes: 64,
            sha256: sha(1),
            status: "ready",
          },
          {
            id: pendingId,
            user_id: keeper,
            title: "Tertinggal",
            file_path: pendingPath,
            size_bytes: 64,
            sha256: sha(2),
            status: "pending",
            created_at: new Date(Date.now() - 2 * HOUR).toISOString(),
          },
        ],
        // Rows list different columns: the one without created_at keeps its default.
        { defaultToNull: false }
      )
    if (error) throw error
    for (const path of [readyPath, pendingPath, strayPath, gonePath])
      await put(path)

    // A profile removed outside the app leaves an account and a folder behind.
    const removed = await adminClient().from("profiles").delete().eq("id", gone)
    if (removed.error) throw removed.error
  })

  afterAll(async () => {
    await adminClient()
      .storage.from("books")
      .remove([readyPath, pendingPath, strayPath, gonePath])
    await deleteTestMembers()
  })

  it("stops without deleting when the plan exceeds the limits", async () => {
    const result = await runSweep({
      admin: adminClient(),
      now: later(),
      onlyUserIds: [keeper, gone],
      limits: { objects: 1, users: 5 },
    })
    expect(result.status).toBe("too_many")
    expect(await present(strayPath)).toBe(true)
    expect(await bookExists(pendingId)).toBe(true)
  })

  it("only plans in a dry run", async () => {
    const result = await runSweep({
      admin: adminClient(),
      now: later(),
      onlyUserIds: [keeper, gone],
      dryRun: true,
    })
    expect(result.status).toBe("dry_run")
    expect(result.plan.pendingBooks.map((book) => book.id)).toEqual([pendingId])
    expect(result.plan.users).toEqual([gone])
    expect(result.plan.objects.map((object) => object.path).sort()).toEqual(
      [gonePath, strayPath].sort()
    )
    expect(await present(gonePath)).toBe(true)
  })

  it("removes what the plan lists and leaves ready books alone", async () => {
    const result = await runSweep({
      admin: adminClient(),
      now: later(),
      onlyUserIds: [keeper, gone],
    })
    expect(result.status).toBe("done")

    expect(await bookExists(pendingId)).toBe(false)
    expect(await present(pendingPath)).toBe(false)
    expect(await present(strayPath)).toBe(false)
    expect(await present(gonePath)).toBe(false)

    const { data } = await adminClient().auth.admin.getUserById(gone)
    expect(data.user).toBeNull()
    forgetTestMember(gone)

    expect(await bookExists(readyId)).toBe(true)
    expect(await present(readyPath)).toBe(true)
  })
})
