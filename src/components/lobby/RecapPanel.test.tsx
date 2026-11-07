import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { ShelfBook } from "@/lib/book-types"
import { currentPeriod, parsePeriod } from "@/lib/recap/period"
import { RecapPanel } from "./RecapPanel"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search: _search,
    ...props
  }: {
    children: ReactNode
    to: string
    search?: unknown
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))
const shareBuilds = vi.hoisted(() => [] as Array<unknown>)
vi.mock("@/components/share/ShareImage", () => ({
  ShareImage: ({ build }: { build: unknown }) => {
    shareBuilds.push(build)
    return <div>ShareImage</div>
  },
}))

const book = (over: Partial<ShelfBook>): ShelfBook => ({ ...sherlock, ...over })
const TODAY = "2026-11-07"
const october = parsePeriod("2026-10", TODAY)
const recap = {
  days: [
    { day: "2026-10-05", seconds: 3600, goalMinutes: null },
    { day: "2026-10-06", seconds: 1800, goalMinutes: null },
  ],
  books: [
    { id: "a", finishedAt: "2026-10-20T00:00:00Z" },
    { id: "gone", finishedAt: "2026-10-10T00:00:00Z" },
  ],
  lookedUp: 12,
  saved: 3,
  topMeeting: { headword: "ominous", meetings: 5 },
  firstDay: "2026-09-02",
}
const shelf = [book({ id: "a", title: "Buku A", coverUrl: "https://x/a.jpg" })]
const base = {
  period: october,
  today: TODAY,
  firstDay: "2026-09-02",
  state: { status: "ready" as const, recap },
  offline: false,
  books: shelf,
  onPick: vi.fn(),
  onRetry: vi.fn(),
}

describe("RecapPanel", () => {
  it("shows the numbers of the period", () => {
    render(<RecapPanel {...base} />)
    expect(
      screen.getByRole("heading", { name: "Kilas balik" })
    ).toBeInTheDocument()
    // The select lists it too, hence the selector.
    expect(
      screen.getByText("Oktober 2026", { selector: "p" })
    ).toBeInTheDocument()
    expect(screen.getByText("1 jam 30 menit")).toBeInTheDocument()
    // Reading days; the streak is also 2 hari.
    expect(screen.getAllByText("2 hari")).toHaveLength(2)
    expect(screen.getByText("12")).toBeInTheDocument()
    expect(screen.getByText(/ominous/)).toHaveTextContent("5×")
    expect(screen.queryByText("sejauh ini")).toBeNull()
  })

  it("shows the covers of finished books that are on the shelf, each opening its details", () => {
    render(<RecapPanel {...base} />)
    expect(screen.getByRole("link", { name: "Buku A" })).toBeInTheDocument()
    expect(screen.getByText("2 buku selesai")).toBeInTheDocument()
  })

  it("says sejauh ini for a period that is not over", () => {
    render(<RecapPanel {...base} period={currentPeriod(TODAY)} />)
    expect(screen.getByText("sejauh ini")).toBeInTheDocument()
  })

  it("writes Belum ada bacaan and offers no Bagikan for an empty period", () => {
    const empty = {
      ...recap,
      days: [],
      books: [],
      lookedUp: 0,
      saved: 0,
      topMeeting: null,
      firstDay: null,
    }
    render(<RecapPanel {...base} state={{ status: "ready", recap: empty }} />)
    expect(
      screen.getByText("Belum ada bacaan di Oktober 2026.")
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Bagikan" })).toBeNull()
  })

  it("says Perlu koneksi internet offline, without asking the server", () => {
    render(<RecapPanel {...base} offline state={{ status: "loading" }} />)
    expect(screen.getByText("Perlu koneksi internet")).toBeInTheDocument()
  })

  it("shows a skeleton while loading and Coba lagi when it cannot load", () => {
    const { rerender } = render(
      <RecapPanel {...base} state={{ status: "loading" }} />
    )
    expect(screen.getByText("Memuat kilas balik…")).toBeInTheDocument()
    const onRetry = vi.fn()
    rerender(
      <RecapPanel
        {...base}
        state={{ status: "unavailable" }}
        onRetry={onRetry}
      />
    )
    expect(
      screen.getByText("Kilas balik belum bisa dimuat.")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }))
    expect(onRetry).toHaveBeenCalled()
  })

  it("picks a period from the list and a kind from Bulan | Tahun", () => {
    const onPick = vi.fn()
    render(<RecapPanel {...base} onPick={onPick} />)
    fireEvent.change(screen.getByLabelText("Periode"), {
      target: { value: "2026-09" },
    })
    expect(onPick).toHaveBeenCalledWith("2026-09")
    fireEvent.click(screen.getByRole("button", { name: "Tahun" }))
    expect(onPick).toHaveBeenCalledWith("2026")
  })

  it("opens the share image from Bagikan", () => {
    render(<RecapPanel {...base} />)
    fireEvent.click(screen.getByRole("button", { name: "Bagikan" }))
    expect(
      screen.getByRole("dialog", { name: "Bagikan kilas balik" })
    ).toBeInTheDocument()
  })

  it("hands the share image the same build when the parent re-renders with an equal period", () => {
    shareBuilds.length = 0
    const { rerender } = render(<RecapPanel {...base} />)
    fireEvent.click(screen.getByRole("button", { name: "Bagikan" }))
    rerender(<RecapPanel {...base} period={parsePeriod("2026-10", TODAY)} />)
    rerender(<RecapPanel {...base} period={parsePeriod("2026-10", TODAY)} />)
    expect(shareBuilds.length).toBeGreaterThan(1)
    expect(new Set(shareBuilds).size).toBe(1)
  })
})
