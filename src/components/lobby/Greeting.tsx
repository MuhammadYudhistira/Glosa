import { useEffect, useState } from "react"

/** How long the greeting stays (spec 3G §3.7: it goes by itself and covers no button). */
export const GREETING_MS = 6000

/**
 * Whether the greeting is still up. Kept by the lobby above its popups, so a
 * popup closing neither brings the greeting back nor restarts its time.
 */
export function useGreetingShown(active: boolean) {
  const [shown, setShown] = useState(true)
  // Once asked for, the time runs on by itself, even when a popup's route
  // drops the greeting's search for a while.
  const [started, setStarted] = useState(active)
  if (active && !started) setStarted(true)
  useEffect(() => {
    if (!started) return
    const timer = setTimeout(() => setShown(false), GREETING_MS)
    return () => clearTimeout(timer)
  }, [started])
  return active && shown
}

export function Greeting({ name }: { name: string }) {
  return (
    <output className="lobby-notice">Selamat datang kembali, {name}!</output>
  )
}
