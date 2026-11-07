export function Segments<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: ReadonlyArray<[T, string]>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div>
      <p className="quote-label">{label}</p>
      <div role="group" aria-label={label} className="quote-segment">
        {options.map(([option, name]) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}
