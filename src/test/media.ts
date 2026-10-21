/**
 * jsdom has no matchMedia. This stands in for "(min-width: 1024px)" (and any
 * other query), and lets a test cross the breakpoint.
 */
export function stubWideScreen(matches: boolean): {
  set: (next: boolean) => void
} {
  const state = { matches }
  const listeners = new Set<() => void>()
  const list = {
    get matches() {
      return state.matches
    },
    addEventListener: (_type: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      listeners.delete(listener),
  }
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => list,
  })
  return {
    set(next) {
      state.matches = next
      for (const listener of listeners) listener()
    },
  }
}

export function unstubWideScreen(): void {
  Reflect.deleteProperty(window, "matchMedia")
}
