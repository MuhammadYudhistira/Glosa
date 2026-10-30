// Imports the dictionary (spec 2 §4.1; spec kamus tiga sumber §4.2) from
// three sources: English Wiktionary (a kaikki.org extract), WordNet Bahasa,
// and the AI meanings kept in dict_generated.
//   node --max-old-space-size=8192 scripts/import-dictionary.ts <kaikki.jsonl[.gz]> --env dev|prod
//     [--wordnet dict/wn-msa-all.tab] [--senses dict/index.sense] [--wordnet-quality YO]
//     [--no-wordnet] [--no-generated] [--coverage book.txt] [--dry-run]
//     [--dump-date YYYY-MM-DD] [--force]
// dev reads .env.local, prod reads .env.prod (both kept out of git). The rows
// go to staging tables first; dict_swap then replaces the dictionary in one
// transaction. --dry-run reads and counts everything and changes nothing.
// Run by hand, never by CI (docs/ops/deploy.md §6.5).
import { readFileSync } from "node:fs"
import { basename } from "node:path"
import { parseArgs } from "node:util"
import { measureCoverage } from "../src/lib/words/coverage.ts"
import { mergeDictionary } from "../src/lib/words/dict-merge.ts"
import type { DictEntry } from "../src/lib/words/types.ts"
import {
  DEFAULT_FILES,
  connect,
  needFile,
  parseQualities,
  readGenerated,
  readWiktionary,
  readWordnet,
  stop,
} from "./dictionary-files.ts"

const BATCH = 1000
const USAGE =
  "Usage: node --max-old-space-size=8192 scripts/import-dictionary.ts <kaikki.jsonl[.gz]> --env dev|prod [--wordnet file] [--senses file] [--wordnet-quality YO] [--no-wordnet] [--no-generated] [--coverage book.txt] [--dry-run] [--dump-date YYYY-MM-DD] [--force]"
const WORDNET_HINT =
  "See docs/ops/deploy.md §6.5, or import without it: --no-wordnet."

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    env: { type: "string" },
    wordnet: { type: "string", default: DEFAULT_FILES.wordnet },
    senses: { type: "string", default: DEFAULT_FILES.senses },
    "wordnet-quality": { type: "string" },
    "no-wordnet": { type: "boolean", default: false },
    "no-generated": { type: "boolean", default: false },
    coverage: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "dump-date": { type: "string" },
    force: { type: "boolean", default: false },
  },
})
const [file] = positionals
if (!file) stop(USAGE)
const qualities = parseQualities(values["wordnet-quality"])
needFile(file, "Download it from kaikki.org (docs/ops/deploy.md §6.5).")
if (!values["no-wordnet"]) {
  needFile(values.wordnet, WORDNET_HINT)
  needFile(values.senses, WORDNET_HINT)
}
if (values.coverage) needFile(values.coverage, "Give a plain-text book.")
const { supabase } = connect(values.env, USAGE)

const wiktionary = await readWiktionary(file)
if (wiktionary.entries.length === 0) stop("Nothing to import.")
const wordnet: Array<DictEntry> = values["no-wordnet"]
  ? []
  : await readWordnet(
      { bahasa: values.wordnet, senses: values.senses },
      qualities
    )
const generated = values["no-generated"] ? [] : await readGenerated(supabase)
console.log(
  `AI: ${generated.filter((row) => row.meanings.length > 0).length} rows with meanings, of ${generated.length}.`
)

const { entries, forms, counts } = mergeDictionary({
  wiktionary: wiktionary.entries,
  wordnet,
  generated,
  forms: wiktionary.forms,
})
console.log(
  `Dictionary: ${entries.length} entries (Wiktionary ${counts.wiktionary}, WordNet ${counts.wordnet}, AI ${counts.ai}), ${forms.length} forms.`
)

if (values.coverage) {
  // dict_swap makes every headword its own form too.
  const known = new Set([
    ...entries.map((entry) => entry.headword),
    ...forms.map((form) => form.form),
  ])
  const c = measureCoverage(readFileSync(values.coverage, "utf8"), (word) =>
    known.has(word)
  )
  const percent = (part: number, whole: number) =>
    `${((part / Math.max(whole, 1)) * 100).toFixed(1)}%`
  console.log(
    `Coverage of ${basename(values.coverage)}: ${percent(c.coveredTokens, c.tokens)} of ${c.tokens} words as they occur, ${percent(c.coveredWords, c.words)} of ${c.words} distinct words.`
  )
}
if (values["dry-run"]) {
  console.log("Dry run: the dictionary stays as it is.")
  process.exit(0)
}

async function check(
  step: string,
  request: PromiseLike<{ error: { message: string } | null }>
) {
  const { error } = await request
  if (error) stop(`${step} failed: ${error.message}`)
}

await check("Clearing the staging tables", supabase.rpc("dict_staging_reset"))
async function loadInBatches<T>(
  table: string,
  rows: Array<T>,
  insert: (
    batch: Array<T>
  ) => PromiseLike<{ error: { message: string } | null }>
) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await check(`Loading ${table}`, insert(rows.slice(i, i + BATCH)))
  }
  console.log(`Loaded ${rows.length} rows into ${table}.`)
}

await loadInBatches("dict_entries_staging", entries, (batch) =>
  supabase.from("dict_entries_staging").insert(batch)
)
await loadInBatches("dict_forms_staging", forms, (batch) =>
  supabase.from("dict_forms_staging").insert(batch)
)

const { data, error } = await supabase.rpc("dict_swap", {
  p_source: basename(file),
  p_dump_date: values["dump-date"],
  p_force: values.force,
})
if (error) {
  stop(
    error.message === "shrunk"
      ? "The new dictionary has over 20% fewer entries than the last one. Check the files, or run again with --force."
      : `Swapping the dictionary failed: ${error.message}`
  )
}
console.log("Dictionary swapped in:", data)
