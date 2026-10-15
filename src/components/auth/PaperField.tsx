import { type ComponentProps, useId } from "react"
import { cn } from "@/lib/utils"

type Props = ComponentProps<"input"> & {
  label: string
  error?: string
  hint?: string
}

export function PaperField({
  label,
  error,
  hint,
  id,
  className,
  ...props
}: Props) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const noteId = `${inputId}-note`
  const note = error ?? hint

  return (
    <div className={cn("mb-3", className)}>
      <label htmlFor={inputId} className="block text-xs text-sepia-muted">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className="w-full border-0 border-b-[1.5px] border-[#8b7556] bg-transparent px-0.5 pt-0.5 font-hand text-xl text-pen outline-none placeholder:text-[#b9a983] focus:border-pen"
        {...props}
      />
      <output
        id={noteId}
        className={cn(
          "mt-1 block text-xs",
          error ? "text-stamp" : "text-sepia-muted"
        )}
      >
        {note}
      </output>
    </div>
  )
}
