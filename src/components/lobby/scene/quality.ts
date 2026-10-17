/** How the lobby is drawn (spec 1D §3.1). The values appear as data-quality. */
export type Quality = "tinggi" | "rendah" | "diam"

export type Environment = {
  reducedMotion: boolean
  webgl: boolean
  coarsePointer: boolean
  /** GiB, from navigator.deviceMemory (Chromium only). */
  deviceMemory: number | undefined
}

/** How long each animated tier is measured before it may step down. */
export const MEASURE_MS = 3000

export function initialQuality(environment: Environment): Quality {
  if (environment.reducedMotion || !environment.webgl) return "diam"
  if (
    environment.coarsePointer ||
    (environment.deviceMemory !== undefined && environment.deviceMemory <= 4)
  ) {
    return "rendah"
  }
  return "tinggi"
}

/** The tier to continue with after MEASURE_MS at `current`. */
export function nextQuality(current: Quality, averageFps: number): Quality {
  if (current === "tinggi" && averageFps < 40) return "rendah"
  if (current === "rendah" && averageFps < 20) return "diam"
  return current
}

/** The share of walkers shown. */
export function walkerShare(quality: Quality): number {
  return quality === "rendah" ? 0.5 : 1
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas")
    return (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) !== null
  } catch {
    return false
  }
}

export function detectEnvironment(): Environment {
  const memory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory
  return {
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
    webgl: webglAvailable(),
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    deviceMemory: memory,
  }
}
