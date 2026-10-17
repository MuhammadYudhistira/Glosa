import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { OutputPass } from "three/addons/postprocessing/OutputPass.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js"
import { buildFurniture } from "./furniture"
import { createKit } from "./kit"
import { type Point2, SHELF_FACES } from "./layout"
import { createMotion } from "./motion"
import { buildPeople } from "./people"
import {
  CAMERA_OFFSET,
  MAX_ZOOM,
  MIN_ZOOM,
  type View,
  type Viewport,
  baseHalfHeight,
  clampView,
} from "./projection"
import { MEASURE_MS, type Quality, nextQuality, walkerShare } from "./quality"
import { buildRoom } from "./room"
import { buildShelves } from "./shelves"
import { buildSkyline } from "./skyline"

/**
 * normal: the lobby. still: the poster image (high-tier look, one frame).
 * test: the E2E camera-bounds check (still, no shadows or bloom, magenta void).
 */
export type StageMode = "normal" | "still" | "test"

export type StageOptions = {
  /** The element the canvas fills; its size is the viewport. */
  host: HTMLElement
  quality: Quality
  mode: StageMode
  view: View
  anda: Point2
  onView: (view: View, viewport: Viewport) => void
  onQuality: (quality: Quality) => void
  /** The WebGL context was lost: the lobby falls back to the still image. */
  onLost: () => void
}

export type Stage = {
  /** How many books stand on the shelves (budget: 15,000). */
  books: number
  /** Moves the camera; the view is kept inside the map. */
  setView: (view: View) => void
  walkTo: (spot: Point2) => void
  dispose: () => void
}

function pixelRatio(quality: Quality, mode: StageMode): number {
  return mode === "normal" && quality === "tinggi"
    ? Math.min(window.devicePixelRatio, 2)
    : 1
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    const materials: Array<THREE.Material> = Array.isArray(object.material)
      ? object.material
      : [object.material]
    for (const material of materials) {
      for (const value of Object.values(material) as Array<unknown>) {
        if (value instanceof THREE.Texture) value.dispose()
      }
      material.dispose()
    }
    if (object instanceof THREE.InstancedMesh) object.dispose()
  })
}

