// @vitest-environment node
import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"
import { localDb } from "./db"
import { loadSpeedSamples, saveSpeedSamples } from "./reading-speed"

beforeEach(async () => {
  await localDb().meta.clear()
})

describe("reading speed on this device", () => {
  it("is empty at first and keeps what was saved", async () => {
    expect(await loadSpeedSamples()).toEqual([])
    await saveSpeedSamples([{ expected: 1, actual: 2 }])
    expect(await loadSpeedSamples()).toEqual([{ expected: 1, actual: 2 }])
  })

  it("drops a stored value it cannot read", async () => {
    await localDb().meta.put({ key: "reading-speed", value: { fast: true } })
    expect(await loadSpeedSamples()).toEqual([])
  })
})
