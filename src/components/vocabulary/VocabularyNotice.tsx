import { SyncNotice } from "@/components/reader/SyncNotice"
import { useWordRejection, wordSync } from "@/lib/words/word-sync-client"

/** Why the server did not keep a word (spec 2 §7), until the member closes it. */
export function VocabularyNotice({ className }: { className?: string }) {
  const rejection = useWordRejection()
  if (!rejection) return null
  return (
    <SyncNotice
      label="Kosakata"
      code={rejection.code}
      onClose={() => wordSync().dismissRejection()}
      className={className}
    />
  )
}
