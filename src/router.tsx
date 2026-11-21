import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { RouteError } from "@/components/RouteError"
import { supportsTransitionTypes, transitionTypes } from "@/lib/page-transition"
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
    // Without type support (Chrome < 125, Safari < 18.2) none at all, or the
    // browser would cross-fade every navigation.
    defaultViewTransition: supportsTransitionTypes()
      ? {
          types: ({ fromLocation, toLocation }) =>
            transitionTypes(fromLocation?.pathname, toLocation.pathname, {
              wide: window.matchMedia(WIDE_QUERY).matches,
              reducedMotion: window.matchMedia(
                "(prefers-reduced-motion: reduce)"
              ).matches,
            }),
        }
      : false,
  })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
