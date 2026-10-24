// Imports the dictionary (spec 2 §4.1) from a kaikki.org English extract:
//   node scripts/import-dictionary.ts <file.jsonl[.gz]> --env dev|prod [--dump-date YYYY-MM-DD] [--force]
// dev reads .env.local, prod reads .env.prod (both kept out of git). The rows
// go to staging tables first; dict_swap then replaces the dictionary in one
// transaction. Run by hand, never by CI (docs/ops/deploy.md §6.5).
import { createReadStream, existsSync } from "node:fs"
import { basename } from "node:path"
import { createInterface } from "node:readline"
import { parseArgs } from "node:util"
import { createGunzip } from "node:zlib"
import { createClient } from "@supabase/supabase-js"
import { createDictionaryBuilder } from "../src/lib/words/dict-import.ts"

const ENV_FILES = { dev: ".env.local", prod: ".env.prod" } as const
const BATCH = 1000
const USAGE =
  "Usage: node scripts/import-dictionary.ts <file.jsonl[.gz]> --env dev|prod [--dump-date YYYY-MM-DD] [--force]"

function stop(message: string): never {
  console.error(message)
  process.exit(1)
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    env: { type: "string" },
    "dump-date": { type: "string" },
    force: { type: "boolean", default: false },
  },
})
const [file] = positionals
const envName = values.env
if (!file || (envName !== "dev" && envName !== "prod")) stop(USAGE)
const envFile = ENV_FILES[envName]
if (!existsSync(envFile)) stop(`Missing ${envFile}`)
process.loadEnvFile(envFile)
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) stop(`${envFile} needs SUPABASE_URL and SUPABASE_SECRET_KEY`)
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})
console.log(`Target: ${new URL(url).host} (${envName})`)

const builder = createDictionaryBuilder()
const input = createReadStream(file)
const lines = createInterface({
  input: file.endsWith(".gz") ? input.pipe(createGunzip()) : input,
  crlfDelay: Infinity,
})
let read = 0
let unreadable = 0
for await (const line of lines) {
  if (!line.trim()) continue
  read += 1
  try {
    builder.add(JSON.parse(line))
  } catch {
    unreadable += 1
  }
  if (read % 200_000 === 0) console.log(`  ${read} records read`)
}
const { entries, forms, phrases } = builder.result()
console.log(
  `Read ${read} records (${unreadable} unreadable): ${entries.length} entries, ${forms.length} forms, ${phrases} phrasal verbs and phrases.`
)
if (entries.length === 0) stop("Nothing to import.")

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
      ? "The new dictionary has over 20% fewer entries than the last one. Check the file, or run again with --force."
      : `Swapping the dictionary failed: ${error.message}`
  )
}
console.log("Dictionary swapped in:", data)
