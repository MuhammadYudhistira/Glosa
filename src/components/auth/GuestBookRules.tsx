import { formatLongDate } from "@/lib/dates"

export function GuestBookRules({ visitors }: { visitors: number }) {
  return (
    <div className="flex h-full flex-col">
      <h1 className="font-hand text-3xl leading-none font-bold text-maroon">
        Buku Tamu
      </h1>
      <p className="mt-1 mb-4 font-type text-xs text-sepia-muted">
        {formatLongDate(new Date())}
      </p>
      <h2 className="text-sm font-bold">Tata tertib perpustakaan</h2>
      <ol className="mt-1 list-decimal space-y-1 pl-4 text-[13px] leading-snug">
        <li>Buku yang kamu bawa hanya bisa dibaca olehmu.</li>
        <li>Bagikan ulasan, bukan file.</li>
        <li>Ketuk kata yang sulit — kami bantu artikan.</li>
      </ol>
      <p className="mt-auto pt-6 text-xs text-sepia-muted">
        Pengunjung hari ini: <b>{visitors}</b>
      </p>
    </div>
  )
}
