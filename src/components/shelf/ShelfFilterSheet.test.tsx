import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { countBooks } from "@/lib/shelf"
import { sherlock } from "./fixtures"
import { ShelfFilterSheet } from "./ShelfFilterSheet"

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))

describe("ShelfFilterSheet", () => {
  it("holds the genre, the order and the storage", async () => {
    render(
      <ShelfFilterSheet
        open
        onOpenChange={vi.fn()}
        genre="semua"
        counts={countBooks([sherlock])}
        sort="opened"
        defaultSort="opened"
        usage={{ usedBytes: 0, limitBytes: 104857600, plan: "free" }}
      />
    )
    const sheet = await screen.findByRole("dialog", { name: "Saring rak" })
    expect(sheet).toContainElement(screen.getByLabelText("Tampilkan genre"))
    expect(sheet).toContainElement(screen.getByLabelText("Urutkan"))
    expect(sheet).toHaveTextContent("Penyimpanan")
  })
})
