import type { ReactNode } from "react"

export function LibrarianBubble({
  children,
  tone = "info",
}: {
  children: ReactNode
  tone?: "info" | "error"
}) {
  const content = (
    <>
      <b className="block text-[11px] text-[#1f6f63]">Petugas perpustakaan</b>
      {children}
    </>
  )
  if (tone === "error") {
    return (
      <div role="alert" className="librarian-bubble">
        {content}
      </div>
    )
  }
  // <output> carries the implicit "status" role (polite live region).
  return <output className="librarian-bubble block">{content}</output>
}
