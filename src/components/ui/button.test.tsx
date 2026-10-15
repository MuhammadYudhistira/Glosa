import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Button } from "./button"

describe("Button", () => {
  it("has a guest-book ink variant and a full-width block size", () => {
    render(
      <Button variant="ink" size="block">
        Tanda tangan & masuk
      </Button>
    )
    const button = screen.getByRole("button", { name: "Tanda tangan & masuk" })
    expect(button.className).toContain("bg-maroon")
    expect(button.className).toContain("w-full")
  })
})
