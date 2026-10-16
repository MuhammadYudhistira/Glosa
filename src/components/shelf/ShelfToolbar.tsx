import { useNavigate } from "@tanstack/react-router"
import { useEffect, useId, useState } from "react"
import { Input } from "@/components/ui/input"
import { SHELF_SORTS, type ShelfSort } from "@/lib/shelf"

export function ShelfToolbar({ q, sort }: { q: string; sort: ShelfSort }) {
  const navigate = useNavigate({ from: "/shelf" })
  const [text, setText] = useState(q)
  const searchId = useId()
  const sortId = useId()

  // Debounce typing into the URL (?q=) so results follow without a jump per keystroke.
  useEffect(() => {
    const query = text.trim()
    if (query === q) return
    const timer = setTimeout(() => {
      void navigate({
        search: (prev) => ({ ...prev, q: query || undefined }),
        replace: true,
      })
    }, 250)
    return () => clearTimeout(timer)
  }, [text, q, navigate])

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1">
        <label
          htmlFor={searchId}
          className="mb-1 block text-xs text-muted-foreground"
        >
          Cari judul atau penulis
        </label>
        <Input
          id={searchId}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoComplete="off"
          maxLength={100}
        />
      </div>
      <div>
        <label
          htmlFor={sortId}
          className="mb-1 block text-xs text-muted-foreground"
        >
          Urutkan
        </label>
        <select
          id={sortId}
          value={sort}
          onChange={(event) => {
            const value = event.target.value
            void navigate({
              search: (prev) => ({
                ...prev,
                sort:
                  value === "title" || value === "added" ? value : undefined,
              }),
              replace: true,
            })
          }}
          className="native-select"
        >
          {SHELF_SORTS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
