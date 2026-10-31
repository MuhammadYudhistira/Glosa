import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FinishPrompt } from "./FinishPrompt"

describe("FinishPrompt", () => {
  it("asks once with three answers", () => {
    const onAnswer = vi.fn()
    const onLater = vi.fn()
    render(
      <FinishPrompt
        busy={false}
        error={null}
        raised={false}
        onAnswer={onAnswer}
        onLater={onLater}
      />
    )
    expect(
      screen.getByText("Sudah selesai membaca buku ini?")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ya, selesai" }))
    expect(onAnswer).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByRole("button", { name: "Belum" }))
    expect(onAnswer).toHaveBeenLastCalledWith(false)
    expect(onLater).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Nanti" }))
    expect(onLater).toHaveBeenCalledOnce()
    expect(onAnswer).toHaveBeenCalledTimes(2)
  })

  it("waits while the answer is saved, and says when it failed", () => {
    render(
      <FinishPrompt
        busy
        error="unknown"
        raised={false}
        onAnswer={vi.fn()}
        onLater={vi.fn()}
      />
    )
    expect(screen.getByRole("button", { name: "Ya, selesai" })).toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent("Ada yang tidak beres.")
  })

  it("marks itself raised while Kembali shows", () => {
    const { rerender } = render(
      <FinishPrompt
        busy={false}
        error={null}
        raised
        onAnswer={vi.fn()}
        onLater={vi.fn()}
      />
    )
    const prompt = screen.getByRole("complementary", { name: "Buku selesai" })
    expect(prompt).toHaveAttribute("data-raised", "true")
    rerender(
      <FinishPrompt
        busy={false}
        error={null}
        raised={false}
        onAnswer={vi.fn()}
        onLater={vi.fn()}
      />
    )
    expect(prompt).toHaveAttribute("data-raised", "false")
  })
})
