import { render, screen } from "@testing-library/react"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { describe, expect, it } from "vitest"
import { SHELF_FILTERS, type ShelfFilter } from "@/lib/shelf"
import { GenreFilter } from "./GenreFilter"

const counts = Object.fromEntries(
  SHELF_FILTERS.map(({ value }) => [value, 1])
) as Record<ShelfFilter, number>

function renderAt(url: string, active: ShelfFilter) {
  const rootRoute = createRootRoute()
  const shelfRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/shelf",
    validateSearch: (s: Record<string, unknown>) => ({
      genre: typeof s.genre === "string" ? s.genre : undefined,
      q: typeof s.q === "string" ? s.q : undefined,
    }),
    component: () => <GenreFilter active={active} counts={counts} />,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([shelfRoute]),
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  return render(<RouterProvider router={router} />)
}

async function currentLinks() {
  await screen.findByRole("navigation", { name: "Filter genre" })
  return screen
    .getAllByRole("link")
    .filter((a) => a.getAttribute("aria-current") === "page")
}

describe("GenreFilter", () => {
  it("marks only the Troli Buku Baru chip as current on ?genre=troli", async () => {
    renderAt("/shelf?genre=troli&q=abc", "troli")
    const current = await currentLinks()
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent("Troli Buku Baru")
  })

  it("marks only the Semua chip as current on plain /shelf", async () => {
    renderAt("/shelf", "semua")
    const current = await currentLinks()
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent("Semua")
  })
})
