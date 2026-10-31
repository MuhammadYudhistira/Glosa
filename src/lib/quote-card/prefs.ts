import { QUOTE_CARD_KEY } from "@/lib/local/keys"
import {
  CARD_LAYOUTS,
  CARD_SIZES,
  type CardLayoutKind,
  type CardSize,
} from "./layout"
import { CARD_THEMES, type CardThemeId } from "./themes"

/** The last layout, theme and size, per device (spec kartu kutipan, decision 12). */
export type CardPrefs = {
  layout: CardLayoutKind
  theme: CardThemeId
  size: CardSize
}

export const DEFAULT_CARD_PREFS: CardPrefs = {
  layout: "kutipan",
  theme: "sampul",
  size: "story",
}

function oneOf<T extends string>(
  options: ReadonlyArray<T>,
  value: unknown,
  fallback: T
): T {
  return (options as ReadonlyArray<unknown>).includes(value)
    ? (value as T)
    : fallback
}

export function loadCardPrefs(): CardPrefs {
  try {
    const raw = localStorage.getItem(QUOTE_CARD_KEY)
    if (!raw) return DEFAULT_CARD_PREFS
    const value = JSON.parse(raw) as Partial<
      Record<keyof CardPrefs, unknown>
    > | null
    return {
      layout: oneOf(CARD_LAYOUTS, value?.layout, DEFAULT_CARD_PREFS.layout),
      theme: oneOf(CARD_THEMES, value?.theme, DEFAULT_CARD_PREFS.theme),
      size: oneOf(CARD_SIZES, value?.size, DEFAULT_CARD_PREFS.size),
    }
  } catch {
    return DEFAULT_CARD_PREFS
  }
}

export function saveCardPrefs(prefs: CardPrefs): void {
  try {
    localStorage.setItem(QUOTE_CARD_KEY, JSON.stringify(prefs))
  } catch {
    // No storage: the choice holds until the dialog closes.
  }
}
