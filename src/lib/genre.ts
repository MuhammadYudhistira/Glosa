/** Genre values stored in books.genre (spec §5a). null means "Troli Buku Baru". */
export const GENRE_VALUES = [
  "fiksi_sastra",
  "fantasi_petualangan",
  "misteri_thriller",
  "anak_remaja",
  "sains_teknologi",
  "sejarah_budaya",
  "bisnis_pengembangan_diri",
  "lainnya",
] as const

export type Genre = (typeof GENRE_VALUES)[number]
export type GenreSource = "auto" | "user"

export const GENRE_LABELS: Record<Genre, string> = {
  fiksi_sastra: "Fiksi & Sastra",
  fantasi_petualangan: "Fantasi & Petualangan",
  misteri_thriller: "Misteri & Thriller",
  anak_remaja: "Anak & Remaja",
  sains_teknologi: "Sains & Teknologi",
  sejarah_budaya: "Sejarah & Budaya",
  bisnis_pengembangan_diri: "Bisnis & Pengembangan Diri",
  lainnya: "Rak Lainnya",
}

export const TROLLEY_LABEL = "Troli Buku Baru"

export function isGenre(value: unknown): value is Genre {
  return (
    typeof value === "string" &&
    (GENRE_VALUES as ReadonlyArray<string>).includes(value)
  )
}

export function genreLabel(genre: Genre | null): string {
  return genre ? GENRE_LABELS[genre] : TROLLEY_LABEL
}

type GuessableGenre = Exclude<Genre, "lainnya">

/** dc:subject keywords per genre, matched as whole words or phrases. Easy to extend. */
export const GENRE_KEYWORDS: Record<GuessableGenre, ReadonlyArray<string>> = {
  fiksi_sastra: [
    "fiction",
    "novel",
    "literature",
    "romance",
    "poetry",
    "drama",
    "classics",
  ],
  fantasi_petualangan: ["fantasy", "adventure", "science fiction", "quests"],
  misteri_thriller: [
    "mystery",
    "detective",
    "crime",
    "thriller",
    "horror",
    "ghost",
  ],
  anak_remaja: [
    "juvenile",
    "children",
    "young adult",
    "fairy tales",
    "readers",
  ],
  sains_teknologi: [
    "science",
    "technology",
    "nature",
    "mathematics",
    "computers",
  ],
  sejarah_budaya: [
    "history",
    "biography",
    "travel",
    "culture",
    "philosophy",
    "religion",
  ],
  bisnis_pengembangan_diri: [
    "business",
    "economics",
    "self-help",
    "psychology",
    "success",
  ],
}

/** Tie-break order, most specific first (spec §5a). */
const PRIORITY: ReadonlyArray<GuessableGenre> = [
  "anak_remaja",
  "misteri_thriller",
  "fantasi_petualangan",
  "sains_teknologi",
  "sejarah_budaya",
  "bisnis_pengembangan_diri",
  "fiksi_sastra",
]

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// Longest keywords first, so "science fiction" is not also read as "science" + "fiction".
const MATCHERS = Object.entries(GENRE_KEYWORDS)
  .flatMap(([genre, keywords]) =>
    keywords.map((keyword) => ({
      genre: genre as GuessableGenre,
      keyword,
      pattern: new RegExp(`(?<![a-z])${escapeRegExp(keyword)}(?![a-z])`, "g"),
    }))
  )
  .sort((a, b) => b.keyword.length - a.keyword.length)

/**
 * Guesses a genre from EPUB dc:subject values (spec §5a). Each subject adds one
 * point to every genre it mentions; the highest score wins and ties go to the
 * more specific genre. "Fiksi & Sastra" is the fallback: library catalogues tag
 * nearly every novel "-- Fiction", so it only wins when nothing more specific matched.
 */
export function suggestGenre(subjects: ReadonlyArray<string>): Genre | null {
  const scores = new Map<GuessableGenre, number>()
  for (const subject of subjects) {
    let text = subject.toLowerCase()
    const matched = new Set<GuessableGenre>()
    for (const { genre, pattern } of MATCHERS) {
      if (text.search(pattern) === -1) continue
      matched.add(genre)
      text = text.replace(pattern, " ")
    }
    for (const genre of matched) scores.set(genre, (scores.get(genre) ?? 0) + 1)
  }

  let best: GuessableGenre | null = null
  let bestScore = 0
  for (const genre of PRIORITY) {
    if (genre === "fiksi_sastra") continue
    const score = scores.get(genre) ?? 0
    if (score > bestScore) {
      best = genre
      bestScore = score
    }
  }
  if (best) return best
  return scores.has("fiksi_sastra") ? "fiksi_sastra" : null
}
