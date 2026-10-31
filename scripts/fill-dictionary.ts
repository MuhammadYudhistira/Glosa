// Fills the dictionary's gaps with meanings made by AI (spec kamus tiga
// sumber §4.3), through the Message Batches API:
//   node --max-old-space-size=8192 scripts/fill-dictionary.ts --env dev|prod
//     [--dry-run] [--trial N] [--commit] [--full] [--discard]
//     [--effort low|medium|high]
//     [--limit N] [--kaikki file] [--wordnet file] [--senses file] [--synsets folder]
//     [--words file]
//     [--wordnet-quality YO]
//   --dry-run  picks the words and prints them, without the API.
//   --trial N  asks the first N words (at most 1000) as one small batch, then
//              prints the real cost, an estimate for all words and 20 samples.
//   --commit   writes the valid answers into dict_generated. With a batch
//              waiting it writes that batch; it never starts a full batch alone.
//   --full     with --commit and no batch waiting, starts a full (paid) batch.
//              Without a waiting batch, --commit alone stops before the API.
//   --discard  forgets (and cancels) the batch waiting in dict/fill-state.json.
// The batch id waits in dict/fill-state.json, so a run cut short picks the
// same batch up again without paying twice. Run by hand from the owner's
// laptop, never by CI or the server; the key comes from ANTHROPIC_API_KEY or
// an `ant auth login` profile. Then run scripts/import-dictionary.ts to
// publish the answers.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { parseArgs } from "node:util"
import Anthropic from "@anthropic-ai/sdk"
import { type GeneratedRow, keyOf } from "../src/lib/words/dict-merge.ts"
import {
  FILL_MAX_TOKENS,
  FILL_MODEL,
  FILL_SCHEMA,
  FILL_SYSTEM,
  WORDS_PER_REQUEST,
  batchCost,
  fillPrompt,
  readAnswer,
} from "../src/lib/words/fill-answer.ts"
import {
  type FillRequest,
  chunk,
  pickCandidates,
} from "../src/lib/words/fill-candidates.ts"
import { normalizeWord } from "../src/lib/words/normalize.ts"
import {
  DEFAULT_FILES,
  type EnvName,
  connect,
  needFile,
  parseQualities,
  readGenerated,
  readMisses,
  readWiktionary,
  readWordnet,
  stop,
  synsetFiles,
} from "./dictionary-files.ts"

const STATE_FILE = "dict/fill-state.json"
const PROBLEMS_FILE = "dict/fill-problems.log"
const UPSERT_BATCH = 500
/** A bigger --trial is a full batch in all but name: that needs --commit --full. */
const MAX_TRIAL = 1000
const POLL_MS = 30_000
const EFFORTS = ["low", "medium", "high"] as const
type Effort = (typeof EFFORTS)[number]
const USAGE =
  "Usage: node --max-old-space-size=8192 scripts/fill-dictionary.ts --env dev|prod [--dry-run] [--trial N] [--commit] [--full] [--discard] [--effort low|medium|high] [--limit N]"

type FillState = {
  env: EnvName
  batchId: string
  trial: boolean
  effort: Effort
  /** Every word there was to ask when the batch was made, for the estimate. */
  candidates: number
  requests: Record<string, Array<FillRequest>>
}

const { values } = parseArgs({
  options: {
    env: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    trial: { type: "string" },
    commit: { type: "boolean", default: false },
    full: { type: "boolean", default: false },
    discard: { type: "boolean", default: false },
    effort: { type: "string", default: "medium" },
    limit: { type: "string" },
    kaikki: { type: "string", default: DEFAULT_FILES.kaikki },
    wordnet: { type: "string", default: DEFAULT_FILES.wordnet },
    senses: { type: "string", default: DEFAULT_FILES.senses },
    synsets: { type: "string", default: DEFAULT_FILES.synsets },
    words: { type: "string", default: DEFAULT_FILES.words },
    "wordnet-quality": { type: "string" },
  },
})

function count(raw: string | undefined, flag: string): number | undefined {
  if (raw === undefined) return undefined
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1)
    stop(`${flag} takes a whole number above 0`)
  return n
}
const trial = count(values.trial, "--trial")
if (trial !== undefined && trial > MAX_TRIAL) {
  stop(
    `--trial takes at most ${MAX_TRIAL} words. For all of them, use --commit --full.`
  )
}
const limit = count(values.limit, "--limit")
const effort = values.effort as Effort
if (!EFFORTS.includes(effort)) stop(`--effort takes ${EFFORTS.join(", ")}`)
const qualities = parseQualities(values["wordnet-quality"])
const { supabase, envName } = connect(values.env, USAGE)

