import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto max-w-2xl p-4 py-10 sm:p-8">
      <Link to="/" className="text-sm text-mint underline">
        ← Glosa
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Terakhir diperbarui: {updated} · Draf, akan ditinjau sebelum rilis
        publik.
      </p>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-foreground/90 [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </main>
  )
}
