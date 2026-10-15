import { createFileRoute } from "@tanstack/react-router"
import { signOutFn } from "@/server/auth"

export const Route = createFileRoute("/logout")({
  preload: false,
  loader: () => signOutFn(),
})
