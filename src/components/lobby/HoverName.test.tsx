import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { HoverName } from "./HoverName"

describe("HoverName", () => {
  it("shows the name beside the cursor, unseen by assistive technology", () => {
    render(<HoverName name="Kotak buku baru" x={100} y={50} />)
    const name = screen.getByText("Kotak buku baru")
    expect(name).toHaveStyle({ left: "114px", top: "68px" })
    expect(name).toHaveAttribute("aria-hidden", "true")
  })
})
