import { cn } from "@/lib/utils"

/** The Glosa mark (generated from docs/brand/glosa-logo.png by scripts/generate-icons.mjs). */
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/logo-mark.png"
      alt=""
      width={96}
      height={96}
      draggable={false}
      className={cn("select-none", className)}
    />
  )
}
