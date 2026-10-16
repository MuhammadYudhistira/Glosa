import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { BookCover, coverHue } from "./BookCover"

describe("BookCover", () => {
  it("shows the cover image when there is one", () => {
    const { container } = render(
      <BookCover
        book={{ title: "Sherlock", coverUrl: "https://storage/cover.webp" }}
      />
    )
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://storage/cover.webp"
    )
  })

  it("draws a titled spine when there is no cover", () => {
    render(
      <BookCover book={{ title: "Catatan Tanpa Sampul", coverUrl: null }} />
    )
    expect(screen.getByText("Catatan Tanpa Sampul")).toBeInTheDocument()
  })

  it("gives each title a stable hue", () => {
    expect(coverHue("Sherlock")).toBe(coverHue("Sherlock"))
    expect(coverHue("Sherlock")).toBeGreaterThanOrEqual(0)
    expect(coverHue("Sherlock")).toBeLessThan(360)
  })
})
