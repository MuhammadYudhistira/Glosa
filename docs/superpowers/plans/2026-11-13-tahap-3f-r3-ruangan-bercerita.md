# Glosa Tahap 3F-R3 — Ruangan yang bercerita: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setiap ketukan hotspot menjadi satu adegan kecil (Anda berjalan lalu melakukan kegiatannya sebelum popup terbuka), ruangan memutar perubahan sejak kunjungan terakhir, dan papan gabus membuka halaman Sorotan & catatan.

**Architecture:**
- **Data kegiatan murni** di `scene/activities.ts`: hotspot → kegiatan, pose sendi per kegiatan, kecepatan jalan berbatas waktu. Diuji tanpa WebGL.
- **Stage menjalankan kegiatan** lewat `perform(id): Promise<void>` dan `skip()`. Janji selesai saat pose selesai, atau seketika di kualitas `diam` (termasuk `prefers-reduced-motion`, yang sudah memaksa `diam`), mode diam, dan saat adegan 3D belum hidup. `LobbyStage.activate` menunggu janji itu sebelum membuka popup atau halaman.
- **Momen perubahan** dari fungsi murni `changesSince(prev, next)` atas cuplikan ruangan yang disimpan di perangkat; stage memutarnya sekali lewat `playMoments`.
- **`/highlights`** adalah popup di atas lobi seperti `/recap`, memakai `listHighlightsFn` (R1 Task 4C) dan `QuoteCardDialog` yang sudah ada.

**Tech Stack:** TanStack Start + Router, React 19, TypeScript, Tailwind CSS 4, three.js, Vitest + Testing Library, Playwright.

**Spec:** [`docs/superpowers/specs/2026-11-07-tahap-3f-ruang-baca-pribadi-design.md`](../specs/2026-11-07-tahap-3f-ruang-baca-pribadi-design.md) keputusan 10–11, §3.6, §4A, §7. Dikerjakan **setelah R1 dan R2** ([R1](2026-11-07-tahap-3f-r1-ruang-studi.md), [R2](2026-11-07-tahap-3f-r2-bahasa.md)); teks UI baru memakai kata-kata R2 ("Ruang baca", dan seterusnya).

## Global Constraints

- **Bahasa:** teks UI berbahasa Indonesia, komentar kode berbahasa Inggris. Array ditulis `Array<T>`. Tidak ada kata "gagal" di teks UI baru.
- **Dependensi:** tidak ada dependensi npm baru.
- **Waktu (persis dari spec §4A.1):** berjalan paling lama **±0,9 detik** (kecepatan menyesuaikan panjang jalur), kegiatan **±0,6 detik**, total paling lama **±1,5 detik**. Momen perubahan **±1 detik**, dimainkan sekali.
- **Tanpa animasi** (pose atau keadaan akhir langsung): kualitas `diam` (termasuk `prefers-reduced-motion`), mode diam/gambar diam, aktivasi lewat keyboard, kunjungan pertama di perangkat (untuk momen perubahan).
- **Ketuk lagi** selama berjalan atau berkegiatan → popup langsung terbuka.
- **Prinsip spec §3.6:** tidak ada animasi baru selain kegiatan Anda dan momen perubahan. Benda bantu kegiatan (kaleng siram, buku di tangan) hanya tampil selama kegiatan.
- **Tetap:** URL lama, nama tabel/fungsi, ID hotspot, data. Tidak ada tabel atau kolom baru; `/highlights` hanya membaca `annotations`.
- **Route tree:** jangan pakai `npm run generate-routes` (menghapus blok `Register`). Route `/highlights` ditambahkan ke `src/routeTree.gen.ts` dengan menyalin setiap kemunculan `recap` (`MemberLobiRecapRouteImport`, `MemberLobiRecapRoute`, `'/recap'`, `'/_member/_lobi/recap'`) dan mengganti namanya menjadi `Highlights` / `/highlights`; `git diff` berkas itu hanya menambah baris `highlights`.
- **Line ending dan encoding:** LF, UTF-8.
- **CI** menjalankan `npm run check` (prettier): `npx prettier --write` pada file yang disentuh sebelum commit.
- **Tes unit:** `npx vitest run --maxWorkers=2` dari PowerShell (di Git Bash Vitest bisa salah lapor "failed to find the current suite"). **E2E:** `--workers=2`; cek port 3000 dulu (`curl -sL localhost:3000/login | grep -o "<title>[^<]*"`), bila dipegang aplikasi lain pakai config sementara di port 3100 lalu hapus.
- **Tidak ada push ke GitHub.** Commit lokal; pesan commit diakhiri baris `Co-Authored-By` dari pengingat atribusi sesi yang berlaku.

## Keputusan dan penyimpangan dari spec

1. **Jalan + kegiatan dimulai dari hotspot, bukan dari prop `anda`.** Sekarang `LobbyStage.activate` memanggil `moveAnda(stand)` dan `LobbyCanvas` meneruskan prop `anda` ke `stage.walkTo`. R3 mempertahankan alur itu (posisi Anda tetap tersimpan per sesi lewat `useAndaSpot`) dan menambah `stage.perform(id)`, yang menunggu jalan yang sedang berlangsung selesai lalu memutar pose. Dengan begitu tidak ada dua sumber gerak.
2. **Kecepatan jalan:** `walkSpeed(length) = max(1.4, length / 0.9)` m/s; jalur pendek tetap berjalan wajar, jalur panjang dipercepat supaya selesai dalam 0,9 detik.
3. **Keyboard dikenali dari `event.detail === 0`** pada `click` tombol hotspot (klik dari Enter/Spasi). `HotspotLayer` meneruskan `{ keyboard }` ke `onActivate`.
4. **Momen perubahan ditunda sampai semua data siap:** kebiasaan baca `ready`, total pertemuan bukan `null`, sorotan selesai dimuat atau offline, dan adegan 3D hidup. Sebelum itu tidak ada cuplikan yang disimpan, supaya data yang belum termuat (mis. api "bara" karena `days` kosong) tidak dianggap perubahan.
5. **Tanaman dan lemari** memutar momen lewat fungsi kecil di modulnya (`plant.grow()`, `showcase.arrive()`), bukan dengan mengganti tanda tangan `setPlant`/`setShowcase` yang dipakai React.
6. **`/highlights` membatasi ke 500 sorotan terbaru** (`MAX_HIGHLIGHTS`, R1 Task 4C), dengan baris kecil "Menampilkan 500 sorotan terbaru." bila tepat 500 yang kembali. Tanpa halaman berikutnya (YAGNI).

## Struktur file

