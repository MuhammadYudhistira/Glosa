import "fake-indexeddb/auto"
import { act, fireEvent, screen } from "@testing-library/react"
import { useRouterState } from "@tanstack/react-router"
import { afterEach, describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { StorageUsage } from "@/lib/book-types"
import type { SessionUser } from "@/lib/session-types"
import { stubWideScreen, unstubWideScreen } from "@/test/media"
import { renderWithRouter } from "@/test/router"
import { isPopupPath } from "./LobbyPopup"
import { LobbyStage } from "./LobbyStage"

// The real scene starts three.js; here it only shows what it was given.
const scene = vi.hoisted(() => ({
  props: null as { paused?: boolean; allow3d?: boolean } | null,
}))
vi.mock("./LobbyScene", () => ({
  LobbyScene: (props: { paused?: boolean; allow3d?: boolean }) => {
    scene.props = props
    return <section aria-label="Adegan lobi" className="lobby-scene" />
  },
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
})
