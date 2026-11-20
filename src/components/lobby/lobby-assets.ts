// Lobby images and models, imported through Vite so every URL carries a hash
// of the file's content (like /assets/*). Files under public/ keep their names,
// and the service worker serves them cache-first by path, so a changed file
// would stay stale after a deploy. `?no-inline` keeps them real files even when
// small: the glTF loader and the service worker precache need URLs, not data:
// URIs.
const stills = import.meta.glob<string>(
  "/src/assets/lobby/still/*.{avif,webp}",
  {
    eager: true,
    query: "?no-inline",
    import: "default",
  }
)

const thumbs = import.meta.glob<string>("/src/assets/lobby/shop/*.webp", {
  eager: true,
  query: "?no-inline",
  import: "default",
})

const models = import.meta.glob<string>("/src/assets/lobby/models/*.glb", {
  eager: true,
  query: "?no-inline",
  import: "default",
})

function pick(
  all: Record<string, string | undefined>,
  dir: string,
  file: string
): string {
  const url = all[`/src/assets/lobby/${dir}/${file}`]
  if (url === undefined) throw new Error(`Missing lobby asset: ${dir}/${file}`)
  return url
}

/** `name` is e.g. "lobby-still-1280.avif" or "lobby-still.webp". */
export const stillUrl = (name: string) => pick(stills, "still", name)

/** Shop thumbnail of a shop item id; undefined for an unknown id. */
export const shopThumbUrl = (id: string): string | undefined =>
  thumbs[`/src/assets/lobby/shop/${id}.webp`]

/** `file` is a model file name from the manifest, e.g. "armchair.glb". */
export const modelUrl = (file: string) => pick(models, "models", file)
