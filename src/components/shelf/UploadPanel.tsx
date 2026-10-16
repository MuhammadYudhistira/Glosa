import { type DragEvent, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { StorageUsage } from "@/lib/book-types"
import { GENRE_LABELS, GENRE_VALUES, type Genre, isGenre } from "@/lib/genre"
import { useOnline } from "@/lib/use-online"
import { cn } from "@/lib/utils"
import { StorageMeter } from "./StorageMeter"
import {
  type UploadItem,
  canRetry,
  queueSummary,
  readyItems,
  uploadStatusText,
} from "./upload-queue"
import { useUploadQueue } from "./useUploadQueue"

export function UploadPanel({
  open,
  onOpenChange,
  usage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  usage: StorageUsage
}) {
  const queue = useUploadQueue()
  const online = useOnline()
  const [dragging, setDragging] = useState(false)
  const ready = readyItems(queue.items)

  function close(next: boolean) {
    if (next || queue.running) return
    queue.clearDone()
    onOpenChange(false)
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    if (online) queue.addFiles(event.dataTransfer.files)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      {/* The footer's "Tutup" is the only close button: it stays disabled while
          an upload runs (Escape goes through the same guard in close()). */}
      <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Bawa buku ke rak
          </DialogTitle>
          <DialogDescription>
            EPUB maksimal 50 MB per file. Genrenya sudah kami tebak; ganti kalau
            kurang pas.
          </DialogDescription>
        </DialogHeader>

        <StorageMeter usage={usage} />

        <label
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-6 text-center text-sm",
            dragging && "border-mint bg-mint/10",
            !online && "cursor-not-allowed opacity-60"
          )}
        >
          <input
            type="file"
            accept=".epub,application/epub+zip"
            multiple
            disabled={!online}
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) queue.addFiles(event.target.files)
              event.target.value = ""
            }}
          />
          <span className="font-bold">Pilih file EPUB</span>
          <span className="text-muted-foreground">atau tarik ke sini</span>
        </label>
        {!online && <p className="text-sm text-stamp">Butuh internet.</p>}

        {queue.items.length > 0 && (
          <ul className="max-h-72 divide-y overflow-y-auto">
            {queue.items.map((item) => (
              <UploadRow
                key={item.id}
                item={item}
                disabled={queue.running}
                onGenre={queue.chooseGenre}
                onRetry={queue.retry}
              />
            ))}
          </ul>
        )}

        <output className="block min-h-5 text-sm">
          {queueSummary(queue.items)}
        </output>

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => close(false)}
            disabled={queue.running}
          >
            Tutup
          </Button>
          <Button
            onClick={() => void queue.uploadAll(ready)}
            disabled={ready.length === 0 || queue.running || !online}
          >
            Terima semua
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function UploadRow({
  item,
  disabled,
  onGenre,
  onRetry,
}: {
  item: UploadItem
  disabled: boolean
  onGenre: (id: string, genre: Genre | null) => void
  onRetry: (item: UploadItem) => void
}) {
  const selectId = useId()
  const editable = item.status === "ready" || canRetry(item)
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">
          {item.title ?? item.fileName}
        </p>
        {item.author && (
          <p className="truncate text-xs text-muted-foreground">
            {item.author}
          </p>
        )}
        <p
          className={cn(
            "text-xs",
            item.status === "failed" ? "text-stamp" : "text-muted-foreground"
          )}
        >
          {uploadStatusText(item)}
        </p>
        {item.status === "uploading" && (
          <progress
            max={1}
            value={item.progress}
            aria-label={`Mengunggah ${item.title ?? item.fileName}`}
            className="mt-1 block h-1.5 w-full"
          />
        )}
      </div>
      {editable && (
        <div className="flex flex-col gap-1">
          <label htmlFor={selectId} className="text-xs text-muted-foreground">
            Genre
          </label>
          <select
            id={selectId}
            value={item.genre ?? ""}
            disabled={disabled}
            onChange={(event) =>
              onGenre(
                item.id,
                isGenre(event.target.value) ? event.target.value : null
              )
            }
            className="native-select"
          >
            <option value="">Pilih genre</option>
            {GENRE_VALUES.map((value) => (
              <option key={value} value={value}>
                {GENRE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      )}
      {canRetry(item) && (
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onRetry(item)}
        >
          Coba lagi
        </Button>
      )}
    </li>
  )
}
