// Glosa's service worker (plan 1C, Task 11). scripts/build-sw.mjs copies this
// file to dist/client/sw.js and fills in the build version and the list of
// files to precache.

const VERSION = "__GLOSA_VERSION__"
const PRECACHE = __GLOSA_PRECACHE__

const APP_CACHE = `glosa-app-${VERSION}`
// Same name as COVER_CACHE in src/lib/local/keys.ts (cleared on sign-out).
const COVER_CACHE = "glosa-covers"
const SHELL = "/_shell.html"
const PRECACHED = new Set(PRECACHE)

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(PRECACHE))
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("glosa-app-") && key !== APP_CACHE) {
          await caches.delete(key)
        }
      }
      await self.clients.claim()
    })()
  )
})

/** Signed cover URLs from Supabase Storage (the token changes every hour). */
function isCover(url) {
  return (
    url.pathname.includes("/storage/v1/object/sign/books/") &&
    /-cover\.(?:webp|jpg)$/.test(url.pathname)
  )
}

async function cacheFirst(cacheName, key, request) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(key)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok || response.type === "opaque") {
    await cache.put(key, response.clone())
  }
  return response
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)

  if (request.mode === "navigate") {
    // Pages always come from the server, so no member page is ever cached.
    // Offline, the app shell takes over and the router renders the page in
    // the browser from this device's data.
    event.respondWith(
      fetch(request).catch(async () => {
        const shell = await caches.match(SHELL)
        return shell ?? Response.error()
      })
    )
    return
  }

  if (isCover(url)) {
    // Cached by path without the token, so a cover still shows when its
    // signed URL has changed or the device is offline.
    event.respondWith(
      cacheFirst(COVER_CACHE, new Request(url.origin + url.pathname), request)
    )
    return
  }

  if (url.origin === self.location.origin && PRECACHED.has(url.pathname)) {
    event.respondWith(
      caches.match(url.pathname).then((cached) => cached ?? fetch(request))
    )
  }
  // Everything else (server functions, EPUB downloads) goes to the network.
})
