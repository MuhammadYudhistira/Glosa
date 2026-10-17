import { Link } from "@tanstack/react-router"
import { LibrarianBubble } from "@/components/auth/LibrarianBubble"
import { cn } from "@/lib/utils"

/** Shown at the reading table when no book has been opened yet (spec 1D §5.1). */
export function ReadingHint() {
  return (
    <output className="lobby-bubble">
      Belum ada buku yang dibaca.{" "}
      <Link to="/shelf" className="font-bold underline">
        Rak Saya
      </Link>
    </output>
  )
}

/** The librarian's greeting for a member without books (spec 1D §5.2). */
export function LibrarianWelcome({ className }: { className?: string }) {
  return (
    <div className={cn("lobby-bubble-stack", className)}>
      <LibrarianBubble>
        Rakmu masih kosong. Bawa buku pertamamu ke sini!
      </LibrarianBubble>
      <p className="lobby-note">
        Belum punya EPUB? Ambil yang legal dan gratis di{" "}
        <a href="https://standardebooks.org" target="_blank" rel="noreferrer">
          Standard Ebooks
        </a>{" "}
        atau{" "}
        <a href="https://www.gutenberg.org" target="_blank" rel="noreferrer">
          Project Gutenberg
        </a>
        .
      </p>
    </div>
  )
}
