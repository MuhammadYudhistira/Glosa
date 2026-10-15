import type { ReactNode } from "react"

export function GuestBook({
  children,
  aside,
}: {
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="guestbook">
      {aside && (
        <section className="guestbook-page guestbook-left hidden md:block">
          {aside}
        </section>
      )}
      <section className="guestbook-page guestbook-right">{children}</section>
    </div>
  )
}

export function PaperDivider({ children }: { children: ReactNode }) {
  return (
    <div className="my-2 flex items-center gap-2 text-xs text-[#8b7556] before:h-px before:flex-1 before:bg-[#cdb991] after:h-px after:flex-1 after:bg-[#cdb991]">
      {children}
    </div>
  )
}
