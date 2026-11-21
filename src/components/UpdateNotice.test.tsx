import { act, fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { renderWithRouter } from "@/test/router"
import { UpdateNotice } from "./UpdateNotice"

describe("UpdateNotice", () => {
  it("says a new version is ready and loads it on request", async () => {
    const apply = vi.fn()
    renderWithRouter(<UpdateNotice apply={apply} />, "/lobby")
    const notice = await screen.findByRole("status")
    expect(notice).toHaveTextContent("Versi baru Glosa siap")
    const button = screen.getByRole("button", { name: "Muat ulang" })
    fireEvent.click(button)
    expect(apply).toHaveBeenCalledTimes(1)
    // Until the page reloads, a second press does nothing.
    expect(button).toBeDisabled()
  })

  it("waits while a book is open, and shows once the reader is left", async () => {
    const { router } = renderWithRouter(
      <UpdateNotice apply={vi.fn()} />,
      "/read/book-1"
    )
    await act(async () => undefined)
    expect(screen.queryByRole("status")).toBeNull()
    await act(() => router.navigate({ to: "/shelf" }))
    expect(await screen.findByRole("status")).toBeInTheDocument()
  })
})
