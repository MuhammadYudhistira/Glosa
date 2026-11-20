# Glosa Tahap 3G — Ketuk dulu, baru nama: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ruang baca tidak lagi memakai label pil dan lingkaran tanda. Benda yang bisa dipakai diberi garis tepi tipis; ketuk pertama (HP) menampilkan kartu nama dengan satu baris keadaan, ketuk kedua membuka tempat itu; di desktop kursor di atas benda menampilkan sorotan dan nama kecil, klik langsung membuka.

**Architecture:**
- **Kotak ketuk murni** (`scene/pick-volumes.ts`, `scene/picker.ts`): satu kotak per benda dari `layout.ts`, dan raycast ortografis ke kotak tanpa three.js, sehingga diuji di jsdom. `stage.pick(x, y)` memakai `view` dan `viewport` stage yang sama dengan kamera.
- **Sorotan digambar di 3D** (`scene/highlight.ts`): garis tepi kotak ketuk. Semua benda memegang satu `LineSegments` redup yang diam; satu benda terpilih mendapat garis penuh dan isian tipis. Ganti sorotan = satu `requestRender()`, ruangan diam tetap 0 frame (R1).
- **Alur di React**: `LobbyScene` menangkap ketuk/geser/kursor di atas kanvas dan melaporkan `onTap(id | null)`, `onHover(id | null)`, `onCameraGesture()`. `LobbyStage` memegang `chosen` (kartu), `hovered`, `lit` (tujuan alur R3) dan menurunkan `highlight`. `activate(id, how)` (alur R3) tidak berubah bentuknya.

**Tech Stack:** TanStack Start + Router, React 19, TypeScript, Tailwind CSS 4, three.js 0.160, Vitest + Testing Library (jsdom 29, `PointerEvent` tersedia), Playwright.

**Spec:** [`docs/superpowers/specs/2026-11-20-tahap-3g-ketuk-nama-design.md`](../specs/2026-11-20-tahap-3g-ketuk-nama-design.md). Spec induk: [3F](../specs/2026-11-07-tahap-3f-ruang-baca-pribadi-design.md), R3 ([plan](2026-11-13-tahap-3f-r3-ruangan-bercerita.md)).

## Global Constraints

- **Bahasa:** teks UI berbahasa Indonesia, komentar kode berbahasa Inggris. Array ditulis `Array<T>`. `src/lib/wording.test.ts` harus tetap hijau: tidak ada "perpustakaan", "lobi", "anggota", "buku tamu", "petugas" di teks UI baru.
- **Dependensi:** tidak ada dependensi npm baru.
- **Keputusan pemilik yang menggantikan aturan lama:** "tidak ada label tetap di ruangan"; aturan 2026-11-14 "label tidak pernah disembunyikan; label yang tidak muat menjadi tanda yang bisa diketuk" dihapus bersama `label-layout.ts`.
- **Ketuk vs geser (spec §3.1):** ketuk bila jari bergerak kurang dari **10 px** dan dilepas sebelum **300 ms**; selain itu geser kamera. (Mouse: hanya aturan jarak, lihat keputusan 2.)
- **Desktop** = `(hover: hover) and (pointer: fine)`; perangkat lain memakai perilaku HP (spec §3.2).
- **Keyboard:** tiap tempat tetap `<button>` bernama (nama = label tempat) dalam urutan Tab sekarang; fokus menampilkan kartu; Enter/Spasi = `perform(id, { instant: true })` tanpa menunggu, halaman langsung terbuka (commit 12a73a2). Isi kartu dibacakan lewat `aria-describedby`.
- **R1 (render sesuai kebutuhan):** ruangan diam merender 0 frame; mengganti sorotan meminta tepat satu frame, dan `setHighlight` dengan id yang sama tidak meminta frame.
- **R3:** `LobbyStage.activate(id, how)` tetap: ketuk kedua saat Anda berjalan = lewati; ketukan terakhir menentukan halaman; `covered = popup || corkboard`; keyboard = `perform(id, { instant: true })` tanpa `await`.
- **Mode gambar diam** (tanpa WebGL atau adegan gagal): titik kecil tanpa tulisan per tempat, ketuk titik → kartu yang sama. Kualitas "diam" dengan WebGL tetap 3D, garis tepi dan sorotan tetap ada.
- **Jangan bergantung pada jalur aset lobi** (`public/lobby/`): cabang lain memindahkan gambar diam, thumbnail toko dan model glb ke impor Vite ber-hash (`LobbyStill.tsx`, `model-manifest.ts`, `ShopPanel.tsx`). Rencana ini tidak menyentuh ketiganya. `LobbyScene.tsx` merender `<LobbyStill>` dan `LobbyScene.test.tsx` memeriksa `src="/lobby/lobby-still.webp"`: jangan ubah baris-baris itu; bila cabang lain sudah mendarat, biarkan konfliknya diselesaikan di sana.
- **Tes unit:** dari PowerShell, `npx vitest run --maxWorkers=2 <path>` (di Git Bash setiap berkas gagal). **Lint/tipe/format/build:** `npm run lint`, `npx tsc --noEmit`, `npm run check` (prettier; jalankan `npx prettier --write <file>` pada berkas yang disentuh sebelum commit), `npm run build`.
- **E2E:** `--workers=2` paling banyak. Port 3000 bisa dipegang proyek lain: cek `curl -sL localhost:3000/login | grep -o "<title>[^<]*"`; bila bukan Glosa, pakai config sementara di port 3100 dan hapus setelahnya. E2E biasa berjalan di kualitas "diam" tanpa WebGL; hanya proyek `lobby-3d` memakai SwiftShader.
- **Line ending/encoding:** LF, UTF-8. **Tidak ada push.** Pesan commit `feat(3g): ...` / `fix(3g): ...` / `test(3g): ...`, diakhiri `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Keputusan dan penyimpangan dari spec

1. **Garis tepi = tepi kotak ketuk, bukan siluet benda.** Perabot digabung (`mergeStatic`), rak/pintu/papan/tanaman tidak punya objek per tempat, jadi `OutlinePass` tidak bisa dipakai merata. Garis tepi kotak juga jujur: yang bersinar adalah yang menjawab ketukan. Kalau di HP terlihat terlalu "kotak", ganti di Task 2 saja (antarmuka `Highlight` tidak berubah).
2. **Mouse: hanya jarak (10 px), tanpa batas 300 ms.** Klik lambat di desktop tetap membuka. Sentuh/pena: kedua aturan spec.
3. **Kartu memakai satu `LobbyStage.chosen`** untuk ketuk (HP) dan fokus keyboard (semua perangkat). Di desktop, mouse tidak membuat kartu.
4. **`HoverName` dirender oleh `LobbyScene`**, bukan `LobbyStage`, supaya posisi kursor (berubah tiap frame) tidak merender ulang `LobbyStage`. `LobbyStage` hanya diberi tahu id yang berubah (`onHover`).
5. **Fokus yang bukan tekanan** (`onFocus` tanpa `pointerdown` sebelumnya) memilih tempat dan menggeser kamera bila di luar layar. Pengganti `:focus-visible`, yang tidak menyala untuk fokus lewat skrip/pembaca layar dan tidak bisa diandalkan di E2E.
6. **Tombol tempat diposisikan di `anchorOf(id)`** (pusat kotak terbesar tempat itu), bukan di `spotOf(id).label`. `spotOf(...).label`/`stand` tetap dipakai kamera (`showSpot`, `reveal`) dan Anda.
7. **Nama aksesibel tombol = label saja** ("Fiksi & Sastra", bukan "Fiksi & Sastra · 0 buku"). Angka kini hanya di kartu, jadi semua tes/E2E yang memakai nama berhitungan diubah (Task 4 dan 7).
8. **Papan (`papan`):** hanya 20 sorotan terbaru yang dimuat lobi (`CORKBOARD_FETCH`). Bila tepat 20: "20+ sorotan". Bila sorotan belum termuat/offline/gagal: "Sorotan dan catatanmu" (bukan "Belum ada sorotan", yang akan keliru). "Belum ada sorotan" hanya untuk hasil kosong yang sudah dimuat.
9. **Tanaman:** data kebiasaan lobi memuat `days` per hari; hitungan "hari baca minggu ini" = hari bertarget terpenuhi sejak Senin (`mondayOf(today)`). Perapian memakai 7 hari terakhir (sama dengan sinyal api). Keduanya `null` (jatuh ke keterangan pendek) selama kebiasaan `loading`/`failed`.
10. **"Pusatkan" hanya disembunyikan di HP tegak** (tinggi > lebar). Desktop dan HP mendatar tetap menampilkannya seperti sekarang, karena spec §3.7 menyatakan pandangan di sana tidak berubah.
11. **Adegan HP menyusut di atas kartu "Lanjutkan membaca"** lewat variabel CSS `--lobby-sheet-h` (diukur, maksimal 9rem untuk adegan), sehingga "ruangan mengisi area antara atas layar dan kartu" benar-benar dihitung kamera dari tinggi adegan.

## Sumber data baris keadaan (spec §3.5, diperiksa)

| Tempat | Sumber di lobi (tanpa permintaan baru) | Bila tidak ada |
|---|---|---|
| `meja-baca` | `summary.lastRead.title` + `shelfPercentage(lastRead, useLocalShelf())` (sudah dimuat `LobbyStage`) | "Belum ada buku yang dibaca" |
| 8 genre | `summary.counts[id]` | "Belum ada buku" |
| `troli` | `summary.trolley.length` | "Tidak ada buku baru" |
| `lemari` | `summary.finishedCount` | "Belum ada buku yang selesai" |
| `meja-admin` | tetap | (sama) |
| `katalog` | `Object.keys(useWordMeetings()).length` (kosakata tersimpan di cache kosakata; `{}` bila belum dibaca) | "Kata yang kamu simpan dari bacaan" |
| `tanaman` | `habit.days` + `habit.today` (`useReadingHabit`), hari bertarget terpenuhi sejak Senin | "Target dan kebiasaan membacamu" |
| `toko` | `useShop().state?.balance` | "Hias ruang bacamu" |
| `perapian` | `habit.days` 7 hari terakhir (`readingDaysBetween`, sama dengan `fireLevel`) | "Rangkuman bacaanmu" |
| `papan` | `useHighlights(CORKBOARD_FETCH)` yang sudah dipakai papan (maks. 20) | "Sorotan dan catatanmu" (belum dimuat) / "Belum ada sorotan" (kosong) |
| `pintu` | tetap | (sama) |

## Struktur file

| File | Tanggung jawab |
|---|---|
| `scene/pick-volumes.ts` (+ tes) | Baru, murni: `PickVolume`, `PICK_VOLUMES`, `volumesOf`, `anchorOf` (Task 1) |
| `scene/picker.ts` (+ tes), `scene/projection.ts` (ekspor `SCREEN_OUT`) | Baru, murni: `pickAt` (Task 1) |
| `scene/highlight.ts` (+ tes), `scene/stage.ts`, `LobbyCanvas.tsx`, `LobbyScene.tsx` (+ tes) | Garis tepi dan sorotan, `stage.pick`/`setHighlight`, prop `highlight` (Task 2) |
| `place-status.ts` (+ tes), `PlaceCard.tsx` (+ tes), `room-signals.ts` (+ tes), `styles.css` | Teks keadaan dan kartu (Task 3) |
| `tap.ts` (+ tes), `use-fine-pointer.ts`, `use-sheet-height.ts`, `HotspotLayer.tsx`, `LobbyScene.tsx`, `LobbyStage.tsx` (+ tes), `styles.css`; hapus `label-layout.ts` | Alur ketuk di HP, titik mode diam, hapus label (Task 4) |
| `HoverName.tsx` (+ tes), `HotspotLayer.tsx`, `LobbyScene.tsx`, `LobbyStage.tsx` (+ tes), `styles.css` | Hover desktop, fokus → kartu, `aria-describedby` (Task 5) |
| `scene/projection.ts` (+ tes), `LobbyScene.tsx`, `Greeting.tsx`, `PlaceHint.tsx`, `place-hint.ts`, `src/lib/local/keys.ts`, `LobbyStage.tsx`, `styles.css` | Kamera HP tegak, sapaan, "Pusatkan", petunjuk sekali (Task 6) |
| `e2e/lobby.spec.ts`, `e2e/lobby-popup.spec.ts`, `e2e/collections.spec.ts`, `e2e/offline.spec.ts`, `e2e/lobby-3d.spec.ts` | E2E, pemindai kata, verifikasi akhir (Task 7) |

`LobbyStill.tsx`, `model-manifest.ts`, `ShopPanel.tsx` **tidak disentuh**.

---

### Task 1: Kotak ketuk dan pemilih (murni)

**Files:**
- Create: `src/components/lobby/scene/pick-volumes.ts`, `pick-volumes.test.ts`, `picker.ts`, `picker.test.ts`
- Modify: `src/components/lobby/scene/projection.ts` (ekspor `SCREEN_OUT`)

**Interfaces:**
- Consumes: `FURNITURE`, `Furnishing`, `footprint`, `WALL_SECTIONS`, `SHELF`, `ROOM_PARTS`, `PLANT`, `PLANT_POT`, `HOTSPOT_SPOTS`, `HotspotId`, `Point3` dari `layout.ts`; `View`, `Viewport`, `halfExtents`, `SCREEN_RIGHT`, `SCREEN_UP`, `project`, `startView`, `clampView` dari `projection.ts`.
- Produces:
  - `type PickVolume = { id: HotspotId; min: Point3; max: Point3; outline: boolean }`
  - `PICK_VOLUMES: ReadonlyArray<PickVolume>`
  - `volumesOf(id: HotspotId): Array<PickVolume>`
  - `anchorOf(id: HotspotId): Point3` (pusat kotak `outline` terbesar tempat itu; tempat tombol tak terlihat dan titik mode diam)
  - `pickAt(point: { x: number; y: number }, view: View, viewport: Viewport, volumes?: ReadonlyArray<PickVolume>): HotspotId | null` (`x`, `y` dalam px CSS dari kiri atas adegan; `null` di luar layar atau di ruang kosong)

- [ ] **Step 1: Ekspor `SCREEN_OUT`**

Di `projection.ts` ubah `const SCREEN_OUT: Point3 = [...]` menjadi `export const SCREEN_OUT: Point3 = [...]` (isi dan komentar tetap).

- [ ] **Step 2: Tulis tes kotak (gagal)**

`src/components/lobby/scene/pick-volumes.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  HOTSPOT_SPOTS,
  ROOM,
  SHELF,
  WALL_SECTIONS,
  type Point3,
} from "./layout"
import {
  PICK_VOLUMES,
  type PickVolume,
  anchorOf,
  volumesOf,
} from "./pick-volumes"

const inside = (point: Point3, v: PickVolume) =>
  [0, 1, 2].every((k) => point[k] >= v.min[k] && point[k] <= v.max[k])
const contains = (a: PickVolume, b: PickVolume) =>
  [0, 1, 2].every((k) => a.min[k] <= b.min[k] && a.max[k] >= b.max[k])

describe("pick volumes", () => {
  it("give every place a box, and one drawn box at least", () => {
    for (const { id } of HOTSPOT_SPOTS) {
      expect(volumesOf(id).length, id).toBeGreaterThan(0)
      expect(
        volumesOf(id).filter((v) => v.outline).length,
        id
      ).toBeGreaterThan(0)
    }
  })

  it("follow the genre sections of the shelf wall, one each", () => {
    for (const { genre, z, width } of WALL_SECTIONS) {
      const boxes = volumesOf(genre)
      expect(boxes).toHaveLength(1)
      expect(boxes[0].min).toEqual([0, SHELF.bottom, z - width / 2])
      expect(boxes[0].max).toEqual([SHELF.depth, SHELF.top, z + width / 2])
    }
  })

  it("stay inside the room, to within the tap padding", () => {
    for (const v of PICK_VOLUMES) {
      expect(v.min[0], v.id).toBeGreaterThanOrEqual(-0.2)
      expect(v.min[1], v.id).toBeGreaterThanOrEqual(0)
      expect(v.min[2], v.id).toBeGreaterThanOrEqual(-0.2)
      expect(v.max[0], v.id).toBeLessThanOrEqual(ROOM.width + 0.2)
      expect(v.max[1], v.id).toBeLessThanOrEqual(ROOM.height)
      expect(v.max[2], v.id).toBeLessThanOrEqual(ROOM.depth + 0.2)
    }
  })

  it("never hide a place of one kind wholly inside another's box", () => {
    const hidden = PICK_VOLUMES.flatMap((a) =>
      PICK_VOLUMES.filter((b) => a.id !== b.id && contains(a, b)).map(
        (b) => `${b.id} in ${a.id}`
      )
    )
    expect(hidden).toEqual([])
  })

  it("anchor each place inside one of its own boxes", () => {
    for (const { id } of HOTSPOT_SPOTS) {
      expect(
        volumesOf(id).some((v) => inside(anchorOf(id), v)),
        id
      ).toBe(true)
    }
  })
})
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run (PowerShell): `npx vitest run --maxWorkers=2 src/components/lobby/scene/pick-volumes.test.ts`
Expected: FAIL, "Failed to resolve import ./pick-volumes".

- [ ] **Step 4: Tulis `pick-volumes.ts`**

