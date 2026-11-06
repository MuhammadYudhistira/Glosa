import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { renderWithRouter } from "@/test/router"
import { ReaderToolbar } from "./ReaderToolbar"

const props = {
  title: "Buku Uji",
  hidden: false,
  syncStatus: "synced" as const,
  onToc: () => undefined,
  onSettings: () => undefined,
}

// ReaderToolbar has a <Link>, so it renders inside a small router.
describe("ReaderToolbar", () => {
  it("bookmarks the page", async () => {
    const onBookmark = vi.fn()
    renderWithRouter(
      <ReaderToolbar {...props} bookmarked={false} onBookmark={onBookmark} />
    )
    const button = await screen.findByRole("button", {
      name: "Bookmark halaman ini",
    })
    expect(button).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(button)
    expect(onBookmark).toHaveBeenCalled()
  })

  it("shows that the page has a bookmark", async () => {
    renderWithRouter(
      <ReaderToolbar {...props} bookmarked onBookmark={() => undefined} />
    )
    expect(
      await screen.findByRole("button", { name: "Hapus bookmark" })
    ).toHaveAttribute("aria-pressed", "true")
    expect(
      screen.getByRole("button", { name: "Daftar isi dan anotasi" })
    ).toBeInTheDocument()
  })

  it("shows the habit ring it is given", async () => {
    renderWithRouter(
      <ReaderToolbar
        {...props}
        bookmarked={false}
        onBookmark={() => undefined}
        habit={<span>cincin</span>}
      />
    )
    expect(await screen.findByText("cincin")).toBeInTheDocument()
  })
})