function readState(): FillState | null {
  if (!existsSync(STATE_FILE)) return null
  return JSON.parse(readFileSync(STATE_FILE, "utf8")) as FillState
}

/** The words to ask, from the source files and the database. */
async function candidates(): Promise<Array<FillRequest>> {
  const hint = "See docs/ops/deploy.md §6.5."
  for (const file of [
    values.kaikki,
    values.wordnet,
    values.senses,
    ...synsetFiles(values.synsets),
    values.words,
  ]) {
    needFile(file, hint)
  }
  const wiktionary = await readWiktionary(values.kaikki)
  const wordnet = await readWordnet(
    { bahasa: values.wordnet, senses: values.senses, synsets: values.synsets },
    qualities,
    wiktionary.lowerCase
  )
  const generated = await readGenerated(supabase)
  const misses = await readMisses(supabase)
  const listed = readFileSync(values.words, "utf8").split(/\r?\n/u)
  const requests = pickCandidates({
    words: [...listed, ...misses],
    partsOfSpeech: wiktionary.partsOfSpeech,
    forms: wiktionary.forms,
    filled: new Set(
      [...wiktionary.entries, ...wordnet].map((e) => keyOf(e.headword, e.pos))
    ),
    generated: new Set(generated.map((row) => keyOf(row.headword, row.pos))),
  })
  console.log(
    `${requests.length} headwords to ask (${listed.length} listed words, ${misses.length} tapped words without meanings).`
  )
  // Tapped words that lead to nothing left to ask are answered (or not words at all).
  if (values.commit && !values["dry-run"]) {
    const asked = new Set(requests.flatMap((request) => request.from))
    const answered = misses.filter((word) => !asked.has(normalizeWord(word)))
    for (const words of chunk(answered, 200)) {
      const { error } = await supabase
        .from("dict_misses")
        .delete()
        .in("word", words)
      if (error) stop(`Tidying dict_misses failed: ${error.message}`)
    }
    if (answered.length > 0)
      console.log(`Removed ${answered.length} answered misses.`)
  }
  return requests
}

const describe = (request: FillRequest) =>
  `${request.headword} (${request.pos.length > 0 ? request.pos.join("/") : "pick one"})`