```ts
import {
  FURNITURE,
  type Furnishing,
  type HotspotId,
  PLANT,
  PLANT_POT,
  type Point3,
  ROOM_PARTS,
  SHELF,
  WALL_SECTIONS,
  footprint,
} from "./layout"

/**
 * One box that answers a tap (spec 3G §4): the place it belongs to, and
 * whether its edges are drawn (a small piece is only part of a place's hit
 * area, never a glowing line of its own).
 */
export type PickVolume = {
  id: HotspotId
  min: Point3
  max: Point3
  outline: boolean
}

/** A piece whose largest side is below this gets TAP_PAD all round: a finger is wider than a mug. */
const SMALL_PIECE = 0.6
const TAP_PAD = 0.15
/** A piece smaller than this in every side is not drawn. */
const OUTLINE_MIN = 0.35
/** How thick the door and the corkboard are as boxes in their wall. */
const WALL_DEPTH = 0.15
const PLANT_HEIGHT = 1.6

function furnishingVolume(piece: Furnishing): PickVolume {
  const { x0, x1, z0, z1 } = footprint(piece)
  const base = piece.y ?? 0
  const largest = Math.max(...piece.size)
  const pad = largest < SMALL_PIECE ? TAP_PAD : 0
  return {
    id: piece.serves,
    min: [x0 - pad, Math.max(0, base - pad), z0 - pad],
    max: [x1 + pad, base + piece.size[1] + pad, z1 + pad],
    outline: largest >= OUTLINE_MIN,
  }
}

const { door, corkboard } = ROOM_PARTS
const [plantX, plantZ] = PLANT
const plantHalf = PLANT_POT.width / 2

export const PICK_VOLUMES: ReadonlyArray<PickVolume> = [
  // The furniture, each piece for the place it serves (layout.ts: `serves`).
  ...FURNITURE.map(furnishingVolume),
  // One box per genre section of the shelf wall.
  ...WALL_SECTIONS.map(
    ({ genre, z, width }): PickVolume => ({
      id: genre,
      min: [0, SHELF.bottom, z - width / 2],
      max: [SHELF.depth, SHELF.top, z + width / 2],
      outline: true,
    })
  ),
  // The door in the shelf wall (X = 0).
  {
    id: "pintu",
    min: [0, 0, door.z - door.width / 2],
    max: [WALL_DEPTH, door.height, door.z + door.width / 2],
    outline: true,
  },
  // The corkboard on the window wall (Z = 0).
  {
    id: "papan",
    min: [corkboard.x - corkboard.width / 2, corkboard.y - corkboard.size / 2, 0],
    max: [
      corkboard.x + corkboard.width / 2,
      corkboard.y + corkboard.size / 2,
      WALL_DEPTH,
    ],
    outline: true,
  },
  // The habit plant and its pot.
  {
    id: "tanaman",
    min: [plantX - plantHalf, 0, plantZ - plantHalf],
    max: [plantX + plantHalf, PLANT_HEIGHT, plantZ + plantHalf],
    outline: true,
  },
]

export function volumesOf(id: HotspotId): Array<PickVolume> {
  return PICK_VOLUMES.filter((volume) => volume.id === id)
}

const sizeOf = (v: PickVolume) =>
  (v.max[0] - v.min[0]) * (v.max[1] - v.min[1]) * (v.max[2] - v.min[2])

/**
 * Where a place's invisible button and its still-image dot sit: the middle of
 * its biggest drawn box, which always lies inside the place's hit area.
 */
export function anchorOf(id: HotspotId): Point3 {
  const boxes = volumesOf(id).filter((volume) => volume.outline)
  const biggest = boxes.reduce((a, b) => (sizeOf(b) > sizeOf(a) ? b : a))
  return [0, 1, 2].map(
    (k) => (biggest.min[k] + biggest.max[k]) / 2
  ) as unknown as Point3
}
```

Catatan untuk implementer: `Point3` adalah `readonly [number, number, number]`; bila `as unknown as Point3` ditolak lint, tulis tiga elemen eksplisit `[(a+b)/2, ...]`.

- [ ] **Step 5: Jalankan tes kotak**

Run: `npx vitest run --maxWorkers=2 src/components/lobby/scene/pick-volumes.test.ts`
Expected: PASS. Bila "never hide ..." atau "stay inside the room" gagal, perbaiki **data kotak** (mis. kecilkan `TAP_PAD`, atau turunkan batas `SMALL_PIECE`), jangan melonggarkan tes.

- [ ] **Step 6: Tulis tes pemilih (gagal)**

`src/components/lobby/scene/picker.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { HOTSPOT_SPOTS, type Point3 } from "./layout"
import { PICK_VOLUMES, type PickVolume, anchorOf } from "./pick-volumes"
import { pickAt } from "./picker"
import {
  SCREEN_OUT,
  type View,
  type Viewport,
  clampView,
  project,
  startView,
} from "./projection"

const DESKTOP: Viewport = { width: 1440, height: 900 }
const PHONE: Viewport = { width: 390, height: 844 }

const toPixels = (point: Point3, view: View, viewport: Viewport) => {
  const { x, y } = project(point, view, viewport)
  return { x: (x / 100) * viewport.width, y: (y / 100) * viewport.height }
}

/** The whole room in sight: the desktop's start view, and a phone at its zoom limit. */
const WHOLE_ROOM: Array<[string, View, Viewport]> = [
  ["desktop", startView(DESKTOP), DESKTOP],
  [
    "phone, whole room",
    clampView({ target: startView(PHONE).target, zoom: 1 }, PHONE),
    PHONE,
  ],
]

describe("pickAt", () => {
  it.each(WHOLE_ROOM)(
    "picks every place at its anchor (%s)",
    (_name, view, viewport) => {
      for (const { id } of HOTSPOT_SPOTS) {
        const at = toPixels(anchorOf(id), view, viewport)
        expect(pickAt(at, view, viewport), id).toBe(id)
      }
    }
  )

  it("picks nothing in the empty corners of the screen", () => {
    const view = startView(DESKTOP)
    expect(pickAt({ x: 2, y: 2 }, view, DESKTOP)).toBeNull()
    expect(pickAt({ x: DESKTOP.width - 2, y: 2 }, view, DESKTOP)).toBeNull()
  })

  it("picks nothing outside the screen", () => {
    const view = startView(DESKTOP)
    const at = toPixels(anchorOf("pintu"), view, DESKTOP)
    expect(pickAt({ x: -1, y: at.y }, view, DESKTOP)).toBeNull()
    expect(pickAt({ x: at.x, y: DESKTOP.height + 1 }, view, DESKTOP)).toBeNull()
  })

  it("lets the box nearer the camera win, whatever the order", () => {
    const view: View = { target: [5, 2, 5], zoom: 1 }
    const viewport: Viewport = { width: 100, height: 100 }
    const near: PickVolume = {
      id: "meja-baca",
      min: [4.5, 1.5, 4.5],
      max: [5.5, 2.5, 5.5],
      outline: true,
    }
    // The same box 2 m further from the camera: the two overlap on screen.
    const shift = 2 * SCREEN_OUT[0]
    const far: PickVolume = {
      id: "pintu",
      min: near.min.map((v) => v - shift) as unknown as Point3,
      max: near.max.map((v) => v - shift) as unknown as Point3,
      outline: true,
    }
    const centre = { x: 50, y: 50 }
    expect(pickAt(centre, view, viewport, [near, far])).toBe("meja-baca")
    expect(pickAt(centre, view, viewport, [far, near])).toBe("meja-baca")
    expect(pickAt(centre, view, viewport, [far])).toBe("pintu")
  })

  it("is the picker the stage uses: the real volumes by default", () => {
    const view = startView(DESKTOP)
    const at = toPixels(anchorOf("troli"), view, DESKTOP)
    expect(pickAt(at, view, DESKTOP)).toBe(
      pickAt(at, view, DESKTOP, PICK_VOLUMES)
    )
  })
})
```

- [ ] **Step 7: Jalankan, pastikan gagal**

Run: `npx vitest run --maxWorkers=2 src/components/lobby/scene/picker.test.ts`
Expected: FAIL, "Failed to resolve import ./picker".

- [ ] **Step 8: Tulis `picker.ts`**

```ts
import type { HotspotId, Point3 } from "./layout"
import { PICK_VOLUMES, type PickVolume } from "./pick-volumes"
import {
  SCREEN_OUT,
  SCREEN_RIGHT,
  SCREEN_UP,
  type View,
  type Viewport,
  halfExtents,
} from "./projection"

/** The camera's rays run against its axis: away from the camera. */
const AWAY: Point3 = [-SCREEN_OUT[0], -SCREEN_OUT[1], -SCREEN_OUT[2]]

/**
 * Where a ray enters a box (slab test), as a distance along `AWAY` from the
 * ray's origin (negative: behind it, toward the camera); null on a miss.
 */
function enter(origin: Point3, volume: PickVolume): number | null {
  let from = Number.NEGATIVE_INFINITY
  let to = Number.POSITIVE_INFINITY
  for (let k = 0; k < 3; k++) {
    const a = (volume.min[k] - origin[k]) / AWAY[k]
    const b = (volume.max[k] - origin[k]) / AWAY[k]
    from = Math.max(from, Math.min(a, b))
    to = Math.min(to, Math.max(a, b))
  }
  return from <= to ? from : null
}

/**
 * The place under a point of the scene (spec 3G §4): a ray through the
 * orthographic camera, the box nearest the camera wins. `point` is in CSS
 * pixels from the scene's top left, like `project`'s inverse. Pure: no
 * three.js, so it runs in tests and on the server.
 */
export function pickAt(
  point: { x: number; y: number },
  view: View,
  viewport: Viewport,
  volumes: ReadonlyArray<PickVolume> = PICK_VOLUMES
): HotspotId | null {
  if (
    point.x < 0 ||
    point.y < 0 ||
    point.x > viewport.width ||
    point.y > viewport.height
  ) {
    return null
  }
  const { halfWidth, halfHeight } = halfExtents(view.zoom, viewport)
  const right = (2 * point.x) / viewport.width - 1
  const up = 1 - (2 * point.y) / viewport.height
  const origin: Point3 = [0, 1, 2].map(
    (k) =>
      view.target[k] +
      SCREEN_RIGHT[k] * right * halfWidth +
      SCREEN_UP[k] * up * halfHeight
  ) as unknown as Point3
  let best: { id: HotspotId; at: number } | null = null
  for (const volume of volumes) {
    const at = enter(origin, volume)
    if (at !== null && (best === null || at < best.at)) {
      best = { id: volume.id, at }
    }
  }
  return best?.id ?? null
}
```

- [ ] **Step 9: Jalankan kedua tes**

Run: `npx vitest run --maxWorkers=2 src/components/lobby/scene/picker.test.ts src/components/lobby/scene/pick-volumes.test.ts src/components/lobby/scene/projection.test.ts`
Expected: PASS. Bila "picks every place at its anchor" gagal untuk satu id karena tempat lain di depannya, geser kotak yang bersalah di `pick-volumes.ts` (bukan tesnya).

- [ ] **Step 10: Lint, tipe, commit**

Run: `npx prettier --write src/components/lobby/scene/pick-volumes.ts src/components/lobby/scene/pick-volumes.test.ts src/components/lobby/scene/picker.ts src/components/lobby/scene/picker.test.ts src/components/lobby/scene/projection.ts`, lalu `npm run lint` dan `npx tsc --noEmit`.

```bash
git add src/components/lobby/scene/pick-volumes.ts src/components/lobby/scene/pick-volumes.test.ts src/components/lobby/scene/picker.ts src/components/lobby/scene/picker.test.ts src/components/lobby/scene/projection.ts
git commit -m "feat(3g): tap volumes and a pure picker for the lobby

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Sorotan 3D (garis tepi dan sorotan kuat), `stage.pick`/`setHighlight`

**Files:**
- Create: `src/components/lobby/scene/highlight.ts`, `highlight.test.ts`
- Modify: `src/components/lobby/scene/stage.ts`, `src/components/lobby/LobbyCanvas.tsx`, `src/components/lobby/LobbyCanvas.test.tsx`, `src/components/lobby/LobbyScene.tsx`

**Interfaces:**
- Consumes: `PICK_VOLUMES`, `PickVolume` (Task 1), `pickAt` (Task 1), `createFrameLoop`'s `requestRender` di `stage.ts`.
- Produces:
  - `boxEdgePositions(min: Point3, max: Point3): Array<number>` (24 titik × 3 = 72 angka)
  - `type Highlight = { set(id: HotspotId | null): boolean; current(): HotspotId | null; dispose(): void }` (`set` mengembalikan `true` hanya bila berubah)
  - `buildHighlight(scene: THREE.Scene, volumes?: ReadonlyArray<PickVolume>): Highlight`
  - `Stage.pick(x: number, y: number): HotspotId | null`, `Stage.setHighlight(id: HotspotId | null): void`
  - `LobbyCanvas` prop `highlight?: HotspotId | null`; `LobbyScene` prop `highlight?: HotspotId | null`

- [ ] **Step 1: Tulis tes `highlight` (gagal)**

`src/components/lobby/scene/highlight.test.ts`:

```ts
import * as THREE from "three"
import { describe, expect, it } from "vitest"
import { HOTSPOT_SPOTS, type Point3 } from "./layout"
import { boxEdgePositions, buildHighlight } from "./highlight"
import { PICK_VOLUMES } from "./pick-volumes"

describe("boxEdgePositions", () => {
  it("is the 12 edges of a box, each along one axis", () => {
    const min: Point3 = [1, 2, 3]
    const max: Point3 = [2, 4, 7]
    const p = boxEdgePositions(min, max)
    expect(p).toHaveLength(12 * 2 * 3)
    for (let i = 0; i < p.length; i += 6) {
      const a = p.slice(i, i + 3)
      const b = p.slice(i + 3, i + 6)
      const differing = [0, 1, 2].filter((k) => a[k] !== b[k])
      expect(differing).toHaveLength(1)
      for (let k = 0; k < 3; k++) {
        expect([min[k], max[k]]).toContain(a[k])
        expect([min[k], max[k]]).toContain(b[k])
      }
    }
  })
})

describe("buildHighlight", () => {
  const drawn = PICK_VOLUMES.filter((volume) => volume.outline)

  it("draws every drawn box's edges once, faintly, from the start", () => {
    const scene = new THREE.Scene()
    buildHighlight(scene)
    const faint = scene.getObjectByName("place-edges") as THREE.LineSegments
    expect(faint).toBeInstanceOf(THREE.LineSegments)
    expect(faint.geometry.getAttribute("position").count).toBe(
      drawn.length * 24
    )
  })

  it("lights one place strongly at a time, and none by default", () => {
    const scene = new THREE.Scene()
    const highlight = buildHighlight(scene)
    const strong = () =>
      scene.children.filter(
        (child) => child.name.startsWith("place-strong:") && child.visible
      )
    expect(strong()).toHaveLength(0)
    highlight.set("troli")
    expect(strong().map((child) => child.name)).toEqual(["place-strong:troli"])
    highlight.set("pintu")
    expect(strong().map((child) => child.name)).toEqual(["place-strong:pintu"])
    highlight.set(null)
    expect(strong()).toHaveLength(0)
  })

  it("has a strong group for every place", () => {
    const scene = new THREE.Scene()
    buildHighlight(scene)
    for (const { id } of HOTSPOT_SPOTS) {
      expect(scene.getObjectByName(`place-strong:${id}`), id).toBeDefined()
    }
  })

  it("reports a change only when the place changes (so one frame, no more)", () => {
    const highlight = buildHighlight(new THREE.Scene())
    expect(highlight.set(null)).toBe(false)
    expect(highlight.set("katalog")).toBe(true)
    expect(highlight.set("katalog")).toBe(false)
    expect(highlight.current()).toBe("katalog")
    expect(highlight.set(null)).toBe(true)
  })

  it("leaves nothing in the scene once disposed", () => {
    const scene = new THREE.Scene()
    buildHighlight(scene).dispose()
    expect(scene.children).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run --maxWorkers=2 src/components/lobby/scene/highlight.test.ts`
Expected: FAIL, "Failed to resolve import ./highlight".

- [ ] **Step 3: Tulis `highlight.ts`**

```ts
import * as THREE from "three"
import type { HotspotId, Point3 } from "./layout"
import { PICK_VOLUMES, type PickVolume } from "./pick-volumes"

/** The accent colour (styles.css: --color-mint). */
const EDGE_COLOR = "#2fe0b8"
/** The still edge of every usable place: thin, dim, never animated (spec 3G §3.4). */
const FAINT_OPACITY = 0.3
const STRONG_FILL_OPACITY = 0.16

/** Pairs of corner indices (bit 0 = x, bit 1 = y, bit 2 = z) that share an edge. */
const EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
]

/** The 12 edges of a box as line-segment positions: x, y, z of each end. */
export function boxEdgePositions(min: Point3, max: Point3): Array<number> {
  const corner = (index: number) => [
    index & 1 ? max[0] : min[0],
    index & 2 ? max[1] : min[1],
    index & 4 ? max[2] : min[2],
  ]
  return EDGES.flatMap(([a, b]) => [...corner(a), ...corner(b)])
}

export type Highlight = {
  /** Lights one place strongly (null: none); true when that changed anything. */
  set: (id: HotspotId | null) => boolean
  current: () => HotspotId | null
  dispose: () => void
}

function edgesOf(volumes: ReadonlyArray<PickVolume>): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      volumes.flatMap((v) => boxEdgePositions(v.min, v.max)),
      3
    )
  )
  return geometry
}

