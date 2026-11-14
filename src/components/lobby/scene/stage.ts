import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { OutputPass } from "three/addons/postprocessing/OutputPass.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js"
import type { HighlightColor } from "@/lib/annotations/types"
import type { PlantStage } from "@/lib/reading-habit"
import { SLOT_IDS } from "@/lib/shop/catalog"
import type { Placements } from "@/lib/shop/types"
import {
  type LightRig,
  type Mood,
  RIGS,
  daylight,
  mixRig,
  msUntilNextMood,
} from "./daylight"
import {
  type RoomChange,
  type RoomSnapshot,
  signalLevels,
} from "../room-memory"
import { NEUTRAL_SIGNALS, type RoomSignals } from "../room-signals"
import { ACTIVITY_OF, facingOf, seatOf } from "./activities"
import { DECOR_BUILDERS, buildDecor } from "./decor"
import { createFrameLoop, moving, viewMoved } from "./frame-loop"
import { type Glow, buildFurniture } from "./furniture"
import { createKit } from "./kit"
import {
  type HotspotId,
  type Point2,
  ROOM,
  type ShowcaseBook,
  decorBlockers,
  spotOf,
} from "./layout"
import { type ModelSet, loadModels } from "./models"
import { MOMENT_SECONDS, easeOut } from "./moment"
import { createMotion, endActivityOnPause } from "./motion"
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
import { MEASURE_MS, type Quality, nextQuality } from "./quality"
import { buildRoom } from "./room"
import { buildPlant } from "./plant"
import type { GenreHues } from "./shelf-books"
import { buildShelves } from "./shelves"
import { buildShowcase } from "./showcase"
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
  /** The light; by default the device clock's (spec 3F §3.4). */
  mood?: Mood
}

export type Stage = {
  /** How many books stand on the shelves (budget: 15,000). */
  books: number
  /** Moves the camera; the view is kept inside the map. */
  setView: (view: View) => void
  walkTo: (spot: Point2) => void
  /**
   * Anda does the hotspot's activity once the walk under way ends (spec 3F
   * §4A.1); resolves when it is done. Where the room does not move ("diam",
   * a still image, behind a popup): in the pose at once, resolved.
   */
  perform: (id: HotspotId) => Promise<void>
  /** Ends the walk and the activity at once (a second tap); perform's promise resolves. */
  skip: () => void
  /** Stops the animation behind a popup; it goes on from the same moment (spec 1F §4.5). */
  setPaused: (paused: boolean) => void
  /** The finished books in the display cabinet (spec Tahap 3 §4.5). */
  setShowcase: (books: ReadonlyArray<ShowcaseBook>) => void
  /** The habit plant's stage (spec 3B §4.1). */
  setPlant: (stage: PlantStage) => void
  /** The shop's items in their slots (spec 3C §6.3). */
  setDecor: (placed: Placements) => void
  /** The fire, the desk lamp and the parcel box show the member's reading (spec 3F §3.6). */
  setSignals: (signals: RoomSignals) => void
  /** The corkboard's papers, one per newest highlight (spec 3F §3.2). */
  setNotes: (colors: ReadonlyArray<HighlightColor>) => void
  /** The genre shelves' books, by cover colour, newest first (spec 3F §3.2). */
  setShelves: (hues: GenreHues) => void
  /** Day, dusk or night: blends over 3 seconds while animating, else at once. */
  setMood: (mood: Mood) => void
  /**
   * What changed since the member's last visit plays for about a second,
   * from the room as it was (spec 3F §4A.2). Where the room does not move
   * ("diam", a still image, behind a popup) it already shows how it is now.
   */
  playMoments: (from: RoomSnapshot, changes: ReadonlyArray<RoomChange>) => void
  dispose: () => void
}

const BLEND_SECONDS = 3

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

/**
 * The 3D study (spec 3F §3). Rejects when WebGL cannot be created or the
 * models do not load; the lobby then stays a still image.
 */
export async function createStage(options: StageOptions): Promise<Stage> {
  const { host, mode } = options
  const quality: Quality = mode === "test" ? "diam" : options.quality
  const fancy = mode !== "test"

  const renderer = new THREE.WebGLRenderer({ antialias: true })
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

  // A build that fails part-way must not leave the canvas and context behind.
  try {
    const models = await loadModels()
    return buildStage(options, renderer, quality, models)
  } catch (error) {
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
    throw error
  }
}

