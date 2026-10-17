import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_READER_SETTINGS } from "@/lib/reader-settings"
import { ReaderSettingsPanel } from "./ReaderSettingsPanel"

function renderPanel(settings = DEFAULT_READER_SETTINGS) {
  const onChange = vi.fn()
  render(
    <ReaderSettingsPanel
      open
      onOpenChange={() => undefined}
      settings={settings}
      onChange={onChange}
    />
  )
  return onChange
}

describe("ReaderSettingsPanel", () => {
  it("changes the theme, font and layout", async () => {
    const onChange = renderPanel()
    await screen.findByRole("dialog", { name: "Tampilan" })

    fireEvent.click(screen.getByLabelText("Gelap"))
    expect(onChange).toHaveBeenLastCalledWith({ theme: "dark" })
    fireEvent.click(screen.getByLabelText("Ramah disleksia"))
    expect(onChange).toHaveBeenLastCalledWith({ font: "dyslexic" })
    fireEvent.click(screen.getByLabelText("Gulir"))
    expect(onChange).toHaveBeenLastCalledWith({ flow: "scrolled" })
    expect(screen.getByLabelText("Sepia")).toBeChecked()
  })

  it("steps the font size and line height within their limits", async () => {
    const onChange = renderPanel({ ...DEFAULT_READER_SETTINGS, fontSize: 200 })
    await screen.findByRole("dialog", { name: "Tampilan" })

    expect(
      screen.getByRole("button", { name: "Perbesar huruf" })
    ).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Perkecil huruf" }))
    expect(onChange).toHaveBeenLastCalledWith({ fontSize: 190 })
    fireEvent.click(screen.getByRole("button", { name: "Renggangkan baris" }))
    expect(onChange).toHaveBeenLastCalledWith({ lineHeight: 1.6 })
    expect(
      screen.getByRole("status", { name: "Ukuran huruf" })
    ).toHaveTextContent("200%")
  })
})
