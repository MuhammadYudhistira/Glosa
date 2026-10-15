import { useEffect, useRef, useState } from "react"
import {
  USERNAME_PROBLEM_TEXT,
  type UsernameProblem,
  validateUsername,
} from "@/lib/username"

export type UsernameStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken" }
  | { state: "invalid"; problem: UsernameProblem }

export type UsernameChecker = (
  username: string
) => Promise<{ available: boolean; problem: UsernameProblem | null }>

export function useUsernameCheck(
  value: string,
  check: UsernameChecker,
  delayMs = 400
): UsernameStatus {
  const [status, setStatus] = useState<UsernameStatus>({ state: "idle" })
  // Keep the latest checker without restarting the debounce when its identity changes.
  const checkRef = useRef(check)
  checkRef.current = check

  useEffect(() => {
    if (value === "") {
      setStatus({ state: "idle" })
      return
    }
    const problem = validateUsername(value)
    if (problem) {
      setStatus({ state: "invalid", problem })
      return
    }
    setStatus({ state: "checking" })
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const result = await checkRef.current(value)
        if (cancelled) return
        if (result.available) setStatus({ state: "available" })
        else if (result.problem)
          setStatus({ state: "invalid", problem: result.problem })
        else setStatus({ state: "taken" })
      } catch {
        if (!cancelled) setStatus({ state: "idle" })
      }
    }, delayMs)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [value, delayMs])

  return status
}

export function usernameStatusText(status: UsernameStatus): string | undefined {
  switch (status.state) {
    case "checking":
      return "Sedang mengecek…"
    case "available":
      return "Nama pengguna tersedia ✓"
    case "taken":
      return "Sudah dipakai anggota lain."
    case "invalid":
      return USERNAME_PROBLEM_TEXT[status.problem]
    default:
      return undefined
  }
}
