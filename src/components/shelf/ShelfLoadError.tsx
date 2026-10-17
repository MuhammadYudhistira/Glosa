import { RouteError } from "@/components/RouteError"
import { Panel } from "@/components/ui/panel"
import { BookLoadError } from "@/lib/book-download"
import { bookMessage } from "@/lib/book-messages"

/** Rak Saya and the lobby, when the shelf cannot load (e.g. offline before it was ever saved). */
export function ShelfLoadError({ error }: { error: unknown }) {
  if (!(error instanceof BookLoadError)) return <RouteError error={error} />
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Panel className="w-full max-w-md p-6 text-center">
        <p role="alert" className="text-sm">
          {bookMessage(error.code)}
        </p>
      </Panel>
    </main>
  )
}
