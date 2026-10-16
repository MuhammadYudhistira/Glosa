import { Link, createFileRoute, redirect } from "@tanstack/react-router"
import { buttonVariants } from "@/components/ui/button"
import { Logo } from "@/components/ui/logo"
import { Panel } from "@/components/ui/panel"
import { guestRedirect } from "@/lib/redirects"
import { SITE_TAGLINE } from "@/lib/site"

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    const target = guestRedirect(context.user)
    if (target) throw redirect({ href: target })
  },
  head: () => ({
    meta: [
      { title: `Glosa — ${SITE_TAGLINE}` },
      {
        name: "description",
        content:
          "Glosa adalah perpustakaan pribadimu untuk belajar bahasa Inggris lewat buku: unggah EPUB, baca dengan nyaman, dan pahami setiap kata.",
      },
    ],
  }),
  component: WelcomePage,
})

function WelcomePage() {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Panel className="w-full max-w-md p-6 text-center sm:p-8">
        <Logo className="mx-auto size-14" />
        <h1 className="mt-3 font-heading text-2xl font-bold sm:text-3xl">
          Selamat datang di Glosa
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Perpustakaan pribadimu untuk belajar bahasa Inggris lewat buku.
        </p>
        <div className="mt-6 grid gap-2.5">
          <Link to="/login" className={buttonVariants({ size: "block" })}>
            Masuk
          </Link>
          <Link
            to="/register"
            className={buttonVariants({ variant: "outline", size: "block" })}
          >
            Daftar jadi anggota
          </Link>
        </div>
      </Panel>
    </main>
  )
}
