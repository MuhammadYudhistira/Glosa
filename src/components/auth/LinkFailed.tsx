import { Link } from "@tanstack/react-router"
import { authMessage } from "@/lib/auth-messages"

// Codes from the OAuth flow rather than an e-mailed link: a new letter would
// not help, so "Minta surat baru" is not offered for them.
const OAUTH_CODES = new Set(["access_denied", "signups_closed"])

function heading(code: string, fromEmailLink: boolean): string {
  if (code === "signups_closed") return "Pendaftaran masih tertutup"
  return fromEmailLink ? "Tautan tidak berlaku" : "Masuk dibatalkan"
}

export function LinkFailed({ code }: { code: string }) {
  const message = authMessage(code)
  const fromEmailLink = !OAUTH_CODES.has(code)
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl border bg-panel p-6 text-center backdrop-blur-md">
        <h1 className="font-heading text-2xl font-bold">
          {heading(code, fromEmailLink)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{message.bubble}</p>
        <div className="mt-6 flex justify-center gap-4 text-sm">
          <Link to="/login" className="text-mint underline">
            Ke buku tamu
          </Link>
          {fromEmailLink && (
            <Link to="/forgot-password" className="text-mint underline">
              Minta surat baru
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
