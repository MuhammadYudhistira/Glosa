import { describe, expect, it } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { ShelfBook } from "@/lib/book-types"
import { RECENT_LIMIT, lobbyHotspots, summarizeLobby } from "./lobby-data"

const book = (id: string, changes: Partial<ShelfBook> = {}): ShelfBook => ({
  ...sherlock,
  id,
  title: `Buku ${id}`,
  ...changes,
})

describe("summarizeLobby", () => {
  it("counts the books per zone and lists the trolley", () => {
    const summary = summarizeLobby([
      book("a"),
      book("b", { genre: null }),
      book("c", { genre: "lainnya" }),
    ])
    expect(summary.counts.misteri_thriller).toBe(1)
    expect(summary.counts.lainnya).toBe(1)
    expect(summary.counts.troli).toBe(1)
    expect(summary.trolley.map(({ id }) => id)).toEqual(["b"])
  })

  it("lists the books opened last, newest first, and hands the last one to the reading table", () => {
    const opened = Array.from({ length: 7 }, (_, i) =>
      book(String(i), { lastOpenedAt: `2026-10-1${i}T08:00:00+00:00` })
    )
    const summary = summarizeLobby([...opened, book("never")])
    expect(summary.recent.map(({ id }) => id)).toEqual([
      "6",
      "5",
      "4",
      "3",
      "2",
    ])
    expect(summary.recent).toHaveLength(RECENT_LIMIT)
    expect(summary.lastRead?.id).toBe("6")
  })

  it("has no last book when nothing was opened yet", () => {
    expect(summarizeLobby([book("a")]).lastRead).toBeNull()
    expect(summarizeLobby([]).recent).toEqual([])
  })
})

describe("lobbyHotspots", () => {
  it("gives the zones their counts, dims empty ones and badges the trolley", () => {
    const { counts } = summarizeLobby([
      book("a"),
      book("b", { genre: null }),
      book("c", { genre: null }),
    ])
    const hotspots = lobbyHotspots(counts)
    expect(hotspots[0]).toMatchObject({ id: "meja-baca", label: "Meja Baca" })
    expect(hotspots.find(({ id }) => id === "misteri_thriller")).toMatchObject({
      label: "Misteri & Thriller",
      count: 1,
      dim: false,
    })
    expect(hotspots.find(({ id }) => id === "fiksi_sastra")).toMatchObject({
      count: 0,
      dim: true,
    })
    expect(hotspots.find(({ id }) => id === "troli")).toMatchObject({
      label: "Troli Buku Baru",
      count: null,
      badge: 2,
    })
    expect(hotspots.find(({ id }) => id === "meja-admin")).toMatchObject({
      id: "meja-admin",
      label: "Meja Admin",
      count: null,
      badge: null,
    })
  })

  it("hides the trolley's badge when it is empty", () => {
    const { counts } = summarizeLobby([book("a")])
    expect(
      lobbyHotspots(counts).find(({ id }) => id === "troli")?.badge
    ).toBeNull()
  })

  it("has the card catalogue, which opens Kosakata", () => {
    const hotspots = lobbyHotspots(summarizeLobby([]).counts)
    expect(hotspots.find(({ id }) => id === "katalog")).toEqual({
      id: "katalog",
      label: "Kosakata",
      count: null,
      badge: null,
      dim: false,
    })
  })
})

describe("finished books", () => {
  it("shows the last twelve finished, newest first, and counts them all", () => {
    const finished = Array.from({ length: 14 }, (_, i) =>
      book(`f${i}`, {
        finishedAt: `2026-10-${String(i + 10).padStart(2, "0")}T08:00:00+00:00`,
      })
    )
    const summary = summarizeLobby([...finished, book("open")])
    expect(summary.finishedCount).toBe(14)
    expect(summary.finished).toHaveLength(12)
    expect(summary.finished[0].id).toBe("f13")
    expect(summary.finished.at(-1)?.id).toBe("f2")
  })

  it("names the habit plant without a count", () => {
    const plant = lobbyHotspots(summarizeLobby([]).counts).find(
      (h) => h.id === "tanaman"
    )
    expect(plant).toEqual({
      id: "tanaman",
      label: "Kebiasaan baca",
      count: null,
      badge: null,
      dim: false,
    })
  })

  it("names the shop kiosk without a count", () => {
    const kiosk = lobbyHotspots(summarizeLobby([]).counts).find(
      (h) => h.id === "toko"
    )
    expect(kiosk).toEqual({
      id: "toko",
      label: "Toko lobi",
      count: null,
      badge: null,
      dim: false,
    })
  })

  it("names the cabinet Sudah dibaca with its count, dim when empty", () => {
    const { counts } = summarizeLobby([book("a")])
    expect(
      lobbyHotspots(counts, 3).find(({ id }) => id === "lemari")
    ).toMatchObject({ label: "Sudah dibaca", count: 3, dim: false })
    expect(
      lobbyHotspots(counts).find(({ id }) => id === "lemari")
    ).toMatchObject({ count: 0, dim: true })
  })
})
