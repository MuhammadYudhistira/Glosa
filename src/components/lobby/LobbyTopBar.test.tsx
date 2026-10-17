import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { SessionUser } from "@/lib/session-types"
import { renderWithRouter } from "@/test/router"
import { LobbyTopBar } from "./LobbyTopBar"

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
const other = {
  ...sherlock,
  id: "b2",
  title: "Pride and Prejudice",
  author: "Jane Austen",
}

describe("LobbyTopBar", () => {
  it("counts the books and finds one on the member's shelf", async () => {
    const onSelect = vi.fn()
    renderWithRouter(
      <LobbyTopBar
        user={member}
        books={[sherlock, other]}
        onSelect={onSelect}
      />
    )
    expect(await screen.findByText("2 buku")).toBeInTheDocument()
    const search = screen.getByLabelText("Cari di rakmu")
    fireEvent.change(search, { target: { value: "sherlock" } })
    fireEvent.click(screen.getByRole("button", { name: /Sherlock Holmes/ }))
    expect(onSelect).toHaveBeenCalledWith(sherlock)
    expect(search).toHaveValue("")
  })

  it("says when nothing matches", async () => {
    renderWithRouter(
      <LobbyTopBar user={member} books={[sherlock]} onSelect={vi.fn()} />
    )
    fireEvent.change(await screen.findByLabelText("Cari di rakmu"), {
      target: { value: "dracula" },
    })
    expect(screen.getByText("Tidak ada buku yang cocok.")).toBeInTheDocument()
  })

  it("keeps settings and sign-out in the account menu", async () => {
    renderWithRouter(
      <LobbyTopBar user={member} books={[]} onSelect={vi.fn()} />
    )
    expect(await screen.findByText("AB")).toBeInTheDocument()
    // The menu is a closed <details>: its links count as hidden until it opens.
    expect(
      screen.getByRole("link", { name: "Pengaturan", hidden: true })
    ).toHaveAttribute("href", "/settings")
    expect(
      screen.getByRole("link", { name: "Keluar", hidden: true })
    ).toHaveAttribute("href", "/logout")
  })
})
