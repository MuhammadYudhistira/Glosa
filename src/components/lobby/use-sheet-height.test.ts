import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useSheetHeight } from "./use-sheet-height"

describe("useSheetHeight", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("sets the page's variable from the sheet, and follows it", () => {
    let resize = () => {}
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback
        }
        observe() {}
        disconnect() {}
      }
    )
    const page = document.createElement("div")
    const sheet = document.createElement("div")
    sheet.className = "lobby-sheet"
    page.append(sheet)
    let height = 120
    Object.defineProperty(sheet, "offsetHeight", { get: () => height })
    renderHook(() => useSheetHeight({ current: page }, "a"))
    expect(page.style.getPropertyValue("--lobby-sheet-h")).toBe("128px")
    height = 300
    resize()
    expect(page.style.getPropertyValue("--lobby-sheet-h")).toBe("308px")
  })

  it("clears the variable where there is no sheet", () => {
    const page = document.createElement("div")
    page.style.setProperty("--lobby-sheet-h", "99px")
    renderHook(() => useSheetHeight({ current: page }, "a"))
    expect(page.style.getPropertyValue("--lobby-sheet-h")).toBe("")
  })
})
