/** Today's minutes against the day's goal, small in the reader's top bar (spec 3B §4.3). */
export function HabitRing({
  seconds,
  goalSeconds,
  hasGoal,
}: {
  seconds: number
  goalSeconds: number
  hasGoal: boolean
}) {
  const minutes = Math.floor(seconds / 60)
  const goal = Math.round(goalSeconds / 60)
  const share = Math.min(1, seconds / goalSeconds)
  const label = hasGoal
    ? `${minutes} dari ${goal} menit hari ini`
    : `${minutes} menit hari ini`
  const circumference = 2 * Math.PI * 15
  return (
    <span role="img" aria-label={label} title={label} className="habit-ring">
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="15" className="habit-ring-track" />
        <circle
          cx="18"
          cy="18"
          r="15"
          className="habit-ring-fill"
          strokeDasharray={`${share * circumference} ${circumference}`}
        />
      </svg>
      <span aria-hidden="true" className="habit-ring-minutes">
        {minutes}
      </span>
    </span>
  )
}
