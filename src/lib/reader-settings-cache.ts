import { READER_SETTINGS_KEY } from "./local/keys"
import {
  DEFAULT_READER_SETTINGS,
  type ReaderSettings,
  parseReaderSettings,
} from "./reader-settings"

type CachedSettings = { settings: ReaderSettings; dirty: boolean }

/** This device's copy of the reader settings; `dirty` while the server lacks them. */
export function cachedReaderSettings(): CachedSettings | null {
  try {
    const raw = localStorage.getItem(READER_SETTINGS_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as { settings?: unknown; dirty?: unknown }
    return {
      settings: parseReaderSettings(value.settings),
      dirty: value.dirty === true,
    }
  } catch {
    return null
  }
}

export function cacheReaderSettings(
  settings: ReaderSettings,
  dirty: boolean
): void {
  try {
    localStorage.setItem(
      READER_SETTINGS_KEY,
      JSON.stringify({ settings, dirty } satisfies CachedSettings)
    )
  } catch {
    // No localStorage: the settings still apply until the reader closes.
  }
}

/**
 * Settings for opening the reader: unsaved changes on this device win; then
 * the account's settings; then this device's copy; then the defaults.
 */
export function initialReaderSettings(
  server: ReaderSettings | null
): ReaderSettings {
  const cached = cachedReaderSettings()
  if (cached?.dirty) return cached.settings
  if (server) {
    cacheReaderSettings(server, false)
    return server
  }
  return cached?.settings ?? DEFAULT_READER_SETTINGS
}