| File | Tanggung jawab |
|---|---|
| `src/components/lobby/scene/activities.ts` (+ `.test.ts`) | Murni: `ActivityId`, `ACTIVITY_OF`, `FACING`, `POSES`, `poseAt`, `walkSpeed`, waktu (Task 1) |
| `src/components/lobby/scene/people.ts`, `motion.ts`, `props.ts` | Sendi `torso`, pose, benda bantu, `perform`/`skip` (Task 2) |
| `src/components/lobby/scene/stage.ts`, `src/components/lobby/{LobbyScene,LobbyStage,HotspotLayer}.tsx` (+ tes) | `perform` dari React, keyboard, ketuk ulang (Task 2) |
| `src/components/lobby/room-memory.ts` (+ `.test.ts`), `src/lib/local/keys.ts` | Murni: cuplikan ruangan, `changesSince`, simpan di perangkat (Task 3) |
| `src/components/lobby/scene/plant.ts`, `showcase.ts`, `stage.ts` | `playMoments` (Task 3) |
| `src/routes/_member/_lobi/highlights.tsx`, `src/components/lobby/HighlightsPanel.tsx` (+ tes), `src/lib/annotations/highlights.ts` (+ tes), `src/components/lobby/LobbyPopup.tsx`, `CorkboardPanel.tsx`, `src/routeTree.gen.ts` | Halaman Sorotan & catatan (Task 4) |
| `e2e/lobby.spec.ts`, `e2e/highlights.spec.ts` | E2E (Task 5) |

---

### Task 1: Data kegiatan dan pose (murni)

**Files:**
- Create: `src/components/lobby/scene/activities.ts`, `activities.test.ts`

**Interfaces:**
- Consumes: `HotspotId`, `HOTSPOT_SPOTS`, `Point2`, `FURNITURE`, `ROOM_PARTS`, `PLANT`, `SHOWCASE`, `WALL_SECTIONS` (`layout.ts`, R1).
- Produces:
  ```ts
  export type ActivityId =
    | "duduk-baca" | "ambil-buku" | "bungkuk" | "menulis" | "mengetik" | "buka-lemari"
    | "menyiram" | "buka-katalog" | "hangatkan" | "lihat-papan" | "pegang-pintu"
  export const WALK_SPEED = 1.4          // m/s
  export const WALK_MAX_SECONDS = 0.9
  export const ACTIVITY_SECONDS = 0.6
  export function walkSpeed(length: number): number
  export const ACTIVITY_OF: Record<HotspotId, ActivityId>
  /** The point Anda faces while doing it (the object), world x/z. */
  export function facingOf(id: HotspotId): Point2
  /** Joint angles in radians; `drop`: how far the body sinks (m), for sitting and crouching. */
  export type Pose = {
    drop: number
    lean: number                       // torso pitch, forward positive
    head: number                       // head pitch, down positive
    arms: readonly [number, number]    // shoulder pitch left/right, forward-up positive
    hips: readonly [number, number]    // hip pitch left/right, forward positive
    knees: readonly [number, number]   // knee bend left/right, positive
  }
  export const STAND: Pose
  export const POSES: Record<ActivityId, Pose>
  /** Eased blend from STAND to the activity's pose; t in 0..1. */
  export function poseAt(activity: ActivityId, t: number): Pose
  /** What Anda holds during the activity, or null. */
  export const HELD: Partial<Record<ActivityId, "buku" | "kaleng" | "katalog">>
  ```

- [ ] **Step 1: Tes (gagal dulu)**

```ts
import { describe, expect, it } from "vitest"
import { GENRE_VALUES } from "@/lib/genre"
import {
  ACTIVITY_OF, ACTIVITY_SECONDS, POSES, STAND, WALK_MAX_SECONDS, WALK_SPEED,
  facingOf, poseAt, walkSpeed,
} from "./activities"
import { HOTSPOT_SPOTS, ROOM } from "./layout"

describe("activities", () => {
  it("gives every hotspot an activity (spec 3F §4A.1)", () => {
    for (const { id } of HOTSPOT_SPOTS) expect(ACTIVITY_OF[id], id).toBeDefined()
    for (const genre of GENRE_VALUES) expect(ACTIVITY_OF[genre]).toBe("ambil-buku")
    expect(ACTIVITY_OF["meja-baca"]).toBe("duduk-baca")
    expect(ACTIVITY_OF.tanaman).toBe("menyiram")
    expect(ACTIVITY_OF.perapian).toBe("hangatkan")
    expect(ACTIVITY_OF.papan).toBe("lihat-papan")
    expect(ACTIVITY_OF.pintu).toBe("pegang-pintu")
  })

  it("faces a point inside the room, away from where Anda stands", () => {
    for (const { id, stand } of HOTSPOT_SPOTS) {
      const [x, z] = facingOf(id)
      expect(x, id).toBeGreaterThanOrEqual(0)
      expect(x, id).toBeLessThanOrEqual(ROOM.width)
      expect(z, id).toBeGreaterThanOrEqual(0)
      expect(z, id).toBeLessThanOrEqual(ROOM.depth)
      expect(Math.hypot(x - stand[0], z - stand[1]), id).toBeGreaterThan(0.2)
    }
  })

  it("walks at least at 1.4 m/s and never longer than 0.9 s", () => {
    expect(walkSpeed(0.5)).toBe(WALK_SPEED)
    expect(walkSpeed(9) * WALK_MAX_SECONDS).toBeCloseTo(9)
    for (const length of [0.1, 1, 3, 12]) {
      expect(length / walkSpeed(length)).toBeLessThanOrEqual(WALK_MAX_SECONDS + 1e-9)
    }
    expect(WALK_MAX_SECONDS + ACTIVITY_SECONDS).toBeLessThanOrEqual(1.5)
  })

  it("blends from standing to the pose", () => {
    expect(poseAt("menyiram", 0)).toEqual(STAND)
    expect(poseAt("menyiram", 1)).toEqual(POSES.menyiram)
    const half = poseAt("duduk-baca", 0.5)
    expect(half.drop).toBeGreaterThan(0)
    expect(half.drop).toBeLessThan(POSES["duduk-baca"].drop)
    expect(poseAt("duduk-baca", 2)).toEqual(POSES["duduk-baca"])
  })

  it("sits lower than it crouches, and stands for the door", () => {
    expect(POSES["duduk-baca"].drop).toBeGreaterThan(0.3)
    expect(POSES.hangatkan.drop).toBeGreaterThan(0.2)
    expect(POSES["pegang-pintu"].drop).toBe(0)
  })
})
```
Run `npx vitest run src/components/lobby/scene/activities.test.ts` → FAIL.