const lineMaterial = (opacity: number) =>
  new THREE.LineBasicMaterial({
    color: EDGE_COLOR,
    transparent: true,
    opacity,
    // The edges follow the hit boxes, not the surfaces: drawn over everything.
    depthTest: false,
  })

/**
 * The edges of the places a member can use (spec 3G §3.4): one thin line set
 * for all of them, always on, and a stronger one (full edges plus a faint
 * fill) for the one place that is picked or hovered. The edges are those of
 * the tap boxes: what glows is what answers a tap. Built in the "normal"
 * mode only; the still image has none.
 */
export function buildHighlight(
  scene: THREE.Scene,
  volumes: ReadonlyArray<PickVolume> = PICK_VOLUMES
): Highlight {
  const drawn = volumes.filter((volume) => volume.outline)
  const faintMaterial = lineMaterial(FAINT_OPACITY)
  const strongMaterial = lineMaterial(1)
  const fillMaterial = new THREE.MeshBasicMaterial({
    color: EDGE_COLOR,
    transparent: true,
    opacity: STRONG_FILL_OPACITY,
    depthTest: false,
    depthWrite: false,
  })
  const disposables: Array<{ dispose: () => void }> = [
    faintMaterial,
    strongMaterial,
    fillMaterial,
  ]

  const faint = new THREE.LineSegments(edgesOf(drawn), faintMaterial)
  faint.name = "place-edges"
  faint.renderOrder = 10
  faint.frustumCulled = false
  disposables.push(faint.geometry)
  scene.add(faint)

  const strong = new Map<HotspotId, THREE.Group>()
  for (const id of new Set(drawn.map((volume) => volume.id))) {
    const group = new THREE.Group()
    group.name = `place-strong:${id}`
    group.visible = false
    const own = drawn.filter((volume) => volume.id === id)
    const lines = new THREE.LineSegments(edgesOf(own), strongMaterial)
    lines.renderOrder = 12
    lines.frustumCulled = false
    disposables.push(lines.geometry)
    group.add(lines)
    for (const v of own) {
      const size = [0, 1, 2].map((k) => v.max[k] - v.min[k])
      const fill = new THREE.Mesh(
        new THREE.BoxGeometry(size[0], size[1], size[2]),
        fillMaterial
      )
      fill.position.set(
        (v.min[0] + v.max[0]) / 2,
        (v.min[1] + v.max[1]) / 2,
        (v.min[2] + v.max[2]) / 2
      )
      fill.renderOrder = 11
      disposables.push(fill.geometry)
      group.add(fill)
    }
    scene.add(group)
    strong.set(id, group)
  }

  let lit: HotspotId | null = null
  return {
    set(id) {
      if (id === lit) return false
      if (lit) {
        const old = strong.get(lit)
        if (old) old.visible = false
      }
      lit = id
      if (id) {
        const next = strong.get(id)
        if (next) next.visible = true
      }
      return true
    },
    current: () => lit,
    dispose() {
      scene.remove(faint, ...strong.values())
      for (const item of disposables) item.dispose()
    },
  }
}
```

- [ ] **Step 4: Jalankan tes `highlight`**

Run: `npx vitest run --maxWorkers=2 src/components/lobby/scene/highlight.test.ts`
Expected: PASS.

- [ ] **Step 5: Hubungkan ke `stage.ts`**

Perubahan di `src/components/lobby/scene/stage.ts`:
1. Impor: `import { buildHighlight } from "./highlight"`, `import { PICK_VOLUMES } from "./pick-volumes"`, `import { pickAt } from "./picker"`.
2. Di tipe `Stage`, setelah `skip`:
   ```ts
   /** The place under a point of the scene, in CSS pixels from its top left (spec 3G §4); null where there is none. */
   pick: (x: number, y: number) => HotspotId | null
   /** Lights one place strongly (null: none); the faint edges of every place are always drawn. A change asks for one frame (R1). */
   setHighlight: (id: HotspotId | null) => void
   ```
3. Di `buildStage`, tepat setelah `motion.update(0, 0)`:
   ```ts
   // The still image (mode "still") and the camera-bounds test have no edges.
   const highlight = mode === "normal" ? buildHighlight(scene) : null
   ```
4. Di objek yang dikembalikan, setelah `skip() { ... }`:
   ```ts
   pick(x, y) {
     return pickAt({ x, y }, view, viewport, PICK_VOLUMES)
   },
   setHighlight(id) {
     // Only a real change draws a frame: an idle room stays at 0 (R1).
     if (highlight?.set(id)) requestRender()
   },
   ```
5. Di `dispose()`, tepat sebelum `releaseScene()`: `highlight?.dispose()`.

- [ ] **Step 6: Tulis tes `LobbyCanvas` (gagal)**

Di `LobbyCanvas.test.tsx`: tambahkan `setHighlight: vi.fn(),` dan `pick: vi.fn(() => null),` ke objek `stage` yang di-`vi.hoisted`, lalu tambah tes di dalam `describe("LobbyCanvas", ...)`:

```tsx
  it("passes the lit place to the stage, now and when it changes", async () => {
    const canvas = (highlight: "troli" | null) => (
      <LobbyCanvas
        quality="tinggi"
        test={false}
        anda={ANDA_START}
        paused={false}
        showcase={[]}
        plant="tunas"
        signals={NEUTRAL_SIGNALS}
        decor={{}}
        highlight={highlight}
        onReady={vi.fn()}
        onView={vi.fn()}
        onQuality={vi.fn()}
        onFail={vi.fn()}
      />
    )
    const { rerender } = render(canvas("troli"))
    await vi.waitFor(() =>
      expect(stage.setHighlight).toHaveBeenCalledWith("troli")
    )
    rerender(canvas(null))
    expect(stage.setHighlight).toHaveBeenLastCalledWith(null)
  })
```

Run: `npx vitest run --maxWorkers=2 src/components/lobby/LobbyCanvas.test.tsx`
Expected: FAIL (`highlight` bukan prop / `setHighlight` tidak dipanggil).

- [ ] **Step 7: Prop `highlight` di `LobbyCanvas` dan `LobbyScene`**

`LobbyCanvas.tsx`: impor `type HotspotId` dari `./scene/layout` (gabung dengan impor `Point2, ShowcaseBook` yang ada); tambah prop `highlight?: HotspotId | null` (default `null`, dokumentasi: "The place lit strongly (spec 3G §3.4)"); tambah `const highlightRef = useRef(highlight)`; di `.then((stage) => {...})` setelah `stage.setShelves(...)` tambah `stage.setHighlight(highlightRef.current)`; tambah efek:

```tsx
  useEffect(() => {
    highlightRef.current = highlight
    stageRef.current?.setHighlight(highlight)
  }, [highlight])
```

`LobbyScene.tsx`: tambah prop `highlight?: HotspotId | null` (default `null`) dan teruskan `highlight={highlight}` ke `<LobbyCanvas>`.

- [ ] **Step 8: Jalankan tes terkait**

Run: `npx vitest run --maxWorkers=2 src/components/lobby/LobbyCanvas.test.tsx src/components/lobby/LobbyScene.test.tsx src/components/lobby/scene`
Expected: PASS.

- [ ] **Step 9: Lint, tipe, commit**

Run: prettier pada berkas yang disentuh, `npm run lint`, `npx tsc --noEmit`.

```bash
git add src/components/lobby/scene/highlight.ts src/components/lobby/scene/highlight.test.ts src/components/lobby/scene/stage.ts src/components/lobby/LobbyCanvas.tsx src/components/lobby/LobbyCanvas.test.tsx src/components/lobby/LobbyScene.tsx
git commit -m "feat(3g): faint edges on every place and a strong highlight in the 3D room

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Teks keadaan dan kartu nama

**Files:**
- Create: `src/components/lobby/place-status.ts`, `place-status.test.ts`, `PlaceCard.tsx`, `PlaceCard.test.tsx`
- Modify: `src/components/lobby/room-signals.ts`, `room-signals.test.ts`, `src/styles.css`

**Interfaces:**
- Consumes: `formatPercent` dari `@/lib/progress`; `ShelfFilter` dari `@/lib/shelf`; `HotspotId` dari `./scene/layout`; `HabitDay`, `goalSeconds`, `addDays` (sudah diimpor `room-signals.ts`).
- Produces:
  - `readingDaysBetween(days: ReadonlyArray<HabitDay>, from: string, to: string): number` di `room-signals.ts`
  - `type PlaceFacts` dan `placeStatus(id: HotspotId, facts: PlaceFacts): string` di `place-status.ts`
  - `PlaceCard({ name, status, statusId, onOpen, className? })`, `onOpen(how: { keyboard: boolean }): void`

- [ ] **Step 1: Tes `readingDaysBetween` (gagal)**

Tambahkan di `room-signals.test.ts` (impor `readingDaysBetween`):

```ts
describe("readingDaysBetween", () => {
  it("counts the days whose goal was met, both ends included, once each", () => {
    const days = [
      read("2026-11-09"),
      read("2026-11-09"),
      short("2026-11-10"),
      read("2026-11-13"),
      read("2026-11-14"),
    ]
    expect(readingDaysBetween(days, "2026-11-09", "2026-11-13")).toBe(2)
    expect(readingDaysBetween(days, "2026-11-10", "2026-11-12")).toBe(0)
    expect(readingDaysBetween([], "2026-11-09", "2026-11-13")).toBe(0)
  })
})
```

Run: `npx vitest run --maxWorkers=2 src/components/lobby/room-signals.test.ts` → FAIL (belum diekspor).

- [ ] **Step 2: Implementasi `readingDaysBetween`**

Di `room-signals.ts` ganti isi `fireLevel` dan tambahkan fungsi baru tepat di atasnya:

```ts
/** Reading days from `from` to `to`, both included: days whose goal was met (spec 3B §3.2). */
export function readingDaysBetween(
  days: ReadonlyArray<HabitDay>,
  from: string,
  to: string
): number {
  return new Set(
    days
      .filter(
        (d) =>
          d.day >= from &&
          d.day <= to &&
          d.seconds >= goalSeconds(d.goalMinutes)
      )
      .map((d) => d.day)
  ).size
}

/** A reading day is a day whose goal was met (spec 3B §3.2), as for the streak. */
export function fireLevel(
  days: ReadonlyArray<HabitDay>,
  today: string
): FireLevel {
  const read = readingDaysBetween(days, addDays(today, -6), today)
  if (read === 0) return "bara"
  return read <= 2 ? "kecil" : "besar"
}
```

(Hapus `fireLevel` lama beserta komentarnya.) Run tes room-signals → PASS (tes `fireLevel` lama tetap hijau).

- [ ] **Step 3: Tes `place-status` (gagal)**

`src/components/lobby/place-status.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { GENRE_VALUES } from "@/lib/genre"
import { formatPercent } from "@/lib/progress"
import type { ShelfFilter } from "@/lib/shelf"
import { type PlaceFacts, placeStatus } from "./place-status"

const none: PlaceFacts = {
  lastRead: null,
  counts: Object.fromEntries(
    ["semua", "troli", ...GENRE_VALUES].map((key) => [key, 0])
  ) as Record<ShelfFilter, number>,
  trolley: 0,
  finished: 0,
  savedWords: 0,
  weekDays: null,
  recentDays: null,
  coins: null,
  highlights: null,
}
const some = (more: Partial<PlaceFacts>): PlaceFacts => ({ ...none, ...more })

describe("placeStatus", () => {
  it("says the last book and how far for the reading chair", () => {
    expect(placeStatus("meja-baca", none)).toBe("Belum ada buku yang dibaca")
    expect(
      placeStatus(
        "meja-baca",
        some({ lastRead: { title: "Emma", percent: 42.9 } })
      )
    ).toBe(`Emma · ${formatPercent(42.9)}`)
  })

  it("counts the books of a genre", () => {
    const genre = GENRE_VALUES[0]
    expect(placeStatus(genre, none)).toBe("Belum ada buku")
    expect(
      placeStatus(genre, some({ counts: { ...none.counts, [genre]: 3 } }))
    ).toBe("3 buku")
  })

  it("counts the books waiting for a genre", () => {
    expect(placeStatus("troli", none)).toBe("Tidak ada buku baru")
    expect(placeStatus("troli", some({ trolley: 2 }))).toBe(
      "2 buku belum diberi genre"
    )
  })

  it("counts the finished books", () => {
    expect(placeStatus("lemari", none)).toBe("Belum ada buku yang selesai")
    expect(placeStatus("lemari", some({ finished: 4 }))).toBe("4 buku selesai")
  })

  it("counts the saved words", () => {
    expect(placeStatus("katalog", none)).toBe(
      "Kata yang kamu simpan dari bacaan"
    )
    expect(placeStatus("katalog", some({ savedWords: 12 }))).toBe(
      "12 kata tersimpan"
    )
  })

  it("counts the reading days of the week, with a short line while unknown or zero", () => {
    expect(placeStatus("tanaman", none)).toBe("Target dan kebiasaan membacamu")
    expect(placeStatus("tanaman", some({ weekDays: 0 }))).toBe(
      "Target dan kebiasaan membacamu"
    )
    expect(placeStatus("tanaman", some({ weekDays: 3 }))).toBe(
      "3 hari baca minggu ini"
    )
  })

  it("counts the coins", () => {
    expect(placeStatus("toko", none)).toBe("Hias ruang bacamu")
    expect(placeStatus("toko", some({ coins: 0 }))).toBe("Hias ruang bacamu")
    expect(placeStatus("toko", some({ coins: 250 }))).toBe("250 koin")
  })

  it("counts the reading days of the last 7 for the fireplace", () => {
    expect(placeStatus("perapian", none)).toBe("Rangkuman bacaanmu")
    expect(placeStatus("perapian", some({ recentDays: 5 }))).toBe(
      "5 dari 7 hari terakhir kamu membaca"
    )
  })

  it("counts the highlights, telling unknown from none and more from a full page", () => {
    expect(placeStatus("papan", none)).toBe("Sorotan dan catatanmu")
    expect(
      placeStatus("papan", some({ highlights: { count: 0, more: false } }))
    ).toBe("Belum ada sorotan")
    expect(
      placeStatus("papan", some({ highlights: { count: 7, more: false } }))
    ).toBe("7 sorotan")
    expect(
      placeStatus("papan", some({ highlights: { count: 20, more: true } }))
    ).toBe("20+ sorotan")
  })

  it("keeps the desk and the door's lines", () => {
    expect(placeStatus("meja-admin", none)).toBe("Tambahkan buku ke rak")
    expect(placeStatus("pintu", none)).toBe("Akun, tampilan, dan keluar")
  })
})
```

Run → FAIL ("Failed to resolve import ./place-status").

- [ ] **Step 4: Tulis `place-status.ts`**

```ts
import { formatPercent } from "@/lib/progress"
import type { ShelfFilter } from "@/lib/shelf"
import type { HotspotId } from "./scene/layout"

/**
 * What the lobby already knows about each place (spec 3G §3.5), gathered by
 * LobbyStage from data it has loaded anyway. `null` is "not known yet".
 */
export type PlaceFacts = {
  lastRead: { title: string; percent: number } | null
  /** Books per genre (and the trolley), as summarizeLobby counts them. */
  counts: Record<ShelfFilter, number>
  /** Books without a genre yet. */
  trolley: number
  finished: number
  savedWords: number
  /** Reading days since Monday; null while the habit is not known. */
  weekDays: number | null
  /** Reading days among the last 7; null while the habit is not known. */
  recentDays: number | null
  coins: number | null
  /** The highlights loaded (at most one page: `more` when it was full); null while not loaded. */
  highlights: { count: number; more: boolean } | null
}

/** The one line a place's card shows under its name. */
export function placeStatus(id: HotspotId, facts: PlaceFacts): string {
  switch (id) {
    case "meja-baca":
      return facts.lastRead
        ? `${facts.lastRead.title} · ${formatPercent(facts.lastRead.percent)}`
        : "Belum ada buku yang dibaca"
    case "troli":
      return facts.trolley > 0
        ? `${facts.trolley} buku belum diberi genre`
        : "Tidak ada buku baru"
    case "lemari":
      return facts.finished > 0
        ? `${facts.finished} buku selesai`
        : "Belum ada buku yang selesai"
    case "meja-admin":
      return "Tambahkan buku ke rak"
    case "katalog":
      return facts.savedWords > 0
        ? `${facts.savedWords} kata tersimpan`
        : "Kata yang kamu simpan dari bacaan"
    case "tanaman":
      return facts.weekDays
        ? `${facts.weekDays} hari baca minggu ini`
        : "Target dan kebiasaan membacamu"
    case "toko":
      return facts.coins ? `${facts.coins} koin` : "Hias ruang bacamu"
    case "perapian":
      return facts.recentDays
        ? `${facts.recentDays} dari 7 hari terakhir kamu membaca`
        : "Rangkuman bacaanmu"
    case "papan": {
      const { highlights } = facts
      if (highlights === null) return "Sorotan dan catatanmu"
      if (highlights.count === 0) return "Belum ada sorotan"
      return `${highlights.count}${highlights.more ? "+" : ""} sorotan`
    }
    case "pintu":
      return "Akun, tampilan, dan keluar"
    default: {
      // The rest are the genres.
      const count = facts.counts[id]
      return count > 0 ? `${count} buku` : "Belum ada buku"
    }
  }
}
```

Run: `npx vitest run --maxWorkers=2 src/components/lobby/place-status.test.ts` → PASS.

- [ ] **Step 5: Tes `PlaceCard` (gagal)**

