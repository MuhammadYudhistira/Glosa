import "fake-indexeddb/auto"
import { act, fireEvent, screen } from "@testing-library/react"
import { useRouterState } from "@tanstack/react-router"
import { afterEach, describe, expect, it, vi } from "vitest"
import { coverHue } from "@/components/shelf/BookCover"
import { sherlock } from "@/components/shelf/fixtures"
import type { StorageUsage } from "@/lib/book-types"
import type { SessionUser } from "@/lib/session-types"
import { stubWideScreen, unstubWideScreen } from "@/test/media"
import { renderWithRouter } from "@/test/router"
import { isPopupPath } from "./LobbyPopup"
import { LobbyStage } from "./LobbyStage"

// The real scene starts three.js; here it only shows what it was given.
const scene = vi.hoisted(() => ({
  props: null as {
    paused?: boolean
    allow3d?: boolean
    onActivate?: (id: string) => void
    notes?: Array<string>
    shelves?: Record<string, ReadonlyArray<number>>
  } | null,
}))
vi.mock("./LobbyScene", () => ({
  LobbyScene: (props: {
    paused?: boolean
    allow3d?: boolean
    onActivate?: (id: string) => void
  }) => {
    scene.props = props
    return <section aria-label="Adegan lobi" className="lobby-scene" />
  },
}))

const highlights = vi.hoisted(() => {
  const state: {
    status: string
    highlights?: Array<Record<string, unknown>>
  } = { status: "ready", highlights: [] }
  return { state }
})
vi.mock("@/lib/annotations/highlights-client", () => ({
  useHighlights: () => ({ state: highlights.state, retry: vi.fn() }),
}))

const bubbles = vi.hoisted(() => ({ remember: vi.fn() }))
vi.mock("@/lib/habit/habit-client", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useReadingHabit: () => ({
    status: "ready",
    today: "2026-11-03",
    days: [],
    goals: { dailyGoalMinutes: null },
    summary: { todayDone: false, todaySeconds: 0, todayGoalSeconds: null },
  }),
}))
vi.mock("@/lib/recap/bubble", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  recapBubbleFor: () => ({
    key: "2026-10",
    label: "Kilas balik Oktober sudah siap",
  }),
  rememberBubble: bubbles.remember,
}))

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
const usage: StorageUsage = {
  usedBytes: 0,
  limitBytes: 104857600,
  plan: "free",
}

function renderStage(popup: boolean, url = popup ? "/shelf" : "/lobby") {
  return renderWithRouter(
    <LobbyStage
      collections={[]}
      user={member}
      books={[sherlock]}
      usage={usage}
      offline={false}
      popup={popup}
    />,
    url
  )
}

/** Like the _lobi layout: the popup follows the route. */
function RoutedStage() {
  const popup = useRouterState({
    select: (state) => isPopupPath(state.location.pathname),
  })
  return (
    <LobbyStage
      collections={[]}
      user={member}
      books={[sherlock]}
      usage={usage}
      offline={false}
      popup={popup}
    />
  )
}

async function pickFromSearch() {
  fireEvent.change(await screen.findByLabelText("Cari di rakmu"), {
    target: { value: "sherlock" },
  })
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(sherlock.title) })
    )
  })
}

