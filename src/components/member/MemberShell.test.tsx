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
import { describe, expect, it } from "vitest"
import { MemberShell } from "./MemberShell"

function renderAt(url: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <MemberShell>
        <p>Isi halaman</p>
      </MemberShell>
    ),
  })
  const pages = ["/lobby", "/shelf", "/settings", "/welcome", "/read/$bookId"]
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
  it("offers the sidebar and the tab bar, with the current page marked", async () => {
    renderAt("/shelf?genre=lainnya")
    const navs = await screen.findAllByRole("navigation", {
      name: "Navigasi anggota",
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
        within(nav).getByRole("link", { name: "Lobi" })
      ).not.toHaveAttribute("aria-current")
    }
    expect(screen.getByText("Isi halaman")).toBeInTheDocument()
  })

  it.each(["/lobby", "/shelf?genre=lainnya", "/settings"])(
    "floats the menu over the lobby at %s",
    async (url) => {
      const { container } = renderAt(url)
      const [sidebar] = await screen.findAllByRole("navigation", {
        name: "Navigasi anggota",
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
      return <p>Lobi 3D</p>
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
    expect(await screen.findByText("Lobi 3D")).toBeInTheDocument()
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
    expect(screen.getByText("Lobi 3D")).toBeInTheDocument()
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