`src/components/lobby/PlaceCard.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PlaceCard } from "./PlaceCard"

function renderCard(onOpen = vi.fn()) {
  render(
    <PlaceCard
      name="Kilas balik"
      status="Rangkuman bacaanmu"
      statusId="status-1"
      onOpen={onOpen}
    />
  )
  return onOpen
}

describe("PlaceCard", () => {
  it("shows the place's name and its one line", () => {
    renderCard()
    const card = screen.getByRole("group", { name: "Tempat dipilih" })
    expect(card).toHaveTextContent("Kilas balik")
    expect(screen.getByText("Rangkuman bacaanmu")).toHaveAttribute(
      "id",
      "status-1"
    )
  })

  it("opens the place from Buka, telling a click from a key press", () => {
    const onOpen = renderCard()
    const open = screen.getByRole("button", { name: "Buka" })
    fireEvent.click(open, { detail: 1 })
    expect(onOpen).toHaveBeenLastCalledWith({ keyboard: false })
    fireEvent.click(open, { detail: 0 })
    expect(onOpen).toHaveBeenLastCalledWith({ keyboard: true })
  })
})
```

Run → FAIL.

- [ ] **Step 6: Tulis `PlaceCard.tsx`**

```tsx
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * The name card of a picked place (spec 3G §3.5): its name, one line about
 * its state, and "Buka". `statusId` is what the focused place's button is
 * described by, so a screen reader says the line too (spec 3G §3.3).
 */
export function PlaceCard({
  name,
  status,
  statusId,
  onOpen,
  className,
}: {
  name: string
  status: string
  statusId: string
  /** `keyboard`: Enter or Space on the button, a click without a pointer. */
  onOpen: (how: { keyboard: boolean }) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Tempat dipilih"
      className={cn("lobby-card lobby-overlay", className)}
    >
      <div className="min-w-0">
        <p className="lobby-card-name truncate">{name}</p>
        <p id={statusId} className="lobby-card-status">
          {status}
        </p>
      </div>
      <Button
        size="lg"
        onClick={(event) => onOpen({ keyboard: event.detail === 0 })}
      >
        Buka
      </Button>
    </div>
  )
}
```

Run: `npx vitest run --maxWorkers=2 src/components/lobby/PlaceCard.test.tsx` → PASS.

- [ ] **Step 7: CSS kartu**

Di `src/styles.css`, di dalam blok `@layer` yang sama, tepat setelah aturan `.lobby-center` (media `min-width: 1024px` yang menutupnya), tambahkan:

```css
  /* The name card of a picked place (spec 3G §3.5): above the phone's sheet,
     at the foot of the scene on desktop. --lobby-sheet-h is set by
     use-sheet-height.ts. */
  .lobby-card {
    position: absolute;
    inset-inline: 0.5rem;
    bottom: calc(var(--lobby-sheet-h, 0px) + 0.5rem);
    z-index: 12;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.9rem;
    background: var(--color-panel);
    padding: 0.65rem 0.8rem;
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.45);
  }
  .lobby-card-name {
    font-weight: 700;
  }
  .lobby-card-status {
    font-size: 0.85rem;
    color: var(--muted-foreground);
  }
  @media (min-width: 1024px) {
    .lobby-card {
      inset-inline: auto;
      left: 50%;
      bottom: 1.5rem;
      width: min(24rem, 40%);
      translate: -50% 0;
    }
  }
```

- [ ] **Step 8: Lint, tipe, commit**

Run: prettier pada berkas yang disentuh, `npm run lint`, `npx tsc --noEmit`, `npx vitest run --maxWorkers=2 src/components/lobby/place-status.test.ts src/components/lobby/PlaceCard.test.tsx src/components/lobby/room-signals.test.ts src/lib/wording.test.ts`.

```bash
git add src/components/lobby/place-status.ts src/components/lobby/place-status.test.ts src/components/lobby/PlaceCard.tsx src/components/lobby/PlaceCard.test.tsx src/components/lobby/room-signals.ts src/components/lobby/room-signals.test.ts src/styles.css
git commit -m "feat(3g): place status lines and the name card

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Alur ketuk di HP; titik mode diam; hapus label pil dan tanda

**Files:**
- Create: `src/components/lobby/tap.ts`, `tap.test.ts`, `src/lib/use-fine-pointer.ts`, `src/components/lobby/use-sheet-height.ts`, `use-sheet-height.test.ts`
- Modify: `src/components/lobby/HotspotLayer.tsx`, `HotspotLayer.test.tsx` (tulis ulang), `LobbyScene.tsx`, `LobbyScene.test.tsx`, `LobbyStage.tsx`, `LobbyStage.test.tsx`, `src/styles.css`
- Delete: `src/components/lobby/label-layout.ts`, `label-layout.test.ts`

**Interfaces:**
- Consumes: `pickAt`/`Stage.pick` (Task 1–2), `anchorOf` (Task 1), `PlaceCard`, `placeStatus`, `PlaceFacts`, `readingDaysBetween` (Task 3), `highlight` prop (Task 2).
- Produces:
  - `createTapTracker()` dengan `down(sample): "gesture" | null`, `move(sample): "gesture" | null`, `up(sample): { x: number; y: number } | null`, `cancel(): void`; `TAP_SLOP_PX = 10`, `TAP_MAX_MS = 300`
  - `useFinePointer(): boolean` (`FINE_QUERY = "(hover: hover) and (pointer: fine)"`; `false` di server)
  - `useSheetHeight(page: RefObject<HTMLElement | null>, sheetKey: string): void`
  - `HotspotLayer` props: `{ hotspots, view, viewport, dots?: boolean, bubbles?, onKey(id), onTap(id), onFocusSpot?(id) }`
  - `LobbyScene` props baru: `onTap?(id: HotspotId | null)`, `onCameraGesture?()`, `onFocusPlace?(id)`; `onActivate(id, how)` tetap (hanya dipanggil dengan `{ keyboard: true }` dari tombol)
  - `LobbyStage`: state `chosen`, `lit`; `tapPlace(id | null)`

- [ ] **Step 1: Tes `tap` (gagal)**

`src/components/lobby/tap.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { TAP_MAX_MS, TAP_SLOP_PX, createTapTracker } from "./tap"

const touch = (x: number, y: number, time: number, id = 1) => ({
  id,
  x,
  y,
  time,
  type: "touch",
})

describe("createTapTracker", () => {
  it("calls a short press that hardly moved a tap, at where it began", () => {
    const tracker = createTapTracker()
    tracker.down(touch(100, 200, 0))
    expect(tracker.move(touch(104, 203, 50))).toBeNull()
    expect(tracker.up(touch(104, 203, 120))).toEqual({ x: 100, y: 200 })
  })

  it("calls a press that moved 10 px or more a drag, once", () => {
    const tracker = createTapTracker()
    tracker.down(touch(0, 0, 0))
    expect(tracker.move(touch(TAP_SLOP_PX, 0, 20))).toBe("gesture")
    expect(tracker.move(touch(40, 0, 30))).toBeNull()
    expect(tracker.up(touch(40, 0, 60))).toBeNull()
  })

  it("does not take a drag that came back as a tap", () => {
    const tracker = createTapTracker()
    tracker.down(touch(0, 0, 0))
    tracker.move(touch(30, 0, 20))
    expect(tracker.up(touch(0, 0, 60))).toBeNull()
  })

  it("calls a touch held for 300 ms or more a press, not a tap", () => {
    const tracker = createTapTracker()
    tracker.down(touch(5, 5, 0))
    expect(tracker.up(touch(5, 5, TAP_MAX_MS))).toBeNull()
  })

  it("lets a mouse click take as long as it likes", () => {
    const tracker = createTapTracker()
    tracker.down({ id: 1, x: 5, y: 6, time: 0, type: "mouse" })
    expect(tracker.up({ id: 1, x: 5, y: 6, time: 5000, type: "mouse" })).toEqual({
      x: 5,
      y: 6,
    })
  })

  it("takes a second finger as a camera gesture and no tap comes of it", () => {
    const tracker = createTapTracker()
    tracker.down(touch(0, 0, 0, 1))
    expect(tracker.down(touch(50, 50, 10, 2))).toBe("gesture")
    expect(tracker.up(touch(50, 50, 40, 2))).toBeNull()
    expect(tracker.up(touch(0, 0, 60, 1))).toBeNull()
  })

  it("starts afresh after a cancel", () => {
    const tracker = createTapTracker()
    tracker.down(touch(0, 0, 0))
    tracker.cancel()
    expect(tracker.up(touch(0, 0, 10))).toBeNull()
    tracker.down(touch(1, 2, 100))
    expect(tracker.up(touch(1, 2, 150))).toEqual({ x: 1, y: 2 })
  })
})
```

Run: `npx vitest run --maxWorkers=2 src/components/lobby/tap.test.ts` → FAIL.

- [ ] **Step 2: Tulis `tap.ts`**

```ts
/** A finger that moves this far (px) is a drag of the camera, not a tap (spec 3G §3.1). */
export const TAP_SLOP_PX = 10
/** A finger held this long (ms) is not a tap. */
export const TAP_MAX_MS = 300

export type PointerSample = {
  id: number
  x: number
  y: number
  /** `event.timeStamp`, in ms. */
  time: number
  /** `event.pointerType`. */
  type: string
}

/**
 * Tells a tap from a drag or a pinch of the camera (spec 3G §3.1). Pure: the
 * scene feeds it its pointer events. A mouse click is held to the distance
 * only, so a slow click on desktop still opens.
 */
export function createTapTracker() {
  let start: PointerSample | null = null
  let spoiled = false
  return {
    /** "gesture" when this is a second finger: the camera is being pinched. */
    down(sample: PointerSample): "gesture" | null {
      if (start) {
        spoiled = true
        return "gesture"
      }
      start = sample
      spoiled = false
      return null
    },
    /** "gesture" the first time the press moves far enough to be a drag. */
    move(sample: PointerSample): "gesture" | null {
      if (!start || spoiled || sample.id !== start.id) return null
      if (Math.hypot(sample.x - start.x, sample.y - start.y) < TAP_SLOP_PX) {
        return null
      }
      spoiled = true
      return "gesture"
    },
    /** Where the tap began, or null when it was not one. */
    up(sample: PointerSample): { x: number; y: number } | null {
      if (!start || sample.id !== start.id) return null
      const began = start
      start = null
      if (spoiled) return null
      const quick = began.type === "mouse" || sample.time - began.time < TAP_MAX_MS
      return quick ? { x: began.x, y: began.y } : null
    },
    cancel() {
      start = null
      spoiled = false
    },
  }
}
```

Run tes `tap` → PASS.

- [ ] **Step 3: `use-fine-pointer.ts` dan `use-sheet-height.ts`**

`src/lib/use-fine-pointer.ts`:

```ts
import { useSyncExternalStore } from "react"

/** A mouse or a trackpad that can hover: the desktop's behaviour in the lobby (spec 3G §3.2). */
export const FINE_QUERY = "(hover: hover) and (pointer: fine)"

function fineQuery(): MediaQueryList | null {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
    ? window.matchMedia(FINE_QUERY)
    : null
}

function subscribe(onChange: () => void): () => void {
  const list = fineQuery()
  list?.addEventListener("change", onChange)
  return () => list?.removeEventListener("change", onChange)
}

/** False on the server and in the first render: phones' behaviour first. */
export function useFinePointer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => fineQuery()?.matches ?? false,
    () => false
  )
}
```

`src/components/lobby/use-sheet-height.ts`:

```ts
import { type RefObject, useEffect } from "react"

/**
 * Sets `--lobby-sheet-h` on the page to the phone sheet's height plus its
 * 0.5rem offset (styles.css: .lobby-sheet), so the name card and the scene
 * can stay above it. `sheetKey` changes when the sheet is replaced.
 */
export function useSheetHeight(
  page: RefObject<HTMLElement | null>,
  sheetKey: string
): void {
  useEffect(() => {
    const root = page.current
    const sheet = root?.querySelector<HTMLElement>(".lobby-sheet")
    if (!root || !sheet) {
      root?.style.removeProperty("--lobby-sheet-h")
      return
    }
    const apply = () =>
      root.style.setProperty("--lobby-sheet-h", `${sheet.offsetHeight + 8}px`)
    apply()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(apply)
    observer.observe(sheet)
    return () => observer.disconnect()
  }, [page, sheetKey])
}
```

`src/components/lobby/use-sheet-height.test.ts`:

```ts
import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useSheetHeight } from "./use-sheet-height"

describe("useSheetHeight", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("sets the page's variable from the sheet, and follows it", () => {
    let resize = () => {}
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback
        }
        observe() {}
        disconnect() {}
      }
    )
    const page = document.createElement("div")
    const sheet = document.createElement("div")
    sheet.className = "lobby-sheet"
    page.append(sheet)
    let height = 120
    Object.defineProperty(sheet, "offsetHeight", { get: () => height })
    renderHook(() => useSheetHeight({ current: page }, "a"))
    expect(page.style.getPropertyValue("--lobby-sheet-h")).toBe("128px")
    height = 300
    resize()
    expect(page.style.getPropertyValue("--lobby-sheet-h")).toBe("308px")
  })

  it("clears the variable where there is no sheet", () => {
    const page = document.createElement("div")
    page.style.setProperty("--lobby-sheet-h", "99px")
    renderHook(() => useSheetHeight({ current: page }, "a"))
    expect(page.style.getPropertyValue("--lobby-sheet-h")).toBe("")
  })
})
```

Run: `npx vitest run --maxWorkers=2 src/components/lobby/use-sheet-height.test.ts` → PASS.

- [ ] **Step 4: Tulis ulang `HotspotLayer.tsx`**

Ganti seluruh isi berkas dengan:

```tsx
import { type ReactNode, useRef } from "react"
import type { HotspotModel } from "./lobby-data"
import type { HotspotId } from "./scene/layout"
import { anchorOf } from "./scene/pick-volumes"
import { type View, type Viewport, project } from "./scene/projection"

/**
 * The lobby's places as HTML buttons over the scene (spec 3G §3.3). No label
 * is drawn: the button is unseen, at its place's anchor, in the tab order
 * with the place's name, and shows only its focus ring. In the 3D scene it
 * lets pointers through (the scene decides what a tap meets); in the still
 * image (`dots`) it is a small dot that takes the tap itself (§3.8).
 */