/** The 3D lobby (spec 1D §3.1). Throws when WebGL cannot be created. */
export function createStage(options: StageOptions): Stage {
  const { host, mode } = options
  let quality: Quality = mode === "test" ? "diam" : options.quality
  const fancy = mode !== "test"

  const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true })
  renderer.setPixelRatio(pixelRatio(quality, mode))
  renderer.shadowMap.enabled = fancy
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.82
  const canvas = renderer.domElement
  canvas.className = "lobby-canvas"
  canvas.setAttribute("aria-hidden", "true")
  host.append(canvas)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(mode === "test" ? "#ff00ff" : "#1b120c")
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04).texture
  scene.environment = environment
  disposeTree(room)
  pmrem.dispose()

  // Warm atrium light and one soft key light that casts the shadows.
  scene.add(new THREE.HemisphereLight("#ffe9cc", "#4a2e18", 0.55))
  const key = new THREE.DirectionalLight("#ffe6c4", 1.25)
  key.position.set(22, 30, 34)
  key.target.position.set(14, 0, 14)
  key.castShadow = fancy
  const shadowSize = quality === "tinggi" ? 2048 : 1024
  key.shadow.mapSize.set(shadowSize, shadowSize)
  const shadowCamera = key.shadow.camera
  shadowCamera.left = -24
  shadowCamera.right = 24
  shadowCamera.top = 24
  shadowCamera.bottom = -24
  shadowCamera.far = 100
  shadowCamera.updateProjectionMatrix()
  key.shadow.radius = 5
  key.shadow.bias = -0.0005
  scene.add(key, key.target)

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
  // A stencil buffer, so the skyline stays inside the glass.
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      stencilBuffer: true,
    })
  )
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(256, 256),
    0.35,
    0.45,
    0.9
  )
  bloom.enabled = fancy && quality === "tinggi"
  composer.addPass(bloom)
  const output = new OutputPass()
  composer.addPass(output)

  const kit = createKit(scene)
  const { stairSeats } = buildRoom(kit)
  const skyline = buildSkyline(kit)
  const books = buildShelves(kit, SHELF_FACES)
  const furniture = buildFurniture(kit)
  const people = buildPeople(
    kit,
    { stairs: stairSeats, lounges: furniture.loungeSeats },
    options.anda
  )
  const motion = createMotion(people, furniture, skyline)
  motion.showWalkers(walkerShare(quality))
  motion.update(0, 0)

  const animates = () => mode === "normal" && quality !== "diam"

  const controls = new OrbitControls(camera, canvas)
  controls.enableRotate = false
  controls.screenSpacePanning = true
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  }
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }
  controls.minZoom = MIN_ZOOM
  controls.maxZoom = MAX_ZOOM
  controls.enableDamping = animates()

  let viewport: Viewport = {
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
  }
  let view = clampView(options.view, viewport)

  function placeCamera() {
    camera.position.set(
      view.target[0] + CAMERA_OFFSET[0],
      view.target[1] + CAMERA_OFFSET[1],
      view.target[2] + CAMERA_OFFSET[2]
    )
    controls.target.set(...view.target)
  }

  function frameCamera() {
    const aspect = viewport.width / viewport.height
    const halfHeight = baseHalfHeight(aspect)
    camera.left = -halfHeight * aspect
    camera.right = halfHeight * aspect
    camera.top = halfHeight
    camera.bottom = -halfHeight
    camera.zoom = view.zoom
    camera.updateProjectionMatrix()
    placeCamera()
    camera.lookAt(controls.target)
  }

  let frame = 0
  let disposed = false
  let needsRender = true
  let last = performance.now()
  let measuring = animates()
  let measureStart = 0
  let measureFrames = 0

  function draw() {
    composer.render()
    needsRender = false
  }
  function schedule() {
    if (frame === 0 && !disposed && !document.hidden) {
      frame = requestAnimationFrame(tick)
    }
  }
  function requestRender() {
    needsRender = true
    schedule()
  }

  function setQuality(next: Quality) {
    quality = next
    measuring = next !== "diam"
    renderer.setPixelRatio(pixelRatio(next, mode))
    bloom.enabled = fancy && next === "tinggi"
    controls.enableDamping = animates()
    motion.showWalkers(walkerShare(next))
    resize()
    options.onQuality(next)
  }

  /** Steps down a tier when its first seconds run too slowly. */
  function measure(now: number) {
    if (!measuring) return
    if (measureStart === 0) {
      measureStart = now
      measureFrames = 0
      return
    }
    measureFrames += 1
    const elapsed = now - measureStart
    if (elapsed < MEASURE_MS) return
    measureStart = 0
    const next = nextQuality(quality, (measureFrames * 1000) / elapsed)
    if (next === quality) measuring = false
    else setQuality(next)
  }

  function tick(now: number) {
    frame = 0
    if (disposed || document.hidden) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (animates()) {
      motion.update(now / 1000, dt)
      controls.update()
      draw()
      measure(now)
      schedule()
    } else if (needsRender) {
      draw()
    }
  }

  /** After every pan or zoom: keep the view inside the map (spec 1D §3.1). */
  function onControlsChange() {
    const { x, y, z } = controls.target
    const next = clampView({ target: [x, y, z], zoom: camera.zoom }, viewport)
    const same =
      Math.abs(next.zoom - view.zoom) < 1e-9 &&
      next.target.every((value, i) => Math.abs(value - view.target[i]) < 1e-9)
    if (next.zoom !== camera.zoom) {
      camera.zoom = next.zoom
      camera.updateProjectionMatrix()
    }
    view = next
    placeCamera()
    // OrbitControls fires "change" on every update of an orthographic camera;
    // an unchanged view is already on screen.
    if (same) return
    options.onView(view, viewport)
    requestRender()
  }

  function resize() {
    const width = host.clientWidth
    const height = host.clientHeight
    if (width === 0 || height === 0) return
    viewport = { width, height }
    renderer.setSize(width, height)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(width, height)
    view = clampView(view, viewport)
    frameCamera()
    options.onView(view, viewport)
    requestRender()
  }

  const onVisibility = () => {
    if (document.hidden) return
    last = performance.now()
    measureStart = 0
    requestRender()
  }
  const onContextLost = (event: Event) => {
    event.preventDefault()
    options.onLost()
  }

  controls.addEventListener("change", onControlsChange)
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  document.addEventListener("visibilitychange", onVisibility)
  canvas.addEventListener("webglcontextlost", onContextLost)
  frameCamera()
  resize()

  return {
    books,
    setView(next) {
      view = clampView(next, viewport)
      frameCamera()
      options.onView(view, viewport)
      requestRender()
    },
    walkTo(spot) {
      motion.walkTo(spot, !animates())
      requestRender()
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
      canvas.removeEventListener("webglcontextlost", onContextLost)
      controls.removeEventListener("change", onControlsChange)
      controls.dispose()
      disposeTree(scene)
      environment.dispose()
      bloom.dispose()
      output.dispose()
      composer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
