import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FinishToggle } from "./FinishToggle"
import { sherlock } from "./fixtures"

const mocks = vi.hoisted(() => ({ setBookFinishedFn: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server/collections", () => mocks)

afterEach(() => {
  vi.clearAllMocks()
})

describe("FinishToggle", () => {
  it("marks a book finished", async () => {
    mocks.setBookFinishedFn.mockResolvedValueOnce({ ok: true })
    const onSaved = vi.fn()
    render(<FinishToggle book={sherlock} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole("button", { name: "Tandai selesai" }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
    expect(mocks.setBookFinishedFn).toHaveBeenCalledWith({
      data: { bookId: sherlock.id, finished: true },
    })
  })

  it("shows when a finished book was finished, and takes the mark off", async () => {
    mocks.setBookFinishedFn.mockResolvedValueOnce({ ok: true })
    render(
      <FinishToggle
        book={{ ...sherlock, finishedAt: "2026-10-20T03:00:00+00:00" }}
        onSaved={vi.fn()}
      />
    )
    expect(
      screen.getByText(/^Selesai dibaca Selasa, 20 Oktober 2026$/)
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole("button", { name: "Tandai belum selesai" })
    )
    await waitFor(() =>
      expect(mocks.setBookFinishedFn).toHaveBeenCalledWith({
        data: { bookId: sherlock.id, finished: false },
      })
    )
  })

  it("says why the mark did not change", async () => {
    mocks.setBookFinishedFn.mockResolvedValueOnce({
      ok: false,
      code: "unknown",
    })
    render(<FinishToggle book={sherlock} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Tandai selesai" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ada yang tidak beres."
    )
  })

  it("ignores a click while saving, and keeps the button focusable", async () => {
    let finish: (value: { ok: true }) => void = () => undefined
    mocks.setBookFinishedFn.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    render(<FinishToggle book={sherlock} onSaved={vi.fn()} />)
    const button = screen.getByRole("button", { name: "Tandai selesai" })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(mocks.setBookFinishedFn).toHaveBeenCalledOnce()
    expect(button).toBeEnabled()
    expect(button).toHaveAttribute("aria-busy", "true")
    await act(async () => finish({ ok: true }))
    expect(button).toHaveAttribute("aria-busy", "false")
  })

  it("is locked when the shelf came from the offline copy", () => {
    render(<FinishToggle book={sherlock} offline onSaved={vi.fn()} />)
    expect(
      screen.getByRole("button", { name: "Tandai selesai" })
    ).toBeDisabled()
  })
})
