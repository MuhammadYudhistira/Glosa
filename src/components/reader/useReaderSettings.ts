import { useServerFn } from "@tanstack/react-start"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ReaderSettings } from "@/lib/reader-settings"
import {
  cacheReaderSettings,
  cachedReaderSettings,
} from "@/lib/reader-settings-cache"
import { saveReaderSettingsFn } from "@/server/reading"

const SAVE_DELAY_MS = 800

/**
 * Reader settings (spec §9): applied at once and kept on this device, then
 * saved to the account after a short pause. Changes made offline stay marked
 * as unsaved and reach the account the next time the reader opens online.
 */
export function useReaderSettings(initial: ReaderSettings, online: boolean) {
  const [settings, setSettings] = useState(initial)
  const saveSettings = useServerFn(saveReaderSettingsFn)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const waiting = useRef<ReaderSettings | null>(null)

  const push = useCallback(
    async (next: ReaderSettings) => {
      try {
        const result = await saveSettings({ data: next })
        if (result.ok && waiting.current === null) {
          cacheReaderSettings(next, false)
        }
      } catch {
        // Still marked unsaved on this device; sent again next time.
      }
    },
    [saveSettings]
  )

  useEffect(() => {
    const cached = cachedReaderSettings()
    if (online && cached?.dirty) void push(cached.settings)
  }, [online, push])

  // Leaving the reader sends a change that is still waiting for its pause.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      const next = waiting.current
      waiting.current = null
      if (next) void push(next)
    },
    [push]
  )

  const update = useCallback(
    (patch: Partial<ReaderSettings>) => {
      setSettings((current) => ({ ...current, ...patch }))
      const next = { ...(waiting.current ?? settings), ...patch }
      waiting.current = next
      cacheReaderSettings(next, true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        timer.current = null
        waiting.current = null
        void push(next)
      }, SAVE_DELAY_MS)
    },
    [push, settings]
  )

  return { settings, update }
}
