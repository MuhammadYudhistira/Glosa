import type { AnnotationStore } from "@/lib/local/annotations"
import { createQueueSync } from "@/lib/sync/queue-sync"
import { isValidAnnotation } from "./schemas"
import {
  type Annotation,
  type AnnotationSyncAnswer,
  MAX_ANNOTATION_BATCH,
} from "./types"

/** A change the server refused, shown until dismissed. `code` is a bookMessage key. */
export type AnnotationRejection = {
  code: "annotations_full" | "annotation_invalid"
}

export type AnnotationSync = {
  /** Shows a new, changed or deleted annotation at once and queues it. */
  put: (annotation: Annotation) => Promise<void>
  /** Sends every waiting change now. Never rejects. */
  flush: () => Promise<void>
  /** Grows on every change to annotations on this device. */
  version: () => number
  /** For changes made beside the queue, such as the server's list arriving. */
  notify: () => void
  rejection: () => AnnotationRejection | null
  dismissRejection: () => void
  subscribe: (listener: () => void) => () => void
  dispose: () => void
}

/**
 * Highlights and bookmarks (spec 2 §7): shown on this device at once, then
 * sent two seconds after the last change, in batches of 50.
 */
export function createAnnotationSync(options: {
  store: AnnotationStore
  send: (entries: Array<Annotation>) => Promise<AnnotationSyncAnswer>
  isOnline: () => boolean
  debounceMs?: number
}): AnnotationSync {
  const { store } = options
  let rejection: AnnotationRejection | null = null
  const queue = createQueueSync<Annotation>({
    store,
    send: options.send,
    isOnline: options.isOnline,
    keyOf: (annotation) => annotation.id,
    batchSize: MAX_ANNOTATION_BATCH,
    onRefused: (refused) =>
      refuse(
        refused.some(({ result }) => result === "limit_reached")
          ? "annotations_full"
          : "annotation_invalid"
      ),
    debounceMs: options.debounceMs,
  })

  function refuse(code: AnnotationRejection["code"]) {
    rejection = { code }
    queue.changed()
  }

  return {
    async put(annotation) {
      if (!isValidAnnotation(annotation)) {
        refuse("annotation_invalid")
        return
      }
      await store.put(annotation)
      queue.changed()
      queue.later()
    },
    flush: queue.flush,
    version: queue.version,
    notify: queue.changed,
    rejection: () => rejection,
    dismissRejection() {
      if (!rejection) return
      rejection = null
      queue.changed()
    },
    subscribe: queue.subscribe,
    dispose: queue.dispose,
  }
}
