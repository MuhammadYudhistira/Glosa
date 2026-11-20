import { type RefObject, useEffect } from "react"

/**
 * Sets `--lobby-sheet-h` on the page to the phone sheet's height plus its
 * 0.5rem offset (styles.css: .lobby-sheet), so the name card and the scene
 * can stay above it. `sheetKey` changes when the sheet is replaced.
 */
export function useSheetHeight(
  page: RefObject<HTMLElement | null>,
  sheetKey: string
): void {
  useEffect(() => {
    const root = page.current
    const sheet = root?.querySelector<HTMLElement>(".lobby-sheet")
    if (!root || !sheet) {
      root?.style.removeProperty("--lobby-sheet-h")
      return
    }
    const apply = () =>
      root.style.setProperty("--lobby-sheet-h", `${sheet.offsetHeight + 8}px`)
    apply()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(apply)
    observer.observe(sheet)
    return () => observer.disconnect()
  }, [page, sheetKey])
}
