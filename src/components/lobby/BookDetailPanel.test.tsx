import { act, fireEvent, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { ShelfBook } from "@/lib/book-types"
import type { SessionUser } from "@/lib/session-types"
import { renderWithRouter } from "@/test/router"
import { BookDetailPanel } from "./BookDetailPanel"
import { LobbyTopBar } from "./LobbyTopBar"

const local = {
  saved: new Set<string>(),
  percentages: new Map<string, number>(),
}
const member: SessionUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "ani@glosa.test",
  provider: "email",
  username: "anibaca",
  displayName: "Ani Baca",
  memberNo: 7,
  plan: "free",
  storageLimitBytes: 104857600,
  memberSince: "2026-10-15T00:00:00+00:00",
  onboarded: true,
}
const other: ShelfBook = {
  ...sherlock,
  id: "b2",
  title: "Pride and Prejudice",
  author: "Jane Austen",
}

/** The search and the panel, wired as the lobby wires them. */
function Lobby() {
  const [selected, setSelected] = useState<ShelfBook | null>(null)
  return (
    <>
      <LobbyTopBar
        user={member}
        books={[sherlock, other]}
        onSelect={setSelected}
      />
      {selected && (
        <BookDetailPanel
          book={selected}
          local={local}
          onClose={() => setSelected(null)}
          onChanged={vi.fn()}
          onDeleted={vi.fn()}
        />
      )}
    </>
  )
}

const pick = (query: string, title: RegExp) => {
  fireEvent.change(screen.getByLabelText("Cari di rakmu"), {
    target: { value: query },
  })
  const result = screen.getByRole("button", { name: title })
  act(() => result.focus())
  fireEvent.click(result)
}

describe("BookDetailPanel", () => {
  it("takes the focus when a search result is picked", async () => {
    renderWithRouter(<Lobby />)
    await screen.findByLabelText("Cari di rakmu")
    pick("sherlock", /Sherlock Holmes/)
    const title = screen.getByRole("heading", { name: sherlock.title })
    expect(title).toHaveFocus()
    expect(title).toHaveAttribute("tabindex", "-1")
  })

  it("moves the focus to the next book picked while it is open", async () => {
    renderWithRouter(<Lobby />)
    await screen.findByLabelText("Cari di rakmu")
    pick("sherlock", /Sherlock Holmes/)
    pick("pride", /Pride and Prejudice/)
    expect(
      screen.getByRole("heading", { name: "Pride and Prejudice" })
    ).toHaveFocus()
  })
})
