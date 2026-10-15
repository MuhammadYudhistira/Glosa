import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { type FormEvent, useState } from "react"
import { AdminDesk } from "@/components/auth/AdminDesk"
import { GuestBook } from "@/components/auth/GuestBook"
import { LibrarianBubble } from "@/components/auth/LibrarianBubble"
import { PaperField } from "@/components/auth/PaperField"
import { Button } from "@/components/ui/button"
import { authMessage } from "@/lib/auth-messages"
import { DEFAULT_MEMBER_PATH } from "@/lib/redirects"
import { updatePasswordFn } from "@/server/auth"

export const Route = createFileRoute("/reset-password")({
  // Reached through the recovery link, which signs the member in first.
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ href: "/forgot-password" })
  },
  head: () => ({ meta: [{ title: "Kata Sandi Baru — Glosa" }] }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const router = useRouter()
  const updatePassword = useServerFn(updatePasswordFn)
  const [pending, setPending] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const message = errorCode ? authMessage(errorCode) : null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") ?? "")
    if (password !== String(form.get("confirm") ?? "")) {
      setErrorCode("password_mismatch")
      return
    }
    setPending(true)
    setErrorCode(null)
    let result: Awaited<ReturnType<typeof updatePassword>>
    try {
      result = await updatePassword({ data: { password } })
    } catch {
      setPending(false)
      setErrorCode("unknown")
      return
    }
    if (!result.ok) {
      setPending(false)
      setErrorCode(result.code)
      return
    }
    await router.invalidate()
    router.history.push(DEFAULT_MEMBER_PATH)
  }

  return (
    <AdminDesk
      bubble={
        <LibrarianBubble tone={message ? "error" : "info"}>
          {message?.bubble ?? "Silakan tulis kata sandi barumu."}
        </LibrarianBubble>
      }
    >
      <GuestBook>
        <h1 className="mb-3 font-hand text-3xl font-bold text-maroon">
          Kata Sandi Baru
        </h1>
        <form onSubmit={onSubmit}>
          <PaperField
            label="Kata sandi baru"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            error={
              errorCode === "password_mismatch" ? undefined : message?.field
            }
          />
          <PaperField
            label="Ulangi kata sandi baru"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            error={
              errorCode === "password_mismatch" ? message?.field : undefined
            }
          />
          <Button type="submit" variant="ink" size="block" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan kata sandi"}
          </Button>
        </form>
      </GuestBook>
    </AdminDesk>
  )
}
