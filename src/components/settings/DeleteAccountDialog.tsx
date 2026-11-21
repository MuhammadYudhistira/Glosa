import { type FormEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ActionResult } from "@/lib/action-result"
import { authMessage } from "@/lib/auth-messages"

/** Deleting the account, behind a confirmation (spec poles mobile §6). */
export function DeleteAccountDialog({
  open,
  onOpenChange,
  username,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  username: string
  /** Resolves only on refusal; success leaves the page. */
  onDelete: (confirmUsername: string) => Promise<ActionResult>
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setDeleting(true)
    setError(null)
    let result: ActionResult
    try {
      result = await onDelete(String(form.get("confirmUsername") ?? ""))
    } catch {
      result = { ok: false, code: "unknown" }
    }
    if (!result.ok) {
      setDeleting(false)
      setError(result.code)
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setError(null)
      setDeleting(false)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="shelf-sheet max-lg:top-auto max-lg:bottom-0 max-lg:max-w-full max-lg:translate-y-0 max-lg:rounded-b-none max-lg:pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle>Hapus akun</DialogTitle>
          <DialogDescription>
            Semua data milikmu akan dihapus permanen dan tidak bisa
            dikembalikan.
          </DialogDescription>
        </DialogHeader>
        <form method="post" onSubmit={onSubmit} className="space-y-3 text-sm">
          <div className="space-y-1">
            <Label htmlFor="confirmUsername">
              Ketik nama penggunamu untuk konfirmasi ({username})
            </Label>
            <Input
              id="confirmUsername"
              name="confirmUsername"
              autoComplete="off"
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {authMessage(error).field}
            </p>
          )}
          <Button
            type="submit"
            variant="destructive"
            size="lg"
            disabled={deleting}
          >
            {deleting ? "Menghapus…" : "Hapus akun saya permanen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
