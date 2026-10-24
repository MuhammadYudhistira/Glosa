import type { DictPos } from "./types"

/** Parts of speech as the popup and Kosakata name them (spec 2 §6.3). */
export const POS_LABELS: Record<DictPos, string> = {
  noun: "kata benda",
  verb: "kata kerja",
  adj: "kata sifat",
  adv: "kata keterangan",
  pron: "kata ganti",
  prep: "kata depan",
  conj: "kata sambung",
  interj: "kata seru",
  phrase: "frasa",
}