function buildStage(
  options: StageOptions,
  renderer: THREE.WebGLRenderer,
  initial: Quality,
  models: ModelSet
): Stage {
  const { host, mode } = options
  let quality = initial
  const fancy = mode !== "test"
  const canvas = renderer.domElement
  // The still image is drawn with everything the high tier has.
  const withLights = fancy && (mode === "still" || initial === "tinggi")

  const scene = new THREE.Scene()
  const background = new THREE.Color(mode === "test" ? "#ff00ff" : "#1b120c")
  scene.background = background

  // One sky light and one key light (the sun, or the moon at night) that
  // casts the shadows; the lamps and the fire add point lights (tinggi only).
  const hemi = new THREE.HemisphereLight("#fff1d6", "#8a6a4a", 0.6)
  scene.add(hemi)
  const centre = new THREE.Vector3(ROOM.width / 2, 0, ROOM.depth / 2)
  const key = new THREE.DirectionalLight("#fff0cf", 1.5)
  key.target.position.copy(centre)
  key.castShadow = fancy && (mode === "still" || initial === "tinggi")
  key.shadow.mapSize.set(2048, 2048)
  const shadowCamera = key.shadow.camera
  shadowCamera.left = -9
  shadowCamera.right = 9
  shadowCamera.top = 9
  shadowCamera.bottom = -9
  shadowCamera.near = 1
  shadowCamera.far = 80
  shadowCamera.updateProjectionMatrix()
  key.shadow.radius = 4
  key.shadow.bias = -0.0004
  key.shadow.normalBias = 0.02
  scene.add(key, key.target)

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType })
  )
  composer.addPass(new RenderPass(scene, camera))
  // A high threshold: only lamps, flames and lit windows bloom, not daylight.
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(256, 256),
    0.45,
    0.5,
    0.95
  )
  bloom.enabled = fancy && quality === "tinggi"
  composer.addPass(bloom)
  const output = new OutputPass()
  composer.addPass(output)

  // Frames run only while something changes (spec 3F §3.6: nothing moves
  // on its own). Made before the parts, whose onChange asks for a frame.
  const loop = createFrameLoop({
    step,
    draw: () => composer.render(),
    canRun: () => !document.hidden,
  })
  const requestRender = () => loop.invalidate()

  /** Frees what the scene and the passes hold; the caller frees the renderer. */
  function releaseScene() {
    disposeTree(scene)
    key.dispose()
    bloom.dispose()
    output.dispose()
    composer.dispose()
  }

  // A build that throws part-way frees what it made before createStage's
  // catch drops the context (the furniture's textures, merged geometry,
  // the bloom targets and the shadow map).
  const built = (() => {
    const parts: Array<{ dispose: () => void }> = []
    const keep = <T extends { dispose: () => void }>(part: T): T => {
      parts.push(part)
      return part
    }
    try {
      const kit = createKit(scene)
      const room = buildRoom(kit, models)
      return {
        room,
        skyline: buildSkyline(kit),
        furniture: buildFurniture(kit, models, withLights),
        shelves: keep(buildShelves(kit)),
        showcase: keep(buildShowcase(kit, models, () => requestRender())),
        plant: keep(buildPlant(kit, () => requestRender())),
        decor: keep(
          buildDecor(
            scene,
            models,
            () => requestRender(),
            // Shop items move briefly when placed (spec 3F §3.6), only
            // where the lobby moves at all and not behind a popup.
            () => animates() && !paused
          )
        ),
        people: buildPeople(kit, options.anda),
      }
    } catch (error) {
      for (const part of parts) part.dispose()
      releaseScene()
      throw error
    }
  })()
  const { room, skyline, furniture, shelves, showcase, plant, decor, people } =
    built
  const motion = createMotion(people)
  motion.update(0, 0)

  let signals: RoomSignals = NEUTRAL_SIGNALS
  /** The moment of change under way: the room it starts from, and how far it is (0..1). */
  let moment: {
    from: RoomSnapshot
    changes: ReadonlyArray<RoomChange>
    t: number
  } | null = null

  /** Sets every light to a rig (spec 3F §3.4) and the room to its signals (§3.6). */
  function applyRig(rig: LightRig) {
    if (mode !== "test") background.set(rig.background)
    hemi.color.set(rig.hemiSky)
    hemi.groundColor.set(rig.hemiGround)
    hemi.intensity = rig.hemi
    key.color.set(rig.sun)
    key.intensity = rig.sunIntensity
    key.position.set(
      centre.x + rig.sunPosition[0],
      centre.y + rig.sunPosition[1],
      centre.z + rig.sunPosition[2]
    )
    for (const lamp of furniture.lamps) lamp.intensity = rig.lamps * 1.6
    decor.setLamps(rig.lamps)
    // In a moment of change, what changed comes in from the last visit's room.
    const { fire, desk, lid } = signalLevels(
      signals,
      moment && { ...moment, k: easeOut(moment.t) }
    )
    furniture.fire.intensity = fire * 2
    if (furniture.deskLight) furniture.deskLight.intensity = desk * 1.6
    // How lit each kind of glow is: the fire and the desk lamp follow the
    // signals, the reading lamps the mood.
    const levels: Record<Glow["kind"], number> = {
      fire,
      desk,
      lamps: rig.lamps,
    }
    for (const { material, max, kind } of furniture.emissives) {
      const level = levels[kind]
      material.emissiveIntensity = max * level
      // An unlit flame or bulb is not drawn at all.
      material.visible = level > 0.02
    }
    for (const flame of furniture.flames) flame.scale.y = fire
    for (const flap of furniture.flaps) {
      flap.rotation.x = flap.userData.side * 1.9 * lid
    }
    skyline.setCity(rig.city)
    renderer.toneMappingExposure = rig.exposure
  }

  const firstMood = options.mood ?? daylight(new Date())
  let from = RIGS[firstMood]
  let to = from
  let current = from
  let blend = 1
  applyRig(current)

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

  let paused = false
  // The animation's own time: it moves only while frames run, so nothing
  // jumps after a pause, a hidden tab or an idle spell.
  let clock = performance.now() / 1000
  // The first seconds of each animated tier run frame after frame, so the
  // measured rate is the real one (an idle, stopped loop is never "slow").
  let measuring = animates()
  let measureStart = 0
  let measureFrames = 0
  /** Whether the controls moved the camera in their last update (before clamping). */
  let gliding = false

  function setQuality(next: Quality) {
    quality = next
    measuring = next !== "diam"
    renderer.setPixelRatio(pixelRatio(next, mode))
    bloom.enabled = fancy && next === "tinggi"
    controls.enableDamping = animates()
    // Shadows and point lights belong to the high tier (spec 3F §3.5).
    key.castShadow = fancy && next === "tinggi"
    for (const lamp of furniture.lamps) lamp.visible = next === "tinggi"
    furniture.fire.visible = next === "tinggi"
    if (furniture.deskLight) furniture.deskLight.visible = next === "tinggi"
    // The loop stops at "diam": "Anda" must not stay frozen mid-walk or
    // mid-activity, nor the light mid-blend.
    if (next === "diam") {
      motion.finishWalk()
      motion.skip()
      finishBlend()
      finishMoment()
      decor.rest()
    }
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

  /** One frame's change; true while something still moves (see Activity). */
  function step(now: number, dt: number): boolean {
    // Still, "diam" and behind a popup: a frame only shows what was set.
    if (!animates() || paused) return false
    clock += dt
    let relight = false
    if (blend < 1) {
      blend = Math.min(1, blend + dt / BLEND_SECONDS)
      current = mixRig(from, to, blend)
      relight = true
    }
    if (moment) {
      moment.t = Math.min(1, moment.t + dt / MOMENT_SECONDS)
      if (moment.t >= 1) moment = null
      relight = true
    }
    if (relight) applyRig(current)
    const growing = plant.update(dt)
    const arriving = showcase.update(dt)
    motion.update(clock, dt)
    gliding = false
    controls.update()
    const decorMoving = decor.update()
    measure(now)
    return moving({
      walking: motion.walking(),
      panning: gliding,
      blending: blend < 1,
      measuring,
      decor: decorMoving,
      acting: motion.acting(),
      moment: moment !== null || growing || arriving,
    })
  }

  /** Ends a moment of change at once: the room as it is now. */
  function finishMoment() {
    plant.rest()
    showcase.rest()
    if (!moment) return
    moment = null
    applyRig(current)
  }

  function finishBlend() {
    if (blend >= 1) return
    blend = 1
    current = to
    applyRig(current)
  }

  function setMood(next: Mood) {
    if (animates()) {
      from = current
      to = RIGS[next]
      blend = 0
    } else {
      from = RIGS[next]
      to = from
      blend = 1
      current = from
      applyRig(current)
    }
    requestRender()
  }

  /** At 05, 16 and 19 o'clock the light follows the clock (plan 3F-R1, decision 9). */
  function rollMood() {
    setMood(daylight(new Date()))
    moodTimer = setTimeout(rollMood, msUntilNextMood(new Date()))
  }

  /** After every pan or zoom: keep the view inside the map (spec 1D §3.1). */
  function onControlsChange() {
    const { x, y, z } = controls.target
    const wanted: View = { target: [x, y, z], zoom: camera.zoom }
    // Pushing against the map's edge still glides: the damping runs down.
    gliding = viewMoved(view, wanted)
    const next = clampView(wanted, viewport)
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
    measureStart = 0
    loop.resume()
  }
  const onContextLost = (event: Event) => {
    event.preventDefault()
    options.onLost()
  }

  frameCamera()
  resize()
  // Listeners last, so a build that throws leaves none behind.
  controls.addEventListener("change", onControlsChange)
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  document.addEventListener("visibilitychange", onVisibility)
  canvas.addEventListener("webglcontextlost", onContextLost)

  // The still image shows a sprout (plan 3B, decision 5).
  plant.set("tunas")
  // The clock's timer last of all: nothing after it can throw and leave it running.
  let moodTimer = setTimeout(rollMood, msUntilNextMood(new Date()))

  return {
    get books() {
      return shelves.count
    },
    setMood,
    setNotes(colors) {
      room.setNotes(colors)
      requestRender()
    },
    setShelves(hues) {
      shelves.set(hues)
      requestRender()
    },
    setSignals(next) {
      signals = next
      applyRig(current)
      requestRender()
    },
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
    perform(id) {
      // Where nothing moves, Anda is at the hotspot in the pose at once; the
      // walk there that the page asks for next then finds them in place.
      const instant = !animates() || paused
      if (instant) motion.walkTo(spotOf(id).stand, true)
      const done = motion.perform(ACTIVITY_OF[id], facingOf(id), seatOf(id))
      if (instant) motion.skip()
      // Wakes the loop: it runs until the activity is done (Activity.acting).
      requestRender()
      return done
    },
    skip() {
      motion.skip()
      requestRender()
    },
    playMoments(start, changes) {
      if (!animates() || paused || changes.length === 0) return
      moment = { from: start, changes: [...changes], t: 0 }
      applyRig(current)
      if (changes.includes("plant")) plant.grow()
      if (changes.includes("showcase")) showcase.arrive()
      // Wakes the loop: it runs until the moment is over (Activity.moment).
      requestRender()
    },
    setPlant(stage) {
      plant.set(stage)
    },
    setDecor(placed) {
      decor.set(placed)
      // Anda walks around the placed items that stand on the floor.
      const filled = SLOT_IDS.filter((slot) => {
        const id = placed[slot]
        return id !== undefined && Object.hasOwn(DECOR_BUILDERS, id)
      })
      motion.setExtraBlockers(decorBlockers(filled))
      requestRender()
    },
    setShowcase(list) {
      showcase.set(list)
    },
    setPaused(next) {
      if (next === paused) return
      paused = next
      // The time spent paused does not count (the loop stopped), and the
      // speed check starts over. An activity under way ends in its pose
      // (its page must not wait behind the popup); a plain walk goes on
      // after it.
      measureStart = 0
      endActivityOnPause(next, motion)
      // A moment behind the popup would go by unseen: the room as it is now.
      if (next) finishMoment()
      requestRender()
    },
    dispose() {
      // No promise may be left waiting on a stage that is gone.
      motion.skip()
      loop.dispose()
      clearTimeout(moodTimer)
      observer.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
      canvas.removeEventListener("webglcontextlost", onContextLost)
      controls.removeEventListener("change", onControlsChange)
      controls.dispose()
      shelves.dispose()
      showcase.dispose()
      plant.dispose()
      decor.dispose()
      releaseScene()
      models.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