describe("LobbyStage", () => {
  afterEach(() => {
    unstubWideScreen()
    scene.props = null
    highlights.state = { status: "ready", highlights: [] }
    bubbles.remember.mockClear()
  })

  it("is the lobby page, with its panels and a live scene", async () => {
    stubWideScreen(true)
    renderStage(false)
    expect(await screen.findByRole("main")).toHaveClass("lobby-page")
    expect(screen.getByRole("heading", { name: "Lobi" })).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Peta Perpustakaan" })
    ).toBeInTheDocument()
    expect(scene.props).toMatchObject({ paused: false, allow3d: true })
  })

  it("opens Kilas balik from the fireplace and Pengaturan from the door", async () => {
    stubWideScreen(true)
    const { router } = renderStage(false)
    await vi.waitFor(() => expect(scene.props).not.toBeNull())
    const activate = scene.props!.onActivate!
    await act(async () => activate("perapian"))
    expect(router.state.location.pathname).toBe("/recap")
    await act(async () => activate("pintu"))
    expect(router.state.location.pathname).toBe("/settings")
  })

  it("behind a popup keeps only a paused, hidden scene and the top bar", async () => {
    stubWideScreen(true)
    const { container } = renderStage(true)
    await screen.findByLabelText("Cari di rakmu")
    expect(screen.queryByRole("main")).toBeNull()
    expect(screen.queryByRole("heading", { name: "Lobi" })).toBeNull()
    expect(
      screen.queryByRole("heading", { name: "Peta Perpustakaan" })
    ).toBeNull()
    expect(scene.props).toMatchObject({ paused: true, allow3d: true })
    const wrapper = container.querySelector(".lobby-scene")?.parentElement
    expect(wrapper).toHaveAttribute("inert")
    expect(wrapper).toHaveAttribute("aria-hidden", "true")
    expect(container.querySelector(".lobby-page")).toHaveAttribute("data-popup")
  })

  it("keeps WebGL off behind a page on phones", async () => {
    stubWideScreen(false)
    renderStage(true)
    await screen.findByLabelText("Cari di rakmu")
    expect(scene.props).toMatchObject({ paused: true, allow3d: false })
  })

  it("opens the highlights dialog from the corkboard", async () => {
    stubWideScreen(true)
    renderStage(false)
    await screen.findByRole("main")
    await act(async () => scene.props?.onActivate?.("papan"))
    expect(
      await screen.findByRole("dialog", { name: "Sorotan" })
    ).toBeInTheDocument()
  })

  it("pins the colours of the newest highlights of books still on the shelf", async () => {
    const mark = (bookId: string, color: string) => ({
      id: `${bookId}-${color}`,
      bookId,
      cfi: "epubcfi(/6/4)",
      color,
      note: "",
      excerpt: "x",
      createdAt: "2026-10-24T08:00:00.000Z",
    })
    highlights.state = {
      status: "ready",
      highlights: [
        mark("gone", "blue"),
        mark(sherlock.id, "pink"),
        mark(sherlock.id, "green"),
      ],
    }
    stubWideScreen(true)
    renderStage(false)
    await screen.findByRole("main")
    expect(scene.props?.notes).toEqual(["pink", "green"])
  })

  it("stands each genre's books on its shelf, the newest added first", async () => {
    const newer = {
      ...sherlock,
      id: "22222222-2222-4222-8222-222222222222",
      title: "The Hound of the Baskervilles",
      createdAt: "2026-10-20T03:00:00+00:00",
    }
    const unsorted = {
      ...sherlock,
      id: "33333333-3333-4333-8333-333333333333",
      genre: null,
    }
    stubWideScreen(true)
    renderWithRouter(
      <LobbyStage
        collections={[]}
        user={member}
        books={[sherlock, unsorted, newer]}
        usage={usage}
        offline={false}
        popup={false}
      />,
      "/lobby"
    )
    await screen.findByRole("main")
    expect(scene.props?.shelves?.misteri_thriller).toEqual([
      coverHue(newer.title),
      coverHue(sherlock.title),
    ])
    expect(scene.props?.shelves?.fiksi_sastra).toEqual([])
  })

  it("closes the popup when a search result is picked, and shows the book", async () => {
    stubWideScreen(true)
    const { router } = renderStage(true)
    fireEvent.change(await screen.findByLabelText("Cari di rakmu"), {
      target: { value: "sherlock" },
    })
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: new RegExp(sherlock.title) })
      )
    })
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe("/lobby")
    )
  })

  it("forgets the open book once a popup opens, so it does not come back after", async () => {
    stubWideScreen(true)
    const { router } = renderWithRouter(<RoutedStage />, "/lobby")
    await pickFromSearch()
    expect(
      screen.getByRole("region", { name: sherlock.title })
    ).toBeInTheDocument()

    await act(() => router.navigate({ to: "/shelf" }))
    await act(() => router.navigate({ to: "/lobby" }))
    expect(await screen.findByRole("main")).toHaveClass("lobby-page")
    expect(screen.queryByRole("region", { name: sherlock.title })).toBeNull()
  })

  it("still shows a book picked from the search over a popup", async () => {
    stubWideScreen(true)
    const { router } = renderWithRouter(<RoutedStage />, "/shelf")
    await pickFromSearch()
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe("/lobby")
    )
    expect(
      await screen.findByRole("region", { name: sherlock.title })
    ).toBeInTheDocument()
  })

  it("remembers the Kilas balik bubble only once it is on screen", async () => {
    stubWideScreen(true)
    const { router } = renderWithRouter(<RoutedStage />, "/shelf")
    await screen.findByLabelText("Cari di rakmu")
    expect(bubbles.remember).not.toHaveBeenCalled()
    await act(() => router.navigate({ to: "/lobby" }))
    await vi.waitFor(() =>
      expect(bubbles.remember).toHaveBeenCalledWith("2026-10")
    )
  })
})
