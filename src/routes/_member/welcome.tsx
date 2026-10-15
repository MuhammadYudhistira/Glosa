import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useCallback, useState } from "react"
import { LibrarianBubble } from "@/components/auth/LibrarianBubble"
import {
  useUsernameCheck,
  usernameStatusText,
} from "@/components/auth/useUsernameCheck"
import { MembershipCard } from "@/components/member/MembershipCard"
import { Stamp } from "@/components/member/Stamp"
import { Button } from "@/components/ui/button"
import { authMessage } from "@/lib/auth-messages"
import { DEFAULT_MEMBER_PATH } from "@/lib/redirects"
import { normalizeUsername } from "@/lib/username"
import { checkUsernameFn, completeOnboardingFn } from "@/server/profile"

export const Route = createFileRoute("/_member/welcome")({
  head: () => ({ meta: [{ title: "Kartu Anggota — Glosa" }] }),
  component: WelcomeCardPage,
})

function WelcomeCardPage() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const completeOnboarding = useServerFn(completeOnboardingFn)
  const checkUsername = useServerFn(checkUsernameFn)
  // Email members chose their username on the form; OAuth members got a generated one.
  const canEditUsername = user.provider !== "email"
  const [username, setUsername] = useState(user.username)
  const checker = useCallback(
    async (candidate: string) =>
      candidate === user.username
        ? { available: true, problem: null }
        : checkUsername({ data: { username: candidate } }),
    [checkUsername, user.username]
  )
  const usernameStatus = useUsernameCheck(
    canEditUsername ? username : "",
    checker
  )
  const [pending, setPending] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  async function enterLibrary() {
    setPending(true)
    setErrorCode(null)
    let result: Awaited<ReturnType<typeof completeOnboarding>>
    try {
      result = await completeOnboarding({
        data: canEditUsername && username !== user.username ? { username } : {},
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
    await router.invalidate()
    router.history.push(DEFAULT_MEMBER_PATH)
  }

  const blocked =
    canEditUsername &&
    (usernameStatus.state === "taken" || usernameStatus.state === "invalid")

  return (
    <main className="relative grid min-h-dvh place-items-center p-4">
      <div className="absolute top-[10%] left-[8%] md:left-[58%]">
        <Stamp>DITERIMA</Stamp>
      </div>
      <div className="flex w-full max-w-sm flex-col items-center gap-5">
        <h1 className="sr-only">Kartu anggotamu sudah jadi</h1>
        <MembershipCard
          member={{
            ...user,
            username: canEditUsername
              ? username || user.username
              : user.username,
          }}
          animate
        />
        {canEditUsername && (
          <div className="w-full rounded-xl border bg-panel p-3 text-sm backdrop-blur-md">
            <label
              htmlFor="username"
              className="block text-xs text-muted-foreground"
            >
              Nama pengguna (bisa diubah sekarang)
            </label>
            <input
              id="username"
              value={username}
              onChange={(event) =>
                setUsername(normalizeUsername(event.target.value))
              }
              autoComplete="username"
              aria-describedby="username-note"
              className="mt-1 w-full rounded-md border bg-night-950 px-3 py-2 text-foreground outline-none focus:border-mint"
            />
            <p
              id="username-note"
              className="mt-1 text-xs text-muted-foreground"
            >
              {usernameStatusText(usernameStatus)}
            </p>
          </div>
        )}
        {errorCode && (
          <LibrarianBubble tone="error">
            {authMessage(errorCode).bubble}
          </LibrarianBubble>
        )}
        <Button
          size="block"
          onClick={enterLibrary}
          disabled={pending || blocked}
        >
          {pending ? "Membuka pintu…" : "Masuk ke perpustakaan →"}
        </Button>
      </div>
    </main>
  )
}
