import { describe, expect, it } from "vitest"
import { createDictionaryBuilder } from "./dict-import"

const run = {
  word: "run",
  lang_code: "en",
  pos: "verb",
  forms: [
    { form: "runs", tags: ["present", "singular", "third-person"] },
    { form: "running", tags: ["participle", "present"] },
    { form: "en-verb", tags: ["inflection-template"] },
    { form: "will run", tags: ["future"] },
  ],
  translations: [
    { code: "id", word: "lari" },
    { code: "id", word: "berlari" },
  ],
  senses: [
    {
      translations: [
        { lang_code: "id", word: "berlari" },
        { lang_code: "ms", word: "lari" },
      ],
    },
  ],
}

const build = (...records: Array<unknown>) => {
  const builder = createDictionaryBuilder()
  for (const record of records) builder.add(record)
  return builder.result()
}

describe("createDictionaryBuilder", () => {
  it("keeps the Indonesian translations of each part of speech, without repeats", () => {
    expect(build(run).entries).toEqual([
      { headword: "run", pos: "verb", meanings: ["lari", "berlari"] },
    ])
  })

  it("keeps at most eight meanings", () => {
    const many = {
      ...run,
      translations: Array.from({ length: 10 }, (_, i) => ({
        code: "id",
        word: `arti ${i}`,
      })),
      senses: [],
    }
    expect(build(many).entries[0].meanings).toHaveLength(8)
  })

  it("takes forms from the headword and from form-of senses, but not table tags or multiword tenses", () => {
    const ran = {
      word: "Ran",
      lang_code: "en",
      pos: "verb",
      senses: [{ form_of: [{ word: "run" }] }],
    }
    const forms = build(run, ran).forms.map(({ form }) => form)
    expect(forms.sort()).toEqual(["ran", "running", "runs"])
  })

  it("keeps every form and part of speech, also of headwords without meanings, but not other languages or names", () => {
    const result = build(
      { word: "sing", lang_code: "en", pos: "verb", forms: [{ form: "sang" }] },
      { ...run, lang_code: "fr" },
      { ...run, pos: "name" }
    )
    expect(result.entries).toEqual([])
    expect(result.forms).toEqual([
      { form: "sang", headword: "sing", pos: "verb" },
    ])
    expect(result.partsOfSpeech).toEqual(new Map([["sing", new Set(["verb"])]]))
  })

  it("lists every part of speech a headword has", () => {
    const like = (pos: string) => ({ word: "like", lang_code: "en", pos })
    expect(
      build(like("verb"), like("prep"), like("verb")).partsOfSpeech.get("like")
    ).toEqual(new Set(["verb", "prep"]))
  })

  it("does not count a form-of-only record as a part of speech, but keeps its form", () => {
    const result = build(
      {
        word: "made",
        lang_code: "en",
        pos: "verb",
        senses: [{ form_of: [{ word: "make" }] }],
      },
      {
        word: "saw",
        lang_code: "en",
        pos: "verb",
        senses: [
          { form_of: [{ word: "see" }] },
          { translations: [{ lang_code: "id", word: "menggergaji" }] },
        ],
      }
    )
    expect(result.partsOfSpeech.has("made")).toBe(false)
    expect(result.partsOfSpeech.get("saw")).toEqual(new Set(["verb"]))
    expect(result.forms).toContainEqual({
      form: "made",
      headword: "make",
      pos: "verb",
    })
  })

  it("keeps phrasal verbs, their own forms, and counts them", () => {
    const giveUp = {
      word: "give up",
      lang_code: "en",
      pos: "verb",
      forms: [{ form: "gave up", tags: ["past"] }],
      translations: [{ code: "id", word: "menyerah" }],
    }
    const result = build(giveUp)
    expect(result.phrases).toBe(1)
    expect(result.forms).toEqual([
      { form: "gave up", headword: "give up", pos: "verb" },
    ])
  })

  it("spells headwords the way the reader does", () => {
    const record = {
      word: "Well-known",
      lang_code: "en",
      pos: "adj",
      translations: [{ code: "id", word: "terkenal" }],
    }
    expect(build(record).entries[0].headword).toBe("well-known")
  })

  it("files interjections under interj", () => {
    const record = {
      word: "hello",
      lang_code: "en",
      pos: "intj",
      translations: [{ code: "id", word: "halo" }],
    }
    expect(build(record).entries[0].pos).toBe("interj")
  })

  it("keeps articles, determiners, numbers and particles, and files postpositions as adverbs", () => {
    const entry = (word: string, pos: string, meaning: string) => ({
      word,
      lang_code: "en",
      pos,
      translations: [{ code: "id", word: meaning }],
    })
    const built = build(
      entry("the", "article", "si"),
      entry("every", "det", "setiap"),
      entry("two", "num", "dua"),
      entry("yes", "particle", "ya"),
      entry("ago", "postp", "yang lalu")
    ).entries.map(({ headword, pos }) => `${headword} ${pos}`)
    expect(built).toEqual([
      "the article",
      "every det",
      "two num",
      "yes particle",
      "ago adv",
    ])
  })

  it("leaves names out: lower case, they would meet ordinary words (US, May)", () => {
    const record = {
      word: "US",
      lang_code: "en",
      pos: "name",
      translations: [{ code: "id", word: "AS" }],
    }
    expect(build(record).entries).toEqual([])
  })
})
