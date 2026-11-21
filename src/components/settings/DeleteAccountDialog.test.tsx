import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { authMessage } from "@/lib/auth-messages"
import { DeleteAccountDialog } from "./DeleteAccountDialog"

describe("DeleteAccountDialog", () => {
  it("asks for the username and shows why the deletion was refused", async () => {
    const onDelete = vi
      .fn()
      .mockResolvedValue({ ok: false, code: "confirm_mismatch" })
    render(
      <DeleteAccountDialog
        open
        onOpenChange={vi.fn()}
        username="ani"
        onDelete={onDelete}
      />
    )
    const dialog = await screen.findByRole("dialog", { name: "Hapus akun" })
    fireEvent.change(
      screen.getByLabelText("Ketik nama penggunamu untuk konfirmasi (ani)"),
      { target: { value: "anu" } }
    )
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Hapus akun saya permanen" })
      )
    })
    expect(onDelete).toHaveBeenCalledWith("anu")
    expect(dialog).toHaveTextContent(authMessage("confirm_mismatch").field)
  })

  it("shows no old alert when reopened after a refused attempt", async () => {
    const onDelete = vi
      .fn()
      .mockResolvedValue({ ok: false, code: "confirm_mismatch" })
    const props = { username: "ani", onDelete }
    const { rerender } = render(
      <DeleteAccountDialog open onOpenChange={vi.fn()} {...props} />
    )
    await screen.findByRole("dialog", { name: "Hapus akun" })
    await act(async () => {
      fireEvent.change(
        screen.getByLabelText("Ketik nama penggunamu untuk konfirmasi (ani)"),
        { target: { value: "anu" } }
      )
      fireEvent.click(
        screen.getByRole("button", { name: "Hapus akun saya permanen" })
      )
    })
    expect(screen.getByRole("alert")).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    // The parent owns `open`: mirror what it does on close, then reopen.
    rerender(
      <DeleteAccountDialog open={false} onOpenChange={vi.fn()} {...props} />
    )
    rerender(<DeleteAccountDialog open onOpenChange={vi.fn()} {...props} />)
    await screen.findByRole("dialog", { name: "Hapus akun" })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
