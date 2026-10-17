import { Link } from "@tanstack/react-router"
import { buttonVariants } from "@/components/ui/button"
import { Panel } from "@/components/ui/panel"

/** A reader page that could not show its book: the reason and a way back. */
export function ReaderProblem({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Panel className="w-full max-w-md space-y-4 p-6 text-center">
        <p role="alert" className="text-sm">
          {message}
        </p>
        <div className="grid gap-2.5">
          {onRetry && (
            <button
              type="button"
              className={buttonVariants({ size: "block" })}
              onClick={onRetry}
            >
              Coba lagi
            </button>
          )}
          <Link
            to="/shelf"
            className={buttonVariants({ variant: "outline", size: "block" })}
          >
            Kembali ke rak
          </Link>
        </div>
      </Panel>
    </main>
  )
}
