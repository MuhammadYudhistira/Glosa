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
})
