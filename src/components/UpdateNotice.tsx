import { useRouterState } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "@/components/ui/button"

/**
 * A new version of the app is ready (src/lib/pwa.ts). The member chooses when
 * to load it; an open book is never interrupted, so the notice waits until
 * the reader is left.
 */
export function UpdateNotice({ apply }: { apply: () => void }) {
  const reading = useRouterState({
    select: (state) => state.location.pathname.startsWith("/read/"),
  })
  const [pressed, setPressed] = useState(false)
  if (reading) return null
  return (
    <output className="update-notice">
      <span>Versi baru Glosa siap.</span>
      <Button
        size="sm"
        disabled={pressed}
        onClick={() => {
          setPressed(true)
          apply()
        }}
      >
        Muat ulang
      </Button>
    </output>
  )
}
