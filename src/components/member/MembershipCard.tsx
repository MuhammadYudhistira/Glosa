import { Logo } from "@/components/ui/logo"
import {
  formatBytes,
  formatMemberNo,
  formatMemberSince,
  planLabel,
} from "@/lib/member"
import type { SessionUser } from "@/lib/session-types"
import { cn } from "@/lib/utils"

export function MembershipCard({
  member,
  className,
  animate = false,
}: {
  member: SessionUser
  className?: string
  animate?: boolean
}) {
  return (
    <figure
      aria-label="Kartu anggota Glosa"
      className={cn(
        "member-card m-0",
        animate && "member-card-enter",
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <Logo className="size-7" />
        <div>
          <b className="block font-heading text-sm tracking-[0.2em]">GLOSA</b>
          <small className="text-[8px] tracking-[0.15em] text-[#9cc9bf]">
            KARTU ANGGOTA PERPUSTAKAAN
          </small>
        </div>
      </div>
      <div className="mt-3 flex flex-1 gap-3.5">
        <div className="grid h-[74px] w-[62px] place-items-center rounded-md border-2 border-white/25 bg-gradient-to-br from-[#c68e63] to-[#7a4a2e] font-heading text-2xl font-bold">
          {member.displayName.charAt(0).toUpperCase()}
        </div>
        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-2.5 gap-y-0.5 text-[9px]">
          <dt className="text-[#8fb9b0]">Nama</dt>
          <dd className="text-xs font-bold">{member.displayName}</dd>
          <dt className="text-[#8fb9b0]">Pengguna</dt>
          <dd className="text-xs font-bold">@{member.username}</dd>
          <dt className="text-[#8fb9b0]">No. anggota</dt>
          <dd className="font-type text-xs font-bold tracking-wider">
            {formatMemberNo(member.memberNo)}
          </dd>
          <dt className="text-[#8fb9b0]">Anggota sejak</dt>
          <dd className="text-xs font-bold">
            {formatMemberSince(member.memberSince)}
          </dd>
        </dl>
      </div>
      <div className="flex items-end justify-between">
        <span className="rounded-full border border-mint/50 px-2 py-0.5 text-[9px] tracking-[0.15em] text-mint">
          {planLabel(member.plan)} · {formatBytes(member.storageLimitBytes)}
        </span>
        <span aria-hidden="true" className="member-card-barcode" />
      </div>
    </figure>
  )
}
