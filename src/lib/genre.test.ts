import { describe, expect, it } from "vitest"
import {
  type Genre,
  TROLLEY_LABEL,
  genreLabel,
  isGenre,
  suggestGenre,
} from "./genre"
import { SHELF_FILTERS } from "./shelf"

describe("suggestGenre", () => {
  const cases: Array<[string, ReadonlyArray<string>, Genre | null]> = [
    ["no subjects", [], null],
    ["no keyword matches", ["Cooking", "Gardening"], null],
    [
      "juvenile fiction goes to the more specific genre",
      ["Juvenile fiction"],
      "anak_remaja",
    ],
    [
      "detective stories",
      ["Detective and mystery stories"],
      "misteri_thriller",
    ],
    [
      "Standard Ebooks: The Adventures of Sherlock Holmes",
      [
        "Holmes, Sherlock (Fictitious character) -- Fiction",
        "Private investigators -- England -- Fiction",
        "Detective and mystery stories, English",
      ],
      "misteri_thriller",
    ],
    [
      "Project Gutenberg: Pride and Prejudice",
      [
        "England -- Fiction",
        "Young women -- Fiction",
        "Love stories",
        "Sisters -- Fiction",
        "Courtship -- Fiction",
        "Domestic fiction",
        "Social classes -- Fiction",
      ],
      "fiksi_sastra",
    ],
    [
      "Project Gutenberg: Alice's Adventures in Wonderland",
      [
        "Fantasy fiction",
        "Children's stories",
        "Imaginary places -- Juvenile fiction",
        "Alice (Fictitious character from Carroll) -- Juvenile fiction",
      ],
      "anak_remaja",
    ],
    [
      "a phrase is not also read as its words",
      ["Science fiction"],
      "fantasi_petualangan",
    ],
    [
      "a tie goes to the more specific genre",
      ["Fantasy", "History"],
      "fantasi_petualangan",
    ],
    [
      "hyphenated keywords",
      ["Self-help techniques"],
      "bisnis_pengembangan_diri",
    ],
    ["case-insensitive", ["WORLD HISTORY"], "sejarah_budaya"],
    ["whole words only", ["Historical fiction"], "fiksi_sastra"],
  ]

  it.each(cases)("%s", (_name, subjects, expected) => {
    expect(suggestGenre(subjects)).toBe(expected)
  })
})

describe("genre labels", () => {
  it("labels genres and the trolley", () => {
    expect(genreLabel("misteri_thriller")).toBe("Misteri & Thriller")
    expect(genreLabel("lainnya")).toBe("Rak Lainnya")
    expect(genreLabel(null)).toBe("Kotak buku baru")
  })

  it("only displays the new books' name: the stored value stays null and the URL value troli", () => {
    // The parcel box in the room and the shelf share one name (owner, 2026-11-13).
    expect(TROLLEY_LABEL).toBe("Kotak buku baru")
    expect(isGenre(TROLLEY_LABEL)).toBe(false)
    expect(
      SHELF_FILTERS.find(({ label }) => label === TROLLEY_LABEL)?.value
    ).toBe("troli")
  })

  it("recognises only stored genre values", () => {
    expect(isGenre("bisnis_pengembangan_diri")).toBe(true)
    expect(isGenre("troli")).toBe(false)
    expect(isGenre(null)).toBe(false)
  })
})
