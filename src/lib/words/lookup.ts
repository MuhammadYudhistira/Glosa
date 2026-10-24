import {
  getCachedLookup,
  getCachedWord,
  putCachedLookup,
} from "@/lib/local/lookups"
import { reportError } from "@/lib/sentry-client"
import { lookupWordFn } from "@/server/words"
import {
  type DictPos,
  type LookupAnswer,
  type LookupResult,
  MAX_MEANINGS,
} from "./types"

export type LookupOutcome =
  | { kind: "result"; result: LookupResult }
  /** A new word without a connection: "Arti butuh koneksi". */
  | { kind: "offline" }
  | { kind: "failed" }

export type LookupDeps = {
  fetch: (word: string, next: Array<string>) => Promise<LookupAnswer>
  isOnline: () => boolean
}

const browserDeps: LookupDeps = {
  fetch: (word, next) => lookupWordFn({ data: { word, next } }),
  isOnline: () => navigator.onLine,
}

/** IndexedDB can fail (private mode, a full disk): the lookup goes on without it. */
async function quietly<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work()
  } catch {
    return fallback
  }
}

/**
 * A word's meanings (spec 2 §5, §7): this device's cache first, then the
 * server, whose answer (an empty one too) is kept for offline. Never rejects.
 */
export async function lookUp(
  word: string,
  next: Array<string>,
  deps: LookupDeps = browserDeps
): Promise<LookupOutcome> {
  const cached = await quietly(() => getCachedLookup(word, next), null)
  if (cached) return { kind: "result", result: cached }

  const offline = async (): Promise<LookupOutcome> => {
    const same = await quietly(() => getCachedWord(word), null)
    return same ? { kind: "result", result: same } : { kind: "offline" }
  }
  if (!deps.isOnline()) return offline()

  let answer: LookupAnswer
  try {
    answer = await deps.fetch(word, next)
  } catch (error) {
    // The connection can drop while the request is in flight.
    if (!deps.isOnline() || error instanceof TypeError) return offline()
    reportError(error)
    return { kind: "failed" }
  }
  if (!answer.ok) {
    reportError(new Error(`lookup_word answered ${answer.code}`))
    return { kind: "failed" }
  }
  const result = answer.result
  await quietly(() => putCachedLookup(word, next, result), undefined)
  return { kind: "result", result }
}

export type SavedChoice = {
  headword: string
  pos: DictPos | null
  meanings: Array<string>
}

/**
 * What Simpan keeps (spec 2 §6.3): the phrase shown first, else the base form
 * with the meanings of all its parts of speech, else the word as tapped.
 */
export function savedChoice(
  result: LookupResult | null,
  tapped: string
): SavedChoice {
  const phrase = result?.phrases.at(0)
  if (phrase) {
    return {
      headword: phrase.headword,
      pos: "phrase",
      meanings: phrase.meanings.slice(0, MAX_MEANINGS),
    }
  }
  const first = result?.entries.at(0)
  if (!result || !first) return { headword: tapped, pos: null, meanings: [] }
  const meanings = result.entries
    .filter((entry) => entry.headword === first.headword)
    .flatMap((entry) => entry.meanings)
  return {
    headword: first.headword,
    pos: first.pos,
    meanings: [...new Set(meanings)].slice(0, MAX_MEANINGS),
  }
}
