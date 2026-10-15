import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function Panel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-2xl border bg-panel shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md",
        className
      )}
    />
  )
}
