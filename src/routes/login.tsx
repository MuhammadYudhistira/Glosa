import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { type FormEvent, useState } from "react"
import { AdminDesk } from "@/components/auth/AdminDesk"
import { GoogleButton } from "@/components/auth/GoogleButton"
import { GuestBook, PaperDivider } from "@/components/auth/GuestBook"
import { GuestBookRules } from "@/components/auth/GuestBookRules"
import { LibrarianBubble } from "@/components/auth/LibrarianBubble"
import { PaperField } from "@/components/auth/PaperField"
import { Button } from "@/components/ui/button"
import { authMessage } from "@/lib/auth-messages"
import { guestRedirect, safeNext } from "@/lib/redirects"
import { signInFn } from "@/server/auth"
import { visitorsTodayFn } from "@/server/profile"

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  beforeLoad: ({ context }) => {
    const target = guestRedirect(context.user)
    if (target) throw redirect({ href: target })
  },
  loader: () => visitorsTodayFn(),
  head: () => ({ meta: [{ title: "Buku Tamu — Glosa" }] }),
  component: LoginPage,
})

function LoginPage() {
  const { next } = Route.useSearch()
  const visitors = Route.useLoaderData()
  const router = useRouter()
  const signIn = useServerFn(signInFn)
  const [pending, setPending] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const message = errorCode ? authMessage(errorCode) : null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setErrorCode(null)
    let result: Awaited<ReturnType<typeof signIn>>
    try {
      result = await signIn({
        data: {
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
        },
      })
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
    // Navigate once; root beforeLoad re-reads the session and the _member
    // guard sends new members to /welcome. Invalidating first would let this
    // page's guest guard redirect too, rendering /welcome twice.
    await router.navigate({ href: safeNext(next) })
  }

  return (
    <AdminDesk
      bubble={
        <LibrarianBubble tone={message ? "error" : "info"}>
          {message
            ? message.bubble
            : "Selamat datang! Silakan isi buku tamu, ya."}
        </LibrarianBubble>
      }
    >
      <GuestBook aside={<GuestBookRules visitors={visitors} />}>
        <h1 className="mb-3 font-hand text-3xl font-bold text-maroon md:hidden">
          Buku Tamu
        </h1>
        <form method="post" onSubmit={onSubmit}>
          <PaperField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            error={message?.field}
          />
          <PaperField
            label="Kata sandi"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <Button
            type="submit"
            variant="ink"
            size="block"
            disabled={pending}
            className="mt-1"
          >
            {pending ? "Menandatangani…" : "Tanda tangan & masuk"}
          </Button>
        </form>
        <PaperDivider>atau</PaperDivider>
        <GoogleButton label="Masuk dengan Google" />
        <div className="mt-3 flex justify-between gap-3 text-xs text-sepia-muted">
          <span>
            Belum jadi anggota?{" "}
            <Link to="/register" className="underline">
              Daftar
            </Link>
          </span>
          <Link to="/forgot-password" className="underline">
            Lupa kata sandi?
          </Link>
        </div>
      </GuestBook>
    </AdminDesk>
  )
}
