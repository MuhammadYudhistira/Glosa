/** Registers the offline service worker, which only exists in production builds. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return
  navigator.serviceWorker
    .register("/sw.js")
    .catch((error: unknown) =>
      console.error("service worker registration failed", error)
    )
}