export function HotspotLayer({
  hotspots,
  view,
  viewport,
  dots = false,
  bubbles,
  onKey,
  onTap,
  onFocusSpot,
}: {
  hotspots: ReadonlyArray<HotspotModel>
  view: View
  viewport: Viewport
  /** The still image: each place is a visible dot that can be tapped. */
  dots?: boolean
  /** Speech bubbles shown above a place. */
  bubbles?: Partial<Record<HotspotId, ReactNode>>
  /** Enter or Space (a click without a pointer): the page opens at once. */
  onKey: (id: HotspotId) => void
  /** A click or tap on a dot (the still image). */
  onTap: (id: HotspotId) => void
  /** Focus that is not a press: the place is picked, and the camera may follow. */
  onFocusSpot?: (id: HotspotId) => void
}) {
  // A press on a button focuses it before the click lands: that focus must
  // not pick the place a second time (the tap would then open it).
  const pressed = useRef(false)
  return (
    <div className="lobby-hotspots lobby-overlay">
      {hotspots.map((hotspot) => {
        const { x, y } = project(anchorOf(hotspot.id), view, viewport)
        return (
          <div
            key={hotspot.id}
            className="lobby-hotspot-anchor"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {bubbles?.[hotspot.id] && (
              <div className="lobby-hotspot-bubble">
                {bubbles[hotspot.id]}
              </div>
            )}
            <button
              type="button"
              className="lobby-hotspot"
              data-dot={dots ? "" : undefined}
              onPointerDown={() => {
                pressed.current = true
              }}
              onPointerCancel={() => {
                pressed.current = false
              }}
              onBlur={() => {
                pressed.current = false
              }}
              onClick={(event) => {
                pressed.current = false
                if (event.detail === 0) onKey(hotspot.id)
                else onTap(hotspot.id)
              }}
              onFocus={() => {
                if (!pressed.current) onFocusSpot?.(hotspot.id)
              }}
            >
              <span className="sr-only">{hotspot.label}</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Tulis ulang `HotspotLayer.test.tsx`**

Ganti seluruh isi:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sherlock } from "@/components/shelf/fixtures"
import type { ShelfBook } from "@/lib/book-types"
import { HotspotLayer } from "./HotspotLayer"
import { STILL_SIZE, STILL_VIEW } from "./LobbyStill"
import { lobbyHotspots, summarizeLobby } from "./lobby-data"
import { anchorOf } from "./scene/pick-volumes"
import { project } from "./scene/projection"

const onTrolley: ShelfBook = { ...sherlock, id: "t", genre: null }

function renderLayer(
  books: Array<ShelfBook>,
  more: Partial<Parameters<typeof HotspotLayer>[0]> = {}
) {
  const onKey = vi.fn()
  const onTap = vi.fn()
  const onFocusSpot = vi.fn()
  render(
    <HotspotLayer
      hotspots={lobbyHotspots(summarizeLobby(books).counts)}
      view={STILL_VIEW}
      viewport={STILL_SIZE}
      onKey={onKey}
      onTap={onTap}
      onFocusSpot={onFocusSpot}
      {...more}
    />
  )
  return { onKey, onTap, onFocusSpot }
}

describe("HotspotLayer", () => {
  it("names each place by its label alone, without a count", () => {
    renderLayer([sherlock, onTrolley])
    expect(
      screen.getByRole("button", { name: "Misteri & Thriller" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Kotak buku baru" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sudah dibaca" })).toBeInTheDocument()
  })

  it("starts at the reading chair and ends at the fireplace, corkboard and door", () => {
    renderLayer([sherlock])
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(18)
    expect(buttons[0]).toHaveAccessibleName("Kursi baca")
    expect(buttons.at(-6)).toHaveAccessibleName("Sudah dibaca")
    expect(buttons.at(-5)).toHaveAccessibleName("Kebiasaan baca")
    expect(buttons.at(-4)).toHaveAccessibleName("Toko dekorasi")
    expect(buttons.at(-3)).toHaveAccessibleName("Kilas balik")
    expect(buttons.at(-2)).toHaveAccessibleName("Sorotan")
    expect(buttons.at(-1)).toHaveAccessibleName("Pengaturan")
  })

  it("puts each place's button at its anchor on screen", () => {
    renderLayer([sherlock])
    const anchor = screen.getByRole("button", { name: "Kursi baca" })
      .parentElement as HTMLElement
    const { x, y } = project(anchorOf("meja-baca"), STILL_VIEW, STILL_SIZE)
    expect(anchor.style.left).toBe(`${x}%`)
    expect(anchor.style.top).toBe(`${y}%`)
  })

  it("draws dots only in the still image", () => {
    renderLayer([sherlock])
    for (const button of screen.getAllByRole("button")) {
      expect(button).not.toHaveAttribute("data-dot")
    }
  })

  it("makes a dot of each place in the still image, and taps through it", () => {
    const { onTap } = renderLayer([sherlock], { dots: true })
    const buttons = screen.getAllByRole("button")
    for (const button of buttons) expect(button).toHaveAttribute("data-dot")
    fireEvent.click(screen.getByRole("button", { name: "Meja tulis" }), {
      detail: 1,
    })
    expect(onTap).toHaveBeenCalledWith("meja-admin")
  })

  it("tells a press from Enter or Space (a click without a pointer)", () => {
    const { onKey, onTap } = renderLayer([sherlock])
    fireEvent.click(screen.getByRole("button", { name: "Meja tulis" }), {
      detail: 0,
    })
    expect(onKey).toHaveBeenCalledWith("meja-admin")
    expect(onTap).not.toHaveBeenCalled()
  })

  it("shows a speech bubble above its place", () => {
    renderLayer([sherlock], { bubbles: { "meja-baca": <p>Halo dari kursi</p> } })
    expect(screen.getByText("Halo dari kursi")).toBeInTheDocument()
  })

  it("picks the place on focus, but not on the focus a press brings", () => {
    const { onFocusSpot } = renderLayer([sherlock])
    const button = screen.getByRole("button", { name: "Meja tulis" })
    button.focus()
    expect(onFocusSpot).toHaveBeenCalledWith("meja-admin")
    onFocusSpot.mockClear()
    button.blur()
    fireEvent.pointerDown(button)
    button.focus()
    expect(onFocusSpot).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: CSS — hapus label, tambah titik dan cincin fokus**

Di `src/styles.css`, **hapus** aturan-aturan ini (blok antara komentar `/* Lobby scene (plan 1D, Task 8). */` dan `.lobby-center`): `.lobby-hotspot-anchor`, `.lobby-hotspot-anchor > *`, `.lobby-hotspot`, `.lobby-hotspot:hover, .lobby-hotspot:focus-visible`, `.lobby-hotspot:focus-visible`, `.lobby-hotspot[data-empty]`, `.lobby-hotspot-count`, semua `.lobby-hotspot[data-look="mark"]...` (tiga aturan), `.lobby-hotspot-anchor > .lobby-hotspot[data-look="unplaced"]...`, `.lobby-hotspot-measure`, `.lobby-hotspot-anchor:has(...)`, `.lobby-hotspot-badge`, dan blok `@media (max-width: 1023px) { .lobby-hotspot {...} }`. Pertahankan `.lobby-hotspots` dan `.lobby-center` (+ media 1024). Di tempatnya, setelah `.lobby-hotspots`, tambahkan:

```css
  /* A place is an unseen 44 px button at its anchor (spec 3G §3.3): bubbles
     sit above it, the focus ring shows on it. */
  .lobby-hotspot-anchor {
    position: absolute;
    width: 44px;
    height: 44px;
    translate: -50% -50%;
  }
  .lobby-hotspot-anchor > * {
    pointer-events: auto;
  }
  .lobby-hotspot-bubble {
    position: absolute;
    bottom: 100%;
    left: 50%;
    translate: -50% 0;
  }
  /* After the rule above, same specificity: the button lets pointers through
     to the 3D scene, which decides what a tap meets. */
  .lobby-hotspot {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 9999px;
    background: transparent;
    pointer-events: none;
  }
  .lobby-hotspot:focus-visible {
    outline: 2px solid var(--color-mint);
    outline-offset: 2px;
  }
  /* The still image has no edges to draw: a small dot, tapped itself (spec 3G §3.8). */
  .lobby-hotspot[data-dot] {
    position: relative;
    pointer-events: auto;
  }
  .lobby-hotspot[data-dot]::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 12px;
    height: 12px;
    translate: -50% -50%;
    border-radius: 9999px;
    background: var(--color-mint);
    box-shadow:
      0 0 0 2px #1b120c,
      0 0 0 3px var(--color-mint);
  }
```

- [ ] **Step 7: `LobbyScene.tsx` — gestur ketuk, tanpa label**

Perubahan:
1. Hapus impor `stillFrame` dari `./label-layout`, `useWideScreen`, dan state/efek `size` (`useState<Viewport | null>`, efek `ResizeObserver`/`resize` yang mengukur `sectionRef`), serta `const wide = useWideScreen()`. `sectionRef` tetap (dipakai `getBoundingClientRect`).
2. Impor `type PointerEvent` dari `react`, `createTapTracker` dari `./tap`.
3. Tambah prop: `onTap?: (id: HotspotId | null) => void` ("A tap on the scene: the place under it, or null on empty space (spec 3G §3.1)"), `onCameraGesture?: () => void` ("The camera starts to be dragged, pinched or zoomed"), `onFocusPlace?: (id: HotspotId) => void` ("A place's button took focus that is not a press"). `onActivate` tetap.
4. Di badan komponen, sebelum `return`:

```tsx
  const tracker = useRef(createTapTracker())
  /** The scene's own pointer events; buttons and links on top of it keep theirs. */
  const overOverlay = (event: { target: EventTarget }) =>
    event.target instanceof Element &&
    event.target.closest("button, a, output") !== null
  const sample = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return {
      id: event.pointerId,
      type: event.pointerType,
      time: event.timeStamp,
      x: event.clientX - box.left,
      y: event.clientY - box.top,
    }
  }
  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (overOverlay(event)) return
    if (tracker.current.down(sample(event))) onCameraGesture?.()
  }
  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (tracker.current.move(sample(event))) onCameraGesture?.()
  }
  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (overOverlay(event)) {
      tracker.current.cancel()
      return
    }
    const hit = tracker.current.up(sample(event))
    if (!hit) return
    // Without a live camera (the still image) a tap on empty space is just "nowhere".
    onTap?.(live ? (stageRef.current?.pick(hit.x, hit.y) ?? null) : null)
  }
```

5. Pada `<section>` tambahkan `onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => tracker.current.cancel()} onWheel={() => { if (live) onCameraGesture?.() }}`.
6. Ganti `<HotspotLayer ...>` dengan:

```tsx
        <HotspotLayer
          hotspots={hotspots}
          view={live ? camera.view : STILL_VIEW}
          viewport={live ? camera.viewport : STILL_SIZE}
          dots={!live}
          bubbles={bubbles}
          onKey={(id) => onActivate(id, { keyboard: true })}
          onTap={(id) => onTap?.(id)}
          onFocusSpot={(id) => {
            // A focused hotspot off screen brings the camera to it (spec 1D §6).
            if (live) reveal(id)
            onFocusPlace?.(id)
          }}
        />
```

(`frame`, `scene`, `fontPx` dihapus.) Komentar di atas komponen/`HotspotLayer` yang menyebut label diperbarui seperlunya.

- [ ] **Step 8: Perbarui `LobbyScene.test.tsx`**

- Hapus seluruh `describe("the labels' frame", ...)` (label sudah tiada).
- Di dua stub stage (`goLive` dan tes "keeps the same focused hotspot ...") tambahkan `pick: vi.fn(() => null), setHighlight: vi.fn(),`.
- Tes "shows the still image without WebGL, and its hotspots still work": klik tombol "Meja tulis" dengan `{ detail: 1 }` kini memanggil `onTap` (tambahkan `onTap` ke `renderScene`: `const onTap = vi.fn()` dan `onTap={onTap}` di `ui`, kembalikan di hasil) → `expect(onTap).toHaveBeenCalledWith("meja-admin")`; tambah klik `{ detail: 0 }` → `expect(onActivate).toHaveBeenCalledWith("meja-admin", { keyboard: true })`.
- Tes "brings an off-screen hotspot into view on keyboard focus only" diganti (tidak lagi memakai `:focus-visible`):

```tsx
    it("brings an off-screen hotspot into view on focus, but not on a press", async () => {
      const zoomed = { ...startView(viewport), zoom: MAX_ZOOM }
      const hidden = hotspots.find(
        ({ id }) => !isInView(spotOf(id).label, zoomed, viewport)
      )
      expect(hidden).toBeDefined()
      const { stage } = await goLive(zoomed)
      const button = screen.getByRole("button", {
        name: new RegExp(`^${hidden?.label}`),
      })

      // A press focuses the button before its click: the camera stays.
      fireEvent.pointerDown(button)
      act(() => button.focus())
      expect(stage.setView).not.toHaveBeenCalled()

      act(() => button.blur())
      act(() => button.focus())
      expect(stage.setView).toHaveBeenCalledWith(
        centerOn(zoomed, spotOf(hidden?.id ?? "meja-baca").label)
      )
    })
```

- Tambah `describe("taps on the 3D scene", ...)` di dalam `describe("with the 3D scene running", ...)`, memakai `goLive` (`stage.pick` dibuat per tes). `renderScene` perlu menerima `onTap`/`onCameraGesture` lewat `extra` (props `SceneProps`), jadi:

```tsx
    describe("taps on the scene", () => {
      const down = (el: Element, x: number, y: number, id = 1) =>
        fireEvent.pointerDown(el, {
          pointerId: id,
          pointerType: "touch",
          clientX: x,
          clientY: y,
        })
      const up = (el: Element, x: number, y: number, id = 1) =>
        fireEvent.pointerUp(el, {
          pointerId: id,
          pointerType: "touch",
          clientX: x,
          clientY: y,
        })

      it("hands a quick tap to the picker and reports the place it found", async () => {
        const onTap = vi.fn()
        const { stage } = await goLiveWith({ onTap })
        stage.pick.mockReturnValue("troli")
        const canvasEl = screen.getByTestId("lobby-canvas")
        down(canvasEl, 120, 80)
        up(canvasEl, 122, 81)
        expect(stage.pick).toHaveBeenCalledWith(120, 80)
        expect(onTap).toHaveBeenCalledWith("troli")
      })

      it("reports null for a tap on empty space", async () => {
        const onTap = vi.fn()
        const { stage } = await goLiveWith({ onTap })
        stage.pick.mockReturnValue(null)
        const canvasEl = screen.getByTestId("lobby-canvas")
        down(canvasEl, 10, 10)
        up(canvasEl, 10, 10)
        expect(onTap).toHaveBeenCalledWith(null)
      })

      it("takes a drag of 10 px or more as the camera, not a tap", async () => {
        const onTap = vi.fn()
        const onCameraGesture = vi.fn()
        await goLiveWith({ onTap, onCameraGesture })
        const canvasEl = screen.getByTestId("lobby-canvas")
        down(canvasEl, 100, 100)
        fireEvent.pointerMove(canvasEl, {
          pointerId: 1,
          pointerType: "touch",
          clientX: 130,
          clientY: 100,
        })
        up(canvasEl, 130, 100)
        expect(onCameraGesture).toHaveBeenCalledTimes(1)
        expect(onTap).not.toHaveBeenCalled()
      })

      it("takes a second finger and the wheel as the camera too", async () => {
        const onTap = vi.fn()
        const onCameraGesture = vi.fn()
        const { scene } = await goLiveWith({ onTap, onCameraGesture })
        const canvasEl = screen.getByTestId("lobby-canvas")
        down(canvasEl, 100, 100, 1)
        down(canvasEl, 150, 150, 2)
        expect(onCameraGesture).toHaveBeenCalledTimes(1)
        up(canvasEl, 150, 150, 2)
        up(canvasEl, 100, 100, 1)
        expect(onTap).not.toHaveBeenCalled()
        fireEvent.wheel(scene, { deltaY: -100 })
        expect(onCameraGesture).toHaveBeenCalledTimes(2)
      })

      it("leaves a press on a button to the button", async () => {
        const onTap = vi.fn()
        const { stage } = await goLiveWith({ onTap })
        const button = screen.getByRole("button", { name: "Pusatkan" })
        down(button, 5, 5)
        up(button, 5, 5)
        expect(stage.pick).not.toHaveBeenCalled()
        expect(onTap).not.toHaveBeenCalled()
      })
    })
```

dengan pembantu di atas `describe("with the 3D scene running")` yang menggeneralisasi `goLive`: ubah `goLive(view = startView(viewport))` menjadi `goLive(view = startView(viewport), extra: SceneProps = {})` yang meneruskan `renderScene(desktop, extra)`, tambah `pick: vi.fn(() => null as string | null), setHighlight: vi.fn(),` di stub-nya, dan definisikan `const goLiveWith = (extra: SceneProps) => goLive(startView(viewport), extra)`.

- [ ] **Step 9: Jalankan tes sejauh ini (gagal di `LobbyStage`, hijau di sisanya)**

Run: `npx vitest run --maxWorkers=2 src/components/lobby/HotspotLayer.test.tsx src/components/lobby/LobbyScene.test.tsx src/components/lobby/tap.test.ts`
Expected: PASS. (`label-layout.test.ts` masih ada dan hijau sampai dihapus.)

- [ ] **Step 10: Tes `LobbyStage` untuk alur ketuk (gagal)**

Di `LobbyStage.test.tsx`:
- Perluas tipe props mock `scene.props` dan `LobbyScene` mock: tambahkan `onTap?: (id: string | null) => void`, `onCameraGesture?: () => void`, `highlight?: string | null`.
- Tambah mock jalur pointer: 

```tsx
const pointer = vi.hoisted(() => ({ fine: false }))
vi.mock("@/lib/use-fine-pointer", () => ({
  useFinePointer: () => pointer.fine,
}))
```
  dan `pointer.fine = false` di `afterEach`.
- Tambah tes di `describe("LobbyStage")`:

```tsx
  describe("tap-first names (spec 3G)", () => {
    const card = () => screen.queryByRole("group", { name: "Tempat dipilih" })

    it("shows a card on the first tap and opens the page on the second", async () => {
      stubWideScreen(false)
      const { router } = renderStage(false)
      await vi.waitFor(() => expect(scene.props).not.toBeNull())
      const tap = scene.props!.onTap!
      await act(async () => tap("perapian"))
      expect(card()).toHaveTextContent("Kilas balik")
      expect(card()).toHaveTextContent("Rangkuman bacaanmu")
      expect(scene.props!.highlight).toBe("perapian")
      expect(handle.perform).not.toHaveBeenCalled()
      expect(router.state.location.pathname).toBe("/lobby")

      await act(async () => tap("perapian"))
      expect(handle.perform).toHaveBeenCalledWith("perapian")
      expect(card()).toBeNull()
      expect(router.state.location.pathname).toBe("/recap")
    })

    it("moves the card to another place without opening anything", async () => {
      stubWideScreen(false)
      renderStage(false)
      await vi.waitFor(() => expect(scene.props).not.toBeNull())
      const tap = scene.props!.onTap!
      await act(async () => tap("perapian"))
      await act(async () => tap("pintu"))
      expect(card()).toHaveTextContent("Pengaturan")
      expect(card()).toHaveTextContent("Akun, tampilan, dan keluar")
      expect(scene.props!.highlight).toBe("pintu")
      expect(handle.perform).not.toHaveBeenCalled()
    })

    it("closes the card on empty space and when the camera is moved", async () => {
      stubWideScreen(false)
      renderStage(false)
      await vi.waitFor(() => expect(scene.props).not.toBeNull())
      await act(async () => scene.props!.onTap!("pintu"))
      expect(card()).not.toBeNull()
      await act(async () => scene.props!.onTap!(null))
      expect(card()).toBeNull()
      expect(scene.props!.highlight).toBeNull()

      await act(async () => scene.props!.onTap!("pintu"))
      await act(async () => scene.props!.onCameraGesture!())
      expect(card()).toBeNull()
    })

    it("opens the page from Buka", async () => {
      stubWideScreen(false)
      const { router } = renderStage(false)
      await vi.waitFor(() => expect(scene.props).not.toBeNull())
      await act(async () => scene.props!.onTap!("pintu"))
      await act(async () =>
        fireEvent.click(screen.getByRole("button", { name: "Buka" }), {
          detail: 1,
        })
      )
      expect(handle.perform).toHaveBeenCalledWith("pintu")
      expect(router.state.location.pathname).toBe("/settings")
    })

    it("opens at once on a fine pointer, with no card", async () => {
      pointer.fine = true
      stubWideScreen(true)
      const { router } = renderStage(false)
      await vi.waitFor(() => expect(scene.props).not.toBeNull())
      await act(async () => scene.props!.onTap!("pintu"))
      expect(card()).toBeNull()
      expect(router.state.location.pathname).toBe("/settings")
    })

    it("skips instead of showing a card while Anda is on the way, and keeps the lit place", async () => {
      stubWideScreen(false)
      let finish = () => undefined as void
      handle.perform.mockImplementation(
        () => new Promise<void>((resolve) => (finish = resolve))
      )
      const { router } = renderStage(false)
      await vi.waitFor(() => expect(scene.props).not.toBeNull())
      await act(async () => scene.props!.onActivate!("perapian", { keyboard: false }))
      expect(scene.props!.highlight).toBe("perapian")
      await act(async () => scene.props!.onTap!("pintu"))
      expect(handle.skip).toHaveBeenCalledTimes(1)
      expect(card()).toBeNull()
      expect(scene.props!.highlight).toBe("pintu")
      await act(async () => finish())
      expect(router.state.location.pathname).toBe("/settings")
      expect(scene.props!.highlight).toBeNull()
    })

    it("takes the keyboard straight to the page and clears the card", async () => {
      stubWideScreen(false)
      renderStage(false)
      await vi.waitFor(() => expect(scene.props).not.toBeNull())
      await act(async () => scene.props!.onTap!("pintu"))
      await act(async () => scene.props!.onActivate!("pintu", { keyboard: true }))
      expect(handle.perform).toHaveBeenCalledWith("pintu", { instant: true })
      expect(card()).toBeNull()
    })
  })
```

Run: `npx vitest run --maxWorkers=2 src/components/lobby/LobbyStage.test.tsx` → FAIL (`onTap` tidak ada).

- [ ] **Step 11: Ubah `LobbyStage.tsx`**

Perubahan (urutan kemunculan):

1. Impor: `useId` dari `react`; `PlaceCard` dari `@/components/lobby/PlaceCard`; `{ type PlaceFacts, placeStatus } from "@/components/lobby/place-status"`; `readingDaysBetween` ke impor `room-signals`; `useSheetHeight` dari `@/components/lobby/use-sheet-height`; `shelfPercentage` dari `@/components/shelf/useLocalShelf` (gabungkan dengan impor `useLocalShelf`); `addDays, mondayOf` dari `@/lib/dates`; `useFinePointer` dari `@/lib/use-fine-pointer`; `useWordMeetings` ke impor dari `@/lib/vocab/vocab-client`.
2. Di bawah `const habit = useReadingHabit()` dan kawan-kawan tambahkan `const fine = useFinePointer()`, `const words = useWordMeetings()`, `const pageRef = useRef<HTMLDivElement>(null)`, `const statusId = useId()`.
3. Di dekat state lain (setelah `const [recapBubble, ...]`):

```tsx
  /** The place whose name card is open (spec 3G §3.1, §3.3). */
  const [chosen, setChosen] = useState<HotspotId | null>(null)
  /** The place Anda is on the way to: it stays lit until its page opens (spec 3G §4). */
  const [lit, setLit] = useState<HotspotId | null>(null)
```
4. Di blok `if (wasPopup !== popup) { ... if (popup) { ... } }` tambahkan `setChosen(null)` di dalam `if (popup)`. 
5. Setelah `const paused = popup || corkboard` (dan `covered`), tambahkan fakta dan sorotan:

```tsx
  const habitKnown = habit.status === "ready" || habit.status === "stale"
  const facts = useMemo<PlaceFacts>(
    () => ({
      lastRead: summary.lastRead
        ? {
            title: summary.lastRead.title,
            percent: shelfPercentage(summary.lastRead, local),
          }
        : null,
      counts: summary.counts,
      trolley: summary.trolley.length,
      finished: summary.finishedCount,
      savedWords: Object.keys(words).length,
      weekDays: habitKnown
        ? readingDaysBetween(habit.days, mondayOf(habit.today), habit.today)
        : null,
      recentDays: habitKnown
        ? readingDaysBetween(habit.days, addDays(habit.today, -6), habit.today)
        : null,
      coins: shop.state?.balance ?? null,
      highlights:
        highlights.state.status === "ready"
          ? {
              count: highlights.state.highlights.length,
              more: highlights.state.highlights.length >= CORKBOARD_FETCH,
            }
          : null,
    }),
    [summary, local, words, habitKnown, habit.days, habit.today, shop.state, highlights.state]
  )
  // Behind a popup or the corkboard's dialog nothing is picked or lit.
  const cardId = paused ? null : chosen
  const highlight = paused ? null : (lit ?? cardId)
  useSheetHeight(
    pageRef,
    `${popup}:${summary.lastRead?.id ?? ""}:${books.length === 0}`
  )
```

6. `activate(id, how)`: dalam cabang berjalan (`if (running.current)`) setelah `sceneRef.current?.skip()` tambahkan `setLit(id)`. Setelah `moveAnda(...)` dan `setReadingHint(false)` tambahkan `setChosen(null)`. Di cabang `else if (sceneRef.current)`: tepat setelah `target.current = id` tambahkan `setLit(id)`. Setelah blok `finally { running.current = false }` dan sebelum `const next = ...` tidak ada perubahan; **setelah** baris `newer.current = null` (yang kedua) tambahkan `setLit(null)`. Cabang keyboard tidak menyalakan `lit`.

7. Tambah fungsi sebelum `open`:

```tsx
  /** A tap on the scene (spec 3G §3.1, §3.2): a card on a phone, the page at once with a mouse. */
  function tapPlace(id: HotspotId | null) {
    if (paused) return
    // While Anda is on the way every tap on a place skips; the last decides (spec 3F §4A.1).
    if (running.current) {
      if (id) void activate(id, { keyboard: false })
      return
    }
    if (id === null) {
      setChosen(null)
      return
    }
    if (fine || chosen === id) {
      void activate(id, { keyboard: false })
      return
    }
    setChosen(id)
  }
```

8. JSX: `<div className="lobby-page" ref={pageRef} ...>`; pada `<LobbyScene ...>` tambahkan `highlight={highlight}`, `onTap={tapPlace}`, `onCameraGesture={() => setChosen(null)}`. (`onActivate` tetap.)
9. Di dalam `{!popup && (<> ... </>)}`, setelah `<ContinueSheet .../>` dan tombol tambah, sebelum `</>`, tambahkan:

```tsx
          {cardId && (
            <PlaceCard
              name={hotspots.find((spot) => spot.id === cardId)?.label ?? ""}
              status={placeStatus(cardId, facts)}
              statusId={statusId}
              onOpen={(how) => void activate(cardId, how)}
            />
          )}
```

Run: `npx vitest run --maxWorkers=2 src/components/lobby/LobbyStage.test.tsx` → PASS. Bila tes lama gagal karena nama tombol berhitungan, perbarui nama itu (hanya nama).

- [ ] **Step 12: Hapus `label-layout`**

```bash
git rm src/components/lobby/label-layout.ts src/components/lobby/label-layout.test.ts
```

`scene/layout.ts` memuat komentar yang menyebut `label-layout.test.ts` (konstanta `SECTION_LABEL_STEP`): ubah komentarnya menjadi "...so the labels stack without overlapping (the room map and the camera use them)". Cari sisa rujukan: `rg "label-layout|lobby-hotspot-measure|data-look|PillText" src e2e` harus kosong kecuali E2E (Task 7).

- [ ] **Step 13: Verifikasi dan commit**

Run: prettier pada berkas yang disentuh; `npm run lint`; `npx tsc --noEmit`; `npx vitest run --maxWorkers=2 src/components/lobby src/lib/wording.test.ts`.
Expected: semua hijau (E2E diperbarui di Task 7; jangan jalankan sekarang).

```bash
git add -A src/components/lobby src/lib/use-fine-pointer.ts src/styles.css
git commit -m "feat(3g): tap a place for its name card, a second tap opens it; labels removed

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Desktop (kursor di atas benda), fokus keyboard → kartu

**Files:**
- Create: `src/components/lobby/HoverName.tsx`, `HoverName.test.tsx`
- Modify: `src/components/lobby/HotspotLayer.tsx`, `HotspotLayer.test.tsx`, `LobbyScene.tsx`, `LobbyScene.test.tsx`, `LobbyStage.tsx`, `LobbyStage.test.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `Stage.pick`, `onTap`, `onFocusPlace`, `highlight`, `chosen` (Task 4).
- Produces:
  - `HoverName({ name: string; x: number; y: number })`
  - `LobbyScene` props baru: `onHover?(id: HotspotId | null)`, `describing?: { id: HotspotId; domId: string } | null`
  - `HotspotLayer` prop baru: `describing?: { id: HotspotId; domId: string } | null` (memberi `aria-describedby` pada tombol itu)
  - `LobbyStage`: state `hovered`

- [ ] **Step 1: Tes `HoverName` (gagal), lalu tulis**

`src/components/lobby/HoverName.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { HoverName } from "./HoverName"

describe("HoverName", () => {
  it("shows the name beside the cursor, unseen by assistive technology", () => {
    render(<HoverName name="Kotak buku baru" x={100} y={50} />)
    const name = screen.getByText("Kotak buku baru")
    expect(name).toHaveStyle({ left: "114px", top: "68px" })
    expect(name).toHaveAttribute("aria-hidden", "true")
  })
})
```

`src/components/lobby/HoverName.tsx`:

```tsx
/** The place's name beside the mouse cursor (spec 3G §3.2). Its button already carries the name for assistive technology. */
export function HoverName({
  name,
  x,
  y,
}: {
  name: string
  /** The cursor, in CSS pixels from the scene's top left. */
  x: number
  y: number
}) {
  return (
    <span
      aria-hidden="true"
      className="lobby-hover-name lobby-overlay"
      style={{ left: x + 14, top: y + 18 }}
    >
      {name}
    </span>
  )
}
```

Run: `npx vitest run --maxWorkers=2 src/components/lobby/HoverName.test.tsx` → FAIL lalu (setelah file ditulis) PASS.

- [ ] **Step 2: `aria-describedby` di `HotspotLayer`**

Tes (tambah di `HotspotLayer.test.tsx`):

```tsx
  it("describes only the place whose card is open", () => {
    renderLayer([sherlock], { describing: { id: "pintu", domId: "kartu-1" } })
    expect(screen.getByRole("button", { name: "Pengaturan" })).toHaveAttribute(
      "aria-describedby",
      "kartu-1"
    )
    expect(
      screen.getByRole("button", { name: "Kilas balik" })
    ).not.toHaveAttribute("aria-describedby")
  })
```

Implementasi: di `HotspotLayer.tsx` tambah prop `describing?: { id: HotspotId; domId: string } | null` (komentar: "The place the open name card describes: its button is described by the card's line (spec 3G §3.3)") dan pada `<button>`: `aria-describedby={describing?.id === hotspot.id ? describing.domId : undefined}`. `LobbyScene` meneruskan `describing` (prop baru, default `null`).

- [ ] **Step 3: Tes hover di `LobbyScene.test.tsx` (gagal)**

Di `describe("with the 3D scene running")` tambahkan:

```tsx
    describe("the mouse over the scene", () => {
      beforeEach(() => {
        vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => {
          run(0)
          return 1
        })
        vi.stubGlobal("cancelAnimationFrame", () => undefined)
      })
      afterEach(() => vi.unstubAllGlobals())
      const move = (el: Element, x: number, y: number, buttons = 0) =>
        fireEvent.pointerMove(el, {
          pointerId: 1,
          pointerType: "mouse",
          clientX: x,
          clientY: y,
          buttons,
        })

      it("names the place under the cursor and reports it once", async () => {
        const onHover = vi.fn()
        const { scene, stage } = await goLiveWith({ onHover })
        stage.pick.mockReturnValue("troli")
        move(screen.getByTestId("lobby-canvas"), 200, 120)
        expect(stage.pick).toHaveBeenCalledWith(200, 120)
        expect(screen.getByText("Kotak buku baru", { selector: ".lobby-hover-name" })).toBeVisible()
        expect(scene).toHaveAttribute("data-hover")
        move(screen.getByTestId("lobby-canvas"), 205, 124)
        expect(onHover).toHaveBeenCalledTimes(1)
        expect(onHover).toHaveBeenLastCalledWith("troli")
      })

      it("drops the name when the cursor leaves the place, or the scene", async () => {
        const onHover = vi.fn()
        const { scene, stage } = await goLiveWith({ onHover })
        stage.pick.mockReturnValue("troli")
        move(screen.getByTestId("lobby-canvas"), 200, 120)
        stage.pick.mockReturnValue(null)
        move(screen.getByTestId("lobby-canvas"), 10, 10)
        expect(document.querySelector(".lobby-hover-name")).toBeNull()
        expect(onHover).toHaveBeenLastCalledWith(null)
        stage.pick.mockReturnValue("troli")
        move(screen.getByTestId("lobby-canvas"), 200, 120)
        fireEvent.pointerLeave(scene)
        expect(document.querySelector(".lobby-hover-name")).toBeNull()
      })

      it("ignores touch, a dragged camera and a paused scene", async () => {
        const { stage, update } = await goLiveWith({})
        stage.pick.mockReturnValue("troli")
        fireEvent.pointerMove(screen.getByTestId("lobby-canvas"), {
          pointerId: 2,
          pointerType: "touch",
          clientX: 50,
          clientY: 50,
        })
        move(screen.getByTestId("lobby-canvas"), 60, 60, 1)
        expect(stage.pick).not.toHaveBeenCalled()
        update({ paused: true })
        move(screen.getByTestId("lobby-canvas"), 60, 60)
        expect(document.querySelector(".lobby-hover-name")).toBeNull()
      })
    })
```

(`goLive` harus mengembalikan `update` dari `renderScene`: sudah dalam `...rendered`.) Run → FAIL (`onHover` tidak ada).

- [ ] **Step 4: Implementasi hover di `LobbyScene.tsx`**

1. Impor `HoverName` dari `./HoverName`; `useCallback` tidak perlu.
2. Prop: `onHover?: (id: HotspotId | null) => void` ("The place under the mouse cursor changed (spec 3G §3.2)"), `describing?: { id: HotspotId; domId: string } | null` (default `null`).
3. State dan efek:

```tsx
  const [hover, setHover] = useState<{ id: HotspotId; x: number; y: number } | null>(null)
  const hoverFrame = useRef<number | null>(null)
  const hoverAt = useRef<{ x: number; y: number } | null>(null)
  // Nothing is hovered behind a popup, or without a live camera.
  const shownHover = live && !paused ? hover : null
  const hoverId = shownHover?.id ?? null
  useEffect(() => {
    onHover?.(hoverId)
  }, [hoverId, onHover])
  useEffect(
    () => () => {
      if (hoverFrame.current !== null) cancelAnimationFrame(hoverFrame.current)
    },
    []
  )
```

4. Di `onPointerMove`, setelah baris gestur:

```tsx
    if (!live || event.pointerType !== "mouse" || overOverlay(event)) return
    // A drag pans the camera: no name while a button is held.
    if (event.buttons !== 0) {
      setHover(null)
      return
    }
    hoverAt.current = sample(event)
    // At most one pick a frame, however fast the mouse moves.
    hoverFrame.current ??= requestAnimationFrame(() => {
      hoverFrame.current = null
      const at = hoverAt.current
      const id = at ? (stageRef.current?.pick(at.x, at.y) ?? null) : null
      setHover(at && id ? { id, x: at.x, y: at.y } : null)
    })
```

5. `<section ... data-hover={shownHover ? "" : undefined} onPointerLeave={() => setHover(null)}>`; dalam `<section>` setelah `<div className={live ? ...}>`:

```tsx
      {shownHover && (
        <HoverName
          name={hotspots.find((spot) => spot.id === shownHover.id)?.label ?? ""}
          x={shownHover.x}
          y={shownHover.y}
        />
      )}
```

6. Teruskan `describing={describing}` ke `<HotspotLayer>`.

Run: `npx vitest run --maxWorkers=2 src/components/lobby/LobbyScene.test.tsx src/components/lobby/HotspotLayer.test.tsx` → PASS.

- [ ] **Step 5: Tes dan kode `LobbyStage` untuk hover dan fokus (gagal, lalu hijau)**

Tambah di `describe("tap-first names (spec 3G)")` (mock `scene.props` perlu tipe `onHover?: (id: string | null) => void`, `onFocusPlace?: (id: string) => void`, `describing?: { id: string; domId: string } | null`):

```tsx
    it("lights the place under a mouse cursor, and nothing else", async () => {
      pointer.fine = true
      stubWideScreen(true)
      renderStage(false)
      await vi.waitFor(() => expect(scene.props).not.toBeNull())
      await act(async () => scene.props!.onHover!("toko"))
      expect(scene.props!.highlight).toBe("toko")
      expect(card()).toBeNull()
      await act(async () => scene.props!.onHover!(null))
      expect(scene.props!.highlight).toBeNull()
    })

    it("shows the card on keyboard focus, on any device, and describes the button by it", async () => {
      pointer.fine = true
      stubWideScreen(true)
      renderStage(false)
      await vi.waitFor(() => expect(scene.props).not.toBeNull())
      await act(async () => scene.props!.onFocusPlace!("perapian"))
      expect(card()).toHaveTextContent("Kilas balik")
      expect(scene.props!.highlight).toBe("perapian")
      const status = screen.getByText("Rangkuman bacaanmu")
      expect(scene.props!.describing).toEqual({
        id: "perapian",
        domId: status.id,
      })
    })

    it("keeps the card closed for a focus while Anda is on the way", async () => {
      stubWideScreen(false)
      handle.perform.mockImplementation(() => new Promise<void>(() => undefined))
      renderStage(false)
      await vi.waitFor(() => expect(scene.props).not.toBeNull())
      await act(async () => scene.props!.onActivate!("perapian", { keyboard: false }))
      await act(async () => scene.props!.onFocusPlace!("pintu"))
      expect(card()).toBeNull()
    })
```

Kode di `LobbyStage.tsx`:
- state `const [hovered, setHovered] = useState<HotspotId | null>(null)`; `highlight = paused ? null : (lit ?? hovered ?? cardId)`;
- di `if (popup)` blok `wasPopup` tambahkan `setHovered(null)`;
- `<LobbyScene ... onHover={setHovered} describing={cardId ? { id: cardId, domId: statusId } : null} onFocusPlace={(id) => { if (!paused && !running.current) setChosen(id) }} />`.

Run: `npx vitest run --maxWorkers=2 src/components/lobby/LobbyStage.test.tsx` → PASS.

- [ ] **Step 6: CSS hover**

Di `styles.css`, setelah aturan titik mode diam:

```css
  /* The place's name beside the mouse cursor (spec 3G §3.2). */
  .lobby-hover-name {
    position: absolute;
    z-index: 6;
    pointer-events: none;
    white-space: nowrap;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--color-panel);
    padding: 0.2rem 0.55rem;
    font-size: 0.8rem;
    font-weight: 700;
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.35);
  }
  .lobby-scene[data-hover] .lobby-canvas {
    cursor: pointer;
  }
```

- [ ] **Step 7: Verifikasi dan commit**

Run: prettier; `npm run lint`; `npx tsc --noEmit`; `npx vitest run --maxWorkers=2 src/components/lobby src/lib/wording.test.ts`.

```bash
git add -A src/components/lobby src/styles.css
git commit -m "feat(3g): hover name on desktop and the name card on keyboard focus

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Kamera HP tegak, sapaan dan "Pusatkan", petunjuk sekali

**Files:**
- Create: `src/components/lobby/Greeting.tsx`, `Greeting.test.tsx`, `PlaceHint.tsx`, `PlaceHint.test.tsx`, `place-hint.ts`, `place-hint.test.ts`
- Modify: `src/components/lobby/scene/projection.ts`, `scene/projection.test.ts`, `LobbyScene.tsx`, `LobbyScene.test.tsx`, `LobbyStage.tsx`, `LobbyStage.test.tsx`, `src/lib/local/keys.ts`, `src/styles.css`

**Interfaces:**
- Consumes: `startView`, `clampView`, `viewMoved` (frame-loop), `ANDA_START`, `spotOf` (layout), `useFinePointer`, `chosen`/`hovered` (Task 4–5).
- Produces:
  - `startView(viewport)`: HP tegak (tinggi > lebar) mengisi tinggi, berpusat pada Anda dan kursi baca, `zoom` ≤ `MAX_ZOOM`; lainnya tetap
  - `Greeting({ name })` (hilang sendiri setelah `GREETING_MS = 6000`)
  - `PlaceHint({ fine, onDone })`; `PLACE_HINT_MS = 6000`
  - `readPlaceHintSeen(): boolean`, `rememberPlaceHint(): void`; `PLACE_HINT_KEY = "glosa:place-hint-seen"` di `src/lib/local/keys.ts`

- [ ] **Step 1: Tes kamera (gagal)**

Di `projection.test.ts`:
- Ubah tes "shows the whole room at the start view (%o)": `it.each([DESKTOP])` (hanya desktop; judulnya tetap).
- Ubah tes "centres an axis ..." : `expect(view).toEqual(clampView({ target: [5, 2.3, 5], zoom: 1 }, PHONE))` menggantikan `toEqual(startView(PHONE))`.
- Tambah:

```ts
describe("the phone held upright (spec 3G §3.7)", () => {
  const aspects: Array<Viewport> = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 600, height: 700 },
  ]

  it.each(aspects)("fills the screen's height with the room (%o)", (viewport) => {
    const view = startView(viewport)
    expect(view.zoom).toBeGreaterThan(1)
    expect(view.zoom).toBeLessThanOrEqual(MAX_ZOOM)
    const ys = corners.map((corner) => project(corner, view, viewport).y)
    // The room's top and bottom corners reach to within a tenth of the height of each edge.
    expect(Math.min(...ys)).toBeLessThan(10)
    expect(Math.max(...ys)).toBeGreaterThan(90)
  })

  it.each(aspects)("is centred on Anda and the reading chair (%o)", (viewport) => {
    const view = startView(viewport)
    for (const point of [ANDA_START, spotOf("meja-baca").stand]) {
      const { x } = project([point[0], 0, point[1]], view, viewport)
      expect(x, `${point}`).toBeGreaterThan(0)
      expect(x, `${point}`).toBeLessThan(100)
    }
  })

  it.each(aspects)("never zooms out to a room narrower than the screen (%o)", (viewport) => {
    const out = clampView({ target: [5, 2, 5], zoom: 0.05 }, viewport)
    expect(out.zoom).toBe(MIN_ZOOM)
    const { halfWidth } = halfExtents(out.zoom, viewport)
    const room = (ROOM.width + ROOM.depth) / Math.SQRT2 + 2 * ROOM.pad
    expect(2 * halfWidth).toBeLessThanOrEqual(room + 1e-9)
  })

  it("leaves landscape and square screens as they were: the whole room", () => {
    for (const viewport of [DESKTOP, { width: 800, height: 800 }, { width: 844, height: 390 }]) {
      expect(startView(viewport).zoom).toBe(1)
    }
  })
})
```

dengan impor tambahan `ANDA_START`, `spotOf` dari `./layout` (gabung impor `ROOM`) dan `ROOM`. Run: `npx vitest run --maxWorkers=2 src/components/lobby/scene/projection.test.ts` → FAIL.

- [ ] **Step 2: Implementasi `startView`**

Di `projection.ts`: impor `ANDA_START`, `spotOf` dari `./layout` (bersama `ROOM`, `type Point3`). Ganti `startView`:

```ts
/** Where a phone held upright looks: between Anda's start and the reading chair (spec 3G §3.7). */
const PORTRAIT_FOCUS: Point3 = [
  (ANDA_START[0] + spotOf("meja-baca").stand[0]) / 2,
  ROOM.height / 2,
  (ANDA_START[1] + spotOf("meja-baca").stand[1]) / 2,
]

/**
 * The first view. Wide and square screens: the whole room. A phone held
 * upright: the room fills the screen's height and the sides are cropped (the
 * camera pans to them); it never zooms out to less than the screen's width
 * (MIN_ZOOM), which is the old whole-room view.
 */
export function startView(viewport: Viewport): View {
  const portrait = viewport.height > viewport.width
  if (!portrait) {
    return clampView(
      {
        target: [ROOM.width / 2, ROOM.height / 2, ROOM.depth / 2],
        zoom: 1,
      },
      viewport
    )
  }
  const aspect = viewport.width / viewport.height
  const fill = baseHalfHeight(aspect) / ((EXTENT.v1 - EXTENT.v0) / 2)
  return clampView({ target: PORTRAIT_FOCUS, zoom: Math.min(MAX_ZOOM, fill) }, viewport)
}
```

(`PORTRAIT_FOCUS` didefinisikan di atas `startView`; `baseHalfHeight` dan `EXTENT` sudah ada di berkas.) Run tes projection → PASS. Bila `x` Anda/kursi keluar layar untuk satu rasio, geser `PORTRAIT_FOCUS`, jangan tesnya.

Cek lintas modul: `layout.ts` tidak mengimpor `projection.ts` (tanpa siklus).

- [ ] **Step 3: Tes "Pusatkan" di HP tegak (gagal), lalu implementasi**

`LobbyScene.test.tsx`, di `describe("with the 3D scene running")`:

```tsx
    describe("on a phone held upright", () => {
      const phone = { width: 390, height: 700 }
      async function goPhone() {
        const rendered = renderScene(desktop)
        await vi.waitFor(() => expect(canvas.props).not.toBeNull())
        const stage = {
          books: 0, setView: vi.fn(), walkTo: vi.fn(), setPaused: vi.fn(),
          setShowcase: vi.fn(), setPlant: vi.fn(), setSignals: vi.fn(),
          setNotes: vi.fn(), setShelves: vi.fn(), setDecor: vi.fn(),
          setMood: vi.fn(), perform: vi.fn(() => Promise.resolve()),
          skip: vi.fn(), playMoments: vi.fn(), dispose: vi.fn(),
          pick: vi.fn(() => null), setHighlight: vi.fn(),
        }
        act(() => {
          canvas.props?.onView(startView(phone), phone)
          canvas.props?.onReady(stage)
        })
        return { ...rendered, stage }
      }

      it("shows Pusatkan only after the camera left its first view", async () => {
        await goPhone()
        expect(screen.queryByRole("button", { name: "Pusatkan" })).toBeNull()
        act(() => {
          canvas.props?.onView(panBy(startView(phone), 0.2, 0, phone), phone)
        })
        expect(screen.getByRole("button", { name: "Pusatkan" })).toBeVisible()
        act(() => canvas.props?.onView(startView(phone), phone))
        expect(screen.queryByRole("button", { name: "Pusatkan" })).toBeNull()
      })
    })
```

Implementasi di `LobbyScene.tsx`: impor `viewMoved` dari `./scene/frame-loop`; sebelum `return`:

```tsx
  // On a phone held upright "Pusatkan" waits for the camera to leave its
  // first view (spec 3G §3.7); elsewhere it is always there, as before.
  const upright = camera !== null && camera.viewport.height > camera.viewport.width
  const away = camera !== null && viewMoved(camera.view, startView(camera.viewport))
```

dan ganti kondisi tombol: `{live && (!upright || away) && (<Button ...>)}`. Run tes LobbyScene → PASS (tes lama 1280×720 tidak berubah).

- [ ] **Step 4: Sapaan hilang sendiri; "Pusatkan" tak tertutup**

`src/components/lobby/Greeting.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GREETING_MS, Greeting } from "./Greeting"

describe("Greeting", () => {
  afterEach(() => vi.useRealTimers())

  it("welcomes the member back and goes away by itself", () => {
    vi.useFakeTimers()
    render(<Greeting name="Ani Baca" />)
    expect(screen.getByText("Selamat datang kembali, Ani Baca!")).toBeVisible()
    act(() => void vi.advanceTimersByTime(GREETING_MS))
    expect(screen.queryByText(/Selamat datang kembali/)).toBeNull()
  })
})
```

`src/components/lobby/Greeting.tsx`:

```tsx
import { useEffect, useState } from "react"

/** How long the greeting stays (spec 3G §3.7: it goes by itself and covers no button). */
export const GREETING_MS = 6000

export function Greeting({ name }: { name: string }) {
  const [shown, setShown] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setShown(false), GREETING_MS)
    return () => clearTimeout(timer)
  }, [])
  if (!shown) return null
  return <output className="lobby-notice">Selamat datang kembali, {name}!</output>
}
```

`LobbyStage.tsx`: ganti `<output className="lobby-notice">Selamat datang kembali, {user.displayName}!</output>` (di dalam `{kembali === 1 && (...)}`) dengan `<Greeting name={user.displayName} />` dan impor. Tes `LobbyStage` lama yang mencari teks sapaan tetap lulus (teks sama; tidak ada timer palsu → tampil).

CSS: pada `.lobby-center` tambahkan `z-index: 12;` (ubah dari 5; lebih tinggi daripada `.lobby-notices` z-index 11) dengan komentar "above the greeting and the notices: never covered (spec 3G §3.7)". Tambahkan setelah blok media `.lobby-center` desktop:

```css
  /* On a phone the scene ends above the "Lanjutkan membaca" sheet, so the
     room the camera fits is the room the member sees (spec 3G §3.7). */
  @media (max-width: 1023px) {
    .lobby-scene {
      bottom: min(var(--lobby-sheet-h, 0px), 9rem);
    }
  }
```

(Aturan ini harus datang **setelah** `.lobby-scene { position: absolute; inset: 0; ... }` agar `bottom` menang; karena berada di akhir blok lobi, aman. Periksa urutan di berkas.)

- [ ] **Step 5: Petunjuk sekali**

`src/lib/local/keys.ts`, tambahkan di akhir: 

```ts
/** Set once the lobby's "tap a thing to see its name" line has been shown on this device (spec 3G §3.4). */
export const PLACE_HINT_KEY = "glosa:place-hint-seen"
```

`src/components/lobby/place-hint.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { PLACE_HINT_KEY } from "@/lib/local/keys"
import { readPlaceHintSeen, rememberPlaceHint } from "./place-hint"

describe("place hint memory", () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("is unseen until remembered, then seen", () => {
    expect(readPlaceHintSeen()).toBe(false)
    rememberPlaceHint()
    expect(localStorage.getItem(PLACE_HINT_KEY)).toBe("1")
    expect(readPlaceHintSeen()).toBe(true)
  })

  it("shows again where storage fails, and never throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(readPlaceHintSeen()).toBe(false)
    expect(() => rememberPlaceHint()).not.toThrow()
  })
})
```

`src/components/lobby/place-hint.ts`:

```ts
import { PLACE_HINT_KEY } from "@/lib/local/keys"

export function readPlaceHintSeen(): boolean {
  try {
    return localStorage.getItem(PLACE_HINT_KEY) !== null
  } catch {
    // No storage: the hint may show again.
    return false
  }
}

export function rememberPlaceHint(): void {
  try {
    localStorage.setItem(PLACE_HINT_KEY, "1")
  } catch {
    // Storage can be off (private windows): the hint may show again.
  }
}
```

`src/components/lobby/PlaceHint.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PLACE_HINT_MS, PlaceHint } from "./PlaceHint"

