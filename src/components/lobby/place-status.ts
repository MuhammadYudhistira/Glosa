import { formatPercent } from "@/lib/progress"
import type { ShelfFilter } from "@/lib/shelf"
import type { HotspotId } from "./scene/layout"

/**
 * What the lobby already knows about each place (spec 3G §3.5), gathered by
 * LobbyStage from data it has loaded anyway. `null` is "not known yet".
 */
export type PlaceFacts = {
  lastRead: { title: string; percent: number } | null
  /** Books per genre (and the trolley), as summarizeLobby counts them. */
  counts: Record<ShelfFilter, number>
  /** Books without a genre yet. */
  trolley: number
  finished: number
  savedWords: number
  /** Reading days since Monday; null while the habit is not known. */
  weekDays: number | null
  /** Reading days among the last 7; null while the habit is not known. */
  recentDays: number | null
  coins: number | null
  /** The highlights loaded (at most one page: `more` when it was full); null while not loaded. */
  highlights: { count: number; more: boolean } | null
}

/** The one line a place's card shows under its name. */
export function placeStatus(id: HotspotId, facts: PlaceFacts): string {
  switch (id) {
    case "meja-baca":
      return facts.lastRead
        ? `${facts.lastRead.title} · ${formatPercent(facts.lastRead.percent)}`
        : "Belum ada buku yang dibaca"
    case "troli":
      return facts.trolley > 0
        ? `${facts.trolley} buku belum diberi genre`
        : "Tidak ada buku baru"
    case "lemari":
      return facts.finished > 0
        ? `${facts.finished} buku selesai`
        : "Belum ada buku yang selesai"
    case "meja-admin":
      return "Tambahkan buku ke rak"
    case "katalog":
      return facts.savedWords > 0
        ? `${facts.savedWords} kata tersimpan`
        : "Kata yang kamu simpan dari bacaan"
    case "tanaman":
      return facts.weekDays
        ? `${facts.weekDays} hari baca minggu ini`
        : "Target dan kebiasaan membacamu"
    case "toko":
      return facts.coins ? `${facts.coins} koin` : "Hias ruang bacamu"
    case "perapian":
      return facts.recentDays
        ? `${facts.recentDays} dari 7 hari terakhir kamu membaca`
        : "Rangkuman bacaanmu"
    case "papan": {
      const { highlights } = facts
      if (highlights === null) return "Sorotan dan catatanmu"
      if (highlights.count === 0) return "Belum ada sorotan"
      return `${highlights.count}${highlights.more ? "+" : ""} sorotan`
    }
    case "pintu":
      return "Akun, tampilan, dan keluar"
    default: {
      // The rest are the genres.
      const count = facts.counts[id]
      return count > 0 ? `${count} buku` : "Belum ada buku"
    }
  }
}
