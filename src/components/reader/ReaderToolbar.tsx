import { Link } from "@tanstack/react-router"
import { ArrowLeft, List, Type } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import type { SyncStatus } from "@/lib/progress-sync"
import { cn } from "@/lib/utils"

export function ReaderToolbar({
  title,
  hidden,
  syncStatus,
  onToc,
  onSettings,
}: {
  title: string
  hidden: boolean
  syncStatus: SyncStatus
  onToc: () => void
  onSettings: () => void
}) {
  return (
    <header
      className={cn("reader-bar reader-bar-top", hidden && "reader-bar-hidden")}
      inert={hidden}
    >
      <Link
        to="/shelf"
        aria-label="Kembali ke rak"
        className={buttonVariants({
          variant: "ghost",
          size: "icon-lg",
          className: "size-10",
        })}
      >
        <ArrowLeft aria-hidden="true" />
      </Link>
      <h1 className="min-w-0 flex-1 truncate font-heading text-sm">{title}</h1>
      {syncStatus === "failing" && (
        <output className="shrink-0 text-xs text-amber-300">
          Belum tersinkron
        </output>
      )}
      <Button
        variant="ghost"
        size="icon-lg"
        className="size-10"
        aria-label="Daftar isi"
        onClick={onToc}
      >
        <List aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-lg"
        className="size-10"
        aria-label="Tampilan"
        onClick={onSettings}
      >
        <Type aria-hidden="true" />
      </Button>
    </header>
  )
}
