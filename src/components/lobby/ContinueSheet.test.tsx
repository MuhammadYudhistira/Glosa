import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import { renderWithRouter } from "@/test/router"
import { ContinueSheet } from "./ContinueSheet"

const local = {
  saved: new Set<string>(),
  percentages: new Map<string, number>(),
}

function renderSheet(props: Partial<Parameters<typeof ContinueSheet>[0]>) {
  renderWithRouter(
    <ContinueSheet
      book={null}
      empty={false}
      local={local}
      onChanged={vi.fn()}
      onDeleted={vi.fn()}
      {...props}
    />
  )
}

describe("ContinueSheet", () => {
  it("offers the last book and its details", async () => {
    renderSheet({ book: sherlock })
    const sheet = await screen.findByRole("region", {
      name: "Lanjutkan membaca",
    })
    expect(sheet).toHaveTextContent(sherlock.title)
    expect(screen.getByRole("link", { name: "Mulai membaca" })).toHaveAttribute(
      "href",
      `/read/${sherlock.id}`
    )
    fireEvent.click(screen.getByRole("button", { name: "Detail" }))
    expect(sheet).toHaveTextContent("Twelve cases.")
    expect(
      screen.getByRole("button", { name: "Tutup detail" })
    ).toHaveAttribute("aria-expanded", "true")
  })

  it("points to Rak Saya before any book was read", async () => {
    renderSheet({ book: null })
    expect(
      await screen.findByText(/Belum ada buku yang dibaca/)
    ).toBeInTheDocument()
  })

  it("greets a member with an empty shelf", async () => {
    renderSheet({ empty: true })
    expect(
      await screen.findByText(
        "Rakmu masih kosong. Bawa buku pertamamu ke sini!"
      )
    ).toBeInTheDocument()
  })
})
