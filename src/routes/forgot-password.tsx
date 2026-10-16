import { Link, createFileRoute, redirect } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { type FormEvent, useState } from "react"
import { AdminDesk } from "@/components/auth/AdminDesk"
import { GuestBook } from "@/components/auth/GuestBook"
import { LibrarianBubble } from "@/components/auth/LibrarianBubble"
import { PaperField } from "@/components/auth/PaperField"
import { Button } from "@/components/ui/button"
import { authMessage } from "@/lib/auth-messages"
import { guestRedirect } from "@/lib/redirects"
import { requestPasswordResetFn } from "@/server/auth"

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: ({ context }) => {
    const target = guestRedirect(context.user)
    if (target) throw redirect({ href: target })
  },
  head: () => ({ meta: [{ title: "Lupa Kata Sandi — Glosa" }] }),
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const requestReset = useServerFn(requestPasswordResetFn)
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const message = errorCode ? authMessage(errorCode) : null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setErrorCode(null)
    let result: Awaited<ReturnType<typeof requestReset>>
    try {
      result = await requestReset({
        data: { email: String(form.get("email") ?? "").trim() },
      })
    } catch {
      setPending(false)
      setErrorCode("unknown")
      return
    }
    setPending(false)
    if (!result.ok) {
      setErrorCode(result.code)
      return
    }
    setSent(true)
  }

  return (
    <AdminDesk
      bubble={
        <LibrarianBubble tone={message ? "error" : "info"}>
          {sent
            ? "Jika email itu terdaftar, surat untuk membuat kata sandi baru sudah kami kirim."
            : (message?.bubble ??
              "Lupa kata sandi? Tulis emailmu, nanti kami kirim surat.")}
        </LibrarianBubble>
      }
    >
      <GuestBook>
        <h1 className="mb-3 font-hand text-3xl font-bold text-maroon">
          Lupa Kata Sandi
        </h1>
        {sent ? (
          <p className="font-hand text-2xl text-pen">
            Cek kotak masuk emailmu, ya.
          </p>
        ) : (
          <form method="post" onSubmit={onSubmit}>
            <PaperField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              error={message?.field}
            />
            <Button type="submit" variant="ink" size="block" disabled={pending}>
              {pending ? "Mengirim…" : "Kirim surat atur ulang"}
            </Button>
          </form>
        )}
        <p className="mt-3 text-xs text-sepia-muted">
          <Link to="/login" className="underline">
            Kembali ke buku tamu
          </Link>
        </p>
      </GuestBook>
    </AdminDesk>
  )
}
