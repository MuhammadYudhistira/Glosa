import { useEffect, useState } from "react"

/** Input types that do not open a keyboard. */
const NO_KEYBOARD = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
])

/** Whether focusing this element opens the phone's keyboard. */
export function isTypingTarget(element: Element | null): boolean {
  if (!element) return false
  if (element instanceof HTMLTextAreaElement) return true
  if (element instanceof HTMLInputElement) return !NO_KEYBOARD.has(element.type)
  return (
    element instanceof HTMLElement &&
    // jsdom has no isContentEditable, so read the attribute too.
    (element.isContentEditable === true ||
      element.getAttribute("contenteditable") === "true")
  )
}

/** True while a field that opens the keyboard has the focus (spec poles mobile §4.5). */
export function useTyping(): boolean {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) =>
      setTyping(isTypingTarget(event.target as Element | null))
    // The element that gets the focus next, or nothing.
    const onFocusOut = (event: FocusEvent) =>
      setTyping(isTypingTarget(event.relatedTarget as Element | null))
    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("focusout", onFocusOut)
    return () => {
      document.removeEventListener("focusin", onFocusIn)
      document.removeEventListener("focusout", onFocusOut)
    }
  }, [])
  return typing
}