- [ ] **Step 2: Implementasi**

```ts
import type { Genre } from "@/lib/genre"
import { GENRE_VALUES } from "@/lib/genre"
import {
  FURNITURE, type HotspotId, PLANT, type Point2, ROOM_PARTS, SHOWCASE, WALL_SECTIONS,
} from "./layout"

export type ActivityId =
  | "duduk-baca" | "ambil-buku" | "bungkuk" | "menulis" | "mengetik" | "buka-lemari"
  | "menyiram" | "buka-katalog" | "hangatkan" | "lihat-papan" | "pegang-pintu"

export const WALK_SPEED = 1.4
export const WALK_MAX_SECONDS = 0.9
export const ACTIVITY_SECONDS = 0.6

/** Long paths speed up so the walk ends within 0.9 s (spec 3F §4A.1). */
export function walkSpeed(length: number): number {
  return Math.max(WALK_SPEED, length / WALK_MAX_SECONDS)
}

const GENRES = Object.fromEntries(
  GENRE_VALUES.map((genre) => [genre, "ambil-buku"])
) as Record<Genre, ActivityId>

export const ACTIVITY_OF: Record<HotspotId, ActivityId> = {
  ...GENRES,
  "meja-baca": "duduk-baca",
  troli: "bungkuk",
  katalog: "menulis",
  "meja-admin": "mengetik",
  lemari: "buka-lemari",
  tanaman: "menyiram",
  toko: "buka-katalog",
  perapian: "hangatkan",
  papan: "lihat-papan",
  pintu: "pegang-pintu",
}

const at = (id: string): Point2 => {
  const piece = FURNITURE.find((f) => f.id === id)
  if (!piece) throw new Error(`No furniture ${id}`)
  return piece.at
}

export function facingOf(id: HotspotId): Point2 {
  switch (id) {
    case "meja-baca": return at("armchair")
    case "troli": return at("parcelBox")
    case "katalog": return at("notebook")
    case "meja-admin": return at("laptop")
    case "lemari": return SHOWCASE
    case "tanaman": return PLANT
    case "toko": return at("catalogue")
    case "perapian": return at("fireplace")
    case "papan": return [ROOM_PARTS.corkboard.x, 0]
    case "pintu": return [0, ROOM_PARTS.door.z]
    default: {
      const section = WALL_SECTIONS.find(({ genre }) => genre === id)
      if (!section) throw new Error(`No section ${id}`)
      return [0, section.z]
    }
  }
}

export type Pose = {
  drop: number
  lean: number
  head: number
  arms: readonly [number, number]
  hips: readonly [number, number]
  knees: readonly [number, number]
}

export const STAND: Pose = { drop: 0, lean: 0, head: 0, arms: [0, 0], hips: [0, 0], knees: [0, 0] }

/** Starting values; tune by eye in the harness (Task 2), the tests only check the shape. */
export const POSES: Record<ActivityId, Pose> = {
  "duduk-baca": { drop: 0.42, lean: -0.15, head: 0.35, arms: [0.9, 0.9], hips: [1.5, 1.5], knees: [1.5, 1.5] },
  "ambil-buku": { drop: 0, lean: -0.1, head: -0.35, arms: [0, 2.6], hips: [0, 0], knees: [0, 0] },
  bungkuk: { drop: 0.1, lean: 0.8, head: 0.3, arms: [1.0, 1.0], hips: [0.4, 0.4], knees: [0.3, 0.3] },
  menulis: { drop: 0.42, lean: 0.25, head: 0.5, arms: [0.7, 1.1], hips: [1.5, 1.5], knees: [1.5, 1.5] },
  mengetik: { drop: 0.42, lean: 0.2, head: 0.35, arms: [1.1, 1.1], hips: [1.5, 1.5], knees: [1.5, 1.5] },
  "buka-lemari": { drop: 0, lean: 0.05, head: 0, arms: [0.2, 1.4], hips: [0, 0], knees: [0, 0] },
  menyiram: { drop: 0, lean: 0.35, head: 0.4, arms: [0.3, 1.2], hips: [0.1, 0.1], knees: [0.1, 0.1] },
  "buka-katalog": { drop: 0, lean: 0.1, head: 0.45, arms: [1.0, 1.0], hips: [0, 0], knees: [0, 0] },
  hangatkan: { drop: 0.3, lean: 0.3, head: 0.1, arms: [1.3, 1.3], hips: [1.2, 1.2], knees: [2.0, 2.0] },
  "lihat-papan": { drop: 0, lean: 0, head: -0.2, arms: [0, 1.8], hips: [0, 0], knees: [0, 0] },
  "pegang-pintu": { drop: 0, lean: 0.05, head: 0, arms: [0, 1.3], hips: [0, 0], knees: [0, 0] },
}

export const HELD: Partial<Record<ActivityId, "buku" | "kaleng" | "katalog">> = {
  "duduk-baca": "buku",
  "ambil-buku": "buku",
  menyiram: "kaleng",
  "buka-katalog": "katalog",
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)
const mix = (a: number, b: number, k: number) => a + (b - a) * k
const pair = (a: readonly [number, number], b: readonly [number, number], k: number) =>
  [mix(a[0], b[0], k), mix(a[1], b[1], k)] as const

export function poseAt(activity: ActivityId, t: number): Pose {
  const target = POSES[activity]
  if (t <= 0) return STAND
  if (t >= 1) return target
  const k = ease(t)
  return {
    drop: mix(STAND.drop, target.drop, k),
    lean: mix(STAND.lean, target.lean, k),
    head: mix(STAND.head, target.head, k),
    arms: pair(STAND.arms, target.arms, k),
    hips: pair(STAND.hips, target.hips, k),
    knees: pair(STAND.knees, target.knees, k),
  }
}
```
Run → PASS.

- [ ] **Step 3: Commit**

```bash
npx prettier --write src/components/lobby/scene/activities.ts src/components/lobby/scene/activities.test.ts
git add src/components/lobby/scene/activities.ts src/components/lobby/scene/activities.test.ts
git commit -m "feat(3f): what Anda does at each hotspot" -m "Co-Authored-By: <sesuai pengingat atribusi>"
```

---

### Task 2: Anda melakukan kegiatannya sebelum popup terbuka

**Files:**
- Create: `src/components/lobby/scene/props.ts`, `src/components/lobby/scene/run.ts`, `run.test.ts`
- Modify: `src/components/lobby/scene/people.ts`, `motion.ts`, `stage.ts`, `src/components/lobby/HotspotLayer.tsx`, `HotspotLayer.test.tsx`, `LobbyScene.tsx`, `LobbyScene.test.tsx`, `LobbyStage.tsx`, `LobbyStage.test.tsx`, `LobbyCanvas.tsx`, `LobbyCanvas.test.tsx`, `scripts/lobby-harness/main.ts`

