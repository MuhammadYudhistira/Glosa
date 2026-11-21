import { describe, expect, it, vi } from "vitest"
import { type UpdateEnv, watchForUpdates } from "./pwa"

/** A stand-in service worker: its state changes are announced like the browser's. */
class FakeWorker extends EventTarget {
  state = "installing"
  postMessage = vi.fn()
  become(state: string) {
    this.state = state
    this.dispatchEvent(new Event("statechange"))
  }
}

class FakeRegistration extends EventTarget {
  waiting: FakeWorker | null = null
  installing: FakeWorker | null = null
  update = vi.fn(() => Promise.resolve())
  /** A new sw.js was found and installs. */
  find(worker: FakeWorker) {
    this.installing = worker
    this.dispatchEvent(new Event("updatefound"))
  }
  /** The new worker installed and waits for the page. */
  install(worker: FakeWorker) {
    this.installing = null
    this.waiting = worker
    worker.become("installed")
  }
}

function setup({
  controlled = true,
  waiting = null as FakeWorker | null,
} = {}) {
  const registration = new FakeRegistration()
  registration.waiting = waiting
  const container = Object.assign(new EventTarget(), {
    controller: controlled ? new FakeWorker() : null,
    register: vi.fn(() => Promise.resolve(registration)),
  })
  const page = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  })
  const reload = vi.fn()
  const env = { container, document: page, reload } as unknown as UpdateEnv
  return { registration, container, page, reload, env }
}

describe("watchForUpdates", () => {
  it("offers a new version once it has installed, and takes it when asked", async () => {
    const { registration, container, reload, env } = setup()
    const onReady = vi.fn()
    await watchForUpdates(env, onReady)
    const worker = new FakeWorker()
    registration.find(worker)
    expect(onReady).not.toHaveBeenCalled()
    registration.install(worker)
    expect(onReady).toHaveBeenCalledTimes(1)

    const apply = onReady.mock.calls[0][0] as () => void
    apply()
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" })
    expect(reload).not.toHaveBeenCalled()
    // The new worker took over: the page reloads into the new version, once.
    container.dispatchEvent(new Event("controllerchange"))
    container.dispatchEvent(new Event("controllerchange"))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("offers nothing on the first install: there is no older version", async () => {
    const { registration, env } = setup({ controlled: false })
    const onReady = vi.fn()
    await watchForUpdates(env, onReady)
    const worker = new FakeWorker()
    registration.find(worker)
    registration.install(worker)
    expect(onReady).not.toHaveBeenCalled()
  })

  it("takes a version already waiting as the app opens, without asking", async () => {
    const waiting = new FakeWorker()
    waiting.state = "installed"
    const { container, reload, env } = setup({ waiting })
    const onReady = vi.fn()
    await watchForUpdates(env, onReady)
    expect(onReady).not.toHaveBeenCalled()
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" })
    container.dispatchEvent(new Event("controllerchange"))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("looks for a new version whenever the app comes back into view", async () => {
    const { registration, page, env } = setup()
    await watchForUpdates(env, vi.fn())
    expect(registration.update).not.toHaveBeenCalled()
    page.visibilityState = "hidden"
    page.dispatchEvent(new Event("visibilitychange"))
    expect(registration.update).not.toHaveBeenCalled()
    page.visibilityState = "visible"
    page.dispatchEvent(new Event("visibilitychange"))
    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it("lets a failed check go by quietly (offline)", async () => {
    const { registration, page, env } = setup()
    registration.update.mockImplementation(() =>
      Promise.reject(new TypeError("Failed to fetch"))
    )
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    await watchForUpdates(env, vi.fn())
    page.dispatchEvent(new Event("visibilitychange"))
    // An unhandled rejection would fail the run.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(registration.update).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })
})
