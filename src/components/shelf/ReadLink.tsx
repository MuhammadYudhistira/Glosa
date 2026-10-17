import { Link } from "@tanstack/react-router"
import { buttonVariants } from "@/components/ui/button"
import { formatPercent } from "@/lib/progress"

export function ReadLink({
  bookId,
  percentage,
}: {
  bookId: string
  percentage: number
}) {
  return (
    <Link
      to="/read/$bookId"
      params={{ bookId }}
      className={buttonVariants({ size: "block" })}
    >
      {percentage > 0
        ? `Lanjutkan membaca · ${formatPercent(percentage)}`
        : "Mulai membaca"}
    </Link>
  )
}
