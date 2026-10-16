import { describe, expect, it } from "vitest"
import { normalizeMetadata } from "./metadata"

describe("normalizeMetadata", () => {
  it("reads plain string metadata", () => {
    expect(
      normalizeMetadata(
        {
          title: "The Adventures of Sherlock Holmes",
          author: "Arthur Conan Doyle",
          language: "en-GB",
          subject: "Detective and mystery stories, English",
          description: "<p>Twelve <i>cases</i>.</p>",
        },
        "sherlock.epub"
      )
    ).toEqual({
      title: "The Adventures of Sherlock Holmes",
      author: "Arthur Conan Doyle",
      language: "en-GB",
      description: "Twelve cases.",
      subjects: ["Detective and mystery stories, English"],
    })
  })

  it("reads foliate's contributor objects, language maps and lists", () => {
    const result = normalizeMetadata(
      {
        title: { ja: "草枕", en: "Kusamakura" },
        author: [
          { name: "Natsume Sōseki", role: ["aut"] },
          { name: { en: "Meredith McKinney" } },
        ],
        language: ["en", "ja"],
        subject: [
          { name: "Japanese fiction", code: "FIC" },
          "Artists -- Fiction",
          "Japanese fiction",
        ],
      },
      "kusamakura.epub"
    )
    expect(result.title).toBe("Kusamakura")
    expect(result.author).toBe("Natsume Sōseki, Meredith McKinney")
    expect(result.language).toBe("en")
    expect(result.subjects).toEqual(["Japanese fiction", "Artists -- Fiction"])
    expect(result.description).toBeNull()
  })

  it("falls back to the file name when the title is missing", () => {
    expect(normalizeMetadata({}, "buku_tanpa-judul.epub")).toEqual({
      title: "buku tanpa judul",
      author: "",
      language: null,
      description: null,
      subjects: [],
    })
    expect(normalizeMetadata(null, ".epub").title).toBe("Tanpa judul")
  })

  it("respects the metadata limits", () => {
    const result = normalizeMetadata(
      {
        title: "J".repeat(400),
        subject: Array.from(
          { length: 40 },
          (_, i) => `Subjek ${i} ${"x".repeat(250)}`
        ),
      },
      "panjang.epub"
    )
    expect(result.title.length).toBeLessThanOrEqual(300)
    expect(result.subjects).toHaveLength(30)
    expect(result.subjects.every((subject) => subject.length <= 200)).toBe(true)
  })
})
