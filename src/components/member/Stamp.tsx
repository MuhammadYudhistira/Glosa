import type { ReactNode } from "react"

export function Stamp({ children }: { children: ReactNode }) {
  return <span className="stamp">{children}</span>
}
