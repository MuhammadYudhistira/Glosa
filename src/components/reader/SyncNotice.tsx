import { Button } from "@/components/ui/button"
import { bookMessage } from "@/lib/book-messages"
import { cn } from "@/lib/utils"

/** Why the server did not keep a change (spec 2 §7), until the member closes it. */
export function SyncNotice({
  label,
  code,
  onClose,
  className,
}: {
  label: string
  /** A bookMessage key. */
  code: string
  onClose: () => void
  className?: string
}) {
  return (
    <aside aria-label={label} className={cn("reader-toast", className)}>
      <output className="text-sm">{bookMessage(code)}</output>
      <Button size="lg" variant="ghost" onClick={onClose}>
        Tutup
      </Button>
    </aside>
  )
}