**Interfaces:**
- Consumes: `ACTIVITY_OF`, `facingOf`, `poseAt`, `walkSpeed`, `ACTIVITY_SECONDS`, `HELD`, `Pose` (Task 1); `advance`, `findPath` (`walk.ts`, R1).
- Produces:
  ```ts
  // run.ts (murni)
  export type Run = { phase: "walk" | "act" | "done"; t: number }   // t: seconds spent in "act"
  export const RUN_START: Run                                       // { phase: "walk", t: 0 }
  export function stepRun(run: Run, dt: number, walking: boolean): Run
  export function finishRun(): Run                                  // { phase: "done", t: ACTIVITY_SECONDS }
  // people.ts
  export type Figure = { root: THREE.Group; torso: THREE.Group; legs: Array<{ hip: THREE.Group; knee: THREE.Group }>; arms: Array<THREE.Group>; head: THREE.Group; hand: THREE.Group }
  export function applyPose(figure: Figure, pose: Pose): void
  // props.ts
  export function buildHeld(kit: Kit): Record<"buku" | "kaleng" | "katalog", THREE.Object3D>   // tersembunyi; ditempel ke figure.hand
  // motion.ts
  Motion.perform: (activity: ActivityId, facing: Point2) => Promise<void>
  Motion.skip: () => void            // menyelesaikan jalan dan kegiatan seketika, janji terpenuhi
  Motion.rest: () => void            // kembali berdiri (dipanggil saat jalan baru dimulai)
  // stage.ts
  Stage.perform: (id: HotspotId) => Promise<void>
  Stage.skip: () => void
  // LobbyScene handle
  LobbySceneHandle.perform: (id: HotspotId) => Promise<void>   // seketika bila 3D tidak hidup
  LobbySceneHandle.skip: () => void
  // HotspotLayer / LobbyScene
  onActivate: (id: HotspotId, how: { keyboard: boolean }) => void
  ```

- [ ] **Step 1: Tes `run.ts` (gagal dulu)**

```ts
import { describe, expect, it } from "vitest"
import { ACTIVITY_SECONDS } from "./activities"
import { RUN_START, finishRun, stepRun } from "./run"

describe("stepRun", () => {
  it("waits while Anda walks, then acts for the activity's time", () => {
    let run = stepRun(RUN_START, 0.5, true)
    expect(run).toEqual({ phase: "walk", t: 0 })
    run = stepRun(run, 0.016, false)
    expect(run.phase).toBe("act")
    run = stepRun(run, ACTIVITY_SECONDS / 2, false)
    expect(run.phase).toBe("act")
    run = stepRun(run, ACTIVITY_SECONDS, false)
    expect(run).toEqual({ phase: "done", t: ACTIVITY_SECONDS })
  })
  it("stays done", () => {
    expect(stepRun(finishRun(), 1, true)).toEqual(finishRun())
  })
})
```
Run → FAIL. Implementasi:
```ts
import { ACTIVITY_SECONDS } from "./activities"

/** One hotspot tap: the walk, then the activity (spec 3F §4A.1). */
export type Run = { phase: "walk" | "act" | "done"; t: number }
export const RUN_START: Run = { phase: "walk", t: 0 }
export const finishRun = (): Run => ({ phase: "done", t: ACTIVITY_SECONDS })

export function stepRun(run: Run, dt: number, walking: boolean): Run {
  if (run.phase === "done") return run
  if (run.phase === "walk") return walking ? run : { phase: "act", t: 0 }
  const t = run.t + dt
  return t >= ACTIVITY_SECONDS ? finishRun() : { phase: "act", t }
}
```
Run → PASS.

- [ ] **Step 2: Figur, pose, benda bantu**

`people.ts`: bila figur Anda (R1 Task 5) belum punya `torso` dan `hand`: sisipkan `torso: THREE.Group` di antara `root` dan badan atas (kepala, lengan, badan; poros di pinggul `y` = tinggi pinggul), dan `hand: THREE.Group` di ujung lengan kanan (`arms[1]`). `applyPose(figure, pose)`: `figure.torso.position.y = -pose.drop` (badan atas dan kaki ikut turun: pasang `legs` di bawah `torso` juga bila itu yang membuat duduk terlihat benar), `torso.rotation.x = pose.lean`, `head.rotation.x = pose.head`, `arms[i].rotation.x = -pose.arms[i]`, `legs[i].hip.rotation.x = -pose.hips[i]`, `legs[i].knee.rotation.x = pose.knees[i]`. Tanda putaran disesuaikan dengan arah sumbu figur sampai pose terlihat benar di harness (Step 6); `stride` saat berjalan menimpa sendi kaki/lengan seperti sekarang.

`props.ts`: `buildHeld(kit)` membuat tiga benda kecil membulat dengan palet ruangan, semua `visible = false`: `buku` (balok 0,16 × 0,03 × 0,12 m, sampul hangat), `kaleng` (silinder 0,09 m + cerat miring + pegangan), `katalog` (balok tipis 0,2 × 0,01 × 0,14 m terbuka dua sisi). Masing-masing ditempel ke `figure.hand`.

- [ ] **Step 3: `motion.ts` dan `stage.ts`**

`motion.ts` menyimpan `run: Run | null`, `activity`, `facing`, dan `resolve`. Saat `update(t, dt)`:
- jalan memakai `walkSpeed(panjangJalur)` sebagai kecepatan (ganti 1,4 m/s tetap dari R1 Task 5; panjang jalur dihitung sekali saat `walkTo`);
- bila `run` ada: `run = stepRun(run, dt, sedangBerjalan)`; pada fase `act`: Anda menghadap `facing` (`root.rotation.y = Math.atan2(fx − x, fz − z)`), `applyPose(figure, poseAt(activity, run.t / ACTIVITY_SECONDS))`, benda `HELD[activity]` tampil; saat `done`: pose akhir dipertahankan, `resolve()` dipanggil sekali.
- `perform(activity, facing)`: menyelesaikan janji sebelumnya (bila ada) lebih dulu, lalu `run = RUN_START` dan mengembalikan janji baru.
- `skip()`: `finishWalk()`, pose akhir seketika, `run = finishRun()`, `resolve()`.
- `rest()` (dipanggil `walkTo` di awal tiap jalan): sembunyikan benda bantu, `applyPose(figure, STAND)`.

