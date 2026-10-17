import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AdminDeskCard } from "./AdminDeskCard"

const usage = {
  usedBytes: 742083,
  limitBytes: 104857600,
  plan: "free" as const,
}

describe("AdminDeskCard", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows the storage and opens the upload", () => {
    const onUpload = vi.fn()
    render(<AdminDeskCard usage={usage} onUpload={onUpload} />)
    expect(screen.getByLabelText("Penyimpanan")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Bawa buku" }))
    expect(onUpload).toHaveBeenCalled()
  })

  it("needs a connection to upload", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    render(<AdminDeskCard usage={usage} onUpload={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Bawa buku" })).toBeDisabled()
    expect(screen.getByText("Butuh internet.")).toBeInTheDocument()
  })
})