describe("PlaceHint", () => {
  afterEach(() => vi.useRealTimers())

  it("tells a phone to tap and a mouse to point, then is done after 6 seconds", () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    const { rerender } = render(<PlaceHint fine={false} onDone={onDone} />)
    expect(screen.getByText("Ketuk benda untuk melihat namanya")).toBeVisible()
    rerender(<PlaceHint fine onDone={onDone} />)
    expect(
      screen.getByText("Arahkan kursor ke benda untuk melihat namanya")
    ).toBeVisible()
    expect(onDone).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(PLACE_HINT_MS))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
```

`src/components/lobby/PlaceHint.tsx`:

```tsx
import { useEffect } from "react"

/** How long the hint stays when nothing is tapped or pointed at (spec 3G §3.4). */
export const PLACE_HINT_MS = 6000

/** The one line that says how to learn a place's name; shown once on a device. */
export function PlaceHint({
  fine,
  onDone,
}: {
  fine: boolean
  onDone: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, PLACE_HINT_MS)
    return () => clearTimeout(timer)
  }, [onDone])
  return (
    <output className="lobby-hint lobby-overlay">
      {fine
        ? "Arahkan kursor ke benda untuk melihat namanya"
        : "Ketuk benda untuk melihat namanya"}
    </output>
  )
}
```

CSS (di dekat `.lobby-card`):

```css
  /* The one-time line about names (spec 3G §3.4), where the card will be. */
  .lobby-hint {
    position: absolute;
    left: 50%;
    bottom: calc(var(--lobby-sheet-h, 0px) + 0.5rem);
    z-index: 12;
    translate: -50% 0;
    border-radius: 9999px;
    background: var(--color-panel);
    padding: 0.4rem 0.9rem;
    font-size: 0.85rem;
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.35);
    pointer-events: none;
  }
  @media (min-width: 1024px) {
    .lobby-hint {
      bottom: 1.5rem;
    }
  }
