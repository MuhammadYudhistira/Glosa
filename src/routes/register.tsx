import { Link, createFileRoute, redirect } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { type FormEvent, useCallback, useEffect, useState } from "react"
import { AdminDesk } from "@/components/auth/AdminDesk"
import { GoogleButton } from "@/components/auth/GoogleButton"
import { LibrarianBubble } from "@/components/auth/LibrarianBubble"
import { PaperField } from "@/components/auth/PaperField"
import {
  useUsernameCheck,
  usernameStatusText,
} from "@/components/auth/useUsernameCheck"
import { Button } from "@/components/ui/button"
import { authMessage } from "@/lib/auth-messages"
import { guestRedirect } from "@/lib/redirects"
import { normalizeUsername } from "@/lib/username"
import { signUpFn } from "@/server/auth"
import { checkUsernameFn } from "@/server/profile"

export const Route = createFileRoute("/register")({
  beforeLoad: ({ context }) => {
    const target = guestRedirect(context.user)
    if (target) throw redirect({ href: target })
  },
  head: () => ({ meta: [{ title: "Formulir Anggota — Glosa" }] }),
  component: RegisterPage,
})

function RegisterPage() {
  const signUp = useServerFn(signUpFn)
  const checkUsername = useServerFn(checkUsernameFn)
  const checker = useCallback(
    (username: string) => checkUsername({ data: { username } }),
    [checkUsername]
  )
  const [username, setUsername] = useState("")
  const usernameStatus = useUsernameCheck(username, checker)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [pending, setPending] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  // The "still checking" notice is only true while the check runs.
  useEffect(() => {
    if (usernameStatus.state !== "checking") {
      setErrorCode((code) => (code === "username_checking" ? null : code))
    }
  }, [usernameStatus.state])
  const message = errorCode ? authMessage(errorCode) : null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Tell the member instead of silently ignoring a submit mid-check.
    if (usernameStatus.state === "checking") {
      setErrorCode("username_checking")
      return
    }
    if (usernameStatus.state !== "available") {
      setErrorCode(
        usernameStatus.state === "taken" ? "username_taken" : "username_invalid"
      )
      return
    }
    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "").trim()
    setPending(true)
    setErrorCode(null)
    let result: Awaited<ReturnType<typeof signUp>>
    try {
      result = await signUp({
        data: {
          email,
          password: String(form.get("password") ?? ""),
          username,
          displayName: String(form.get("displayName") ?? ""),
          acceptedTerms: form.get("acceptedTerms") === "on",
        },
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
    setSentTo(email)
  }

  const bubble = sentTo
    ? `Kami kirim surat konfirmasi ke ${sentTo}. Buka tautannya untuk menerima kartu anggotamu.`
    : (message?.bubble ??
      "Anggota baru? Isi satu formulir ini, kartumu langsung jadi.")

  return (
    <AdminDesk
      bubble={
        <LibrarianBubble tone={message ? "error" : "info"}>
          {bubble}
        </LibrarianBubble>
      }
    >
      <div className="rotate-[1.2deg] border-t-[6px] border-[#1f5e45] bg-[#fbf5e6] p-5 text-sepia-ink shadow-[0_14px_26px_rgba(0,0,0,0.55)]">
        <div className="mb-3 flex justify-between font-type text-xs font-bold tracking-wide text-[#1f5e45]">
          <h1>FORMULIR PENDAFTARAN ANGGOTA</h1>
          <span className="font-normal text-[#8b7556]">No. ______</span>
        </div>
        {sentTo ? (
          <p className="font-hand text-2xl text-pen">
            Kami kirim surat konfirmasi ke {sentTo}. Sampai jumpa di meja admin!
          </p>
        ) : (
          <form method="post" onSubmit={onSubmit}>
            <div className="grid gap-x-5 sm:grid-cols-2">
              <PaperField
                label="Nama lengkap"
                name="displayName"
                autoComplete="name"
                maxLength={60}
                required
                error={
                  errorCode === "display_name_invalid"
                    ? message?.field
                    : undefined
                }
              />
              <PaperField
                label="Nama pengguna"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => {
                  setUsername(normalizeUsername(event.target.value))
                  setErrorCode((code) =>
                    code === "username_checking" ? null : code
                  )
                }}
                required
                error={
                  usernameStatus.state === "taken" ||
                  usernameStatus.state === "invalid"
                    ? usernameStatusText(usernameStatus)
                    : errorCode === "username_checking"
                      ? message?.field
                      : undefined
                }
                hint={usernameStatusText(usernameStatus)}
              />
              <PaperField
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
                error={
                  errorCode === "email_address_invalid" ||
                  errorCode === "email_address_not_authorized"
                    ? message?.field
                    : undefined
                }
              />
              <PaperField
                label="Kata sandi"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                error={
                  errorCode === "weak_password" ? message?.field : undefined
                }
              />
            </div>
            <label className="my-3 flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                name="acceptedTerms"
                required
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                className="mt-0.5 accent-[#1f5e45]"
              />
              <span>
                Saya setuju dengan tata tertib (
                <Link to="/terms" target="_blank" className="underline">
                  Syarat Layanan
                </Link>{" "}
                &amp;{" "}
                <Link to="/privacy" target="_blank" className="underline">
                  Kebijakan Privasi
                </Link>
                )
              </span>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="submit"
                variant="ink"
                size="block"
                disabled={pending}
              >
                {pending ? "Mengirim…" : "Ajukan keanggotaan"}
              </Button>
              <div>
                <GoogleButton
                  label="Daftar dengan Google"
                  disabled={!acceptedTerms}
                  describedBy={acceptedTerms ? undefined : "google-terms-hint"}
                />
                {!acceptedTerms && (
                  <output
                    id="google-terms-hint"
                    className="mt-1 block text-xs text-sepia-muted"
                  >
                    Centang persetujuan tata tertib dulu.
                  </output>
                )}
              </div>
            </div>
          </form>
        )}
        <p className="mt-3 text-xs text-sepia-muted">
          Sudah jadi anggota?{" "}
          <Link to="/login" className="underline">
            Isi buku tamu
          </Link>
        </p>
      </div>
    </AdminDesk>
  )
}
