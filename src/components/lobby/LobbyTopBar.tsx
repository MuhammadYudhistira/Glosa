import { Link } from "@tanstack/react-router"
import { LibraryIcon } from "lucide-react"
import { type RefObject, useEffect, useId, useRef, useState } from "react"
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

/**
 * Logo, book count, search in the member's own shelf, account menu (spec 1D
 * §5.2), as a band across the top like mockups/lobi.html.
 */
export function LobbyTopBar({
  user,
  books,
  onSelect,
  searchRef,
  className,
}: {
  user: SessionUser
  books: ReadonlyArray<ShelfBook>
  onSelect: (book: ShelfBook) => void
  /** The search input, where the lobby returns focus. */
  searchRef?: RefObject<HTMLInputElement | null>
  className?: string
}) {
  const searchId = useId()
  const ownRef = useRef<HTMLInputElement>(null)
  const inputRef = searchRef ?? ownRef
  const [query, setQuery] = useState("")
  const q = query.trim().slice(0, MAX_QUERY_LENGTH)
  const results = q ? shelfBooks(books, { q }).slice(0, MAX_RESULTS) : []
  const accountRef = useRef<HTMLDetailsElement>(null)
  /** The lobby stays mounted under its popups, so the menu must close itself (spec 1F §6). */
  const closeAccount = (refocus: boolean) => {
    const details = accountRef.current
    if (!details?.open) return
    details.open = false
    if (refocus) details.querySelector("summary")?.focus()
  }

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const details = accountRef.current
      if (
        details?.open &&
        event.target instanceof Node &&
        !details.contains(event.target)
      ) {
        details.open = false
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  return (
    <header className={cn("lobby-topbar lobby-overlay", className)}>
      <div className="lobby-brand">
        <Logo className="size-9" />
        <div>
          <span className="block font-heading text-xl leading-tight font-bold">
            Glosa
          </span>
          <span className="block text-xs text-muted-foreground">
            Baca aslinya, pahami katanya
          </span>
        </div>
      </div>
      <dl className="lobby-stat">
        <LibraryIcon aria-hidden="true" className="size-5" />
        <div>
          <dt>Buku saya</dt>
          <dd>{books.length}</dd>
        </div>
      </dl>
      <div
        className="relative ml-auto w-72 xl:w-96"
        onKeyDown={(event) => {
          // Escape closes the results, from the input or from a result.
          if (event.key !== "Escape" || !query) return
          event.preventDefault()
          setQuery("")
          inputRef.current?.focus()
        }}
      >
        <label htmlFor={searchId} className="sr-only">
          Cari di rakmu
        </label>
        <Input
          ref={inputRef}
          id={searchId}
          type="search"
          placeholder="Cari di rakmu"
          autoComplete="off"
          data-lobby-search=""
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
      <details
        ref={accountRef}
        className="lobby-account"
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !accountRef.current?.open) return
          event.preventDefault()
          closeAccount(true)
        }}
      >
        <summary aria-label="Menu akun" className="lobby-me">
          <span className="lobby-avatar">{initials(user.displayName)}</span>
          <span className="hidden min-w-0 xl:block">
            <b className="block truncate text-sm">{user.displayName}</b>
            <span className="block truncate text-xs text-muted-foreground">
              @{user.username}
            </span>
          </span>
        </summary>
        <div className="lobby-account-menu">
          <p className="px-3 py-1 text-sm">
            <b className="block">{user.displayName}</b>
            <span className="text-muted-foreground">@{user.username}</span>
          </p>
          <Link to="/settings" onClick={() => closeAccount(false)}>
            Pengaturan
          </Link>
          <Link to="/logout" onClick={() => closeAccount(false)}>
            Keluar
          </Link>
        </div>
      </details>
    </header>
  )
}
