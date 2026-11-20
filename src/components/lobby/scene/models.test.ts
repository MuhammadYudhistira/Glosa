import * as THREE from "three"
import { beforeEach, describe, expect, it, vi } from "vitest"

const loadAsync = vi.fn()
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    loadAsync = loadAsync
  },
}))
vi.mock("@/components/lobby/lobby-assets", () => ({
  modelUrl: (file: string) => `/m/${file}`,
}))
vi.mock("./model-manifest", () => ({
  MODEL_KEYS: ["a", "b", "c"],
  MODELS: {
    a: { file: "a.glb", source: "kaykit", credit: "" },
    b: { file: "a.glb", source: "kaykit", credit: "" },
    c: { file: null, source: "code", credit: "" },
  },
}))

const crate = () => {
  const scene = new THREE.Group()
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2)))
  return { scene }
}

describe("fitTo", () => {
  it("scales to the height and stands the object on the floor, centred", async () => {
    const { fitTo } = await import("./models")
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2))
    mesh.position.set(5, 7, 5)
    const group = new THREE.Group()
    group.add(mesh)
    fitTo(group, 2)
    const box = new THREE.Box3().setFromObject(group)
    expect(box.max.y - box.min.y).toBeCloseTo(2)
    expect(box.min.y).toBeCloseTo(0)
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0)
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0)
  })
})

describe("loadModels", () => {
  beforeEach(() => {
    vi.resetModules()
    loadAsync.mockReset()
  })

  it("loads each file once and hands out clones; null for code models", async () => {
    loadAsync.mockResolvedValue(crate())
    const { loadModels } = await import("./models")
    const set = await loadModels()
    expect(loadAsync).toHaveBeenCalledTimes(1)
    expect(loadAsync).toHaveBeenCalledWith("/m/a.glb")
    const first = set.get("a" as never)
    expect(first).not.toBeNull()
    expect(set.get("a" as never)).not.toBe(first)
    expect(set.get("c" as never)).toBeNull()
    await loadModels()
    expect(loadAsync).toHaveBeenCalledTimes(1)
  })

  it("rejects when any model fails, and tries again next time", async () => {
    loadAsync.mockRejectedValueOnce(new Error("404"))
    const { loadModels } = await import("./models")
    await expect(loadModels()).rejects.toThrow("404")
    loadAsync.mockResolvedValue(crate())
    await expect(loadModels()).resolves.toBeDefined()
  })
})
