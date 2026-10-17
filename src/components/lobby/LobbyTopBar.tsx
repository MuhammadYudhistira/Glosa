import { Link } from "@tanstack/react-router"
import { useId, useState } from "react"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/ui/logo"
import type { ShelfBook } from "@/lib/book-types"
import type { SessionUser } from "@/lib/session-types"
import { MAX_QUERY_LENGTH, shelfBooks } from "@/lib/shelf"
import { cn } from "@/lib/utils"

const MAX_RESULTS = 6

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?"

/** Logo, book count, search in the member's own shelf, account menu (spec 1D §5.2). */
export function LobbyTopBar({
  user,
  books,
  onSelect,
  className,
}: {
  user: SessionUser
  books: ReadonlyArray<ShelfBook>
  onSelect: (book: ShelfBook) => void
  className?: string
}) {
  const searchId = useId()
  const [query, setQuery] = useState("")
  const q = query.trim().slice(0, MAX_QUERY_LENGTH)
  const results = q ? shelfBooks(books, { q }).slice(0, MAX_RESULTS) : []

  return (
    <header className={cn("lobby-topbar lobby-overlay", className)}>
      <Logo className="size-8" />
      <span className="font-heading text-lg font-bold">Glosa</span>
      <span className="text-sm text-muted-foreground">{books.length} buku</span>
      <div className="relative ml-auto w-72">
        <label htmlFor={searchId} className="sr-only">
          Cari di rakmu
        </label>
        <Input
          id={searchId}
          type="search"
          placeholder="Cari di rakmu"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {q && (
          <ul aria-label="Hasil pencarian" className="lobby-search-results">
            {results.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Tidak ada buku yang cocok.
              </li>
            ) : (
              results.map((book) => (
                <li key={book.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(book)
                      setQuery("")
                    }}
                  >
                    <span className="block truncate text-sm font-bold">
                      {book.title}
                    </span>
                    {book.author && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {book.author}
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <details className="lobby-account">
        <summary aria-label="Menu akun" className="lobby-avatar">
          {initials(user.displayName)}
        </summary>
        <div className="lobby-account-menu">
          <p className="px-3 py-1 text-sm">
            <b className="block">{user.displayName}</b>
            <span className="text-muted-foreground">@{user.username}</span>
          </p>
          <Link to="/settings">Pengaturan</Link>
          <Link to="/logout">Keluar</Link>
        </div>
      </details>
    </header>
  )
}
