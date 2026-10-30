import { ArrowLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Back to the place read before a jump (spec 2 §6.7), bottom left. */
export function ReaderBack({
  shown,
  onBack,
}: {
  shown: boolean
  onBack: () => void
}) {
  if (!shown) return null
  return (
    <Button
      variant="secondary"
      size="lg"
      className="reader-back"
      onClick={onBack}
    >
      <ArrowLeftIcon aria-hidden="true" />
      Kembali
    </Button>
  )
}
