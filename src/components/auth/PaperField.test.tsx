import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PaperField } from "./PaperField"

describe("PaperField", () => {
  it("labels its input", () => {
    render(
      <PaperField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
      />
    )
    const input = screen.getByLabelText("Email")
    expect(input).toHaveAttribute("autocomplete", "email")
    expect(input).not.toHaveAttribute("aria-invalid")
  })

  it("links the error message to the input", () => {
    render(
      <PaperField
        label="Email"
        name="email"
        error="Format email tidak valid."
      />
    )
    const input = screen.getByLabelText("Email")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAccessibleDescription("Format email tidak valid.")
  })

  it("shows a hint when there is no error", () => {
    render(
      <PaperField
        label="Nama pengguna"
        name="username"
        hint="Nama pengguna tersedia ✓"
      />
    )
    expect(screen.getByLabelText("Nama pengguna")).toHaveAccessibleDescription(
      "Nama pengguna tersedia ✓"
    )
  })

  it("renders the hint inside a live status region", () => {
    render(<PaperField label="Nama pengguna" name="username" hint="Tersedia" />)
    expect(screen.getByRole("status")).toHaveTextContent("Tersedia")
  })

  it("keeps an empty status region when there is no note", () => {
    render(<PaperField label="Email" name="email" />)
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
    expect(screen.getByLabelText("Email")).not.toHaveAttribute(
      "aria-describedby"
    )
  })
})