`stage.ts`: `perform(id)`: bila `!animates()` (kualitas `diam`, mode bukan `normal`) → pose akhir seketika lewat `motion.perform(...)` lalu `motion.skip()`, `requestRender()`, kembalikan `Promise.resolve()`; selain itu `const done = motion.perform(ACTIVITY_OF[id], facingOf(id)); requestRender(); return done` (loop berjalan selama `run` belum `done`: `needsRender` tetap benar). `skip()`: `motion.skip(); requestRender()`. `setQuality("diam")` memanggil `motion.skip()` (bersama `finishWalk`). `dispose` memanggil `motion.skip()` supaya tidak ada janji yang menggantung.

- [ ] **Step 4: React (tes dulu)**

`HotspotLayer.test.tsx`: klik mouse (`fireEvent.click(button, { detail: 1 })`) → `onActivate(id, { keyboard: false })`; klik dari keyboard (`fireEvent.click(button, { detail: 0 })`) → `{ keyboard: true }`. Implementasi: `onClick={(event) => onActivate(hotspot.id, { keyboard: event.detail === 0 })}`; tipe prop berubah, `LobbyScene` meneruskan apa adanya.

`LobbyScene.tsx`: handle mendapat `perform(id)` → `live ? stageRef.current?.perform(id) ?? Promise.resolve() : Promise.resolve()` (pakai cara `LobbyScene` mengakses stage yang sudah ada, mis. lewat `LobbyCanvas` ref/`onReady`), dan `skip()`. Tes `LobbyScene.test.tsx`: tanpa 3D hidup, `perform` langsung terpenuhi.

`LobbyStage.test.tsx` (mock `LobbyScene` yang sudah ada diperluas dengan handle palsu lewat `forwardRef`/`useImperativeHandle`, `perform: vi.fn()`, `skip: vi.fn()`):
```ts
it("opens the page after Anda's activity, at once from the keyboard, and skips on a second tap", async () => {
  let finish = () => undefined as void
  handle.perform.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)))
  const { router } = renderStage(false)
  await vi.waitFor(() => expect(scene.props).not.toBeNull())
  const activate = scene.props!.onActivate!
  await act(async () => activate("perapian", { keyboard: false }))
  expect(router.state.location.pathname).toBe("/lobby")
  await act(async () => activate("perapian", { keyboard: false }))
  expect(handle.skip).toHaveBeenCalledTimes(1)
  await act(async () => finish())
  expect(router.state.location.pathname).toBe("/recap")

  await act(async () => void router.navigate({ to: "/lobby" }))
  handle.perform.mockClear()
  await act(async () => activate("pintu", { keyboard: true }))
  expect(handle.perform).not.toHaveBeenCalled()
  expect(router.state.location.pathname).toBe("/settings")
})
```
Implementasi `LobbyStage.activate(id, { keyboard })`:
```ts
const running = useRef(false)
async function activate(id: HotspotId, how: { keyboard: boolean }) {
  // A second tap while Anda is on the way: skip to the page (spec 3F §4A.1).
  if (running.current) {
    sceneRef.current?.skip()
    return
  }
  moveAnda(spotOf(id).stand)
  setReadingHint(false)
  if (!how.keyboard && sceneRef.current) {
    running.current = true
    try {
      await sceneRef.current.perform(id)
    } finally {
      running.current = false
    }
  }
  open(id)
}
```
Isi lama `activate` (cabang per hotspot) pindah ke `function open(id: HotspotId)`. Ganti komentar "Every tap acts at once, while Anda walks over (spec 1D §5.1)" menjadi "Anda walks over and does the activity, then the page opens (spec 3F §4A.1; replaces 1D §5.1)". `LibraryMap.onSelect` tetap hanya menggeser kamera.

`LobbyCanvas.test.tsx`: mock stage mendapat `perform: vi.fn(() => Promise.resolve())`, `skip: vi.fn()`. Tes lama yang memanggil `onActivate(id)` dengan satu argumen (mis. tes perapian/pintu/papan dari R1 Task 4A/4C) diubah menjadi `onActivate(id, { keyboard: true })`, yang tetap membuka halaman seketika.

Run `npx vitest run src/components/lobby --maxWorkers=2` → PASS.

- [ ] **Step 5: Harness**

`main.ts`: `?act=<hotspotId>` → setelah stage siap, `stage.walkTo(spotOf(id).stand, true)` lalu `await stage.perform(id)` dengan mode yang memutar animasi sampai selesai (atau, di mode `still`, pose akhir seketika). Perintah baru di `lobby-harness.mjs`:
```js
async function acts(dir) {
  mkdirSync(dir, { recursive: true })
  for (const id of ["meja-baca", "fiksi_sastra", "troli", "katalog", "meja-admin", "lemari", "tanaman", "toko", "perapian", "papan", "pintu"]) {
    const png = await render({ width: 1440, height: 900 }, `mode=still&mood=dusk&act=${id}&focus=${id}`)
    await sharp(png).toFile(`${dir}/${id}.png`)
    console.log(`wrote ${dir}/${id}.png`)
  }
}
```
(`focus=<hotspotId>` memusatkan kamera pada label hotspot dengan zoom `MAX_ZOOM`; perluas parser `focus` yang ada agar menerima ID hotspot selain `x,y,z`.) Cabang `else if (command === "acts") await acts(file ?? "scratch/acts")`.

- [ ] **Step 6: Verifikasi dan commit**

`node scripts/lobby-harness.mjs acts scratch/acts` lalu lihat kesebelas gambar: Anda duduk di kursi (tidak menembus), menyiram ke arah tanaman dengan kaleng di tangan, berjongkok menghadap api, memegang gagang pintu, dan seterusnya. Setel `POSES` dan tanda sendi sampai benar (tes Task 1 tetap hijau). `npx tsc --noEmit`, `npx vitest run --maxWorkers=2` → hijau. Format dan commit `feat(3f): Anda does the activity before the page opens`.

---

### Task 3: Momen perubahan sejak kunjungan terakhir

**Files:**
- Create: `src/components/lobby/room-memory.ts`, `room-memory.test.ts`
- Modify: `src/lib/local/keys.ts`, `src/components/lobby/scene/plant.ts`, `showcase.ts`, `stage.ts`, `src/components/lobby/{LobbyScene,LobbyCanvas,LobbyStage}.tsx` (+ tes), `scripts/lobby-harness/main.ts`

