import { describe, expect, it } from "vitest"
import {
  type SweepBook,
  type SweepInput,
  deletionCounts,
  planSweep,
} from "./plan-sweep"

const NOW = Date.parse("2026-10-20T12:00:00Z")
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString()

const member = "11111111-1111-4111-8111-111111111111"
const gone = "22222222-2222-4222-8222-222222222222"

function book(overrides: Partial<SweepBook>): SweepBook {
  return {
    id: "b-ready",
    userId: member,
    status: "ready",
    createdAt: ago(600),
    filePath: `${member}/b-ready.epub`,
    coverPath: `${member}/b-ready-cover.webp`,
    ...overrides,
  }
}

function input(overrides: Partial<SweepInput>): SweepInput {
  return {
    now: NOW,
    objects: [],
    books: [],
    profileIds: [member],
    users: [{ id: member, createdAt: ago(10_000) }],
    ...overrides,
  }
}

describe("planSweep", () => {
  it("never touches a ready book or its objects", () => {
    const plan = planSweep(
      input({
        books: [book({})],
        objects: [
          { path: `${member}/b-ready.epub`, createdAt: ago(600) },
          { path: `${member}/b-ready-cover.webp`, createdAt: ago(600) },
        ],
      })
    )
    expect(plan).toEqual({ pendingBooks: [], objects: [], users: [] })
  })

  it("removes pending books older than an hour with their objects", () => {
    const old = book({
      id: "b-old",
      status: "pending",
      createdAt: ago(61),
      filePath: `${member}/b-old.epub`,
      coverPath: null,
    })
    const fresh = book({
      id: "b-fresh",
      status: "pending",
      createdAt: ago(59),
      filePath: `${member}/b-fresh.epub`,
      coverPath: null,
    })
    const plan = planSweep(
      input({
        books: [old, fresh],
        objects: [
          { path: `${member}/b-old.epub`, createdAt: ago(61) },
          { path: `${member}/b-fresh.epub`, createdAt: ago(59) },
        ],
      })
    )
    expect(plan.pendingBooks).toEqual([
      { id: "b-old", paths: [`${member}/b-old.epub`] },
    ])
    expect(plan.objects).toEqual([])
  })

  it("removes accounts without a profile once older than an hour", () => {
    const plan = planSweep(
      input({
        users: [
          { id: member, createdAt: ago(10_000) },
          { id: gone, createdAt: ago(61) },
          { id: "fresh-user", createdAt: ago(59) },
        ],
      })
    )
    expect(plan.users).toEqual([gone])
  })

  it("empties folders whose member has no profile, whatever their age", () => {
    const plan = planSweep(
      input({
        objects: [
          { path: `${gone}/x.epub`, createdAt: ago(1) },
          { path: `${gone}/x-cover.jpg`, createdAt: null },
        ],
      })
    )
    expect(plan.objects).toEqual([
      { path: `${gone}/x.epub`, reason: "folder_without_profile" },
      { path: `${gone}/x-cover.jpg`, reason: "folder_without_profile" },
    ])
  })

  it("removes unreferenced objects only once older than an hour", () => {
    const plan = planSweep(
      input({
        objects: [
          { path: `${member}/stray-old.epub`, createdAt: ago(61) },
          { path: `${member}/stray-new.epub`, createdAt: ago(59) },
          { path: `${member}/stray-unknown.epub`, createdAt: null },
        ],
      })
    )
    expect(plan.objects).toEqual([
      { path: `${member}/stray-old.epub`, reason: "unreferenced" },
    ])
  })
})

describe("deletionCounts", () => {
  it("counts every object, pending books' included, and accounts", () => {
    expect(
      deletionCounts({
        pendingBooks: [{ id: "b", paths: ["u/b.epub", "u/b-cover.webp"] }],
        objects: [{ path: "u/x.epub", reason: "unreferenced" }],
        users: ["gone"],
      })
    ).toEqual({ objects: 3, users: 1 })
  })
})
