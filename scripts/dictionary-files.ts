// What the dictionary scripts share: the source files and the dictionary
// tables. Node runs it as it is, so imports spell out their extensions.
import { createReadStream, existsSync } from "node:fs"
import { createInterface } from "node:readline"
import { createGunzip } from "node:zlib"
import { type SupabaseClient, createClient } from "@supabase/supabase-js"
import type { Database } from "../src/server/database.types.ts"
import { createDictionaryBuilder } from "../src/lib/words/dict-import.ts"
import type { GeneratedRow } from "../src/lib/words/dict-merge.ts"
import {
  DICT_POS,
  type DictEntry,
  type DictPos,
} from "../src/lib/words/types.ts"
import {
  DEFAULT_WORDNET_QUALITIES,
  WORDNET_QUALITIES,
  type WordnetQuality,
  createWordnetReader,
} from "../src/lib/words/wordnet.ts"

const ENV_FILES = { dev: ".env.local", prod: ".env.prod" } as const
export type EnvName = keyof typeof ENV_FILES
/** PostgREST answers at most this many rows at once. */
const PAGE = 1000
/** Tapped words the AI may be asked about in one run (plan, decision 5). */
const MAX_MISSES = 5000

/** Where docs/ops/deploy.md §6.5 puts the downloads. */
export const DEFAULT_FILES = {
  kaikki: "dict/kaikki.org-dictionary-English.jsonl",
  wordnet: "dict/wn-msa-all.tab",
  senses: "dict/index.sense",
  words: "dict/wordfreq-en-50k.txt",
}

export function stop(message: string): never {
  console.error(message)
  process.exit(1)
}

/** Stops before anything changes when a needed file is missing. */
export function needFile(path: string, hint: string): void {
  if (!existsSync(path)) stop(`Missing ${path}. ${hint}`)
}

/** The service-role client of dev (.env.local) or prod (.env.prod). */
export function connect(
  envName: string | undefined,
  usage: string
): { supabase: SupabaseClient<Database>; envName: EnvName } {
  if (envName !== "dev" && envName !== "prod") stop(usage)
  const envFile = ENV_FILES[envName]
  if (!existsSync(envFile)) stop(`Missing ${envFile}`)
  process.loadEnvFile(envFile)
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key)
    stop(`${envFile} needs SUPABASE_URL and SUPABASE_SECRET_KEY`)
  console.log(`Target: ${new URL(url).host} (${envName})`)
  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { supabase, envName }
}

/** A text file's lines, gzipped or not. */
export function linesOf(file: string): AsyncIterable<string> {
  const input = createReadStream(file)
  return createInterface({
    input: file.endsWith(".gz") ? input.pipe(createGunzip()) : input,
    crlfDelay: Infinity,
  })
}

/** The Wiktionary side, from a kaikki.org English extract. */
export async function readWiktionary(file: string) {
  const builder = createDictionaryBuilder()
  let read = 0
  let unreadable = 0
  for await (const line of linesOf(file)) {
    if (!line.trim()) continue
    read += 1
    try {
      builder.add(JSON.parse(line))
    } catch {
      unreadable += 1
    }
    if (read % 200_000 === 0) console.log(`  ${read} records read`)
  }
  const result = builder.result()
  console.log(
    `Wiktionary: ${read} records (${unreadable} unreadable): ${result.entries.length} entries, ${result.forms.length} forms, ${result.phrases} phrasal verbs and phrases.`
  )
  return result
}

/** "YO" or "YOL" from --wordnet-quality; Y and O by default. */
export function parseQualities(raw: string | undefined): Array<WordnetQuality> {
  if (raw === undefined) return [...DEFAULT_WORDNET_QUALITIES]
  const letters = [...new Set(raw.toUpperCase())]
  const valid = (letter: string): letter is WordnetQuality =>
    (WORDNET_QUALITIES as ReadonlyArray<string>).includes(letter)
  if (letters.length === 0 || !letters.every(valid)) {
    stop(
      `--wordnet-quality takes letters from ${WORDNET_QUALITIES.join("")}, e.g. YO`
    )
  }
  return letters.filter(valid)
}

/** The WordNet Bahasa side. */
export async function readWordnet(
  files: { bahasa: string; senses: string },
  qualities: ReadonlyArray<WordnetQuality>
): Promise<Array<DictEntry>> {
  const reader = createWordnetReader(qualities)
  for await (const line of linesOf(files.bahasa)) {
    if (!line.startsWith("#")) reader.addBahasa(line)
  }
  for await (const line of linesOf(files.senses)) reader.addSense(line)
  const entries = reader.result()
  console.log(
    `WordNet Bahasa (${qualities.join("")}): ${entries.length} entries.`
  )
  return entries
}

const isPos = (pos: string): pos is DictPos =>
  (DICT_POS as ReadonlyArray<string>).includes(pos)

/** Every row of dict_generated, a page at a time. */
export async function readGenerated(
  supabase: SupabaseClient<Database>
): Promise<Array<GeneratedRow>> {
  const rows: Array<GeneratedRow> = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("dict_generated")
      .select("headword, pos, meanings")
      .order("headword")
      .order("pos")
      .range(from, from + PAGE - 1)
    if (error) stop(`Reading dict_generated failed: ${error.message}`)
    for (const row of data) {
      if (isPos(row.pos)) {
        rows.push({
          headword: row.headword,
          pos: row.pos,
          meanings: row.meanings,
        })
      }
    }
    if (data.length < PAGE) break
  }
  return rows
}

/** The most looked-up words without a meaning, most first. */
export async function readMisses(
  supabase: SupabaseClient<Database>
): Promise<Array<string>> {
  const words: Array<string> = []
  for (let from = 0; from < MAX_MISSES; from += PAGE) {
    const { data, error } = await supabase
      .from("dict_misses")
      .select("word")
      .order("lookups", { ascending: false })
      .order("word")
      .range(from, Math.min(from + PAGE, MAX_MISSES) - 1)
    if (error) stop(`Reading dict_misses failed: ${error.message}`)
    words.push(...data.map((row) => row.word))
    if (data.length < PAGE) break
  }
  return words
}
