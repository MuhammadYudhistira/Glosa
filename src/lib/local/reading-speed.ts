import { type SpeedSample, parseSamples } from "@/lib/reading-speed"
import { localDb } from "./db"

/**
 * This device's reading speed (spec 2 §4.4): never sent to the server, and
 * cleared with the rest of `meta` when another member signs in here.
 */
const SPEED_KEY = "reading-speed"

export async function loadSpeedSamples(): Promise<Array<SpeedSample>> {
  const row = await localDb().meta.get(SPEED_KEY)
  return parseSamples(row?.value)
}

export async function saveSpeedSamples(
  samples: ReadonlyArray<SpeedSample>
): Promise<void> {
  await localDb().meta.put({ key: SPEED_KEY, value: [...samples] })
}
