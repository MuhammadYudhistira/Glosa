export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path
        d="M20 6 L34 12 V30 L20 36 L6 30 V12 Z"
        fill="#0f3a36"
        stroke="#2fe0b8"
        strokeWidth="1.5"
      />
      <path d="M12 15 h7 v14 h-7 z M21 15 h7 v14 h-7 z" fill="#e8f1f0" />
    </svg>
  )
}
