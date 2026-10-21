import { render } from "@testing-library/react"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import type { ReactNode } from "react"

const PATHS = ["/lobby", "/shelf", "/settings", "/logout", "/read/$bookId"]

/** Renders a component that uses <Link> or server functions inside a small router. */
export function renderWithRouter(ui: ReactNode, url = "/lobby") {
  const rootRoute = createRootRoute({ component: () => ui })
  const router = createRouter({
    routeTree: rootRoute.addChildren(
      PATHS.map((path) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path,
          component: () => null,
        })
      )
    ),
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  return { ...render(<RouterProvider router={router} />), router }
}
