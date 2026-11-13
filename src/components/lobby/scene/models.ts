import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { MODEL_DIR, MODELS, MODEL_KEYS, type ModelKey } from "./model-manifest"

export type ModelSet = {
  get: (key: ModelKey) => THREE.Group | null
  dispose: () => void
}

/** One download per file for the whole session; a failed download is forgotten. */
const cache = new Map<string, Promise<THREE.Group>>()

function fetchFile(file: string): Promise<THREE.Group> {
  let pending = cache.get(file)
  if (!pending) {
    pending = new GLTFLoader()
      .loadAsync(MODEL_DIR + file)
      .then((gltf) => gltf.scene)
    pending.catch(() => cache.delete(file))
    cache.set(file, pending)
  }
  return pending
}

/** Scales uniformly to `height`, centres on X/Z and puts the base on Y = 0. */
export function fitTo(object: THREE.Object3D, height: number): THREE.Object3D {
  object.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const scale = size.y > 0 ? height / size.y : 1
  object.scale.multiplyScalar(scale)
  object.updateMatrixWorld(true)
  const fitted = new THREE.Box3().setFromObject(object)
  const centre = fitted.getCenter(new THREE.Vector3())
  object.position.x -= centre.x
  object.position.z -= centre.z
  object.position.y -= fitted.min.y
  object.updateMatrixWorld(true)
  return object
}

/** Every model that has a file, or a rejection: the lobby then stays a still image. */
export async function loadModels(): Promise<ModelSet> {
  const files = [
    ...new Set(MODEL_KEYS.flatMap((key) => MODELS[key].file ?? [])),
  ]
  const loaded = new Map<string, THREE.Group>()
  await Promise.all(
    files.map(async (file) => loaded.set(file, await fetchFile(file)))
  )
  return {
    get(key) {
      const file = MODELS[key].file
      const source = file === null ? undefined : loaded.get(file)
      return source ? source.clone(true) : null
    },
    dispose() {
      // Nothing of its own to free. The clones share geometry and materials
      // with the cached sources, and stage.dispose() frees them on the GPU
      // through the clones. three uploads them again on their next use, so a
      // stage built after that (remount, StrictMode) still draws them.
    },
  }
}
