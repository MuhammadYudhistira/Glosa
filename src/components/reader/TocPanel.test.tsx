import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TocPanel } from "./TocPanel"

const toc = [
  {
    label: "A Scandal in Bohemia",
    href: "text/a-scandal.xhtml",
    subitems: [{ label: "I", href: "text/a-scandal.xhtml#i" }],
  },
  { label: "The Redheaded League", href: "text/the-redheaded-league.xhtml" },
]

describe("TocPanel", () => {
  it("lists the chapters, marks the current one and goes where it is told", async () => {
    const onSelect = vi.fn()
    render(
      <TocPanel
        open
        onOpenChange={() => undefined}
        toc={toc}
        currentHref="text/the-redheaded-league.xhtml"
        onSelect={onSelect}
      />
    )
    await screen.findByRole("dialog", { name: "Daftar isi" })
    expect(screen.getByRole("button", { name: "I" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "The Redheaded League" })
    ).toHaveAttribute("aria-current", "true")

    fireEvent.click(
      screen.getByRole("button", { name: "A Scandal in Bohemia" })
    )
    expect(onSelect).toHaveBeenCalledWith("text/a-scandal.xhtml")
  })

  it("says so when the book has no table of contents", async () => {
    render(
      <TocPanel
        open
        onOpenChange={() => undefined}
        toc={[]}
        currentHref={null}
        onSelect={() => undefined}
      />
    )
    expect(
      await screen.findByText("Buku ini tidak punya daftar isi.")
    ).toBeInTheDocument()
  })
})
