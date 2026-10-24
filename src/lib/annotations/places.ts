import { collapse, compare } from "foliate-js/epubcfi.js"

/** Where the page shown begins: a bookmark's place (plan 2B, decision 16). */
export function pageStart(pageCfi: string): string {
  return collapse(pageCfi)
}

/** Whether a place is on the page shown: from its start, up to (not at) its end. */
export function onPage(cfi: string, pageCfi: string): boolean {
  const start = collapse(pageCfi)
  const end = collapse(pageCfi, true)
  if (compare(start, end) === 0) return compare(cfi, start) === 0
  return compare(cfi, start) >= 0 && compare(cfi, end) < 0
}

/** Annotations in the order they come in the book (spec 2 §6.6). */
export function inBookOrder<T extends { cfi: string }>(
  items: ReadonlyArray<T>
): Array<T> {
  return [...items].sort((a, b) => compare(a.cfi, b.cfi))
}
