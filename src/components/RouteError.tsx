import { Link } from "@tanstack/react-router"
import { useEffect } from "react"
import { buttonVariants } from "@/components/ui/button"
import { reportError } from "@/lib/sentry-client"

export function RouteError({ error }: { error: unknown }) {
  useEffect(() => {
    console.error(error)
    reportError(error)
  }, [error])

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl border bg-panel p-6 text-center backdrop-blur-md">
        <h1 className="font-heading text-2xl font-bold">
          Ada yang tidak beres
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Petugas sedang membereskannya. Coba muat ulang halaman ini.
        </p>
        <div className="mt-6 grid gap-2.5">
          <button
            type="button"
            className={buttonVariants({ size: "block" })}
            onClick={() => window.location.reload()}
          >
            Muat ulang
          </button>
          <Link
            to="/"
            className={buttonVariants({ variant: "outline", size: "block" })}
          >
            Ke beranda
          </Link>
        </div>
      </div>
    </main>
  )
}
