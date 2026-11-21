import { useNavigate } from "@tanstack/react-router"
import { useEffect, useId, useRef, useState } from "react"
import { Input } from "@/components/ui/input"

/** The search field, shown when the search button opens it (spec poles mobile §3.1). */
export function ShelfSearch({
  q,
  autoFocus,
}: {
  q: string
  autoFocus?: boolean
}) {
  const navigate = useNavigate({ from: "/shelf" })
  const [text, setText] = useState(q)
  const searchId = useId()

  const pushed = useRef(q)

  // A ?q= change we did not push (browser Back/Forward) replaces the input text.
  useEffect(() => {
    if (q === pushed.current) return
    pushed.current = q
    setText(q)
  }, [q])

  // Debounce typing into the URL (?q=) so results follow without a jump per keystroke.
  useEffect(() => {
    const query = text.trim()
    if (query === q) return
    const timer = setTimeout(() => {
      pushed.current = query
      void navigate({
        search: (prev) => ({ ...prev, q: query || undefined }),
        replace: true,
      })
    }, 250)
    return () => clearTimeout(timer)
  }, [text, q, navigate])

  return (
    <div>
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
        autoFocus={autoFocus}
        maxLength={100}
      />
    </div>
  )
}
