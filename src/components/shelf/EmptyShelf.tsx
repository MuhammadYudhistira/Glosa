import type { ReactNode } from "react"
import { LibrarianBubble } from "@/components/auth/LibrarianBubble"
import { Panel } from "@/components/ui/panel"

export function EmptyShelf({ action }: { action?: ReactNode }) {
  return (
    <Panel className="flex flex-col gap-4 p-6">
      <LibrarianBubble>
        Rakmu masih kosong. Bawa buku pertamamu ke sini!
      </LibrarianBubble>
      {action}
      <p className="text-sm text-muted-foreground">
        Belum punya EPUB? Ambil yang legal dan gratis di{" "}
        <a
          href="https://standardebooks.org"
          target="_blank"
          rel="noreferrer"
          className="text-mint underline"
        >
          Standard Ebooks
        </a>{" "}
        atau{" "}
        <a
          href="https://www.gutenberg.org"
          target="_blank"
          rel="noreferrer"
          className="text-mint underline"
        >
          Project Gutenberg
        </a>
        .
      </p>
    </Panel>
  )
}