```

Sambungkan di `LobbyStage.tsx`:

```tsx
  // The hint shows once per device, when the live room first shows (spec 3G §3.4).
  const [hint, setHint] = useState<"idle" | "shown" | "done">("idle")
  useEffect(() => {
    if (hint === "idle" && sceneLive && !popup && !readPlaceHintSeen()) {
      setHint("shown")
    }
  }, [hint, sceneLive, popup])
  const endHint = useCallback(() => {
    setHint("done")
    rememberPlaceHint()
  }, [])
  // The first tap, cursor or card makes it unnecessary.
  useEffect(() => {
    if (hint === "shown" && (chosen !== null || hovered !== null)) endHint()
  }, [hint, chosen, hovered, endHint])
```

dan dalam JSX (di dalam `{!popup && (<>...)}`, sebelum `PlaceCard`): `{hint === "shown" && !cardId && <PlaceHint fine={fine} onDone={endHint} />}`. Impor `useCallback`, `PlaceHint`, `readPlaceHintSeen`, `rememberPlaceHint`.

Tes `LobbyStage` (tambah di `describe("tap-first names")`; `localStorage.clear()` sudah di `afterEach`; mock scene live dengan `scene.props!.onLiveChange!(true)`):

```tsx
    it("shows the hint once, until a first tap, and remembers it", async () => {
      stubWideScreen(false)
      renderStage(false)
      await vi.waitFor(() => expect(scene.props).not.toBeNull())
      expect(screen.queryByText(/untuk melihat namanya/)).toBeNull()
      await act(async () => scene.props!.onLiveChange!(true))
      expect(screen.getByText("Ketuk benda untuk melihat namanya")).toBeVisible()
      await act(async () => scene.props!.onTap!("pintu"))
      expect(screen.queryByText(/untuk melihat namanya/)).toBeNull()
      expect(localStorage.getItem("glosa:place-hint-seen")).toBe("1")
    })

    it("does not show the hint again on a device that has seen it", async () => {
      localStorage.setItem("glosa:place-hint-seen", "1")
      stubWideScreen(false)
      renderStage(false)
      await vi.waitFor(() => expect(scene.props).not.toBeNull())
      await act(async () => scene.props!.onLiveChange!(true))
      expect(screen.queryByText(/untuk melihat namanya/)).toBeNull()
    })
