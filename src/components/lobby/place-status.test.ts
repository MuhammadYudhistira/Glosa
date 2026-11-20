import { describe, expect, it } from "vitest"
import { GENRE_VALUES } from "@/lib/genre"
import { formatPercent } from "@/lib/progress"
import type { ShelfFilter } from "@/lib/shelf"
import { type PlaceFacts, placeStatus } from "./place-status"

const none: PlaceFacts = {
  lastRead: null,
  counts: Object.fromEntries(
    ["semua", "troli", ...GENRE_VALUES].map((key) => [key, 0])
  ) as Record<ShelfFilter, number>,
  trolley: 0,
  finished: 0,
  savedWords: 0,
  weekDays: null,
  recentDays: null,
  coins: null,
  highlights: null,
}
const some = (more: Partial<PlaceFacts>): PlaceFacts => ({ ...none, ...more })

describe("placeStatus", () => {
  it("says the last book and how far for the reading chair", () => {
    expect(placeStatus("meja-baca", none)).toBe("Belum ada buku yang dibaca")
    expect(
      placeStatus(
        "meja-baca",
        some({ lastRead: { title: "Emma", percent: 42.9 } })
      )
    ).toBe(`Emma · ${formatPercent(42.9)}`)
  })

  it("counts the books of a genre", () => {
    const genre = GENRE_VALUES[0]
    expect(placeStatus(genre, none)).toBe("Belum ada buku")
    expect(
      placeStatus(genre, some({ counts: { ...none.counts, [genre]: 3 } }))
    ).toBe("3 buku")
  })

  it("counts the books waiting for a genre", () => {
    expect(placeStatus("troli", none)).toBe("Tidak ada buku baru")
    expect(placeStatus("troli", some({ trolley: 2 }))).toBe(
      "2 buku belum diberi genre"
    )
  })

  it("counts the finished books", () => {
    expect(placeStatus("lemari", none)).toBe("Belum ada buku yang selesai")
    expect(placeStatus("lemari", some({ finished: 4 }))).toBe("4 buku selesai")
  })

  it("counts the saved words", () => {
    expect(placeStatus("katalog", none)).toBe(
      "Kata yang kamu simpan dari bacaan"
    )
    expect(placeStatus("katalog", some({ savedWords: 12 }))).toBe(
      "12 kata tersimpan"
    )
  })

  it("counts the reading days of the week, with a short line while unknown or zero", () => {
    expect(placeStatus("tanaman", none)).toBe("Target dan kebiasaan membacamu")
    expect(placeStatus("tanaman", some({ weekDays: 0 }))).toBe(
      "Target dan kebiasaan membacamu"
    )
    expect(placeStatus("tanaman", some({ weekDays: 3 }))).toBe(
      "3 hari baca minggu ini"
    )
  })

  it("counts the coins", () => {
    expect(placeStatus("toko", none)).toBe("Hias ruang bacamu")
    expect(placeStatus("toko", some({ coins: 0 }))).toBe("Hias ruang bacamu")
    expect(placeStatus("toko", some({ coins: 250 }))).toBe("250 koin")
  })

  it("counts the reading days of the last 7 for the fireplace", () => {
    expect(placeStatus("perapian", none)).toBe("Rangkuman bacaanmu")
    expect(placeStatus("perapian", some({ recentDays: 5 }))).toBe(
      "5 dari 7 hari terakhir kamu membaca"
    )
  })

  it("counts the highlights, telling unknown from none and more from a full page", () => {
    expect(placeStatus("papan", none)).toBe("Sorotan dan catatanmu")
    expect(
      placeStatus("papan", some({ highlights: { count: 0, more: false } }))
    ).toBe("Belum ada sorotan")
    expect(
      placeStatus("papan", some({ highlights: { count: 7, more: false } }))
    ).toBe("7 sorotan")
    expect(
      placeStatus("papan", some({ highlights: { count: 20, more: true } }))
    ).toBe("20+ sorotan")
  })

  it("keeps the desk and the door's lines", () => {
    expect(placeStatus("meja-admin", none)).toBe("Tambahkan buku ke rak")
    expect(placeStatus("pintu", none)).toBe("Akun, tampilan, dan keluar")
  })
})
