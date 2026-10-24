import type { SavedWord } from "@/lib/words/types"
import type { WordStore } from "@/lib/words/word-sync"
import { localDb } from "./db"

/** Every form of every saved word, by headword: what the books underline (spec 2 §6.5). */
export type FormsByHeadword = Record<string, Array<string>>

const FORMS_KEY = "saved-forms"

// Two changes of a word within one millisecond still get different stamps,
// so confirm() never drops the later one.
let lastStamp = 0
function stamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1)
  return lastStamp
}

/** Kosakata on this device, newest first. */
export async function listLocalWords(): Promise<Array<SavedWord>> {
  return localDb().words.orderBy("createdAt").reverse().toArray()
}

export async function loadSavedForms(): Promise<FormsByHeadword> {
  const row = await localDb().meta.get(FORMS_KEY)
  return (row?.value as FormsByHeadword | undefined) ?? {}
}

async function changeForms(
  change: (forms: FormsByHeadword) => FormsByHeadword
): Promise<void> {
  await localDb().meta.put({
    key: FORMS_KEY,
    value: change(await loadSavedForms()),
  })
}

const without = (forms: FormsByHeadword, headword: string): FormsByHeadword =>
  Object.fromEntries(Object.entries(forms).filter(([key]) => key !== headword))

/** The server's list, with this device's waiting changes laid over it (spec 2 §7). */
export async function replaceLocalWords(
  words: Array<SavedWord>
): Promise<void> {
  const db = localDb()
  await db.transaction("rw", db.words, db.wordOps, async () => {
    const ops = await db.wordOps.toArray()
    await db.words.clear()
    await db.words.bulkPut(words)
    for (const op of ops) {
      if (op.kind === "save" && op.word) await db.words.put(op.word)
      else await db.words.delete(op.headword)
    }
  })
}

/** The server's forms, with this device's waiting changes laid over them. */
export async function saveSavedForms(forms: FormsByHeadword): Promise<void> {
  const db = localDb()
  await db.transaction("rw", db.wordOps, db.meta, async () => {
    // Partial: a key may be missing, so each lookup is checked.
    const local: Partial<FormsByHeadword> = await loadSavedForms()
    let merged: FormsByHeadword = forms
    for (const op of await db.wordOps.toArray()) {
      const current: Partial<FormsByHeadword> = merged
      merged =
        op.kind === "save"
          ? {
              ...merged,
              [op.headword]: current[op.headword] ??
                local[op.headword] ?? [op.headword],
            }
          : without(merged, op.headword)
    }
    await db.meta.put({ key: FORMS_KEY, value: merged })
  })
}

/** Kosakata in IndexedDB: a change shows at once and waits for the server in wordOps. */
export const localWordStore: WordStore = {
  async save(word, forms) {
    const db = localDb()
    await db.transaction("rw", db.words, db.wordOps, db.meta, async () => {
      await db.words.put(word)
      await db.wordOps.put({
        headword: word.headword,
        kind: "save",
        word,
        queuedAt: stamp(),
      })
      await changeForms((all) => ({
        ...all,
        [word.headword]: [...new Set([word.headword, ...forms])],
      }))
    })
  },

  async remove(headword) {
    const db = localDb()
    await db.transaction("rw", db.words, db.wordOps, db.meta, async () => {
      await db.words.delete(headword)
      await db.wordOps.put({
        headword,
        kind: "delete",
        word: null,
        queuedAt: stamp(),
      })
      await changeForms((all) => without(all, headword))
    })
  },

  pending: () => localDb().wordOps.orderBy("queuedAt").toArray(),

  async confirm(sent) {
    const db = localDb()
    await db.transaction("rw", db.wordOps, async () => {
      for (const op of sent) {
        const row = await db.wordOps.get(op.headword)
        if (row?.queuedAt === op.queuedAt) await db.wordOps.delete(op.headword)
      }
    })
  },

  async revert(op) {
    if (op.kind !== "save") return
    const db = localDb()
    await db.transaction("rw", db.words, db.wordOps, db.meta, async () => {
      if (await db.wordOps.get(op.headword)) return
      await db.words.delete(op.headword)
      await changeForms((all) => without(all, op.headword))
    })
  },
}
