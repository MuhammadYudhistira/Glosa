import { act, render, screen, within } from "@testing-library/react"
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { useEffect } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MemberShell } from "./MemberShell"

function renderAt(url: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <MemberShell>
        <p>Isi halaman</p>
      </MemberShell>
    ),
  })
  const pages = [
    "/lobby",
    "/shelf",
    "/settings",
    "/recap",
    "/welcome",
    "/read/$bookId",
  ]
  const router = createRouter({
    routeTree: rootRoute.addChildren(
      pages.map((path) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path,
          component: () => null,
        })
      )
    ),
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  return render(<RouterProvider router={router} />)
}

describe("MemberShell", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("floats the phone's dock, naming every tab and labelling only the current one", async () => {
    const { container } = renderAt("/shelf")
    await screen.findAllByRole("navigation", { name: "Navigasi utama" })
    const dock = container.querySelector(".member-dock")
    expect(dock).not.toBeNull()
    const tabs = within(dock as HTMLElement).getAllByRole("link")
    expect(tabs.map((tab) => tab.getAttribute("aria-label"))).toEqual([
      "Ruang baca",
      "Rak Saya",
      "Kosakata",
      "Pengaturan",
    ])
    const labels = dock!.querySelectorAll(".member-dock-label")
    expect([...labels].map((label) => label.textContent)).toEqual(["Rak"])
  })

  it("hides the dock while a text field has the focus", async () => {
    const { container } = renderAt("/settings")
    await screen.findAllByRole("navigation", { name: "Navigasi utama" })
    const field = document.createElement("input")
    document.body.append(field)
    act(() => field.focus())
    expect(container.querySelector(".member-dock")).toHaveAttribute(
      "data-typing"
    )
    act(() => field.blur())
    expect(container.querySelector(".member-dock")).not.toHaveAttribute(
      "data-typing"
    )
    field.remove()
  })

  it("re-places the dock's pill when the dock is resized, and ignores a 0-wide box", async () => {
    let notify: () => void = () => {}
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          notify = callback
        }
        observe() {}
        disconnect() {}
      }
    )
    let box = { left: 0, width: 0 }
    const left = vi
      .spyOn(HTMLElement.prototype, "offsetLeft", "get")
      .mockImplementation(() => box.left)
    const width = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockImplementation(() => box.width)
    try {
      const { container } = renderAt("/shelf")
      await screen.findAllByRole("navigation", { name: "Navigasi utama" })
      const pill = container.querySelector<HTMLElement>(".member-dock-pill")!
      // Hidden on a wide screen: nothing to place.
      expect(pill.style.width).toBe("")
      box = { left: 90, width: 100 }
      act(() => notify())
      expect(pill.style.left).toBe("90px")
      expect(pill.style.width).toBe("100px")
      // Rotated: the tabs moved.
      box = { left: 140, width: 160 }
      act(() => notify())
      expect(pill.style.left).toBe("140px")
      expect(pill.style.width).toBe("160px")
      // Hidden again (0 wide): the pill keeps its last place.
      box = { left: 0, width: 0 }
      act(() => notify())
      expect(pill.style.width).toBe("160px")
    } finally {
      left.mockRestore()
      width.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it("offers the sidebar and the dock, with the current page marked", async () => {
    renderAt("/shelf?genre=lainnya")
    const navs = await screen.findAllByRole("navigation", {
      name: "Navigasi utama",
    })
    expect(navs).toHaveLength(2)
    for (const nav of navs) {
      const links = within(nav).getAllByRole("link")
      expect(links.map((link) => link.getAttribute("href"))).toEqual([
        "/lobby",
        "/shelf",
        "/vocabulary",
        "/settings",
      ])
      expect(
        within(nav).getByRole("link", { name: "Rak Saya" })
      ).toHaveAttribute("aria-current", "page")
      expect(
        within(nav).getByRole("link", { name: "Ruang baca" })
      ).not.toHaveAttribute("aria-current")
    }
    expect(screen.getByText("Isi halaman")).toBeInTheDocument()
  })

  it.each(["/lobby", "/shelf?genre=lainnya", "/settings", "/recap"])(
    "floats the menu over the lobby at %s",
    async (url) => {
      const { container } = renderAt(url)
      const [sidebar] = await screen.findAllByRole("navigation", {
        name: "Navigasi utama",
      })
      expect(sidebar).toHaveAttribute("data-floating")
      expect(container.querySelector(".member-main")).toHaveAttribute(
        "data-floating"
      )
    }
  )

  it.each(["/read/abc", "/welcome"])(
    "leaves %s without navigation",
    async (url) => {
      renderAt(url)
      expect(await screen.findByText("Isi halaman")).toBeInTheDocument()
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
    }
  )

  it("keeps the page it leaves mounted while the next route loads", async () => {
    let mounts = 0
    function Lobby() {
      useEffect(() => {
        mounts += 1
      }, [])
      return <p>Ruang 3D</p>
    }
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const rootRoute = createRootRoute({
      component: () => (
        <MemberShell>
          <Outlet />
        </MemberShell>
      ),
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([
        createRoute({
          getParentRoute: () => rootRoute,
          path: "/lobby",
          component: Lobby,
        }),
        createRoute({
          getParentRoute: () => rootRoute,
          path: "/read/$bookId",
          beforeLoad: () => held,
          component: () => <p>Pembaca</p>,
        }),
      ]),
      history: createMemoryHistory({ initialEntries: ["/lobby"] }),
    })
    render(<RouterProvider router={router} />)
    expect(await screen.findByText("Ruang 3D")).toBeInTheDocument()
    expect(mounts).toBe(1)

    let navigation: Promise<void> = Promise.resolve()
    await act(async () => {
      navigation = router.navigate({
        to: "/read/$bookId",
        params: { bookId: "abc" },
      })
    })
    // The reader's beforeLoad is still running: the lobby and its shell stay.
    expect(router.state.location.pathname).toBe("/read/abc")
    expect(screen.getByText("Ruang 3D")).toBeInTheDocument()
    expect(screen.getAllByRole("navigation")).toHaveLength(2)
    expect(mounts).toBe(1)

    await act(async () => {
      release()
      await navigation
    })
    expect(await screen.findByText("Pembaca")).toBeInTheDocument()
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
    expect(mounts).toBe(1)
  })
})
