import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { LobbyPopup } from "@/components/lobby/LobbyPopup"
import { ShelfLoadError } from "@/components/shelf/ShelfLoadError"
import { Button } from "@/components/ui/button"
import { VocabularyList } from "@/components/vocabulary/VocabularyList"
import { VocabularyNotice } from "@/components/vocabulary/VocabularyNotice"
import { claimLocalData } from "@/lib/local/device"
import { replaceLocalWords } from "@/lib/local/saved-words"
import { loadVocabulary } from "@/lib/vocabulary-loader"
import type { SavedWord } from "@/lib/words/types"
import {
  refreshSavedForms,
  useLocalWords,
  useSavedForms,
  wordSync,
} from "@/lib/words/word-sync-client"

const lobi = getRouteApi("/_member/_lobi")
/** How long "Urungkan" stays after a word is deleted. */
const UNDO_MS = 6_000

export const Route = createFileRoute("/_member/_lobi/vocabulary")({
  loader: ({ context }) => loadVocabulary(context.user.id),
  head: () => ({ meta: [{ title: "Kosakata — Glosa" }] }),
  errorComponent: ShelfLoadError,
  component: VocabularyPage,
})

function VocabularyPage() {
  const loaded = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const { books } = lobi.useLoaderData()
  const words = useLocalWords(loaded.words)
  const forms = useSavedForms()
  const shelfIds = useMemo(() => new Set(books.map((book) => book.id)), [books])
  const [removed, setRemoved] = useState<{
    word: SavedWord
    forms: Array<string>
  } | null>(null)

  // The server's list becomes this device's copy for offline (spec 2 §7).
  useEffect(() => {
    if (loaded.offline) return
    let live = true
    // On a hard load the loader skips the claim, so wait for it here: a wipe
    // for another member must not land after the replace.
    claimLocalData(user.id)
      .then(() => replaceLocalWords(loaded.words))
      .then(() => {
        if (!live) return
        wordSync().notify()
        return refreshSavedForms()
      })
      .catch((error: unknown) =>
        console.error("storing Kosakata on this device failed", error)
      )
    return () => {
      live = false
    }
  }, [loaded, user.id])

  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setRemoved(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [removed])

  const remove = (word: SavedWord) => {
    setRemoved({ word, forms: forms[word.headword] ?? [word.headword] })
    wordSync()
      .remove(word.headword)
      .catch((error: unknown) =>
        console.error("deleting the word failed", error)
      )
  }
  const undo = () => {
    if (!removed) return
    wordSync()
      .save(removed.word, removed.forms)
      .catch((error: unknown) =>
        console.error("restoring the word failed", error)
      )
    setRemoved(null)
  }

  return (
    <LobbyPopup label="Kosakata" className="max-w-4xl" bodyClassName="gap-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-heading text-3xl font-bold">Kosakata</h1>
        {words.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {words.length} kata
          </span>
        )}
      </header>
      {loaded.offline && (
        <output className="block rounded-lg border bg-panel px-4 py-2 text-sm">
          Kamu sedang offline. Kosakata ditampilkan dari salinan di perangkat
          ini.
        </output>
      )}
      <VocabularyNotice className="vocab-notice" />
      {removed && (
        <aside aria-label="Kata dihapus" className="vocab-notice">
          <output className="text-sm">
            “{removed.word.headword}” dihapus.
          </output>
          <Button variant="outline" size="lg" onClick={undo}>
            Urungkan
          </Button>
        </aside>
      )}
      <VocabularyList
        words={words}
        forms={forms}
        shelfIds={shelfIds}
        onDelete={remove}
      />
    </LobbyPopup>
  )
}
