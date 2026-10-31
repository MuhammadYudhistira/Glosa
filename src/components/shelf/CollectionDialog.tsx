import { useServerFn } from "@tanstack/react-start"
import { type FormEvent, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { bookMessage } from "@/lib/book-messages"
import { type Collection, MAX_COLLECTION_NAME } from "@/lib/book-types"
import {
  createCollectionFn,
  deleteCollectionFn,
  renameCollectionFn,
} from "@/server/collections"

export type CollectionDone = {
  notice: string
  /** A collection to open; null goes back to Semua; undefined stays. */
  koleksi?: string | null
}

/** Makes a collection, or renames or deletes one (spec Tahap 3 §4.1). */
export function CollectionDialog({
  open,
  editing,
  onOpenChange,
  onDone,
}: {
  open: boolean
  /** null makes a new collection. */
  editing: Collection | null
  onOpenChange: (open: boolean) => void
  onDone: (done: CollectionDone) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent className="sm:max-w-md">
          <CollectionForm
            key={editing?.id ?? "new"}
            editing={editing}
            onDone={onDone}
          />
        </DialogContent>
      )}
    </Dialog>
  )
}

function CollectionForm({
  editing,
  onDone,
}: {
  editing: Collection | null
  onDone: (done: CollectionDone) => void
}) {
  const nameId = useId()
  const create = useServerFn(createCollectionFn)
  const rename = useServerFn(renameCollectionFn)
  const remove = useServerFn(deleteCollectionFn)
  const [name, setName] = useState(editing?.name ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function run(action: () => Promise<void>) {
    // Ignored while busy: the buttons stay focusable meanwhile.
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch {
      setError("unknown")
    }
    setBusy(false)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 1 || trimmed.length > MAX_COLLECTION_NAME) {
      setError("collection_invalid")
      return
    }
    void run(async () => {
      if (!editing) {
        const result = await create({ data: { name: trimmed } })
        if (!result.ok) return setError(result.code)
        onDone({
          notice: `Koleksi “${trimmed}” dibuat.`,
          koleksi: result.id,
        })
        return
      }
      const result = await rename({ data: { id: editing.id, name: trimmed } })
      if (!result.ok) return setError(result.code)
      onDone({ notice: "Nama koleksi diganti." })
    })
  }

  function onDelete() {
    if (!editing) return
    void run(async () => {
      const result = await remove({ data: { id: editing.id } })
      // Already gone (deleted elsewhere): the aim is met.
      if (!result.ok && result.code !== "collection_missing")
        return setError(result.code)
      onDone({ notice: `Koleksi “${editing.name}” dihapus.`, koleksi: null })
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-xl">
          {editing ? "Ubah koleksi" : "Koleksi baru"}
        </DialogTitle>
      </DialogHeader>
      <form className="space-y-3" onSubmit={onSubmit} noValidate>
        <div className="space-y-1">
          <label htmlFor={nameId} className="block text-sm font-bold">
            Nama koleksi
          </label>
          <Input
            id={nameId}
            value={name}
            maxLength={MAX_COLLECTION_NAME}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-stamp">
            {bookMessage(error)}
          </p>
        )}
        <Button
          type="submit"
          aria-disabled={busy}
          aria-busy={busy}
          className="aria-busy:opacity-50"
        >
          {editing ? "Simpan" : "Buat"}
        </Button>
      </form>
      {editing && (
        <div className="space-y-2 border-t pt-4">
          {!confirming ? (
            <Button variant="destructive" onClick={() => setConfirming(true)}>
              Hapus koleksi
            </Button>
          ) : (
            <>
              <p className="text-sm">
                Hapus koleksi “{editing.name}”? Bukunya tetap di rak.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  aria-disabled={busy}
                  aria-busy={busy}
                  className="aria-busy:opacity-50"
                  onClick={onDelete}
                >
                  Ya, hapus
                </Button>
                <Button
                  variant="ghost"
                  aria-disabled={busy}
                  onClick={() => {
                    if (!busy) setConfirming(false)
                  }}
                >
                  Batal
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
