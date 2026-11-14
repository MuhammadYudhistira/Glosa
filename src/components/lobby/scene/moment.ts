/** How long a moment of change lasts, in seconds (spec 3F §4A.2: about 1 s). */
export const MOMENT_SECONDS = 1

/** Quick at first, settling at the end. */
export const easeOut = (k: number): number => 1 - Math.pow(1 - k, 3)
