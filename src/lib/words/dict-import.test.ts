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

  it("drops forms of headwords without meanings, other languages and other parts of speech", () => {
    const result = build(
      { word: "sing", lang_code: "en", pos: "verb", forms: [{ form: "sang" }] },
      { ...run, lang_code: "fr" },
      { ...run, pos: "name" }
    )
    expect(result).toEqual({ entries: [], forms: [], phrases: 0 })
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
})
