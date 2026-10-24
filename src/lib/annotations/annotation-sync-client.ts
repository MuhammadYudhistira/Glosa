import { useEffect, useState, useSyncExternalStore } from "react"
import {
  bookAnnotations,
  localAnnotationStore,
  mergeServerAnnotations,
} from "@/lib/local/annotations"
import { useQueueFlush } from "@/lib/sync/use-queue-flush"
import { listAnnotationsFn, syncAnnotationsFn } from "@/server/annotations"
import {
  type AnnotationRejection,
  type AnnotationSync,
  createAnnotationSync,
} from "./annotation-sync"
import type { Annotation } from "./types"

let engine: AnnotationSync | null = null

/** The one annotation sync of this tab (browser only). */
export function annotationSync(): AnnotationSync {
  engine ??= createAnnotationSync({
    store: localAnnotationStore,
    isOnline: () => navigator.onLine,
    send: (entries) => syncAnnotationsFn({ data: { entries } }),
  })
  return engine
}

/**
 * Reads the book's annotations from the server, tombstones too, so changes
 * made on other devices show here (spec 2 §4.3). Without a connection the
 * device's copy stays. Never rejects.
 */
export async function refreshBookAnnotations(bookId: string): Promise<void> {
  try {
    const answer = await listAnnotationsFn({ data: { bookId } })
    if (!answer.ok) return
    await mergeServerAnnotations(bookId, answer.annotations)
    annotationSync().notify()
  } catch (error) {
    console.error("fetching the book's annotations failed", error)
  }
}

const flushAnnotations = () => annotationSync().flush()

/** Sends waiting annotation changes when the app opens and when the connection comes back. */
export function useAnnotationFlush(userId: string): void {
  useQueueFlush(userId, flushAnnotations)
}

export function useAnnotationsVersion(): number {
  return useSyncExternalStore(
    (listener) => annotationSync().subscribe(listener),
    () => annotationSync().version(),
    () => 0
  )
}

const NONE: Array<Annotation> = []

/** The book's annotations on this device, read again after every change. */
export function useBookAnnotations(bookId: string): Array<Annotation> {
  const version = useAnnotationsVersion()
  const [state, setState] = useState<{
    bookId: string
    annotations: Array<Annotation>
  }>({ bookId, annotations: NONE })
  useEffect(() => {
    let live = true
    bookAnnotations(bookId)
      .then((annotations) => {
        if (live) setState({ bookId, annotations })
      })
      .catch((error: unknown) =>
        console.error("reading annotations on this device failed", error)
      )
    return () => {
      live = false
    }
  }, [bookId, version])
  return state.bookId === bookId ? state.annotations : NONE
}

export function useAnnotationRejection(): AnnotationRejection | null {
  useAnnotationsVersion()
  return import.meta.env.SSR ? null : annotationSync().rejection()
}
