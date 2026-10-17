import { render, screen, within } from "@testing-library/react"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
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

  it.each(["/read/abc", "/welcome"])(
    "leaves %s without navigation",
    async (url) => {
      renderAt(url)
      expect(await screen.findByText("Isi halaman")).toBeInTheDocument()
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
    }
  )
})
