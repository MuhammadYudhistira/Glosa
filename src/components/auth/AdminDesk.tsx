import type { ReactNode } from "react"

/** Lays a page out in front of the zoomed-in admin desk (see .scene-canvas[data-focus="admin"]). */
export function AdminDesk({
  bubble,
  children,
}: {
  bubble: ReactNode
  children: ReactNode
}) {
  return (
    <main className="relative flex min-h-dvh flex-col justify-end p-3 pt-28 md:flex-row md:items-center md:justify-end md:p-8">
      <div className="absolute top-4 left-4 max-w-[17rem] md:top-[14%] md:left-[6%]">
        {bubble}
      </div>
      <div className="w-full md:w-[min(62vw,52rem)]">{children}</div>
    </main>
  )
}
