import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { isTypingTarget, useTyping } from "./use-typing"

afterEach(() => {
  document.body.innerHTML = ""
})

describe("isTypingTarget", () => {
  it("is a field that opens the keyboard", () => {
    const make = (html: string) => {
      document.body.innerHTML = html
      return document.body.firstElementChild
    }
    expect(isTypingTarget(make('<input type="text">'))).toBe(true)
    expect(isTypingTarget(make('<input type="search">'))).toBe(true)
    expect(isTypingTarget(make("<input>"))).toBe(true)
    expect(isTypingTarget(make("<textarea></textarea>"))).toBe(true)
    expect(isTypingTarget(make('<div contenteditable="true"></div>'))).toBe(
      true
    )
    expect(isTypingTarget(make('<input type="checkbox">'))).toBe(false)
    expect(isTypingTarget(make("<select></select>"))).toBe(false)
    expect(isTypingTarget(make("<button></button>"))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe("useTyping", () => {
  it("follows the focus into and out of a text field", () => {
    document.body.innerHTML = '<input type="text"><button>ok</button>'
    const input = document.querySelector("input")!
    const button = document.querySelector("button")!
    const { result } = renderHook(() => useTyping())
    expect(result.current).toBe(false)
    act(() => input.focus())
    expect(result.current).toBe(true)
    act(() => button.focus())
    expect(result.current).toBe(false)
  })
})
