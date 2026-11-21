import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { RouteError } from "@/components/RouteError"
import { transitionTypes } from "@/lib/page-transition"
import { WIDE_QUERY } from "@/lib/use-wide-screen"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,

    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouteError,
    // Phones animate between the room and its pages (spec poles mobile §5).
    defaultViewTransition: {
      types: ({ fromLocation, toLocation }) =>
        transitionTypes(fromLocation?.pathname, toLocation.pathname, {
          wide: window.matchMedia(WIDE_QUERY).matches,
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches,
        }),
    },
  })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
