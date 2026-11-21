/** What the update watch needs from the browser; tests pass stand-ins. */
export type UpdateEnv = {
  container: ServiceWorkerContainer
  document: Document
  reload: () => void
}

/**
 * Registers the service worker and watches for new versions. A new worker
 * waits until the page asks it to take over (pwa/sw.template.js): as the app
 * opens nothing is lost yet, so a version already waiting is taken at once;
 * later, `onReady` gets the function that takes it, for the member to choose
 * when. The page then reloads into the new version, once.
 */
export async function watchForUpdates(
  env: UpdateEnv,
  onReady: (apply: () => void) => void
): Promise<void> {
  const { container } = env
  const registration = await container.register("/sw.js")
  let reloading = false
  const take = (worker: ServiceWorker) => {
    container.addEventListener("controllerchange", () => {
      if (reloading) return
      reloading = true
      env.reload()
    })
    worker.postMessage({ type: "SKIP_WAITING" })
  }

  // Without a controller this is the first install: there is no older version.
  if (registration.waiting && container.controller) take(registration.waiting)

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing
    worker?.addEventListener("statechange", () => {
      if (worker.state !== "installed" || !container.controller) return
      onReady(() => take(worker))
    })
  })

  // An installed app can stay open for days: it looks for a new version each
  // time it comes back into view. Offline the check simply fails.
  env.document.addEventListener("visibilitychange", () => {
    if (env.document.visibilityState !== "visible") return
    registration.update().catch(() => undefined)
  })
}

/** Registers the offline service worker, which only exists in production builds. */
export function registerServiceWorker(
  onReady: (apply: () => void) => void
): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return
  watchForUpdates(
    {
      container: navigator.serviceWorker,
      document,
      reload: () => window.location.reload(),
    },
    onReady
  ).catch((error: unknown) =>
    console.error("service worker registration failed", error)
  )
}
