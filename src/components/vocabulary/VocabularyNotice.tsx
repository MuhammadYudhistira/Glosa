import { Button } from "@/components/ui/button"
import { bookMessage } from "@/lib/book-messages"
import { cn } from "@/lib/utils"
import { useWordRejection, wordSync } from "@/lib/words/word-sync-client"

/** Why the server did not keep a word (spec 2 §7), until the member closes it. */
export function VocabularyNotice({ className }: { className?: string }) {
  const rejection = useWordRejection()
  if (!rejection) return null
  return (
    <aside aria-label="Kosakata" className={cn("reader-toast", className)}>
      <output className="text-sm">{bookMessage(rejection.code)}</output>
      <Button
        size="lg"
        variant="ghost"
        onClick={() => wordSync().dismissRejection()}
      >
        Tutup
      </Button>
    </aside>
  )
}
