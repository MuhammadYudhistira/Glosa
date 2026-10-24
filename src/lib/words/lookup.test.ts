// @vitest-environment node
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { clearLocalData } from "@/lib/local/device"
import { putCachedLookup } from "@/lib/local/lookups"
import { reportError } from "@/lib/sentry-client"
import { lookUp, savedChoice } from "./lookup"
import type { LookupAnswer, LookupResult } from "./types"

vi.mock("@/server/words", () => ({ lookupWordFn: vi.fn() }))
vi.mock("@/lib/sentry-client", () => ({ reportError: vi.fn() }))

const ran: LookupResult = {
  word: "ran",
  entries: [
    { headword: "run", pos: "verb", meanings: ["berlari", "menjalankan"] },
    { headword: "run", pos: "noun", meanings: ["lari", "berlari"] },
    { headword: "ran", pos: "noun", meanings: ["nama"] },
  ],
  phrases: [],
}
const empty: LookupResult = { word: "zzz", entries: [], phrases: [] }

function deps(answer: LookupAnswer | Error, online = true) {
  return {
    fetch: vi.fn(() =>
      answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)
    ),
    isOnline: () => online,
  }
}

beforeEach(async () => {
  await clearLocalData()
  vi.mocked(reportError).mockClear()
})

describe("lookUp", () => {
  it("answers from this device without asking the server", async () => {
    await putCachedLookup("ran", [], ran)
    const source = deps({ ok: true, result: empty })
    expect(await lookUp("ran", [], source)).toEqual({
      kind: "result",
      result: ran,
    })
    expect(source.fetch).not.toHaveBeenCalled()
  })

  it("asks the server and keeps the answer, an empty one too", async () => {
    const source = deps({ ok: true, result: empty })
    expect(await lookUp("zzz", [], source)).toEqual({
      kind: "result",
      result: empty,
    })
    expect(source.fetch).toHaveBeenCalledWith("zzz", [])
    const offline = deps(new TypeError("Failed to fetch"), false)
    expect(await lookUp("zzz", [], offline)).toEqual({
      kind: "result",
      result: empty,
    })
  })

  it("offline, another lookup of the word stands in, else it needs a connection", async () => {
    await putCachedLookup("ran", ["up"], ran)
    const offline = deps({ ok: true, result: empty }, false)
    expect(await lookUp("ran", ["away"], offline)).toEqual({
      kind: "result",
      result: ran,
    })
    expect(await lookUp("took", [], offline)).toEqual({ kind: "offline" })
    expect(offline.fetch).not.toHaveBeenCalled()
  })

  it("counts a connection lost on the way as offline", async () => {
    expect(
      await lookUp("took", [], deps(new TypeError("Failed to fetch")))
    ).toEqual({ kind: "offline" })
    expect(reportError).not.toHaveBeenCalled()
  })

  it("reports a server error", async () => {
    expect(
      await lookUp("took", [], deps({ ok: false, code: "unknown" }))
    ).toEqual({ kind: "failed" })
    expect(reportError).toHaveBeenCalledOnce()
  })
})

describe("savedChoice", () => {
  it("saves the phrase shown first", () => {
    const withPhrase = {
      ...ran,
      phrases: [{ headword: "run up", meanings: ["menaikkan"] }],
    }
    expect(savedChoice(withPhrase, "ran")).toEqual({
      headword: "run up",
      pos: "phrase",
      meanings: ["menaikkan"],
    })
  })

  it("otherwise saves the base form with its meanings, without repeats", () => {
    expect(savedChoice(ran, "ran")).toEqual({
      headword: "run",
      pos: "verb",
      meanings: ["berlari", "menjalankan", "lari"],
    })
  })

  it("otherwise saves the word as tapped", () => {
    expect(savedChoice(empty, "zzz")).toEqual({
      headword: "zzz",
      pos: null,
      meanings: [],
    })
    expect(savedChoice(null, "took")).toEqual({
      headword: "took",
      pos: null,
      meanings: [],
    })
  })
})
