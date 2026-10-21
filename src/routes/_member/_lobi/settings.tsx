import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { type FormEvent, useState } from "react"
import { LobbyPopup } from "@/components/lobby/LobbyPopup"
import { MembershipCard } from "@/components/member/MembershipCard"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Panel } from "@/components/ui/panel"
import { authMessage } from "@/lib/auth-messages"
import { clearLocalData } from "@/lib/local/device"
import { normalizeUsername } from "@/lib/username"
import { deleteAccountFn, updateProfileFn } from "@/server/profile"

export const Route = createFileRoute("/_member/_lobi/settings")({
  head: () => ({ meta: [{ title: "Pengaturan — Glosa" }] }),
  component: SettingsPage,
})

function SettingsPage() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const updateProfile = useServerFn(updateProfileFn)
  const deleteAccount = useServerFn(deleteAccountFn)

  const [username, setUsername] = useState(user.username)
  const [profileState, setProfileState] = useState<
    { kind: "idle" } | { kind: "saved" } | { kind: "error"; code: string }
  >({ kind: "idle" })
  const [saving, setSaving] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setProfileState({ kind: "idle" })
    try {
      let result: Awaited<ReturnType<typeof updateProfile>>
      try {
        result = await updateProfile({
          data: {
            displayName: String(form.get("displayName") ?? ""),
            username,
          },
        })
      } catch {
        setProfileState({ kind: "error", code: "unknown" })
        return
      }
      if (!result.ok) {
        setProfileState({ kind: "error", code: result.code })
        return
      }
      setProfileState({ kind: "saved" })
      await router.invalidate()
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setDeleting(true)
    setDeleteError(null)
    let result: Awaited<ReturnType<typeof deleteAccount>>
    try {
      result = await deleteAccount({
        data: { confirmUsername: String(form.get("confirmUsername") ?? "") },
      })
    } catch {
      setDeleting(false)
      setDeleteError("unknown")
      return
    }
    if (!result.ok) {
      setDeleting(false)
      setDeleteError(result.code)
      return
    }
    // Navigate once; root beforeLoad re-reads the session. Invalidating first
    // would make the _member guard redirect to /login before this navigation.
    // The account is gone: its copies on this device go too.
    await clearLocalData().catch((error: unknown) =>
      console.error("clearing this device failed", error)
    )
    await router.navigate({ href: "/" })
  }

  return (
    <LobbyPopup label="Pengaturan" className="max-w-3xl" bodyClassName="gap-6">
      <h1 className="font-heading text-3xl font-bold">Pengaturan</h1>

      <Panel className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
        <MembershipCard member={user} className="shrink-0" />
        <form
          method="post"
          onSubmit={onSaveProfile}
          className="w-full min-w-0 space-y-3 text-sm sm:flex-1"
        >
          <h2 className="font-bold">Profil</h2>
          <div className="space-y-1">
            <Label htmlFor="displayName">Nama</Label>
            <Input
              id="displayName"
              name="displayName"
              defaultValue={user.displayName}
              maxLength={60}
              required
              autoComplete="name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="username">Nama pengguna</Label>
            <Input
              id="username"
              name="username"
              value={username}
              onChange={(event) =>
                setUsername(normalizeUsername(event.target.value))
              }
              required
              autoComplete="username"
            />
          </div>
          {profileState.kind === "error" && (
            <p role="alert" className="text-xs text-destructive">
              {authMessage(profileState.code).field}
            </p>
          )}
          {profileState.kind === "saved" && (
            <output className="block text-xs text-mint">
              Profil tersimpan.
            </output>
          )}
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Menyimpan…" : "Simpan profil"}
          </Button>
        </form>
      </Panel>

      <Panel className="p-6">
        <Link
          to="/logout"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Keluar
        </Link>
      </Panel>

      <Panel className="border-destructive/50 p-6 text-sm">
        <h2 className="font-bold text-destructive">Hapus akun</h2>
        <p className="mt-1 text-muted-foreground">
          Semua data milikmu akan dihapus permanen dan tidak bisa dikembalikan.
        </p>
        <form method="post" onSubmit={onDelete} className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="confirmUsername">
              Ketik nama penggunamu untuk konfirmasi ({user.username})
            </Label>
            <Input
              id="confirmUsername"
              name="confirmUsername"
              autoComplete="off"
              required
            />
          </div>
          {deleteError && (
            <p role="alert" className="text-xs text-destructive">
              {authMessage(deleteError).field}
            </p>
          )}
          <Button
            type="submit"
            variant="destructive"
            size="lg"
            disabled={deleting}
          >
            {deleting ? "Menghapus…" : "Hapus akun saya permanen"}
          </Button>
        </form>
      </Panel>
    </LobbyPopup>
  )
}