**Interfaces:**
- Consumes: `RoomSignals`, `FireLevel`, `FIRE_STRENGTH` (R1 Task 4B); `PlantStage` (`@/lib/reading-habit`); `useReadingHabit`, `useMeetingsTotal`, `useHighlights` (R1).
- Produces:
  ```ts
  // room-memory.ts
  export type RoomSnapshot = RoomSignals & { plant: PlantStage; finished: number }
  export type RoomChange = "fire" | "deskLamp" | "parcel" | "plant" | "showcase"
  export function changesSince(prev: RoomSnapshot | null, next: RoomSnapshot): Array<RoomChange>
  export function readRoomSnapshot(): RoomSnapshot | null
  export function rememberRoomSnapshot(snapshot: RoomSnapshot): void
  // keys.ts
  export const ROOM_SEEN_KEY = "glosa:room-seen"
  // stage.ts
  Stage.playMoments: (from: RoomSnapshot, changes: ReadonlyArray<RoomChange>) => void
  // plant.ts / showcase.ts
  Plant.grow: () => void          // bagian tahap terbaru tumbuh dari skala 0 dalam 1 detik
  Showcase.arrive: () => void     // sampul terbaru meluncur masuk dalam 1 detik
  // LobbySceneHandle
  playMoments: (from: RoomSnapshot, changes: ReadonlyArray<RoomChange>) => void
  ```

- [ ] **Step 1: Tes (gagal dulu)**

```ts
import { afterEach, describe, expect, it } from "vitest"
import { ROOM_SEEN_KEY } from "@/lib/local/keys"
import { type RoomSnapshot, changesSince, readRoomSnapshot, rememberRoomSnapshot } from "./room-memory"

const base: RoomSnapshot = { fire: "kecil", deskLamp: false, parcelOpen: false, plant: "daun", finished: 3 }

describe("changesSince", () => {
  it("plays nothing on the first visit or when nothing changed", () => {
    expect(changesSince(null, base)).toEqual([])
    expect(changesSince(base, { ...base })).toEqual([])
  })
  it("lists each change once, in a fixed order", () => {
    const next: RoomSnapshot = { fire: "besar", deskLamp: true, parcelOpen: true, plant: "rimbun", finished: 4 }
    expect(changesSince(base, next)).toEqual(["fire", "deskLamp", "parcel", "plant", "showcase"])
  })
  it("plays the fire both ways, but only a lamp or a lid that turns on", () => {
    expect(changesSince(base, { ...base, fire: "bara" })).toEqual(["fire"])
    expect(changesSince({ ...base, deskLamp: true, parcelOpen: true }, base)).toEqual([])
  })
  it("plays only growth and new finished books", () => {
    expect(changesSince(base, { ...base, plant: "tunas" })).toEqual([])
    expect(changesSince(base, { ...base, finished: 2 })).toEqual([])
  })
})

describe("room snapshot on this device", () => {
  afterEach(() => localStorage.clear())
  it("keeps the last snapshot and ignores a broken one", () => {
    expect(readRoomSnapshot()).toBeNull()
    rememberRoomSnapshot(base)
    expect(readRoomSnapshot()).toEqual(base)
    localStorage.setItem(ROOM_SEEN_KEY, '{"fire":"api"}')
    expect(readRoomSnapshot()).toBeNull()
  })
})
```
Run → FAIL.

- [ ] **Step 2: Implementasi `room-memory.ts`**

```ts
import { ROOM_SEEN_KEY } from "@/lib/local/keys"
import type { PlantStage } from "@/lib/reading-habit"
import type { FireLevel, RoomSignals } from "./room-signals"

/** What the room showed when the member last saw it (spec 3F §4A.2). */
export type RoomSnapshot = RoomSignals & { plant: PlantStage; finished: number }
export type RoomChange = "fire" | "deskLamp" | "parcel" | "plant" | "showcase"

const STAGES: ReadonlyArray<PlantStage> = ["biji", "tunas", "daun", "rimbun", "kuncup", "berbunga"]
const FIRES: ReadonlyArray<FireLevel> = ["bara", "kecil", "besar"]

export function changesSince(prev: RoomSnapshot | null, next: RoomSnapshot): Array<RoomChange> {
  if (prev === null) return []
  const changes: Array<RoomChange> = []
  if (prev.fire !== next.fire) changes.push("fire")
  if (!prev.deskLamp && next.deskLamp) changes.push("deskLamp")
  if (!prev.parcelOpen && next.parcelOpen) changes.push("parcel")
  if (STAGES.indexOf(next.plant) > STAGES.indexOf(prev.plant)) changes.push("plant")
  if (next.finished > prev.finished) changes.push("showcase")
  return changes
}

const isSnapshot = (value: unknown): value is RoomSnapshot => {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    FIRES.includes(v.fire as FireLevel) &&
    typeof v.deskLamp === "boolean" &&
    typeof v.parcelOpen === "boolean" &&
    STAGES.includes(v.plant as PlantStage) &&
    Number.isInteger(v.finished) &&
    (v.finished as number) >= 0
  )
}

export function readRoomSnapshot(): RoomSnapshot | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ROOM_SEEN_KEY) ?? "null")
    return isSnapshot(value) ? value : null
  } catch {
    return null
  }
}

export function rememberRoomSnapshot(snapshot: RoomSnapshot): void {
  try {
    localStorage.setItem(ROOM_SEEN_KEY, JSON.stringify(snapshot))
  } catch {
    // Storage can be off: every visit is then a first visit.
  }
}
```
`keys.ts`: `export const ROOM_SEEN_KEY = "glosa:room-seen"` (komentar: cuplikan ruangan terakhir yang dilihat, spec 3F §4A.2). Bila `PlantStage` punya daftar urutan yang sudah diekspor di `reading-habit.ts`, pakai itu, bukan `STAGES` baru. Run → PASS.

- [ ] **Step 3: Adegan memutar momen**

`stage.ts` `playMoments(from, changes)`: hanya bila `animates()`; selain itu tidak melakukan apa-apa (keadaan akhir sudah tampil). Satu tween 1 detik (`momentT` 0→1, `needsRender` selama berjalan, ease-out):
- `fire`: kekuatan api dicampur dari `FIRE_STRENGTH[from.fire]` ke `FIRE_STRENGTH[signals.fire]` (dipakai `applyRig` lewat variabel `fireNow` alih-alih langsung dari sinyal selama tween);
- `deskLamp`: glow dan cahaya lampu meja dari 0 ke 1;
- `parcel`: tutup dari 0 ke `side × 1.9`;
- `plant`: `plant.grow()`;
- `showcase`: `showcase.arrive()`.

`plant.ts` `grow()`: bagian yang ditambahkan tahap sekarang dibanding tahap sebelumnya (`PLANT_SHAPES`) diskalakan dari 0 ke 1 dalam 1 detik (simpan grup bagian tahap terbaru saat `set`). `showcase.ts` `arrive()`: sampul di slot pertama bergeser dari `z + 0.3` dan opasitas 0 ke posisinya dalam 1 detik. Keduanya memakai `onChange` yang sudah ada untuk meminta render.

