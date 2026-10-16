import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useCallback, useReducer, useRef, useState } from "react"
import type { ActionResult } from "@/lib/action-result"
import { EpubError, type ParsedEpub, readEpub } from "@/lib/epub/read-epub"
import type { Genre } from "@/lib/genre"
import { confirmUploadFn, requestUploadFn } from "@/server/books"
import { uploadBook } from "./upload-book"
import { type UploadItem, uploadQueueReducer } from "./upload-queue"

type Entry = { file: File; parsed: ParsedEpub | null }

export function useUploadQueue() {
  const [items, dispatch] = useReducer(uploadQueueReducer, [])
  const [running, setRunning] = useState(false)
  // Files and parse results are not serialisable, so they live beside the reducer.
  const entries = useRef(new Map<string, Entry>())
  const requestUpload = useServerFn(requestUploadFn)
  const confirmUpload = useServerFn(confirmUploadFn)
  const router = useRouter()

  const addFiles = useCallback((files: Iterable<File>) => {
    const added = Array.from(files, (file) => ({
      id: crypto.randomUUID(),
      file,
    }))
    for (const { id, file } of added)
      entries.current.set(id, { file, parsed: null })
    dispatch({
      type: "added",
      files: added.map(({ id, file }) => ({ id, fileName: file.name })),
    })
    for (const { id, file } of added) {
      readEpub(file)
        .then((parsed) => {
          const entry = entries.current.get(id)
          if (entry) entry.parsed = parsed
          dispatch({
            type: "read",
            id,
            title: parsed.metadata.title,
            author: parsed.metadata.author,
            suggestedGenre: parsed.suggestedGenre,
          })
        })
        .catch((error: unknown) =>
          dispatch({
            type: "failed",
            id,
            // Not every failure means a broken file (e.g. the file vanished after selection).
            code: error instanceof EpubError ? error.code : "unknown",
          })
        )
    }
  }, [])

  const uploadAll = useCallback(
    async (targets: ReadonlyArray<UploadItem>) => {
      if (targets.length === 0) return
      setRunning(true)
      try {
        for (const item of targets) {
          const entry = entries.current.get(item.id)
          if (!entry?.parsed) continue
          dispatch({ type: "started", id: item.id })
          let result: ActionResult
          try {
            result = await uploadBook(
              entry.file,
              entry.parsed,
              { genre: item.genre, genreSource: item.genreSource },
              { requestUpload, confirmUpload },
              (progress) =>
                dispatch({ type: "progressed", id: item.id, progress })
            )
          } catch {
            result = { ok: false, code: "unknown" }
          }
          dispatch(
            result.ok
              ? { type: "finished", id: item.id }
              : { type: "failed", id: item.id, code: result.code }
          )
        }
      } finally {
        setRunning(false)
        await router.invalidate()
      }
    },
    [requestUpload, confirmUpload, router]
  )

  const retry = useCallback(
    (item: UploadItem) => {
      dispatch({ type: "retried", id: item.id })
      void uploadAll([{ ...item, status: "ready", code: null, progress: 0 }])
    },
    [uploadAll]
  )

  const chooseGenre = useCallback((id: string, genre: Genre | null) => {
    dispatch({ type: "genre_chosen", id, genre })
  }, [])

  const clearDone = useCallback(() => {
    dispatch({ type: "cleared" })
  }, [])

  return { items, running, addFiles, chooseGenre, retry, uploadAll, clearDone }
}
