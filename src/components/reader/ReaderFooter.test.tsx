import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ReaderFooter } from "./ReaderFooter"

const location = {
  fraction: 0.25,
  cfi: "epubcfi(/6/8!/4/2)",
  chapter: "The Redheaded League",
  chapterHref: "text/the-redheaded-league.xhtml",
  pageText: "",
  turned: false,
  time: null,
}

afterEach(() => {
  vi.useRealTimers()
})

describe("ReaderFooter", () => {
  it("shows nothing until the book has a position", () => {
    render(
      <ReaderFooter
        hidden={false}
        location={null}
        timeLeft={null}
        onSeek={() => undefined}
      />
    )
    expect(
      screen.getByRole("status", { name: "Posisi baca" })
    ).toBeEmptyDOMElement()
  })

  it("shows the position and chapter, and seeks after the slider rests", () => {
    vi.useFakeTimers()
    const onSeek = vi.fn()
    render(
      <ReaderFooter
        hidden={false}
        location={location}
        timeLeft={null}
        onSeek={onSeek}
      />
    )
    expect(
      screen.getByRole("status", { name: "Posisi baca" })
    ).toHaveTextContent("25%")
    expect(
      screen.getByRole("status", { name: "Bab saat ini" })
    ).toHaveTextContent("The Redheaded League")

    fireEvent.change(
      screen.getByRole("slider", { name: "Posisi dalam buku" }),
      {
        target: { value: "0.5" },
      }
    )
    expect(onSeek).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(onSeek).toHaveBeenCalledWith(0.5)
  })

  it("shows the time left in the chapter and in the book", () => {
    render(
      <ReaderFooter
        hidden={false}
        location={location}
        timeLeft={{ chapter: 8.4, book: 312 }}
        onSeek={() => undefined}
      />
    )
    expect(
      screen.getByRole("status", { name: "Sisa waktu" })
    ).toHaveTextContent("±8 mnt lagi di bab ini · ±5 j 12 mnt lagi di buku")
  })

  it("shows no time before foliate has one", () => {
    render(
      <ReaderFooter
        hidden={false}
        location={location}
        timeLeft={null}
        onSeek={() => undefined}
      />
    )
    expect(screen.queryByRole("status", { name: "Sisa waktu" })).toBeNull()
  })
})
