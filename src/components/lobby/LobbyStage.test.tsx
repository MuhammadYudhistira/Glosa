import "fake-indexeddb/auto"
import { act, fireEvent, screen, within } from "@testing-library/react"
import { useRouterState } from "@tanstack/react-router"
import type { Ref } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { coverHue } from "@/components/shelf/BookCover"
import { sherlock } from "@/components/shelf/fixtures"
import type { StorageUsage } from "@/lib/book-types"
import { ROOM_SEEN_KEY } from "@/lib/local/keys"
import type { SessionUser } from "@/lib/session-types"
import { stubWideScreen, unstubWideScreen } from "@/test/media"
import { renderWithRouter } from "@/test/router"
import { isPopupPath } from "./LobbyPopup"
import { LobbyStage } from "./LobbyStage"
import { type RoomSnapshot, readRoomSnapshot } from "./room-memory"

type Activate = (id: string, how: { keyboard: boolean }) => void

// The real scene starts three.js; here it only shows what it was given, and
// its handle's activity ends at once unless a test says otherwise.
const scene = vi.hoisted(() => ({
  props: null as {
    paused?: boolean
    allow3d?: boolean
    onActivate?: Activate
    onLiveChange?: (live: boolean) => void
    notes?: Array<string>
    shelves?: Record<string, ReadonlyArray<number>>
    bubbles?: Record<string, unknown>
  } | null,
}))
const handle = vi.hoisted(() => ({
  perform: vi.fn((_id: string, _how?: { instant?: boolean }) =>
    Promise.resolve()
  ),
  skip: vi.fn(),
  showSpot: vi.fn(),
  showDecor: vi.fn(),
  playMoments: vi.fn(),
}))
vi.mock("./LobbyScene", async () => {
  const { useImperativeHandle } = await import("react")
  return {
    LobbyScene: (props: {
      paused?: boolean
      allow3d?: boolean
      onActivate?: Activate
      ref?: Ref<typeof handle>
    }) => {
      scene.props = props
      useImperativeHandle(props.ref, () => handle)
      return <section aria-label="Adegan ruang baca" className="lobby-scene" />
    },
  }
})

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
// The reading habit and the words' meetings as the room's tests set them.
const habit = vi.hoisted(() => ({
  status: "ready",
  days: [] as Array<Record<string, unknown>>,
  stage: "tunas",
}))
vi.mock("@/lib/habit/habit-client", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useReadingHabit: () => ({
    status: habit.status,
    today: "2026-11-03",
    days: habit.days,
    goals: { dailyGoalMinutes: null },
    summary: {
      todayDone: false,
      todaySeconds: 0,
      todayGoalSeconds: null,
      stage: habit.stage,
    },
  }),
}))
const vocab = vi.hoisted((): { total: number | null } => ({ total: 0 }))
vi.mock("@/lib/vocab/vocab-client", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMeetingsTotal: () => vocab.total,
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
    handle.perform.mockReset()
    handle.perform.mockImplementation(() => Promise.resolve())
    handle.skip.mockClear()
    highlights.state = { status: "ready", highlights: [] }
    bubbles.remember.mockClear()
    handle.playMoments.mockClear()
    habit.status = "ready"
    habit.days = []
    habit.stage = "tunas"
    vocab.total = 0
    localStorage.clear()
  })

  it("is the lobby page, with its panels and a live scene", async () => {
    stubWideScreen(true)
    renderStage(false)
    expect(await screen.findByRole("main")).toHaveClass("lobby-page")
    expect(
      screen.getByRole("heading", { name: "Ruang baca" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Denah ruangan" })
    ).toBeInTheDocument()
    expect(scene.props).toMatchObject({ paused: false, allow3d: true })
  })

  it("opens Kilas balik from the fireplace and Pengaturan from the door", async () => {
    stubWideScreen(true)
    const { router } = renderStage(false)
    await vi.waitFor(() => expect(scene.props).not.toBeNull())
    const activate = scene.props!.onActivate!
    await act(async () => activate("perapian", { keyboard: true }))
    expect(router.state.location.pathname).toBe("/recap")
    await act(async () => activate("pintu", { keyboard: true }))
    expect(router.state.location.pathname).toBe("/settings")
  })

  it("opens the page after Anda's activity, at once from the keyboard, and skips on a second tap", async () => {
    stubWideScreen(true)
    let finish = () => undefined as void
    handle.perform.mockImplementation(
      () => new Promise<void>((resolve) => (finish = resolve))
    )
    const { router } = renderStage(false)
    await vi.waitFor(() => expect(scene.props).not.toBeNull())
    const activate = scene.props!.onActivate!
    await act(async () => activate("perapian", { keyboard: false }))
    expect(handle.perform).toHaveBeenCalledWith("perapian")
    expect(router.state.location.pathname).toBe("/lobby")
    await act(async () => activate("perapian", { keyboard: false }))
    expect(handle.skip).toHaveBeenCalledTimes(1)
    await act(async () => finish())
    expect(router.state.location.pathname).toBe("/recap")

    await act(async () => void router.navigate({ to: "/lobby" }))
    handle.perform.mockClear()
    // Never resolves: the page must not wait for it.
    handle.perform.mockImplementation(() => new Promise<void>(() => undefined))
    await act(async () => activate("pintu", { keyboard: true }))
    expect(handle.perform).toHaveBeenCalledWith("pintu", { instant: true })
    expect(router.state.location.pathname).toBe("/settings")
  })

  it("a tap on another hotspot skips and opens the newer page only", async () => {
    stubWideScreen(true)
    let finish = () => undefined as void
    handle.perform.mockImplementation(
      () => new Promise<void>((resolve) => (finish = resolve))
    )
    const { router } = renderStage(false)
    await vi.waitFor(() => expect(scene.props).not.toBeNull())
    const activate = scene.props!.onActivate!
    await act(async () => activate("perapian", { keyboard: false }))
    await act(async () => activate("pintu", { keyboard: false }))
    expect(handle.skip).toHaveBeenCalledTimes(1)
    expect(handle.perform).toHaveBeenCalledTimes(1)
    await act(async () => finish())
    expect(router.state.location.pathname).toBe("/settings")
  })

  it("the last tap wins: a tap back on the running hotspot opens its page", async () => {
    stubWideScreen(true)
    let finish = () => undefined as void
    handle.perform.mockImplementation(
      () => new Promise<void>((resolve) => (finish = resolve))
    )
    const { router } = renderStage(false)
    await vi.waitFor(() => expect(scene.props).not.toBeNull())
    const activate = scene.props!.onActivate!
    await act(async () => activate("perapian", { keyboard: false }))
    await act(async () => activate("pintu", { keyboard: false }))
    await act(async () => activate("perapian", { keyboard: false }))
    await act(async () => finish())
    expect(router.state.location.pathname).toBe("/recap")
  })

  it("opens nothing over the corkboard dialog when the activity ends", async () => {
    stubWideScreen(true)
    let finish = () => undefined as void
    handle.perform.mockImplementation(
      () => new Promise<void>((resolve) => (finish = resolve))
    )
    const { router } = renderStage(false)
    await vi.waitFor(() => expect(scene.props).not.toBeNull())
    const activate = scene.props!.onActivate!
    await act(async () => activate("papan", { keyboard: true }))
    await screen.findByRole("dialog", { name: "Sorotan" })
    // An activity under way as the dialog covers the scene ends without a page.
    await act(async () => activate("perapian", { keyboard: false }))
    await act(async () => finish())
    expect(router.state.location.pathname).toBe("/lobby")
  })

  it("opens nothing when the lobby is gone before the activity ends", async () => {
    stubWideScreen(true)
    let finish = () => undefined as void
    handle.perform.mockImplementation(
      () => new Promise<void>((resolve) => (finish = resolve))
    )
    const { router, unmount } = renderStage(false)
    await vi.waitFor(() => expect(scene.props).not.toBeNull())
    const activate = scene.props!.onActivate!
    await act(async () => activate("perapian", { keyboard: false }))
    unmount()
    await act(async () => finish())
    expect(router.state.location.pathname).toBe("/lobby")
  })

  it("behind a popup keeps only a paused, hidden scene and the top bar", async () => {
    stubWideScreen(true)
    const { container } = renderStage(true)
    await screen.findByLabelText("Cari di rakmu")
    expect(screen.queryByRole("main")).toBeNull()
    expect(screen.queryByRole("heading", { name: "Ruang baca" })).toBeNull()
    expect(screen.queryByRole("heading", { name: "Denah ruangan" })).toBeNull()
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

  it("opens the highlights dialog from the corkboard, the scene paused behind it", async () => {
    stubWideScreen(true)
    renderStage(false)
    await screen.findByRole("main")
    expect(scene.props).toMatchObject({ paused: false })
    await act(async () =>
      scene.props?.onActivate?.("papan", { keyboard: true })
    )
    const dialog = await screen.findByRole("dialog", { name: "Sorotan" })
    expect(dialog).toBeInTheDocument()
    expect(scene.props).toMatchObject({ paused: true })
    fireEvent.click(within(dialog).getByRole("button", { name: "Tutup" }))
    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Sorotan" })).toBeNull()
    )
    expect(scene.props).toMatchObject({ paused: false })
  })

  it("closes the corkboard dialog when its link opens the highlights page", async () => {
    highlights.state = {
      status: "ready",
      highlights: [
        {
          id: "h1",
          bookId: sherlock.id,
          cfi: "epubcfi(/6/4)",
          color: "yellow",
          note: "",
          excerpt: "x",
          createdAt: "2026-10-24T08:00:00.000Z",
        },
      ],
    }
    stubWideScreen(true)
    const { router } = renderWithRouter(<RoutedStage />, "/lobby")
    await vi.waitFor(() => expect(scene.props).not.toBeNull())
    await act(async () =>
      scene.props?.onActivate?.("papan", { keyboard: true })
    )
    const dialog = await screen.findByRole("dialog", { name: "Sorotan" })
    fireEvent.click(within(dialog).getByRole("link", { name: "Lihat semua" }))
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe("/highlights")
    )
    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Sorotan" })).toBeNull()
    )
    // Back on the lobby, the dialog does not come back by itself.
    await act(() => router.navigate({ to: "/lobby" }))
    expect(await screen.findByRole("main")).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "Sorotan" })).toBeNull()
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

  it("greets an empty shelf beside the desk card, not over the room's labels", async () => {
    stubWideScreen(true)
    renderWithRouter(
      <LobbyStage
        collections={[]}
        user={member}
        books={[]}
        usage={usage}
        offline={false}
        popup={false}
      />,
      "/lobby"
    )
    const side = await screen.findByRole("complementary", {
      name: "Panel ruang baca",
    })
    expect(
      within(side).getByText("Rakmu masih kosong. Bawa buku pertamamu ke sini!")
    ).toBeInTheDocument()
    expect(
      within(side).getByRole("link", { name: "Standard Ebooks" })
    ).toBeInTheDocument()
    // Its slot holds nothing else: no recent books on an empty shelf.
    expect(
      within(side).queryByRole("heading", { name: "Baru Dibuka" })
    ).toBeNull()
    // No hotspot carries it: the labels can never cover it.
    expect(scene.props?.bubbles?.["meja-admin"]).toBeUndefined()
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

  describe("what changed since the last visit (spec 3F §4A.2)", () => {
    /** The room these tests show: one reading day (a small fire), Sherlock unfinished. */
    const now: RoomSnapshot = {
      fire: "kecil",
      deskLamp: false,
      parcelOpen: false,
      plant: "tunas",
      finished: 0,
    }
    const read = [{ day: "2026-11-02", seconds: 900, goalMinutes: null }]

    /** The scene goes (again) live, which also renders the stage with the data as set. */
    const goLive = async () => {
      await vi.waitFor(() => expect(scene.props).not.toBeNull())
      await act(async () => scene.props!.onLiveChange!(false))
      await act(async () => scene.props!.onLiveChange!(true))
    }

    it("plays it once the scene is live, and remembers the room", async () => {
      stubWideScreen(true)
      habit.days = read
      const before: RoomSnapshot = { ...now, fire: "bara" }
      localStorage.setItem(ROOM_SEEN_KEY, JSON.stringify(before))
      renderStage(false)
      await vi.waitFor(() => expect(scene.props).not.toBeNull())
      expect(handle.playMoments).not.toHaveBeenCalled()
      await goLive()
      expect(handle.playMoments).toHaveBeenCalledTimes(1)
      expect(handle.playMoments).toHaveBeenCalledWith(before, ["fire"])
      expect(readRoomSnapshot()).toEqual(now)

      // Once per visit: the scene going again and coming back plays nothing.
      await goLive()
      expect(handle.playMoments).toHaveBeenCalledTimes(1)
    })

    it("plays nothing on the first visit on this device, but remembers the room", async () => {
      stubWideScreen(true)
      habit.days = read
      renderStage(false)
      await goLive()
      expect(handle.playMoments).not.toHaveBeenCalled()
      expect(readRoomSnapshot()).toEqual(now)
    })

    it("waits for the habit and the words' meetings: nothing played, nothing saved before", async () => {
      stubWideScreen(true)
      habit.days = read
      habit.status = "loading"
      vocab.total = null
      const before: RoomSnapshot = { ...now, fire: "bara" }
      localStorage.setItem(ROOM_SEEN_KEY, JSON.stringify(before))
      renderStage(false)
      await goLive()
      habit.status = "ready"
      await goLive()
      expect(handle.playMoments).not.toHaveBeenCalled()
      expect(readRoomSnapshot()).toEqual(before)

      // A copy from this device (offline) is the room the member sees too.
      habit.status = "stale"
      vocab.total = 0
      await goLive()
      expect(handle.playMoments).toHaveBeenCalledWith(before, ["fire"])
      expect(readRoomSnapshot()).toEqual(now)
    })

    it("plays nothing behind a popup, where nobody sees the room", async () => {
      stubWideScreen(true)
      habit.days = read
      const before: RoomSnapshot = { ...now, fire: "bara" }
      localStorage.setItem(ROOM_SEEN_KEY, JSON.stringify(before))
      renderStage(true)
      await goLive()
      expect(handle.playMoments).not.toHaveBeenCalled()
      expect(readRoomSnapshot()).toEqual(before)
    })

    it("keeps the remembered room up to date as it changes during the visit", async () => {
      stubWideScreen(true)
      habit.days = read
      renderStage(false)
      await goLive()
      habit.stage = "daun"
      await goLive()
      expect(readRoomSnapshot()).toEqual({ ...now, plant: "daun" })
      expect(handle.playMoments).not.toHaveBeenCalled()
    })
  })
})