`LobbyScene`/`LobbyCanvas`: handle `playMoments` diteruskan ke stage (diabaikan bila 3D belum hidup).

- [ ] **Step 4: React menentukan kapan (tes dulu)**

`LobbyStage.test.tsx`: dengan `localStorage` berisi cuplikan lama `{ fire: "bara", … }` dan data yang memberi api `kecil`, setelah `onLiveChange(true)` handle `playMoments` dipanggil sekali dengan `(lama, ["fire"])` dan cuplikan baru tersimpan; render ulang tidak memanggilnya lagi. Tanpa cuplikan lama → `playMoments` tidak dipanggil, cuplikan tersimpan.

Implementasi `LobbyStage`:
```ts
const played = useRef(false)
const ready =
  sceneLive &&
  habit.status === "ready" &&
  meetingsTotal !== null &&
  (highlights.state.status !== "loading")
useEffect(() => {
  if (!ready || played.current) return
  played.current = true
  const next: RoomSnapshot = { ...signals, plant: habit.summary.stage, finished: summary.finished.length }
  const prev = readRoomSnapshot()
  const changes = changesSince(prev, next)
  if (prev && changes.length > 0) sceneRef.current?.playMoments(prev, changes)
  rememberRoomSnapshot(next)
}, [ready, signals, habit.summary.stage, summary.finished.length])
```
(`summary.finished` = daftar buku selesai yang sudah dihitung `summarizeLobby`; pakai nama bidang yang ada.) Run `npx vitest run src/components/lobby --maxWorkers=2` → PASS.

- [ ] **Step 5: Harness, verifikasi, commit**

Harness: `?from=<json cuplikan ter-encode>&changes=fire,plant` memanggil `stage.playMoments` setelah siap; `shot` diambil setelah 1,2 detik (`mode=normal`) untuk melihat keadaan akhir, dan satu gambar pada 0,4 detik untuk melihat peralihan. Lihat keduanya. `npx tsc --noEmit`, `npx vitest run --maxWorkers=2` → hijau. Format dan commit `feat(3f): the room plays what changed since your last visit`.

---

### Task 4: Halaman Sorotan & catatan

**Files:**
- Create: `src/routes/_member/_lobi/highlights.tsx`, `src/components/lobby/HighlightsPanel.tsx`, `HighlightsPanel.test.tsx`, `src/lib/annotations/highlights.ts`, `highlights.test.ts`
- Modify: `src/routeTree.gen.ts`, `src/components/lobby/LobbyPopup.tsx` (`POPUP_PATHS`), `LobbyPopup.test.tsx` bila mengacu daftar itu, `src/components/lobby/CorkboardPanel.tsx` (+ tes), `src/routes/privacy.tsx` (hanya bila halaman itu mendaftar tempat sorotan ditampilkan)

**Interfaces:**
- Consumes: `useHighlights(limit, online)`, `Highlight`, `MAX_HIGHLIGHTS` (R1 Task 4C); `QuoteCardDialog` (`@/components/reader/QuoteCardDialog`), `useSavedForms` (`@/lib/words/word-sync-client`), `savedFormsOf` (`@/lib/words/saved-marks`), `fetchCoverBlob` (`@/lib/quote-card/cover-art`), `LobbyPopup`, loader `/_member/_lobi` (`books`, `offline`), `useOnline`.
- Produces:
  ```ts
  // highlights.ts (murni)
  export type HighlightFilter = { bookId: string | null; color: HighlightColor | null }
  export type HighlightRow = Highlight & { book: { id: string; title: string; author: string; coverUrl: string | null } }
  export function highlightRows(highlights: ReadonlyArray<Highlight>, books: ReadonlyArray<ShelfBook>, filter: HighlightFilter): Array<HighlightRow>
  export function highlightBooks(highlights: ReadonlyArray<Highlight>, books: ReadonlyArray<ShelfBook>): Array<{ id: string; title: string; count: number }>
  // HighlightsPanel.tsx
  export function HighlightsPanel(props: { state: HighlightsState; books: ReadonlyArray<ShelfBook>; onRetry: () => void }): JSX.Element
  ```
  Route `/highlights` (search `{ buku?: string; warna?: HighlightColor }`).

- [ ] **Step 1: Fungsi murni (tes dulu)**

```ts
import { describe, expect, it } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { Highlight } from "./types"
import { highlightBooks, highlightRows } from "./highlights"

const h = (id: string, bookId: string, color: Highlight["color"], createdAt: string): Highlight =>
  ({ id, bookId, cfi: `epubcfi(/6/2!/4/${id})`, color, note: "", excerpt: `kutipan ${id}`, createdAt })
const list = [
  h("a", sherlock.id, "yellow", "2026-11-10T10:00:00Z"),
  h("b", "gone", "blue", "2026-11-12T10:00:00Z"),
  h("c", sherlock.id, "pink", "2026-11-13T10:00:00Z"),
]

describe("highlightRows", () => {
  it("keeps highlights of books on the shelf, newest first, with their book", () => {
    const rows = highlightRows(list, [sherlock], { bookId: null, color: null })
    expect(rows.map((row) => row.id)).toEqual(["c", "a"])
    expect(rows[0].book.title).toBe(sherlock.title)
  })
  it("filters by book and by colour", () => {
    expect(highlightRows(list, [sherlock], { bookId: sherlock.id, color: "yellow" }).map((r) => r.id)).toEqual(["a"])
    expect(highlightRows(list, [sherlock], { bookId: "gone", color: null })).toEqual([])
  })
})

describe("highlightBooks", () => {
  it("lists the books that have highlights, with their counts", () => {
    expect(highlightBooks(list, [sherlock])).toEqual([{ id: sherlock.id, title: sherlock.title, count: 2 }])
  })
})
```
Implementasi singkat: peta `books` per `id`, saring sorotan yang bukunya ada, saring `filter`, urutkan `createdAt` menurun; `highlightBooks` menghitung per buku, urut judul (`localeCompare("id")`). Run → PASS.

- [ ] **Step 2: Panel (tes dulu)**

