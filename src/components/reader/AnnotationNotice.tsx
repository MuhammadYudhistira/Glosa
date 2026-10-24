import {
  annotationSync,
  useAnnotationRejection,
} from "@/lib/annotations/annotation-sync-client"
import { SyncNotice } from "./SyncNotice"

/** Why the server did not keep an annotation (spec 2 §8), until the member closes it. */
export function AnnotationNotice() {
  const rejection = useAnnotationRejection()
  if (!rejection) return null
  return (
    <SyncNotice
      label="Anotasi"
      code={rejection.code}
      onClose={() => annotationSync().dismissRejection()}
    />
  )
}
