import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { bookStorage, objectPaths } from "@/server/book-storage"
import { adminClient, createTestMember, deleteTestMembers } from "./helpers"

const run = Date.now().toString(36)

describe("bookStorage", () => {
  let folder = ""
  let path = ""

  beforeAll(async () => {
    const member = await createTestMember({
      email: `db-storage-${run}@glosa.test`,
    })
    folder = member.id
    path = `${folder}/${randomUUID()}.epub`
  })

  afterAll(async () => {
    await adminClient().storage.from("books").remove([path])
    await deleteTestMembers()
  })

  it("uploads through a signed URL, reports the size, signs reads and removes", async () => {
    const storage = bookStorage(adminClient())
    const uploadUrl = await storage.createUploadUrl(path)

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": "application/epub+zip", "x-upsert": "false" },
      body: new Blob([new Uint8Array(1234)]),
    })
    expect(response.ok).toBe(true)
    expect(await storage.statObject(path)).toBe(1234)
    expect(await storage.listFolder(folder)).toContain(path)

    const readUrls = await storage.getReadUrls([path])
    const readUrl = readUrls.get(path)
    expect(readUrl).toBeDefined()
    const file = await fetch(readUrl ?? "")
    expect((await file.arrayBuffer()).byteLength).toBe(1234)

    await storage.remove([path])
    expect(await storage.statObject(path)).toBeNull()
    expect(await storage.listFolder(folder)).not.toContain(path)
  })

  it("lists a book's objects", () => {
    expect(
      objectPaths({ file_path: "u/b.epub", cover_path: "u/b-cover.webp" })
    ).toEqual(["u/b.epub", "u/b-cover.webp"])
    expect(objectPaths({ file_path: "u/b.epub", cover_path: null })).toEqual([
      "u/b.epub",
    ])
  })
})
