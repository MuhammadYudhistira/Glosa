export type Mood = "day" | "dusk" | "night"

/** The mood from the device's local clock (spec 3F §3.4). */
export function daylight(date: Date): Mood {
  const hour = date.getHours()
  if (hour >= 5 && hour < 16) return "day"
  if (hour >= 16 && hour < 19) return "dusk"
  return "night"
}

/** Milliseconds until the hour the mood next changes (05, 16 or 19 o'clock). */
export function msUntilNextMood(date: Date): number {
  const hour = date.getHours()
  const next = new Date(date)
  // 29 rolls over to 05:00 the next day.
  next.setHours(hour < 5 ? 5 : hour < 16 ? 16 : hour < 19 ? 19 : 29, 0, 0, 0)
  return next.getTime() - date.getTime()
}

export type LightRig = {
  background: string
  hemiSky: string
  hemiGround: string
  hemi: number
  sun: string
  sunIntensity: number
  sunPosition: readonly [number, number, number]
  lamps: number // 0..1: reading lamp, desk lamp
  fire: number // 0..1: fireplace
  city: number // 0..1: window glow and city lights
  exposure: number
}

/**
 * Start values; the owner's visual checkpoint (plan 3F-R1, Task 4) tunes
 * them. `sunPosition` is relative to the room's centre: by day and at dusk
 * the sun comes in through the window (−Z), at night the moon does.
 */
export const RIGS: Record<Mood, LightRig> = {
  day: {
    background: "#2a1d14",
    hemiSky: "#fff3dc",
    hemiGround: "#9a7650",
    hemi: 1.0,
    sun: "#fff0cf",
    sunIntensity: 2.3,
    sunPosition: [7, 15, -11],
    lamps: 0,
    fire: 0,
    city: 0,
    exposure: 0.95,
  },
  dusk: {
    background: "#241518",
    hemiSky: "#ffc99a",
    hemiGround: "#5a3a2c",
    hemi: 0.62,
    sun: "#ff9c5a",
    sunIntensity: 1.9,
    sunPosition: [9, 6.5, -12],
    lamps: 0.8,
    fire: 0.6,
    city: 0.45,
    exposure: 0.92,
  },
  night: {
    background: "#120d12",
    hemiSky: "#9088bc",
    hemiGround: "#4a3428",
    // A soft fill, so the floor away from the fire still reads.
    hemi: 1.1,
    sun: "#9fb0ff",
    sunIntensity: 0.55,
    sunPosition: [6, 14, -10],
    lamps: 1,
    fire: 1,
    city: 1,
    exposure: 1.05,
  },
}

function mixHex(a: string, b: string, k: number): string {
  const channel = (hex: string, i: number) =>
    parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  return `#${[0, 1, 2]
    .map((i) =>
      Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * k)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`
}

const mixNumber = (a: number, b: number, k: number) => a + (b - a) * k

/** A blend of two rigs, k = 0 is `a` and k = 1 is `b`. */
export function mixRig(a: LightRig, b: LightRig, k: number): LightRig {
  const t = Number.isNaN(k) ? 0 : Math.min(1, Math.max(0, k))
  if (t === 0) return { ...a, sunPosition: [...a.sunPosition] }
  if (t === 1) return { ...b, sunPosition: [...b.sunPosition] }
  return {
    background: mixHex(a.background, b.background, t),
    hemiSky: mixHex(a.hemiSky, b.hemiSky, t),
    hemiGround: mixHex(a.hemiGround, b.hemiGround, t),
    hemi: mixNumber(a.hemi, b.hemi, t),
    sun: mixHex(a.sun, b.sun, t),
    sunIntensity: mixNumber(a.sunIntensity, b.sunIntensity, t),
    sunPosition: [
      mixNumber(a.sunPosition[0], b.sunPosition[0], t),
      mixNumber(a.sunPosition[1], b.sunPosition[1], t),
      mixNumber(a.sunPosition[2], b.sunPosition[2], t),
    ],
    lamps: mixNumber(a.lamps, b.lamps, t),
    fire: mixNumber(a.fire, b.fire, t),
    city: mixNumber(a.city, b.city, t),
    exposure: mixNumber(a.exposure, b.exposure, t),
  }
}