`HighlightsPanel.test.tsx` (router uji):
- `ready` dengan sorotan → tiap baris menampilkan kutipan, catatan bila ada, judul buku, dan dua aksi: tautan **Buka di buku** (`/read/<bookId>?cfi=…`) dan tombol **Buat kartu kutipan**;
- saringan "Buku" (select berisi "Semua buku" + `highlightBooks`) dan "Warna" (Semua, Kuning, Hijau, Biru, Merah muda) menyaring daftar dan memperbarui search URL (`buku`, `warna`);
- **Buat kartu kutipan** membuka `QuoteCardDialog` dengan `quote` = kutipan dan `book` = `{ id, title, author, finished: false, finishDeclined: true }` (`vi.mock` komponen dialog di tes, cukup periksa propsnya);
- kosong → "Belum ada sorotan. Tandai kalimat yang kamu suka saat membaca, lalu kembali ke sini."; offline → "Sorotan bisa dilihat saat online."; `failed` → "Sorotan belum bisa dimuat." + "Coba lagi";
- tepat `MAX_HIGHLIGHTS` sorotan → baris "Menampilkan 500 sorotan terbaru."

Implementasi: `HighlightsPanel` memakai `highlightRows`/`highlightBooks`; garis warna kiri per sorotan; `QuoteCardDialog` dipasang seperti di pembaca (`key` per sorotan, `savedForms = savedFormsOf(useSavedForms())`, `loadCover = () => fetchCoverBlob(row.book.coverUrl)`, `finalFocus` = tombol yang membukanya). Run → PASS.

- [ ] **Step 3: Route, popup, papan**

`highlights.tsx` dengan pola `recap.tsx`: `createFileRoute("/_member/_lobi/highlights")`, `validateSearch` (`buku` string atau `undefined`; `warna` salah satu `HIGHLIGHT_COLORS` atau `undefined`), `head` judul "Sorotan & catatan — Glosa", komponen: `LobbyPopup` berjudul "Sorotan & catatan" berisi `HighlightsPanel` dengan `useHighlights(MAX_HIGHLIGHTS, online && !offline)`. Tambah `/highlights` ke `POPUP_PATHS`. Tambah route ke `src/routeTree.gen.ts` sesuai Global Constraints. `CorkboardPanel`: tautan **Lihat semua** ke `/highlights` di bawah daftar (juga saat kosong tidak tampil); perbarui tesnya.

Run `npx tsc --noEmit` dan `npx vitest run src/components/lobby src/lib/annotations --maxWorkers=2` → PASS.

- [ ] **Step 4: Commit**

Format dan commit `feat(3f): Sorotan & catatan page from the corkboard`.

---

### Task 5: E2E dan verifikasi akhir R3

**Files:**
- Create: `e2e/highlights.spec.ts`
- Modify: `e2e/lobby.spec.ts`, `e2e/lobby-3d.spec.ts` bila waktu tunggu popup berubah

**Interfaces:**
- Consumes: semua task sebelumnya; helper E2E yang sudah membuat sorotan di pembaca (cari `highlight` di `e2e/`).

- [ ] **Step 1: E2E**

`e2e/highlights.spec.ts`: buat sorotan di pembaca (helper yang ada), kembali ke ruang baca, ketuk hotspot "Sorotan" → dialog papan menampilkan kutipan → **Lihat semua** → `/highlights` menampilkan kutipan dan judul buku → **Buka di buku** membuka pembaca di sorotan itu (URL memuat `cfi=`) → kembali, **Buat kartu kutipan** membuka dialog kartu kutipan. Desktop dan HP (proyek Playwright yang ada).

`e2e/lobby.spec.ts`: di 3D, ketuk "Kilas balik" → URL tetap `/lobby` sesaat lalu `/recap` dalam ≤ 2 detik; ketuk dua kali cepat → `/recap` lebih cepat dari ketukan tunggal (atau cukup: tetap sampai di `/recap`); dengan `page.emulateMedia({ reducedMotion: "reduce" })` → `/recap` langsung (≤ 300 ms setelah klik). Tekan Enter pada hotspot yang difokus → popup langsung.

Run: `npx playwright test e2e/highlights.spec.ts e2e/lobby.spec.ts e2e/lobby-3d.spec.ts e2e/lobby-popup.spec.ts --workers=2` (cek port 3000 dulu).

- [ ] **Step 2: Verifikasi akhir**

```bash
npx tsc --noEmit
npx vitest run --maxWorkers=2
npm run check
npm run build
```
Semua hijau. Laporkan ke pengendali: ringkasan, gambar `scratch/acts/*.png`, dan cek manual setelah deploy: rasa jeda kegiatan di HP (±1,5 detik masih nyaman?), momen perubahan setelah membaca di perangkat lain, `/highlights` dengan banyak sorotan.

- [ ] **Step 3: Commit**

```bash
npx prettier --write e2e/*.ts
git add -A e2e
git commit -m "test(3f): E2E for activities and highlights" -m "Co-Authored-By: <sesuai pengingat atribusi>"
```

---

## Self-review (dijalankan penulis rencana)

**Cakupan spec.** Keputusan 10 (dua jenis animasi) → Global Constraints, Task 2–3 (tidak ada animasi lain); keputusan 11 (kegiatan, ±1,5 detik, menggantikan 1D no. 5) → Task 1 (waktu, `walkSpeed`), Task 2 (alur React, komentar 1D diganti); §4A.1 tabel kegiatan → `ACTIVITY_OF` (Task 1); ketuk ulang, reduced-motion, mode diam, kualitas diam, keyboard → Task 2 Step 3–4 (reduced-motion lewat kualitas `diam`); pose lewat kode dan benda bantu → Task 2 Step 2; §4A.2 momen perubahan dan pengecualian kunjungan pertama → Task 3; §4A.3 `/highlights` (isi, saringan, dua aksi, offline, tanpa tabel baru) → Task 4 (fungsi server dari R1 Task 4C); §7 tes R3 → Task 1–5.

**Placeholder.** Nilai `POSES` adalah nilai awal yang disetel di harness (Task 2 Step 6), dengan tes yang memeriksa bentuknya. Nama bidang `summary.finished` dan cara `LobbyScene` mengakses stage disebut "pakai yang ada" karena R1 Task 5–7 bisa mengubahnya; pelaksana mengecek sebelum menulis.

**Konsistensi tipe.** `ActivityId`/`ACTIVITY_OF`/`facingOf`/`poseAt`/`HELD`/`ACTIVITY_SECONDS` (Task 1) dipakai `run.ts`, `motion.ts`, `stage.ts` (Task 2); `RoomSignals`/`FIRE_STRENGTH` (R1 4B) dipakai `room-memory.ts` dan `playMoments` (Task 3); `Highlight`/`HighlightsState`/`useHighlights`/`MAX_HIGHLIGHTS` (R1 4C) dipakai Task 4; `onActivate(id, { keyboard })` sama di `HotspotLayer`, `LobbyScene`, `LobbyStage`.