```

- [ ] **Step 6: Verifikasi dan commit**

Run: prettier; `npm run lint`; `npx tsc --noEmit`; `npx vitest run --maxWorkers=2 src/components/lobby src/lib/wording.test.ts`.
Expected: hijau.

```bash
git add -A src/components/lobby src/lib/local/keys.ts src/styles.css
git commit -m "feat(3g): upright phone camera, self-closing greeting, one-time place hint

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: E2E, pemindai kata, pembersihan, verifikasi akhir

**Files:**
- Modify: `e2e/lobby.spec.ts`, `e2e/lobby-popup.spec.ts`, `e2e/collections.spec.ts`, `e2e/offline.spec.ts`, `e2e/lobby-3d.spec.ts`

**Interfaces:**
- Consumes: kartu (`role="group"` bernama "Tempat dipilih", tombol "Buka"), tombol tempat bernama label, `.lobby-hover-name`, `[data-dot]` di mode diam.
- Produces: tidak ada (hanya tes).

- [ ] **Step 1: Perbarui nama tombol (tanpa hitungan)**

Ganti di semua E2E, memakai `exact: true`:
- `e2e/lobby.spec.ts`: baris 37 `"Fiksi & Sastra · 0 buku"` → `"Fiksi & Sastra"`; baris 46 `"Misteri & Thriller · 1 buku"` → `"Misteri & Thriller"`; baris 58 `"Kotak buku baru · 1 buku"` → `"Kotak buku baru"`; baris 71 `"Fiksi & Sastra · 1 buku"` → `"Fiksi & Sastra"` (tambahkan `exact: true`).
- `e2e/lobby-popup.spec.ts` baris 124 dan 136: `"Fiksi & Sastra · 0 buku"` → `"Fiksi & Sastra"`, `exact: true`.
- `e2e/collections.spec.ts` baris 161: `"Sudah dibaca · 1 buku"` → `"Sudah dibaca"`, `exact: true` (locator sudah dibatasi `scene`).
- `e2e/offline.spec.ts` baris 94: `"Kotak buku baru · 1 buku"` → `"Kotak buku baru"`, `exact: true`.

Pastikan sisanya: `rg "· [0-9]+ buku" e2e` kosong.

- [ ] **Step 2: `e2e/lobby.spec.ts` — ganti tes label bertabrakan**

Hapus seluruh tes `"no two room labels overlap, and none covers the greeting"`. Di tempatnya tambahkan:

```ts
test("the room has no fixed labels: every place is an unseen button, and the greeting covers none", async ({
  page,
  isMobile,
}) => {
  await signInAndOnboard(page, await createConfirmedMember())
  const scene = await openLobby(page)
  const buttons = scene.locator("button.lobby-hotspot")
  await expect(buttons).toHaveCount(18)
  // No label is drawn: a button shows nothing but a dot (still image) or its focus ring.
  const labelled = await buttons.evaluateAll(
    (list) =>
      list.filter((button) => {
        const style = getComputedStyle(button)
        return style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.borderTopWidth !== "0px"
      }).length
  )
  expect(labelled).toBe(0)
  await expect(page.locator(".lobby-hotspot-measure")).toHaveCount(0)
  if (!isMobile) {
    const welcome = page
      .getByText("Rakmu masih kosong. Bawa buku pertamamu ke sini!")
      .filter({ visible: true })
    await expect(welcome).toBeVisible()
  }
})

test("focusing a place shows its name card with its state; Buka opens its page", async ({
  page,
}) => {
  await memberWithBook(page)
  const scene = await openLobby(page)
  const card = page.getByRole("group", { name: "Tempat dipilih" })
  await expect(card).toHaveCount(0)
  const trolley = scene.getByRole("button", { name: "Kotak buku baru", exact: true })
  await trolley.focus()
  await expect(card).toContainText("Kotak buku baru")
  await expect(card).toContainText("1 buku belum diberi genre")
  await expect(trolley).toHaveAccessibleDescription("1 buku belum diberi genre")
  await card.getByRole("button", { name: "Buka" }).click()
  await expect(page.getByRole("dialog", { name: "Susun buku" })).toBeVisible()
  await expect(card).toHaveCount(0)
})

test("Enter on a focused place opens its page at once, with no second step", async ({
  page,
}) => {
  await signInAndOnboard(page, await createConfirmedMember())
  const scene = await openLobby(page)
  await scene.getByRole("button", { name: "Pengaturan", exact: true }).press("Enter")
  await expect(page).toHaveURL(/\/settings$/)
})
```

Di `test.describe("a hotspot at still quality")`:
- Tes `"at still quality a click and a double click on Kilas balik each open /recap"`: ubah signature menjadi `async ({ page, isMobile })` dan tambahkan di awal `test.skip(isMobile, "a phone taps once for the name card first")`.
- Tambahkan:

```ts
  test("on a phone a tap on a place shows its card, and a second tap opens it", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "a mouse opens at once")
    await signInAndOnboard(page, await createConfirmedMember())
    const scene = await openLobby(page)
    const card = page.getByRole("group", { name: "Tempat dipilih" })
    await fireplace(scene).click()
    await expect(card).toContainText("Kilas balik")
    await expect(card).toContainText("Rangkuman bacaanmu")
    await expect(page).toHaveURL(/\/lobby$/)
    await fireplace(scene).click()
    await expect(page).toHaveURL(/\/recap$/)
  })

  test("on a phone a tap on empty space closes the card", async ({ page, isMobile }) => {
    test.skip(!isMobile, "a mouse has no card")
    await signInAndOnboard(page, await createConfirmedMember())
    const scene = await openLobby(page)
    const card = page.getByRole("group", { name: "Tempat dipilih" })
    await fireplace(scene).click()
    await expect(card).toBeVisible()
    const box = (await scene.boundingBox())!
    await page.mouse.click(box.x + 4, box.y + 4)
    await expect(card).toHaveCount(0)
  })
```

- [ ] **Step 3: `e2e/lobby-3d.spec.ts` — ketuk di kanvas**

Tambahkan pembantu di atas tes pertama:

```ts
/** The middle of a place's (unseen) button: where its anchor shows on the canvas. */
async function centreOf(page: Page, name: string) {
  const box = await sceneOf(page)
    .getByRole("button", { name, exact: true })
    .boundingBox()
  if (!box) throw new Error(`no button ${name}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
```

Ubah tes-tes yang sebelumnya mengklik tombol (tombol kini tak menerima penunjuk di 3D):
- `"a hotspot on the 3D scene opens the upload"`: ganti `await scene.getByRole("button", { name: "Meja tulis", exact: true }).click()` dengan

```ts
  const desk = await centreOf(page, "Meja tulis")
  // The mouse is a fine pointer: one click opens (no name card).
  await page.mouse.click(desk.x, desk.y)
```
- Tes still quality 3D (`"Kilas balik"` klik): ganti `.click()` dengan `const at = await centreOf(page, "Kilas balik"); await page.mouse.click(at.x, at.y)`.
- `"at the start view every hotspot sits inside the scene"`: ganti pengecekan kotak penuh dengan pusat: untuk tiap tombol `const cx = box.x + box.width / 2`, `cy = box.y + box.height / 2`, lalu `expect(cx, name).toBeGreaterThanOrEqual(sceneBox.x)` dan `toBeLessThanOrEqual(sceneBox.x + sceneBox.width)`; sama untuk y.

Tambahkan tes baru:

```ts
test("the mouse over a place names it in the room, and a click opens it", async ({ page }) => {
  test.setTimeout(300_000)
  await signInAndOnboard(page, await createConfirmedMember())
  const scene = sceneOf(page)
  await expect(scene.locator("canvas")).toBeVisible({ timeout: 120_000 })
  const desk = await centreOf(page, "Meja tulis")
  await page.mouse.move(desk.x, desk.y)
  await expect(scene.locator(".lobby-hover-name")).toHaveText("Meja tulis")
  await page.mouse.move(2, 2)
  await expect(scene.locator(".lobby-hover-name")).toHaveCount(0)
})

test.describe("on a phone held upright", () => {
  // The device's browser type is fixed by the project; the rest is a Pixel 5.
  const { defaultBrowserType: _browser, ...pixel } = devices["Pixel 5"]
  test.use(pixel)

  test("a tap names a place, a second tap opens it, a tap on empty space closes the card", async ({ page }) => {
    test.setTimeout(300_000)
    await signInAndOnboard(page, await createConfirmedMember())
    const scene = sceneOf(page)
    await expect(scene.locator("canvas")).toBeVisible({ timeout: 120_000 })
    const card = page.getByRole("group", { name: "Tempat dipilih" })
    const sceneBox = (await scene.boundingBox())!
    // The room fills the scene's height: Kilas balik's anchor is on screen.
    const at = await centreOf(page, "Kilas balik")
    expect(at.x).toBeGreaterThan(sceneBox.x)
    expect(at.x).toBeLessThan(sceneBox.x + sceneBox.width)

    await page.touchscreen.tap(at.x, at.y)
    await expect(card).toContainText("Kilas balik")
    await expect(page).toHaveURL(/\/lobby$/)

    await page.touchscreen.tap(sceneBox.x + 6, sceneBox.y + 6)
    await expect(card).toHaveCount(0)

    await page.touchscreen.tap(at.x, at.y)
    await expect(card).toContainText("Kilas balik")
    await page.touchscreen.tap(at.x, at.y)
    await expect(page).toHaveURL(/\/recap$/)
  })

  test("Pusatkan shows only after the camera has moved", async ({ page }) => {
    test.setTimeout(300_000)
    await signInAndOnboard(page, await createConfirmedMember())
    const scene = sceneOf(page)
    await expect(scene.locator("canvas")).toBeVisible({ timeout: 120_000 })
    const center = scene.getByRole("button", { name: "Pusatkan" })
    await expect(center).toHaveCount(0)
    const box = (await scene.boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 120, y, { steps: 4 })
    await page.mouse.up()
    await expect(center).toBeVisible()
    await center.click()
    await expect(center).toHaveCount(0)
  })
})
```

Tambahkan `devices` ke impor `@playwright/test`. Bila tap pada anchor perapian ternyata memilih tempat lain di tampilan HP (lihat kegagalan "Kilas balik" tidak muncul di kartu), pindahkan kotak yang menutupinya di `pick-volumes.ts`; jangan ganti tempatnya di tes tanpa mencatat alasannya.

- [ ] **Step 4: Verifikasi penuh (lokal)**

Jalankan berurutan dari PowerShell:
1. `npx vitest run --maxWorkers=2` (seluruh suite; `wording.test.ts` harus hijau).
2. `npm run lint`, `npx tsc --noEmit`, `npm run check`, `npm run build`.
3. Cek port 3000 (lihat Global Constraints). E2E non-3D: `npx playwright test e2e/lobby.spec.ts e2e/lobby-popup.spec.ts e2e/collections.spec.ts e2e/offline.spec.ts --workers=2`.
4. E2E 3D (lambat, satu per satu): `npx playwright test --project=lobby-3d --no-deps --workers=1`.
5. Sebelum selesai, jalankan seluruh Playwright sekali dengan `--workers=2` bila waktu mengizinkan; setidaknya proyek `desktop` dan `mobile`.

Expected: semua hijau. Bila `offline.spec.ts` gagal karena tombol tak terlihat, periksa bahwa `toBeAttached` (bukan `toBeVisible`) dipakai di sana.

- [ ] **Step 5: Periksa sisa dan commit**

Run: `rg "label-layout|data-look|lobby-hotspot-measure|lobby-hotspot-count|lobby-hotspot-badge|PillText" src e2e` → kosong. `git status` bersih selain berkas yang dimaksud; `.worktrees/` tidak disentuh.

```bash
git add e2e
git commit -m "test(3g): E2E for name cards, hover names, still dots and the upright phone

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Daftar cek manual pemilik di HP (catat di ledger, jangan dikerjakan agen)**

- garis tepi terlihat tapi tidak ramai (bila terlalu "kotak": ganti `highlight.ts`, Task 2);
- ketukan pada benda yang bertumpuk (meja tulis dan kursi, kotak paket dan rak);
- kamera tegak: ruangan mengisi area di atas kartu "Lanjutkan membaca", geser ke kiri/kanan, "Pusatkan" muncul setelah digeser dan tidak tertutup sapaan;
- kartu tidak menutupi benda yang disorot (kartu ada di dasar adegan; bila benda terpilih ada di bawah, pertimbangkan memindahkan kartu ke atas);
- petunjuk "Ketuk benda untuk melihat namanya" hanya sekali.

---

## Self-review

**1. Cakupan spec**

| Bagian spec | Task |
|---|---|
| §2 keputusan 1–5 (ketuk dulu, kartu, garis tepi diam, tanpa angka di ruangan, desktop hover/klik) | 2, 4, 5 |
| §2 keputusan 6 (kamera HP tegak) | 6 |
| §2 keputusan 7 (kotak tak terlihat di 3D, tombol tak terlihat) | 1, 2, 4 |
| §3.1 HP: ketuk, ketuk sama/Buka, benda lain, ruang kosong/geser, 10 px/300 ms | 4 (`tap.ts`, `tapPlace`, `onCameraGesture`) |
| §3.2 desktop: hover, klik, `(hover: hover) and (pointer: fine)` | 4 (`useFinePointer`), 5 |
| §3.3 keyboard: tombol, fokus → kartu, Enter, `aria-describedby` | 4 (tombol), 5 (fokus, describedby), tes E2E Task 7 |
| §3.4 petunjuk: garis tipis diam, sorotan kuat, kalimat sekali, `glosa:place-hint-seen` + try/catch | 2, 6 |
| §3.5 kartu + tabel keadaan + sumber data | 3 dan tabel "Sumber data" di atas |
| §3.6 yang dihapus (pil, tanda, histeresis, angka/garis putus) | 4 (hapus `label-layout.ts`, CSS); gelembung ditambatkan di `HotspotLayer` |
| §3.7 kamera HP tegak, batas zoom-out, "Pusatkan", sapaan | 6 (+ keputusan 10–11) |
| §3.8 mode gambar diam: titik, kartu sama, WebGL gagal → `selected` dilepas | 4 (dots; `LobbyScene` mengirim `onTap(null)` di mode diam). **Celah kecil:** "WebGL gagal di tengah jalan, `selected` dilepas" ditangani karena `highlight` hanya efek visual dan kartu tetap berlaku di mode titik; tidak ada kode tambahan diperlukan, tapi tes E2E mobile (Task 7) memverifikasi alur titik |
| §4 arsitektur (`pick-volumes`, `picker`, `highlight`, `stage`, `place-status`, `PlaceCard`, `HoverName`, `HotspotLayer`, hapus `label-layout`, `LobbyStage`, kamera) | 1–6 |
| §4 kasus khusus: `covered` → batalkan; alur R3 menutup kartu dan sorotan tetap di tujuan; data berubah → baris ikut; ukuran berubah → tetap | 4 (`cardId`/`highlight` memakai `paused`; `lit`; `facts` di `useMemo`) |
| §5 pengujian unit/E2E/3D/pemindai/manual | tiap task + Task 7 |

**2. Pemindaian placeholder:** tidak ada "TBD"/"nanti". Dua catatan kondisional di Task 1 Step 5 dan Task 6 Step 2/Task 7 Step 3 menyuruh memperbaiki *data* kotak bila tes geometri gagal; itu instruksi konkret, bukan placeholder.

**3. Konsistensi tipe/nama:** `PickVolume`/`PICK_VOLUMES`/`volumesOf`/`anchorOf` (Task 1) dipakai di Task 2 (`highlight.ts`) dan Task 4 (`HotspotLayer`). `pickAt` (Task 1) dipakai `stage.pick` (Task 2). `Stage.setHighlight` → `LobbyCanvas.highlight` → `LobbyScene.highlight` (Task 2) → `LobbyStage` (Task 4–5). `placeStatus`/`PlaceFacts` (Task 3) dipakai `LobbyStage` (Task 4); `readingDaysBetween` (Task 3). `createTapTracker` (Task 4). Props `LobbyScene`: `onTap`, `onCameraGesture`, `onFocusPlace` (Task 4), `onHover`, `describing` (Task 5), `highlight` (Task 2). `HotspotLayer`: `onKey`/`onTap`/`onFocusSpot`/`dots` (Task 4), `describing` (Task 5). `useFinePointer`, `useSheetHeight` (Task 4); `startView` (Task 6) dipakai ulang tanpa perubahan tanda tangan.

**4. Ambiguitas/konflik spec yang perlu keputusan pemilik** (juga dilaporkan di pesan akhir): lihat daftar "Keputusan dan penyimpangan" nomor 1, 2, 8, 9, 10, 11.