async function main() {
  let state = readState()
  if (values.discard) {
    if (!state) return console.log("No batch is waiting.")
    const client = new Anthropic()
    const batch = await client.messages.batches.retrieve(state.batchId)
    if (batch.processing_status !== "ended") {
      await client.messages.batches.cancel(state.batchId)
    }
    rmSync(STATE_FILE)
    return console.log(`Forgot batch ${state.batchId}.`)
  }
  if (values["dry-run"]) {
    const requests = await candidates()
    for (const request of requests.slice(0, 40))
      console.log(`  ${describe(request)}`)
    if (state) console.log(`Batch ${state.batchId} waits in ${STATE_FILE}.`)
    return
  }
  if (state && state.env !== envName) {
    stop(
      `${STATE_FILE} holds a batch for ${state.env}. Finish it with --env ${state.env}, or drop it with --discard.`
    )
  }

  if (values.full && !values.commit) {
    stop("--full needs --commit: a full batch is only started with both.")
  }
  if (!state && trial === undefined && values.commit && !values.full) {
    stop(
      "No batch is waiting. To start a full (paid) batch, add --full. To try first, use --trial N."
    )
  }

  const client = new Anthropic()
  if (state) {
    const size = Object.values(state.requests).reduce(
      (n, group) => n + group.length,
      0
    )
    console.log(
      `Picking up batch ${state.batchId} (${state.trial ? "trial" : "full"}, effort ${state.effort}, ${size} headwords).`
    )
    if (trial !== undefined || limit !== undefined || effort !== "medium") {
      console.log(
        "--trial, --limit and --effort are ignored for a waiting batch (use --discard to drop it)."
      )
    }
  } else {
    const requests = await candidates()
    const chosen = requests.slice(0, trial ?? limit ?? requests.length)
    if (chosen.length === 0) return console.log("Nothing to ask.")
    if (trial === undefined && !(values.commit && values.full)) {
      stop(
        "A full batch needs --commit --full. Run a --trial first and check its cost."
      )
    }
    const groups: FillState["requests"] = {}
    chunk(chosen, WORDS_PER_REQUEST).forEach((group, i) => {
      groups[`fill-${String(i).padStart(5, "0")}`] = group
    })
    // No SDK retry: a lost response retried would create a second paid batch.
    const batch = await client.messages.batches.create(
      {
        requests: Object.entries(groups).map(([custom_id, group]) => ({
          custom_id,
          params: {
            model: FILL_MODEL,
            max_tokens: FILL_MAX_TOKENS,
            output_config: {
              effort,
              format: { type: "json_schema", schema: FILL_SCHEMA },
            },
            system: FILL_SYSTEM,
            messages: [{ role: "user", content: fillPrompt(group) }],
          },
        })),
      },
      { maxRetries: 0 }
    )
    // Print the id first: if the state file cannot be written, it is not lost.
    console.log(`Created batch ${batch.id}.`)
    state = {
      env: envName,
      batchId: batch.id,
      trial: trial !== undefined,
      effort,
      candidates: requests.length,
      requests: groups,
    }
    writeFileSync(STATE_FILE, `${JSON.stringify(state)}\n`)
    console.log(
      `Sent batch ${batch.id}: ${chosen.length} headwords in ${Object.keys(groups).length} requests, effort ${effort}.`
    )
  }

  for (;;) {
    const batch = await client.messages.batches.retrieve(state.batchId)
    if (batch.processing_status === "ended") break
    const c = batch.request_counts
    console.log(
      `  ${c.processing} requests waiting, ${c.succeeded} done, ${c.errored} errored`
    )
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }

  const rows: Array<GeneratedRow> = []
  const problems: Array<string> = []
  let answered = 0
  let input = 0
  let output = 0
  for await (const result of await client.messages.batches.results(
    state.batchId
  )) {
    const group = state.requests[result.custom_id] as
      Array<FillRequest> | undefined
    if (!group) continue
    if (result.result.type !== "succeeded") {
      problems.push(`${result.custom_id}: ${result.result.type}`)
      continue
    }
    const message = result.result.message
    input += message.usage.input_tokens
    output += message.usage.output_tokens
    if (message.stop_reason !== "end_turn") {
      problems.push(`${result.custom_id}: stopped (${message.stop_reason})`)
      continue
    }
    const text = message.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
    const answer = readAnswer(group, text)
    rows.push(...answer.rows)
    problems.push(...answer.problems)
    answered += answer.answered.length
  }

  const asked = Object.values(state.requests).reduce(
    (n, group) => n + group.length,
    0
  )
  const cost = batchCost({ input, output })
  console.log(
    `${answered} of ${asked} headwords answered (${rows.length} rows); ${problems.length} problems.`
  )
  console.log(
    `Cost: $${cost.toFixed(2)} (${input} input, ${output} output tokens).`
  )
  if (state.trial) {
    console.log(
      `Estimate for all ${state.candidates} headwords at effort ${state.effort}: $${((cost / Math.max(asked, 1)) * state.candidates).toFixed(2)}.`
    )
  }
  for (const row of rows.slice(0, 20)) {
    console.log(
      `  ${row.headword} (${row.pos}): ${row.meanings.join(", ") || "-"}`
    )
  }
  if (problems.length > 0) {
    writeFileSync(PROBLEMS_FILE, `${problems.join("\n")}\n`)
    console.log(
      `Problems are in ${PROBLEMS_FILE}; those words are asked again next run.`
    )
  }

  if (!values.commit) {
    return console.log(
      "Nothing written. Run again with --commit to write these answers, or --discard to drop them."
    )
  }
  for (const batch of chunk(rows, UPSERT_BATCH)) {
    const { error } = await supabase.from("dict_generated").upsert(
      batch.map((row) => ({ ...row, model: FILL_MODEL })),
      { onConflict: "headword,pos" }
    )
    if (error)
      stop(
        `Writing dict_generated failed: ${error.message}. ${STATE_FILE} stays; run again with --commit.`
      )
  }
  rmSync(STATE_FILE)
  console.log(
    `Wrote ${rows.length} rows into dict_generated. Publish them: node --max-old-space-size=8192 scripts/import-dictionary.ts dict/kaikki.org-dictionary-English.jsonl --env ${envName}`
  )
}

await main()
