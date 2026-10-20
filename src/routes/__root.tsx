import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { type ReactNode, useEffect } from "react"

import { currentUser } from "@/lib/current-user"
import { registerServiceWorker } from "@/lib/pwa"
import { sentryConfig } from "@/lib/sentry-config"
import { setReportedUser, startBrowserSentry } from "@/lib/sentry-client"
import { sentryHeadScripts } from "@/lib/sentry-env"
import { forgetUser, rememberUser } from "@/lib/session-cache"
import { SceneBackdrop } from "@/components/scene/SceneBackdrop"
import appCss from "@/styles.css?url"

export const Route = createRootRoute({
  beforeLoad: async () => ({ user: await currentUser() }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "theme-color", content: "#0b1518" },
      { title: "Glosa" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", href: "/icons/icon-192.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
    scripts: sentryHeadScripts(sentryConfig()),
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1 className="font-heading text-2xl">404</h1>
      <p>Halaman yang kamu cari tidak ada di perpustakaan ini.</p>
    </main>
  ),
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootComponent() {
  const { user } = Route.useRouteContext()

  // First, so Sentry exists by the time the member effect below tags it.
  useEffect(() => {
    registerServiceWorker()
    startBrowserSentry(sentryConfig())
  }, [])

  // Keep the last member seen online, so the app can still open offline.
  useEffect(() => {
    if (user) rememberUser(user)
    else if (user === null) forgetUser()
    if (user !== undefined) setReportedUser(user?.id ?? null)
  }, [user])

  return (
    <>
      {/* In the offline shell nobody is known yet and the shell was rendered for
          "/": the scene would not match the page the browser renders. */}
      {user !== undefined && <SceneBackdrop />}
      <div className="relative z-10">
        <Outlet />
      </div>
    </>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
