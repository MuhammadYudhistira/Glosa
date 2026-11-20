import { useEffect, useState } from "react"

/** How long the greeting stays (spec 3G §3.7: it goes by itself and covers no button). */
export const GREETING_MS = 6000

export function Greeting({ name }: { name: string }) {
  const [shown, setShown] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setShown(false), GREETING_MS)
    return () => clearTimeout(timer)
  }, [])
  if (!shown) return null
  return (
    <output className="lobby-notice">Selamat datang kembali, {name}!</output>
  )
}
