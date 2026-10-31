import { fireEvent, render, screen } from "@testing-library/react"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { describe, expect, it, vi } from "vitest"
import type { Collection } from "@/lib/book-types"
import { CollectionBar } from "./CollectionBar"

const santai: Collection = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Bacaan santai",
  createdAt: "2026-10-20T00:00:00+00:00",
}
const counts = { semua: 3, sedang: 1, selesai: 0, [santai.id]: 2 }

async function renderBar(
  active: string | undefined,
  canEdit = true,
  handlers = { onCreate: vi.fn(), onEdit: vi.fn() }
) {
  const rootRoute = createRootRoute()
  const shelfRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/shelf",
    validateSearch: (s: Record<string, unknown>) => ({
      koleksi: typeof s.koleksi === "string" ? s.koleksi : undefined,
    }),
    component: () => (
      <CollectionBar
        active={active}
        collections={[santai]}
        counts={counts}
        canEdit={canEdit}
        {...handlers}
      />
    ),
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([shelfRoute]),
    history: createMemoryHistory({ initialEntries: ["/shelf"] }),
  })
  render(<RouterProvider router={router} />)
  await screen.findByRole("navigation", { name: "Koleksi" })
  return handlers
}

describe("CollectionBar", () => {
  it("lists Semua, the automatic collections and the member's, with counts", async () => {
    await renderBar(undefined)
    const links = screen.getAllByRole("link")
    expect(links.map((link) => link.textContent)).toEqual([
      "Semua · 3",
      "Sedang dibaca · 1",
      "Sudah dibaca · 0",
      "Bacaan santai · 2",
    ])
    expect(links[0]).toHaveAttribute("aria-current", "page")
    expect(links[3]).toHaveAttribute("href", `/shelf?koleksi=${santai.id}`)
  })

  it("offers to edit the member's collection that is open", async () => {
    const { onEdit } = await renderBar(santai.id)
    fireEvent.click(
      screen.getByRole("button", { name: "Ubah koleksi Bacaan santai" })
    )
    expect(onEdit).toHaveBeenCalledWith(santai)
  })

  it("has no edit button on an automatic collection", async () => {
    await renderBar("selesai")
    expect(screen.queryByRole("button", { name: /Ubah koleksi/ })).toBeNull()
  })

  it("makes a new collection only online", async () => {
    const { onCreate } = await renderBar(undefined)
    fireEvent.click(screen.getByRole("button", { name: "+ Koleksi baru" }))
    expect(onCreate).toHaveBeenCalledOnce()
  })

  it("turns making off offline", async () => {
    await renderBar(undefined, false)
    expect(
      screen.getByRole("button", { name: "+ Koleksi baru" })
    ).toBeDisabled()
  })
})
