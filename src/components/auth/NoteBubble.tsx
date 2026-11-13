import type { ReactNode } from "react"

export function NoteBubble({
  children,
  tone = "info",
}: {
  children: ReactNode
  tone?: "info" | "error"
}) {
  if (tone === "error") {
    return (
      <div role="alert" className="note-bubble">
        {children}
      </div>
    )
  }
  // <output> carries the implicit "status" role (polite live region).
  return <output className="note-bubble block">{children}</output>
}
