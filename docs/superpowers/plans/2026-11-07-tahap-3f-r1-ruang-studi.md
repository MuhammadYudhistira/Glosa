# Glosa Tahap 3F-R1 — Ruang studi 3D: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lobi 3D berupa aula besar diganti ruang studi pribadi yang detail (model glTF CC0 + bagian dari kode), dengan cahaya pagi/senja/malam menurut jam perangkat, hanya karakter Anda, dan panel, data, route, serta ID hotspot tidak berubah.

**Architecture:**
- **Pertukaran di tempat.** `createStage` tetap menjadi satu-satunya antarmuka adegan ke React. Modul di `src/components/lobby/scene/` diganti isinya; ekspor yang dipakai React (`HOTSPOT_SPOTS`, `DECOR_SLOTS`, `SHOWCASE_SLOTS`, `PLANT_SHAPES`, `PREVIEW_SHIFT`, `HotspotId`, `ANDA_START`, `spotOf`) tetap bernama sama.
- **Model.** `model-manifest.ts` (data murni: kunci model, berkas, sumber, kredit) dan `models.ts` (pemuat `GLTFLoader`, cache, `fitTo`). Semua tugas lain memakai **kunci manifest**, bukan nama berkas. Benda yang tak ada di paket dibuat lewat kode (`file: null`).
- **Cahaya.** `daylight.ts` murni: `daylight(date)` memberi suasana, `RIGS` memberi angka cahaya, `mixRig` mencampur untuk peralihan halus. Stage menerapkan rig; tingkat `rendah` tanpa bayangan dan tanpa lampu titik.
- **Diorama.** Ruangan kotak 12 × 12 m melayang di latar gelap (kamera isometrik sama seperti sekarang). Kamera dijepit supaya ruangan tidak hilang, bukan supaya layar tidak pernah melihat latar (lihat keputusan 1).

**Tech Stack:** TanStack Start + Router, React 19, TypeScript, Tailwind CSS 4, three.js (`three/addons`: `GLTFLoader`, `OrbitControls`, post-processing), Vitest + Testing Library, Playwright (WebGL lewat SwiftShader).

**Spec:** [`docs/superpowers/specs/2026-11-07-tahap-3f-ruang-baca-pribadi-design.md`](../specs/2026-11-07-tahap-3f-ruang-baca-pribadi-design.md) §1–§3 (termasuk §3.6), §5–§7. Rencana pasangannya: R2 (bahasa dan alur masuk), lalu R3 (ruangan yang bercerita, [`2026-11-13-tahap-3f-r3-ruangan-bercerita.md`](2026-11-13-tahap-3f-r3-ruangan-bercerita.md)).

**Pembaruan 2026-11-13:** Task 1–4 selesai. Prinsip pemilik "setiap benda dan animasi punya tujuan" (spec keputusan 9–12, §3.6) menambah **Task 4A–4C** sebelum Task 5, dan mengubah Task 7–8 seperlunya.

## Global Constraints

- **Bahasa:** teks UI berbahasa Indonesia, komentar kode berbahasa Inggris. Array ditulis `Array<T>`. Tidak ada kata "gagal" di teks UI baru. Teks UI lama ("lobi", "Meja Baca", dan lainnya) **tidak diubah di R1**; itu pekerjaan R2.
- **Dependensi:** tidak ada dependensi npm baru (`three/addons` bagian dari `three`). Alat konversi aset dijalankan sekali lewat `npx --yes …` dan tidak masuk `package.json`.
- **Aset:** KayKit Furniture Bits (CC0, Kay Lousberg; `https://kaylousberg.itch.io/furniture-bits`, GitHub `KayKit-Game-Assets/KayKit-Furniture-Bits-1.0`). Paket CC0 lain (misalnya Poly Pizza) hanya untuk benda yang tak ada. Hanya `.glb` yang dipakai, di `public/lobby/models/`, **total ≤ 3 MB**, **tanpa Draco**, dengan `public/lobby/models/LICENSE.md` (CC0 dan asal tiap model).
- **Keamanan aset:** paket unduhan adalah data tak tepercaya: simpan di direktori baru yang kosong di luar `src` (mis. folder scratchpad), jangan pernah menjalankan skrip/kode dari dalamnya, jalankan alat dengan jalur sebagai argumen dari direktori lain.
- **Tetap:** URL, nama tabel/fungsi, ID hotspot, ID/nama/harga 18 barang toko, tiga tingkat kualitas (`tinggi`, `rendah`, `diam`) dan penurunan otomatis menurut FPS, gelembung dan panel React.
- **Angka (persis dari spec):** suasana **pagi/siang 05.00–15.59**, **senja 16.00–18.59**, **malam 19.00–04.59** (jam lokal perangkat); **8** bagian genre; **12** sampul di lemari kaca; **6** slot dekorasi (`rug`, `lamp`, `seat`, `wall`, `pet`, `ceiling`) dan **18** barang; gambar diam = ruang studi **versi malam** (avif/webp, 1280 dan ukuran besar); kamera isometrik, putar ±15° dan perbesar seperti sekarang; model ≤ **3 MB**.
- **Perilaku:** model gagal dimuat → ruangan tetap di mode diam tanpa pesan error; selama model dimuat, gambar diam tampil dengan hotspot yang sudah bisa diketuk, lalu 3D memudar masuk; bayangan hanya di `tinggi`; mesh statis digabung; buku di rak memakai instancing; model di-cache service worker PWA.
- **Line ending dan encoding:** LF, UTF-8. Jangan menulis file lewat PowerShell `Set-Content` atau Python tanpa `encoding='utf-8', newline=''`.
- **Route tree:** jangan pakai `npm run generate-routes`. R1 tidak menambah route.
- **Benda bertujuan (spec §3.6):** setiap perabot dasar punya `serves` (hotspot pemiliknya); tidak ada benda atau animasi dekoratif baru. Animasi hanya respons atas tindakan atau sinyal keadaan bacaan.
- **CI** menjalankan `npm run check` (prettier): setiap task menjalankan `npx prettier --write` pada file yang disentuh sebelum commit.
- **Tes unit:** `npx vitest run --maxWorkers=2` (`--maxWorkers=1` bila worker timeout; laptop lemah). **E2E:** `--workers=2`; cek port 3000 dulu (`curl -sL localhost:3000/login | grep -o "<title>[^<]*"`), bila dipegang aplikasi lain pakai config sementara di port 3100 lalu hapus; satu kegagalan dijalankan ulang sendirian dulu.
- **Tidak ada push ke GitHub** (pemilik yang memutuskan). Commit lokal saja. Pesan commit diakhiri baris `Co-Authored-By` dari pengingat atribusi sesi yang berlaku (contoh di rencana ini memakai `Claude Opus 5.5`; ganti sesuai pengingat).

## Keputusan dan penyimpangan dari spec

1. **Diorama, bukan peta tertutup.** Spec §3.1 meminta seluruh ruangan terlihat dalam satu layar, juga di HP. Dengan kamera isometrik tetap, ruangan 12 × 12 m selebar ±17 m di layar, sehingga pada layar tegak (390 × 844) hanya muat bila latar di luar ruangan boleh terlihat. Maka: ruangan melayang di latar gelap hangat; `MIN_ZOOM` 1 = "seluruh ruangan pas di layar"; `clampView` memusatkan sumbu yang lebih sempit dari layar dan menjepit sumbu yang lebih lebar ke batas ruangan. Tes E2E "kamera tidak pernah menampilkan apa pun di luar peta" diganti "ruangan tidak pernah hilang dari layar". Mode `test` tetap memakai latar magenta.
2. **"Bersudut L" = pandangan sudut dua dinding** (dinding rak di X = 0, dinding jendela di Z = 0), lantai persegi 12 × 12 m (menjadi **±10 × 10 m** di Task 4R atas keputusan pemilik 2026-11-13), tinggi 4,6 m. Lantai persegi menjaga rumus proyeksi sederhana.
3. **Posisi di rencana adalah nilai awal** (Task 3 dan 5). Tes unit (di dalam ruangan, tidak bertabrakan, terproyeksi di layar HP dan desktop) adalah penentunya; geser angka bila tes gagal, jangan melonggarkan tes. Arah visual dikunci pemilik di Task 4.
4. **Tata letak adalah sumber kebenaran ukuran.** `FURNITURE` di `layout.ts` memberi tiap perabot `size` (m) dan `turn` (kelipatan π/2); model di-`fitTo` ke tinggi itu. Telapak tabrakan dihitung dari `size`/`turn`, bukan dari model, sehingga tes tak butuh membaca berkas glb.
5. **Karakter Anda:** tetap dibuat lewat kode (dibulatkan, palet baru) kecuali audit menemukan karakter CC0 statis satu-mesh; Furniture Bits tidak memuat karakter. Keputusan akhir ditulis di berkas audit (Task 1).
6. **Stage mendapat dua masukan data baru** untuk rak genre: `setShelves(hues: GenreHues)` (spec §3.2: punggung buku sebanyak jumlah buku, warna `coverHue`). Karena itu `LobbyStage`, `LobbyScene`, dan `LobbyCanvas` mendapat satu prop `shelves` (perubahan mekanis, Task 5). `createStage` menjadi `async` (mengembalikan `Promise<Stage>`) karena memuat model; `LobbyCanvas` dan harness menunggunya.
7. **Pemuatan semua-atau-tidak-sama-sekali:** bila satu model gagal dimuat, `loadModels` menolak dan `LobbyScene` jatuh ke mode diam (`onFail`), bukan ruangan setengah jadi.
8. **Cache PWA tanpa perubahan kode:** `scripts/build-sw.mjs` sudah men-precache semua berkas `dist/client` (termasuk `lobby/models/*.glb`). Task 7 hanya menambahkan `LICENSE.md` ke daftar `SKIP` dan satu tes yang memastikan glb masuk daftar.
9. **Suasana otomatis berganti** lewat `setTimeout(msUntilNextMood)` di stage; peralihan 3 detik di mode animasi, seketika di `diam`/`test`. Parameter `?mood=day|dusk|night` di harness (dan opsi `mood` di `StageOptions`) memaksa suasana untuk tangkapan layar dan tes.
10. **Penggantian nama tugas dari daftar pemilik:** lemari kaca, tanaman, dan karakter Anda masuk Task 5 bersama rak (satu tugas "isi ruangan"), slot dekorasi dan 18 barang di Task 6.
11. **(2026-11-13) Yang dibuang lebih luas dari daftar spec §3.1,** dengan alasan yang sama (keputusan 9): selain tangga, dua tanaman kecil, lukisan, dan karpet dasar, juga **rel kuningan tangga** dan **karpet panjang di depan rak** (fungsi `dressing()` di `room.ts` seluruhnya) serta **buku di ambang jendela**. Keset di depan pintu tetap (bagian dari pintu); lilin di mantel menjadi bagian dari sinyal api.
12. **(2026-11-13) Pintu membuka `/settings` langsung,** bukan popup kecil berisi dua tombol (spec §3.2): halaman Pengaturan sudah memuat tautan **Keluar** (`src/routes/_member/_lobi/settings.tsx`). Satu ketukan lebih sedikit, tanpa komponen baru.
13. **(2026-11-13) Lampu meja memakai cache Kosakata yang ada.** `useWordMeetings` sudah tersedia di lobi (layout `_lobi` memanggil `refreshVocab`); total pertemuan dihitung di klien, tanpa fungsi server baru. Total baru dicatat setelah cache terbaca (`useMeetingsTotal` mengembalikan `null` sebelum itu), supaya catatan pertama tidak tertulis `0`.
14. **(2026-11-13) Sorotan untuk papan gabus lewat satu fungsi server baru** `listHighlightsFn({ limit })` (sorotan belum dihapus, terbaru dulu, `limit` 1–500). Data sorotan di perangkat hanya ada per buku yang pernah dibuka, jadi daftar lintas buku harus dari server. R3 memakai fungsi yang sama untuk `/highlights`.
15. **(2026-11-13) Api tidak lagi diatur rig.** `LightRig.fire` dihapus dari `daylight.ts`; kekuatan api hanya dari sinyal (`FIRE_STRENGTH`), di semua suasana.

## Struktur file

| File | Tanggung jawab |
|---|---|
| `docs/superpowers/plans/2026-11-07-tahap-3f-r1-audit-aset.md` | Hasil audit aset: benda → model/kode, keputusan Anda (Task 1) |
| `public/lobby/models/*.glb`, `LICENSE.md` | Model yang dipakai + kredit (Task 1) |
| `src/components/lobby/scene/model-manifest.ts` (+ `.test.ts`) | Data murni: `MODEL_KEYS`, `ModelKey`, `MODELS` (Task 1) |
| `src/components/lobby/scene/models.ts` (+ `.test.ts`) | `loadModels`, `fitTo`, cache (Task 1) |
| `src/components/lobby/scene/daylight.ts` (+ `.test.ts`) | `Mood`, `daylight`, `msUntilNextMood`, `RIGS`, `mixRig` (Task 2) |
| `src/components/lobby/scene/walk.ts` (+ `.test.ts`) | Jalur jalan Anda menghindari perabot (Task 2) |
| `src/components/lobby/scene/layout.ts` (+ `.test.ts`) | `ROOM`, `FURNITURE`, `WALL_SECTIONS`, hotspot, slot, batas jalan (Task 3, 5, 6) |
| `src/components/lobby/scene/projection.ts` (+ `.test.ts`) | Kamera diorama: `clampView`, `startView` (Task 3) |
| `src/components/lobby/scene/room.ts`, `furniture.ts`, `skyline.ts`, `stage.ts` | Cangkang ruangan, perabot dasar, kota di jendela, rig cahaya (Task 3) |
| `scripts/lobby-harness.mjs`, `scripts/lobby-harness/main.ts` | Perintah `moods`, parameter `mood` (Task 3), `thumbs`/`still` malam (Task 7) |
| `src/components/lobby/scene/shelf-books.ts` (+ `.test.ts`), `shelves.ts`, `showcase.ts`, `plant.ts`, `people.ts`, `motion.ts` | Rak genre, lemari kaca, tanaman, hanya Anda, jalan (Task 5) |
| `src/components/lobby/LobbyStage.tsx`, `LobbyScene.tsx`, `LobbyCanvas.tsx` (+ tes) | Prop `shelves`, `await createStage`, memudar masuk (Task 5, 7) |
| `src/components/lobby/scene/decor.ts` (+ `.test.ts`) | 18 barang dibuat ulang, kiosk dihapus (Task 6) |
| `src/styles.css`, `src/components/lobby/LobbyStill.tsx`, `public/lobby/lobby-still*`, `public/lobby/shop/*`, `scripts/build-sw.mjs` | Memudar masuk, gambar diam malam, thumbnail, cache (Task 7) |
| `src/components/lobby/room-signals.ts` (+ `.test.ts`) | Murni: `RoomSignals`, `FireLevel`, `fireLevel`, `roomSignals`, `FIRE_STRENGTH`, `NEUTRAL_SIGNALS` (Task 4B) |
| `src/lib/vocab/vocab-seen.ts` (+ `.test.ts`), `src/lib/local/keys.ts`, `src/lib/vocab/vocab-client.ts`, `src/routes/_member/_lobi/vocabulary.tsx` | Total pertemuan dan catatan "Kosakata terakhir dibuka" (Task 4B) |
| `src/server/annotations.ts`, `src/lib/annotations/types.ts`, `src/lib/annotations/highlights-client.ts` (+ `.test.ts`), `src/components/lobby/CorkboardPanel.tsx` (+ `.test.tsx`) | Sorotan terbaru untuk papan gabus (Task 4C) |
| `e2e/lobby-3d.spec.ts`, `e2e/shop.spec.ts`, `e2e/lobby.spec.ts` | Penyesuaian E2E (Task 8) |

---

### Task 1: Audit aset, manifest model, dan pemuat

**Files:**
- Create: `docs/superpowers/plans/2026-11-07-tahap-3f-r1-audit-aset.md`
- Create: `public/lobby/models/*.glb`, `public/lobby/models/LICENSE.md`
- Create: `src/components/lobby/scene/model-manifest.ts`, `src/components/lobby/scene/model-manifest.test.ts`
- Create: `src/components/lobby/scene/models.ts`, `src/components/lobby/scene/models.test.ts`

**Interfaces:**
- Produces (`model-manifest.ts`, murni, tanpa three):
  ```ts
  export type ModelSource = "kaykit" | "polypizza" | "code"
  export type ModelEntry = { file: string | null; source: ModelSource; credit: string }
  export const MODEL_KEYS: readonly [...]   // daftar di bawah
  export type ModelKey = (typeof MODEL_KEYS)[number]
  export const MODELS: Record<ModelKey, ModelEntry>
  export const MODEL_DIR = "/lobby/models/"
  ```
- Produces (`models.ts`):
  ```ts
  export type ModelSet = { get: (key: ModelKey) => THREE.Group | null; dispose: () => void }
  export function loadModels(): Promise<ModelSet>        // semua entri ber-file, atau menolak
  export function fitTo(object: THREE.Object3D, height: number): THREE.Object3D
  ```
  `get` mengembalikan klon baru (geometri/material dipakai bersama) atau `null` untuk entri `file: null` (dibuat lewat kode oleh pemanggil). `fitTo` menskala seragam sehingga tinggi kotak batas = `height`, lalu menaruh pusat X/Z di 0 dan dasar di Y = 0.

`MODEL_KEYS` (kunci logis dari rencana ini; audit mengisi `file`/`source`/`credit`-nya):
`armchair`, `readingLamp`, `desk`, `deskChair`, `laptop`, `notebook`, `sideTable`, `catalogue`, `parcelBox`, `door`, `fireplace`, `glassCabinet`, `windowFrame`, `corkboard`, `plantPot`, `baseRug`, `anda`, dan 18 kunci barang toko `decor_<id>`: `decor_rug_woven`, `decor_rug_round`, `decor_rug_pattern`, `decor_lamp_floor`, `decor_lamp_arc`, `decor_lamp_lantern`, `decor_seat_beanbag`, `decor_seat_armchair`, `decor_seat_sofa`, `decor_wall_map`, `decor_wall_painting`, `decor_wall_clock`, `decor_pet_cat`, `decor_pet_bird`, `decor_pet_aquarium`, `decor_ceiling_lights`, `decor_ceiling_books`, `decor_ceiling_globe`. (Rak dinding dan buku sengaja tidak di sini: dibuat lewat kode, Task 5.)

- [ ] **Step 1: Unduh paket ke direktori kosong (data tak tepercaya)**

Buat direktori baru kosong di scratchpad (mis. `$SCRATCH/kaykit-furniture`) lalu:
```bash
git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0.git "$SCRATCH/kaykit-furniture"
```
Bila GitHub tak terjangkau, hentikan dan laporkan ke pengendali (jangan mengarang model). Lihat isinya hanya dengan `ls`/`find` (jangan menjalankan skrip di dalamnya). Daftar semua model `.gltf` beserta ukuran berkas dan ukuran tekstur.

- [ ] **Step 2: Tulis berkas audit**

Buat `docs/superpowers/plans/2026-11-07-tahap-3f-r1-audit-aset.md` (Indonesia) berisi: (a) tabel satu baris per `MODEL_KEYS` (kunci → model paket / paket lain / kode, alasan satu kalimat, perkiraan tinggi nyata dalam m); (b) keputusan karakter Anda (aturan: dipakai hanya bila CC0, statis, satu mesh, gaya cocok; selain itu kode); (c) ukuran total glb setelah konversi; (d) tautan lisensi tiap paket. Aturan pemetaan: barang yang jelas ada di paket (kursi, meja, lampu, sofa, bean bag, jam, lukisan, kotak, tanaman/pot, karpet) → paket; jendela, perapian, lemari kaca, papan gabus, pintu → paket bila ada, selain itu kode; kucing, burung/sangkar, akuarium, bola dunia, peta, buku terbang, untaian lampu, lentera → paket bila ada, selain itu kode (gaya membulat, palet hangat sama).

- [ ] **Step 3: Konversi dan salin hanya model yang dipakai**

Untuk tiap model terpakai (`.gltf` + `.bin` + tekstur), jalankan dari direktori lain dengan jalur absolut, mis.:
```bash
npx --yes gltf-pipeline -i "$SCRATCH/kaykit-furniture/<jalur>/<model>.gltf" -o public/lobby/models/<nama>.glb -b
```
(sekali pakai, tanpa Draco, tidak menambah dependensi). Beri nama berkas `kebab-case`. Bila tekstur palet tertanam di tiap berkas dan total > 3 MB, kecilkan: `npx --yes @gltf-transform/cli optimize <in>.glb <out>.glb --compress false --texture-compress webp --texture-size 512` (periksa `--help` untuk nama flag versi yang terpasang). Ukur: `du -cb public/lobby/models/*.glb`; harus ≤ 3.145.728 byte.

- [ ] **Step 4: Tulis `LICENSE.md`**

`public/lobby/models/LICENSE.md`: tiap model → nama asli di paket, pembuat (Kay Lousberg / lainnya), lisensi CC0 1.0, URL sumber.

- [ ] **Step 5: Tulis tes manifest (gagal dulu)**

`model-manifest.test.ts`:
```ts
import { existsSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { MODEL_KEYS, MODELS } from "./model-manifest"

const dir = resolve(__dirname, "../../../../public/lobby/models")
const entries = MODEL_KEYS.map((key) => [key, MODELS[key]] as const)

describe("model manifest", () => {
  it("has an entry for every key", () => {
    expect(Object.keys(MODELS).sort()).toEqual([...MODEL_KEYS].sort())
  })

  it("has a file on disk for every model that has one", () => {
    for (const [key, entry] of entries) {
      if (entry.file === null) continue
      expect(entry.file, key).toMatch(/^[a-z0-9-]+\.glb$/)
      expect(existsSync(resolve(dir, entry.file)), `${key}: ${entry.file}`).toBe(true)
    }
  })

  it("marks models without a file as made in code", () => {
    for (const [key, entry] of entries) {
      expect(entry.file === null, key).toBe(entry.source === "code")
    }
  })

  it("stays within 3 MB in all, once per file", () => {
    const files = new Set(entries.flatMap(([, e]) => (e.file ? [e.file] : [])))
    const bytes = [...files].reduce((sum, f) => sum + statSync(resolve(dir, f)).size, 0)
    expect(bytes).toBeLessThanOrEqual(3 * 1024 * 1024)
  })

  it("credits every model file in LICENSE.md", () => {
    const text = readFileSync(resolve(dir, "LICENSE.md"), "utf8")
    expect(text).toContain("CC0")
    for (const [, entry] of entries) {
      if (entry.file) expect(text, entry.file).toContain(entry.file)
    }
  })
})
```
Run: `npx vitest run src/components/lobby/scene/model-manifest.test.ts` → FAIL (modul belum ada).

- [ ] **Step 6: Tulis `model-manifest.ts`**

Isi `MODEL_DIR`, `MODEL_KEYS` (daftar di atas, `as const`), tipe, dan `MODELS` sesuai tabel audit (satu entri per kunci, `credit` = nama model asli di paket atau "dibuat lewat kode"). Lebih dari satu kunci boleh memakai satu berkas. Run tes manifest → PASS.

- [ ] **Step 7: Tulis tes pemuat (gagal dulu)**

`models.test.ts` (mock `GLTFLoader`):
```ts
import * as THREE from "three"
import { beforeEach, describe, expect, it, vi } from "vitest"

const loadAsync = vi.fn()
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    loadAsync = loadAsync
  },
}))
vi.mock("./model-manifest", () => ({
  MODEL_DIR: "/m/",
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
```
Run → FAIL.

- [ ] **Step 8: Tulis `models.ts`**

```ts
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
  const wrapper = object
  wrapper.scale.multiplyScalar(scale)
  wrapper.updateMatrixWorld(true)
  const fitted = new THREE.Box3().setFromObject(wrapper)
  const centre = fitted.getCenter(new THREE.Vector3())
  wrapper.position.x -= centre.x
  wrapper.position.z -= centre.z
  wrapper.position.y -= fitted.min.y
  wrapper.updateMatrixWorld(true)
  return wrapper
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
      return source ? (source.clone(true) as THREE.Group) : null
    },
    dispose() {
      // Geometry and materials are shared through the cache and live as long as the page.
    },
  }
}
```
Catatan untuk pelaksana: `fitTo` menskala `object` sendiri; pemanggil membungkus klon dalam `THREE.Group` baru lebih dulu bila ia juga memakai `position`/`rotation` objek itu (tes di atas sudah begitu). Run `npx vitest run src/components/lobby/scene/model-manifest.test.ts src/components/lobby/scene/models.test.ts` → PASS.

- [ ] **Step 9: Format dan commit**

```bash
npx prettier --write src/components/lobby/scene/model-manifest.ts src/components/lobby/scene/model-manifest.test.ts src/components/lobby/scene/models.ts src/components/lobby/scene/models.test.ts docs/superpowers/plans/2026-11-07-tahap-3f-r1-audit-aset.md
git add public/lobby/models src/components/lobby/scene/model-manifest*.ts src/components/lobby/scene/models*.ts docs/superpowers/plans/2026-11-07-tahap-3f-r1-audit-aset.md
git commit -m "feat(3f): asset audit, model manifest and glTF loader" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Fungsi murni — cahaya hari dan jalur jalan

**Files:**
- Create: `src/components/lobby/scene/daylight.ts`, `daylight.test.ts`
- Create: `src/components/lobby/scene/walk.ts`, `walk.test.ts`

**Interfaces:**
- Produces (`daylight.ts`):
  ```ts
  export type Mood = "day" | "dusk" | "night"
  export function daylight(date: Date): Mood
  export function msUntilNextMood(date: Date): number
  export type LightRig = {
    background: string; hemiSky: string; hemiGround: string; hemi: number
    sun: string; sunIntensity: number; sunPosition: readonly [number, number, number]
    lamps: number   // 0..1: reading lamp, desk lamp
    fire: number    // 0..1: fireplace
    city: number    // 0..1: window glow and city lights
    exposure: number
  }
  export const RIGS: Record<Mood, LightRig>
  export function mixRig(a: LightRig, b: LightRig, k: number): LightRig   // k 0..1
  ```
- Produces (`walk.ts`):
  ```ts
  export type Box2 = { x0: number; x1: number; z0: number; z1: number }
  export function walkable(p: Point2, bounds: Box2, blocked: ReadonlyArray<Box2>, radius: number): boolean
  export function findPath(from: Point2, to: Point2, bounds: Box2, blocked: ReadonlyArray<Box2>, radius: number): Array<Point2>   // [] when no way; otherwise excludes `from`, ends at `to`
  ```
  `Point2` dari `./layout`.

- [ ] **Step 1: Tes `daylight` (gagal dulu)**

```ts
import { describe, expect, it } from "vitest"
import { RIGS, daylight, mixRig, msUntilNextMood } from "./daylight"

const at = (h: number, m = 0) => new Date(2026, 10, 7, h, m)

describe("daylight", () => {
  it.each([
    [4, 59, "night"],
    [5, 0, "day"],
    [15, 59, "day"],
    [16, 0, "dusk"],
    [18, 59, "dusk"],
    [19, 0, "night"],
    [0, 0, "night"],
    [12, 0, "day"],
  ] as const)("%i:%i is %s", (h, m, mood) => {
    expect(daylight(at(h, m))).toBe(mood)
  })
})

describe("msUntilNextMood", () => {
  it("counts to the next boundary, also past midnight", () => {
    expect(msUntilNextMood(at(15, 59))).toBe(60_000)
    expect(msUntilNextMood(at(18, 0))).toBe(3_600_000)
    expect(msUntilNextMood(at(23, 0))).toBe(6 * 3_600_000)
    expect(msUntilNextMood(at(4, 30))).toBe(30 * 60_000)
  })
})

describe("mixRig", () => {
  it("returns the ends at k = 0 and k = 1 and blends in between", () => {
    expect(mixRig(RIGS.day, RIGS.night, 0)).toEqual(RIGS.day)
    expect(mixRig(RIGS.day, RIGS.night, 1)).toEqual(RIGS.night)
    const half = mixRig(RIGS.day, RIGS.night, 0.5)
    expect(half.lamps).toBeCloseTo((RIGS.day.lamps + RIGS.night.lamps) / 2)
    expect(half.background).toMatch(/^#[0-9a-f]{6}$/)
  })

  it("has lamps off by day and on at dusk and night", () => {
    expect(RIGS.day.lamps).toBe(0)
    expect(RIGS.dusk.lamps).toBeGreaterThan(0)
    expect(RIGS.night.lamps).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Tulis `daylight.ts`**

```ts
export type Mood = "day" | "dusk" | "night"

/** The mood from the device's local clock (spec 3F §3.4). */
export function daylight(date: Date): Mood {
  const hour = date.getHours()
  if (hour >= 5 && hour < 16) return "day"
  if (hour >= 16 && hour < 19) return "dusk"
  return "night"
}

/** Milliseconds until the hour the mood next changes (05, 16 or 19 o'clock). */
export function msUntilNextMood(date: Date): number {
  const hour = date.getHours()
  const next = new Date(date)
  // 29 rolls over to 05:00 the next day.
  next.setHours(hour < 5 ? 5 : hour < 16 ? 16 : hour < 19 ? 19 : 29, 0, 0, 0)
  return next.getTime() - date.getTime()
}

export type LightRig = {
  background: string
  hemiSky: string
  hemiGround: string
  hemi: number
  sun: string
  sunIntensity: number
  sunPosition: readonly [number, number, number]
  lamps: number
  fire: number
  city: number
  exposure: number
}

/** Start values; the owner's visual checkpoint (plan 3F-R1, Task 4) tunes them. */
export const RIGS: Record<Mood, LightRig> = {
  day: {
    background: "#2a1d14",
    hemiSky: "#fff1d6",
    hemiGround: "#8a6a4a",
    hemi: 0.75,
    sun: "#fff0cf",
    sunIntensity: 1.7,
    sunPosition: [-4, 22, 26],
    lamps: 0,
    fire: 0,
    city: 0,
    exposure: 0.9,
  },
  dusk: {
    background: "#241518",
    hemiSky: "#ffc99a",
    hemiGround: "#5a3a2c",
    hemi: 0.5,
    sun: "#ff9c5a",
    sunIntensity: 1.1,
    sunPosition: [26, 7, 12],
    lamps: 0.8,
    fire: 0.6,
    city: 0.45,
    exposure: 0.85,
  },
  night: {
    background: "#120d12",
    hemiSky: "#6e78b8",
    hemiGround: "#2a1c22",
    hemi: 0.32,
    sun: "#8fa0e0",
    sunIntensity: 0.35,
    sunPosition: [-4, 22, 26],
    lamps: 1,
    fire: 1,
    city: 1,
    exposure: 0.82,
  },
}

function mixHex(a: string, b: string, k: number): string {
  const channel = (hex: string, i: number) =>
    parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  return `#${[0, 1, 2]
    .map((i) =>
      Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * k)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`
}

const mixNumber = (a: number, b: number, k: number) => a + (b - a) * k

/** A blend of two rigs, k = 0 is `a` and k = 1 is `b`. */
export function mixRig(a: LightRig, b: LightRig, k: number): LightRig {
  if (k <= 0) return a
  if (k >= 1) return b
  return {
    background: mixHex(a.background, b.background, k),
    hemiSky: mixHex(a.hemiSky, b.hemiSky, k),
    hemiGround: mixHex(a.hemiGround, b.hemiGround, k),
    hemi: mixNumber(a.hemi, b.hemi, k),
    sun: mixHex(a.sun, b.sun, k),
    sunIntensity: mixNumber(a.sunIntensity, b.sunIntensity, k),
    sunPosition: [
      mixNumber(a.sunPosition[0], b.sunPosition[0], k),
      mixNumber(a.sunPosition[1], b.sunPosition[1], k),
      mixNumber(a.sunPosition[2], b.sunPosition[2], k),
    ],
    lamps: mixNumber(a.lamps, b.lamps, k),
    fire: mixNumber(a.fire, b.fire, k),
    city: mixNumber(a.city, b.city, k),
    exposure: mixNumber(a.exposure, b.exposure, k),
  }
}
```
Run `npx vitest run src/components/lobby/scene/daylight.test.ts` → PASS.

- [ ] **Step 3: Tes `walk` (gagal dulu)**

```ts
import { describe, expect, it } from "vitest"
import { type Box2, findPath, walkable } from "./walk"

const bounds: Box2 = { x0: 0, x1: 10, z0: 0, z1: 10 }
const wall: Box2 = { x0: 4, x1: 5, z0: 0, z1: 8 }

function crosses(path: Array<readonly [number, number]>, from: readonly [number, number], box: Box2) {
  const points = [from, ...path]
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1]
    const [bx, bz] = points[i]
    for (let t = 0; t <= 1; t += 0.02) {
      const x = ax + (bx - ax) * t
      const z = az + (bz - az) * t
      if (x > box.x0 && x < box.x1 && z > box.z0 && z < box.z1) return true
    }
  }
  return false
}

describe("walkable", () => {
  it("keeps the walker's radius off furniture and walls", () => {
    expect(walkable([2, 2], bounds, [wall], 0.3)).toBe(true)
    expect(walkable([3.8, 2], bounds, [wall], 0.3)).toBe(false)
    expect(walkable([0.1, 5], bounds, [wall], 0.3)).toBe(false)
    expect(walkable([11, 5], bounds, [wall], 0.3)).toBe(false)
  })
})

describe("findPath", () => {
  it("goes straight when nothing is in the way", () => {
    expect(findPath([1, 1], [3, 3], bounds, [wall], 0.3)).toEqual([[3, 3]])
  })

  it("walks around furniture and ends at the target", () => {
    const path = findPath([2, 2], [7, 2], bounds, [wall], 0.3)
    expect(path.length).toBeGreaterThan(1)
    expect(path.at(-1)).toEqual([7, 2])
    expect(crosses(path, [2, 2], wall)).toBe(false)
  })

  it("gives no path to a blocked or unreachable target", () => {
    expect(findPath([2, 2], [4.5, 4], bounds, [wall], 0.3)).toEqual([])
    const closed: Array<Box2> = [{ x0: 4, x1: 5, z0: -1, z1: 11 }]
    expect(findPath([2, 2], [7, 2], bounds, closed, 0.3)).toEqual([])
  })
})
```

- [ ] **Step 4: Tulis `walk.ts`**

```ts
import type { Point2 } from "./layout"

export type Box2 = { x0: number; x1: number; z0: number; z1: number }

const CELL = 0.25

/** Whether a walker of this radius may stand at `p`: inside the bounds, off every box. */
export function walkable(
  [x, z]: Point2,
  bounds: Box2,
  blocked: ReadonlyArray<Box2>,
  radius: number
): boolean {
  if (
    x < bounds.x0 + radius ||
    x > bounds.x1 - radius ||
    z < bounds.z0 + radius ||
    z > bounds.z1 - radius
  ) {
    return false
  }
  return !blocked.some(
    (box) =>
      x > box.x0 - radius &&
      x < box.x1 + radius &&
      z > box.z0 - radius &&
      z < box.z1 + radius
  )
}

function clear(
  a: Point2,
  b: Point2,
  bounds: Box2,
  blocked: ReadonlyArray<Box2>,
  radius: number
): boolean {
  const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (CELL / 2))
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 1 : i / steps
    const p: Point2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    if (!walkable(p, bounds, blocked, radius)) return false
  }
  return true
}

/**
 * A path from `from` to `to` that never enters furniture: A* on a 0.25 m grid,
 * then straightened. Empty when the target is blocked or cannot be reached;
 * the result leaves out `from` and ends exactly at `to`.
 */
export function findPath(
  from: Point2,
  to: Point2,
  bounds: Box2,
  blocked: ReadonlyArray<Box2>,
  radius: number
): Array<Point2> {
  if (!walkable(to, bounds, blocked, radius)) return []
  if (clear(from, to, bounds, blocked, radius)) return [to]

  const cols = Math.ceil((bounds.x1 - bounds.x0) / CELL) + 1
  const rows = Math.ceil((bounds.z1 - bounds.z0) / CELL) + 1
  const cellOf = (p: Point2): [number, number] => [
    Math.round((p[0] - bounds.x0) / CELL),
    Math.round((p[1] - bounds.z0) / CELL),
  ]
  const pointOf = (c: number, r: number): Point2 => [
    bounds.x0 + c * CELL,
    bounds.z0 + r * CELL,
  ]
  const free = (c: number, r: number) =>
    c >= 0 &&
    r >= 0 &&
    c < cols &&
    r < rows &&
    walkable(pointOf(c, r), bounds, blocked, radius)

  const start = cellOf(from)
  const goal = cellOf(to)
  const key = (c: number, r: number) => r * cols + c
  const cost = new Map<number, number>([[key(...start), 0]])
  const parent = new Map<number, number>()
  const open: Array<[number, number, number]> = [[0, ...start]]
  const heuristic = (c: number, r: number) =>
    Math.hypot(goal[0] - c, goal[1] - r)

  let found = false
  while (open.length > 0) {
    open.sort((a, b) => a[0] - b[0])
    const [, c, r] = open.shift()!
    if (c === goal[0] && r === goal[1]) {
      found = true
      break
    }
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue
        const nc = c + dc
        const nr = r + dr
        // No cutting corners: a diagonal needs both straight neighbours free.
        if (!free(nc, nr) || (dc !== 0 && dr !== 0 && !(free(c + dc, r) && free(c, r + dr)))) {
          continue
        }
        const next = cost.get(key(c, r))! + Math.hypot(dc, dr)
        if (next < (cost.get(key(nc, nr)) ?? Infinity)) {
          cost.set(key(nc, nr), next)
          parent.set(key(nc, nr), key(c, r))
          open.push([next + heuristic(nc, nr), nc, nr])
        }
      }
    }
  }
  if (!found) return []

  const cells: Array<Point2> = []
  for (let k: number | undefined = key(...goal); k !== undefined; k = parent.get(k)) {
    cells.push(pointOf(k % cols, Math.floor(k / cols)))
  }
  cells.reverse()
  cells[cells.length - 1] = to

  // String pulling: skip every waypoint that can be walked past.
  const path: Array<Point2> = []
  let anchor = from
  let i = 0
  while (i < cells.length) {
    let j = cells.length - 1
    while (j > i && !clear(anchor, cells[j], bounds, blocked, radius)) j--
    path.push(cells[j])
    anchor = cells[j]
    i = j + 1
  }
  return path
}
```
Run `npx vitest run src/components/lobby/scene/walk.test.ts` → PASS.

- [ ] **Step 5: Format dan commit**

```bash
npx prettier --write src/components/lobby/scene/daylight.ts src/components/lobby/scene/daylight.test.ts src/components/lobby/scene/walk.ts src/components/lobby/scene/walk.test.ts
git add src/components/lobby/scene/daylight*.ts src/components/lobby/scene/walk*.ts
git commit -m "feat(3f): daylight moods and furniture-aware walking paths" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tata letak ruangan, kamera diorama, cangkang ruang, perabot dasar, tiga rig cahaya

Task terbesar: satu sapuan karena mengganti `layout.ts` menyentuh semua modul adegan. Akhir task: aplikasi dan semua tes hijau, ruangan tampil dengan perabot dasar dan tiga suasana; rak, lemari, tanaman, dan dekorasi masih kasar/ada di tempat baru (disempurnakan Task 5–6).

**Files:**
- Modify (tulis ulang isi): `src/components/lobby/scene/layout.ts`, `layout.test.ts`, `projection.ts`, `projection.test.ts`, `room.ts`, `furniture.ts`, `skyline.ts`, `stage.ts`
- Modify: `src/components/lobby/LibraryMap.tsx` (`ATRIUM.size` menjadi `ROOM.width` pada `onMap`; denah berlian tetap, komentar "atrium" diganti "ruangan"; tes `LibraryMap.test.tsx` tetap hijau)
- Modify: `src/components/lobby/scene/people.ts`, `motion.ts` (walker, pembaca, pustakawan dihapus; Anda tetap, jalan lurus dulu), `scripts/lobby-harness.mjs`, `scripts/lobby-harness/main.ts`
- Delete: `src/components/lobby/scene/shelves.ts`, `shelves.test.ts` (ditulis ulang di Task 5; `stage.books` sementara `0`), `buildKiosk` di `decor.ts` (KIOSK dihapus; katalog toko jadi `catalogue` di meja samping)
- Test: `layout.test.ts`, `projection.test.ts`, `HotspotLayer.test.tsx`/`LobbyScene.test.tsx`/`useAndaSpot.test.ts` bila mengacu konstanta yang berubah

**Interfaces:**
- Consumes: `ModelKey`, `loadModels`, `fitTo` (Task 1); `daylight`, `RIGS`, `mixRig`, `msUntilNextMood`, `Mood` (Task 2); `findPath`, `Box2` (Task 2, dipakai Task 5).
- Produces (`layout.ts`; ekspor lama dipertahankan namanya, bentuk yang berubah ditandai):
  ```ts
  export type Point2 = readonly [number, number]; export type Point3 = readonly [number, number, number]
  export const ROOM = { width: 12, depth: 12, height: 4.6, pad: 0.9 } as const   // menggantikan ATRIUM
  export type Furnishing = { id: string; model: ModelKey; at: Point2; y?: number; size: Point3; turn: number; solid: boolean }
  export const FURNITURE: ReadonlyArray<Furnishing>      // perabot dasar; solid=false untuk yang tak menghalangi (karpet, laptop, buku catatan, katalog)
  export function footprint(f: { at: Point2; size: Point3; turn: number }): Box2   // telapak, turn kelipatan π/2
  export const WALL_SECTIONS: ReadonlyArray<{ genre: Genre; z: number; width: number }>   // 8 bagian rak di dinding X = 0
  export const SHELF = { depth: 0.45, bottom: 0.15, top: 3.6, rows: 5, z0: 0.6 } as const
  export const SHOWCASE: Point2; SHOWCASE_SIZE; SHOWCASE_TURN: number; SHOWCASE_SHELVES; SHOWCASE_SLOTS = 12
  export function showcaseSlots(): Array<Point3>        // titik dunia, sesuai SHOWCASE_TURN
  export const PLANT: Point2; PLANT_POT; PLANT_SHAPES   // tidak berubah bentuknya
  export const DECOR_SLOTS: Record<SlotId, { at: Point3; turn: number; flat: boolean; focus: Point3 }>
  export const DECOR_SIZES: Record<SlotId, Point3>      // ukuran telapak perkiraan terbesar item di slot (untuk tes tabrakan)
  export const PREVIEW_SHIFT = 0.16
  export const ANDA_START: Point2; ANDA_RADIUS = 0.3
  export const ADMIN_DESK: Point2 = [1.1, 6.4]      // dipakai SceneBackdrop dan LobbyStill.test (zoom CSS ke laptop admin)
  export const WALK_BOUNDS: Box2; export function walkBlockers(): Array<Box2>   // dari FURNITURE solid + lemari + pot tanaman + slot dekor solid
  export type HotspotId = Genre | "meja-baca" | "meja-admin" | "troli" | "katalog" | "lemari" | "tanaman" | "toko"
  export type HotspotSpot = { id: HotspotId; label: Point3; stand: Point2 }
  export const HOTSPOT_SPOTS: ReadonlyArray<HotspotSpot>   // urutan tab sama seperti sekarang
  export function spotOf(id: HotspotId): HotspotSpot
  ```
  `ATRIUM`, `GLASS`, `BOX`, `STAIRS`, `TOWER`, `ZONES`, `READING_TABLE`, `TROLLEY`, `CARD_CATALOG`, `KIOSK`, `READERS`, `LIBRARIAN`, `LOUNGES`, `WALKER_ROUTES`, `ShelfFace`, `SHELF_FACES` **dihapus**. `Box2` didefinisikan di `walk.ts`; `layout.ts` mengimpornya sebagai tipe.
- Produces (`projection.ts`): `View`, `Viewport`, `MIN_ZOOM = 1`, `MAX_ZOOM = 2.6`, `CAMERA_OFFSET`, `SCREEN_RIGHT`, `SCREEN_UP`, `baseHalfHeight(aspect)`, `halfExtents`, `clampView`, `project`, `startView`, `panBy`, `centerOn`, `isInView` — nama dan tanda tangan sama; isi `baseHalfHeight`/`clampView`/`startView` baru.
- Produces (`stage.ts`): `createStage(options: StageOptions): Promise<Stage>`; `StageOptions` mendapat `mood?: Mood`; `Stage` mendapat `setMood: (mood: Mood) => void` dan (Task 5) `setShelves`.

- [ ] **Step 1: Tulis ulang `projection.ts` (kamera diorama) — tes dulu**

Ganti isi `projection.test.ts` untuk aturan baru (pertahankan tes `project`/`panBy`/`centerOn`/`isInView` yang masih berlaku; hapus tes hexagon atrium). Tambah:
```ts
import { ROOM } from "./layout"
import { MAX_ZOOM, SCREEN_RIGHT, SCREEN_UP, clampView, halfExtents, project, startView } from "./projection"

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const corners = [0, ROOM.width].flatMap((x) =>
  [0, ROOM.height].flatMap((y) => [0, ROOM.depth].map((z) => [x, y, z] as const))
)

describe("diorama camera", () => {
  it.each([PHONE, DESKTOP])("shows the whole room at the start view (%o)", (viewport) => {
    const view = startView(viewport)
    expect(view.zoom).toBe(1)
    for (const corner of corners) {
      const { x, y } = project(corner, view, viewport)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(100)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(100)
    }
  })

  it("keeps the room on screen however far it is panned", () => {
    for (const viewport of [PHONE, DESKTOP]) {
      const far = clampView({ target: [500, 0, -500], zoom: MAX_ZOOM }, viewport)
      const { halfWidth, halfHeight } = halfExtents(far.zoom, viewport)
      const u = dot(SCREEN_RIGHT, far.target)
      const umax = ROOM.width / Math.SQRT2
      // The edge of the screen never goes past the room's edge.
      expect(Math.abs(u) - halfWidth).toBeLessThanOrEqual(umax + 1e-6)
      expect(halfHeight).toBeGreaterThan(0)
      expect(dot(SCREEN_UP, far.target)).toBeLessThan(1e3)
    }
  })

  it("centres an axis the room does not fill, and never changes the zoom within limits", () => {
    const view = clampView({ target: [3, 1, 9], zoom: 1 }, PHONE)
    expect(view).toEqual(startView(PHONE))
    expect(clampView({ target: [6, 2, 6], zoom: 9 }, DESKTOP).zoom).toBe(MAX_ZOOM)
  })
})
```
Run → FAIL. Lalu ganti di `projection.ts`: hapus `ATRIUM` dan konstanta hexagon (`SIZE`, `HEIGHT`, `FRONT`, `EDGE`, `FLOOR`, `FIT_V`), tambah:
```ts
import { ROOM, type Point3 } from "./layout"

/** The room's box on screen: u (right) and v (up) ranges over its 8 corners. */
const EXTENT = (() => {
  const us: Array<number> = []
  const vs: Array<number> = []
  for (const x of [0, ROOM.width])
    for (const y of [0, ROOM.height])
      for (const z of [0, ROOM.depth]) {
        us.push(dot(SCREEN_RIGHT, [x, y, z]))
        vs.push(dot(SCREEN_UP, [x, y, z]))
      }
  return {
    u0: Math.min(...us) - ROOM.pad,
    u1: Math.max(...us) + ROOM.pad,
    v0: Math.min(...vs) - ROOM.pad,
    v1: Math.max(...vs) + ROOM.pad,
  }
})()

/** Half the view's height in metres at zoom 1: the whole room (with its pad) just fits. */
export function baseHalfHeight(aspect: number): number {
  return Math.max((EXTENT.v1 - EXTENT.v0) / 2, (EXTENT.u1 - EXTENT.u0) / 2 / aspect)
}

/** One axis: centred when the room is narrower than the screen, otherwise kept inside the room. */
function fitAxis(value: number, min: number, max: number, half: number): number {
  return max - min <= 2 * half ? (min + max) / 2 : clamp(value, min + half, max - half)
}

/** Keeps the room on screen (spec 3F §3.1; plan 3F-R1, decision 1). */
export function clampView(view: View, viewport: Viewport): View {
  const zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM)
  const { halfWidth, halfHeight } = halfExtents(zoom, viewport)
  const u0 = dot(SCREEN_RIGHT, view.target)
  const v0 = dot(SCREEN_UP, view.target)
  const u = fitAxis(u0, EXTENT.u0, EXTENT.u1, halfWidth)
  const v = fitAxis(v0, EXTENT.v0, EXTENT.v1, halfHeight)
  return { target: slide(view.target, u - u0, v - v0), zoom }
}

/** The first view: the whole room, on every screen shape. */
export function startView(viewport: Viewport): View {
  return clampView({ target: [ROOM.width / 2, ROOM.height / 2, ROOM.depth / 2], zoom: 1 }, viewport)
}
```
(`dot`, `clamp`, `slide`, `halfExtents`, `project`, `panBy`, `centerOn`, `isInView` tetap.) Run `npx vitest run src/components/lobby/scene/projection.test.ts` → PASS (setelah Step 2 karena mengimpor `ROOM`; lakukan Step 2 sebelum menjalankan).

- [ ] **Step 2: Tulis ulang `layout.ts` — tes dulu**

Ganti `layout.test.ts` dengan tes bagian §7 spec:
```ts
import { describe, expect, it } from "vitest"
import { GENRE_VALUES } from "@/lib/genre"
import { SLOT_IDS } from "@/lib/shop/catalog"
import { MODEL_KEYS } from "./model-manifest"
import {
  ANDA_START, ANDA_RADIUS, DECOR_SIZES, DECOR_SLOTS, FURNITURE, HOTSPOT_SPOTS, PLANT, PLANT_POT,
  PLANT_SHAPES, ROOM, SHOWCASE, SHOWCASE_SIZE, SHOWCASE_SLOTS, WALK_BOUNDS, WALL_SECTIONS,
  footprint, showcaseSlots, walkBlockers, type Point2,
} from "./layout"
import { isInView, project, startView } from "./projection"
import { type Box2, findPath, walkable } from "./walk"

const inRoom = ([x, z]: Point2, m = 0) => x >= m && x <= ROOM.width - m && z >= m && z <= ROOM.depth - m
const overlap = (a: Box2, b: Box2) =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 1440, height: 900 }]

describe("room layout", () => {
  it("lists the hotspots in tab order, once each", () => {
    expect(HOTSPOT_SPOTS.map(({ id }) => id)).toEqual([
      "meja-baca", ...GENRE_VALUES, "troli", "meja-admin", "katalog", "lemari", "tanaman", "toko",
    ])
  })

  it("gives every genre one wall section, side by side inside the room", () => {
    expect(WALL_SECTIONS.map(({ genre }) => genre)).toEqual([...GENRE_VALUES])
    const last = WALL_SECTIONS.at(-1)!
    expect(last.z + last.width / 2).toBeLessThanOrEqual(ROOM.depth)
  })

  it.each(VIEWPORTS)("has every hotspot inside the room and on screen (%o)", (viewport) => {
    const view = startView(viewport)
    for (const { id, label, stand } of HOTSPOT_SPOTS) {
      expect(label[0], id).toBeGreaterThanOrEqual(0)
      expect(label[0], id).toBeLessThanOrEqual(ROOM.width)
      expect(label[1], id).toBeGreaterThan(0)
      expect(label[1], id).toBeLessThanOrEqual(ROOM.height)
      expect(inRoom([label[0], label[2]]), id).toBe(true)
      expect(inRoom(stand), id).toBe(true)
      expect(isInView(label, view, viewport), id).toBe(true)
      const { x, y } = project(label, view, viewport)
      expect(x + y, id).toBeGreaterThan(0)
    }
  })

  it("lets Anda stand at every hotspot and reach it from the start", () => {
    const blocked = walkBlockers()
    expect(walkable(ANDA_START, WALK_BOUNDS, blocked, ANDA_RADIUS)).toBe(true)
    for (const { id, stand } of HOTSPOT_SPOTS) {
      expect(walkable(stand, WALK_BOUNDS, blocked, ANDA_RADIUS), id).toBe(true)
      expect(findPath(ANDA_START, stand, WALK_BOUNDS, blocked, ANDA_RADIUS).length, id).toBeGreaterThan(0)
    }
  })

  it("keeps the base furniture inside the room and apart from each other", () => {
    const solid = FURNITURE.filter((f) => f.solid)
    for (const f of FURNITURE) {
      const box = footprint(f)
      expect(box.x0, f.id).toBeGreaterThanOrEqual(0)
      expect(box.x1, f.id).toBeLessThanOrEqual(ROOM.width)
      expect(box.z0, f.id).toBeGreaterThanOrEqual(0)
      expect(box.z1, f.id).toBeLessThanOrEqual(ROOM.depth)
      expect(MODEL_KEYS, f.id).toContain(f.model)
      const quarters = f.turn / (Math.PI / 2)
      expect(Math.abs(quarters - Math.round(quarters)), f.id).toBeLessThan(1e-9)
    }
    solid.forEach((a, i) =>
      solid.slice(i + 1).forEach((b) => expect(overlap(footprint(a), footprint(b)), `${a.id} / ${b.id}`).toBe(false))
    )
  })

  it("puts every decor slot inside the room and clear of the solid furniture", () => {
    const solid = walkBlockers()
    for (const slot of SLOT_IDS) {
      const { at, flat } = DECOR_SLOTS[slot]
      expect(inRoom([at[0], at[2]]), slot).toBe(true)
      expect(at[1], slot).toBeGreaterThanOrEqual(0)
      expect(at[1], slot).toBeLessThanOrEqual(ROOM.height)
      if (flat) continue
      const box = footprint({ at: [at[0], at[2]], size: DECOR_SIZES[slot], turn: DECOR_SLOTS[slot].turn })
      expect(solid.some((other) => overlap(box, other)), slot).toBe(false)
    }
  })

  it("stands the cabinet, its covers and the plant inside the room", () => {
    expect(SHOWCASE_SLOTS).toBe(12)
    expect(showcaseSlots()).toHaveLength(12)
    for (const [x, y, z] of showcaseSlots()) {
      expect(inRoom([x, z])).toBe(true)
      expect(y).toBeLessThan(SHOWCASE_SIZE.height)
    }
    expect(inRoom(SHOWCASE)).toBe(true)
    expect(inRoom(PLANT, PLANT_POT.width / 2)).toBe(true)
    expect(Object.keys(PLANT_SHAPES)).toHaveLength(6)
  })
})
```
`walkBlockers()` hanya berisi perabot dasar (termasuk lemari) dan pot tanaman, tidak pernah slot dekorasi; barang dekorasi terpasang ditambahkan terpisah di Task 6. Run → FAIL.

Tulis ulang `layout.ts` (sebagian komentar dari file lama dipertahankan). Nilai awal:
```ts
export const ROOM = { width: 12, depth: 12, height: 4.6, pad: 0.9 } as const

export const FURNITURE: ReadonlyArray<Furnishing> = [
  { id: "armchair", model: "armchair", at: [3.8, 2.2], size: [1.0, 0.9, 1.0], turn: 0, solid: true },
  { id: "readingLamp", model: "readingLamp", at: [2.5, 1.6], size: [0.4, 1.6, 0.4], turn: 0, solid: true },
  { id: "fireplace", model: "fireplace", at: [3.8, 0.25], size: [1.8, 1.6, 0.5], turn: 0, solid: true },
  { id: "baseRug", model: "baseRug", at: [3.8, 3.0], size: [2.2, 0.02, 1.6], turn: 0, solid: false },
  { id: "sideTable", model: "sideTable", at: [5.2, 2.0], size: [0.6, 0.6, 0.6], turn: 0, solid: true },
  { id: "catalogue", model: "catalogue", at: [5.2, 2.0], y: 0.6, size: [0.4, 0.12, 0.3], turn: 0, solid: false },
  { id: "desk", model: "desk", at: [1.1, 7.0], size: [1.8, 0.8, 0.8], turn: Math.PI / 2, solid: true },
  { id: "deskChair", model: "deskChair", at: [2.1, 7.0], size: [0.6, 1.0, 0.6], turn: -Math.PI / 2, solid: true },
  { id: "laptop", model: "laptop", at: [1.1, 6.4], y: 0.8, size: [0.4, 0.3, 0.3], turn: Math.PI / 2, solid: false },
  { id: "notebook", model: "notebook", at: [1.1, 7.6], y: 0.8, size: [0.3, 0.05, 0.22], turn: Math.PI / 2, solid: false },
  { id: "parcelBox", model: "parcelBox", at: [1.3, 10.6], size: [0.7, 0.5, 0.7], turn: 0, solid: true },
  { id: "glassCabinet", model: "glassCabinet", at: [10.6, 0.3], size: [2.2, 2.2, 0.5], turn: 0, solid: true },
]
```
`SHOWCASE = [10.6, 0.3]`, `SHOWCASE_SIZE = { width: 2.2, height: 2.2, depth: 0.5 }`, `SHOWCASE_TURN = 0` (menghadap +Z), `SHOWCASE_SHELVES = [0.12, 0.8, 1.48]`; `showcaseSlots()` mengembalikan titik dunia: lokal `(dx, y, dz = depth/2 + 0.02)` dengan `dx = (i − 1.5) × 0.5`, rak paling atas dulu, lalu diputar `SHOWCASE_TURN` (turn 0 → `[cx + dx, y, cz + dz]`). Cangkang pintu/jendela/papan gabus bukan perabot (ditempel di dinding oleh `room.ts`): `ROOM_PARTS = { window: { x0: 5.2, x1: 8.8, y0: 1.0, y1: 3.4 }, door: { z: 10.7, width: 1.3, height: 2.1 }, corkboard: { x: 1.2, y: 2.4, size: 1.0 } }` diekspor dari `layout.ts`. `SHELF = { depth: 0.45, bottom: 0.15, top: 3.6, rows: 5, z0: 0.6 }`; `WALL_SECTIONS`: genre ke-i (urutan `GENRE_VALUES`), `width: 1.1`, `z: 0.6 + 1.1 × (i + 0.5)`. `PLANT = [9.0, 0.9]`, `PLANT_POT = { width: 0.7, height: 0.6 }`, `PLANT_SHAPES` tidak berubah. `ANDA_START = [8.0, 9.5]`, `ANDA_RADIUS = 0.3`, `WALK_BOUNDS = { x0: 0.5, x1: 12, z0: 0.5, z1: 12 }`. `DECOR_SLOTS` (nilai awal): rug `at [7.0, 0, 6.5] turn 0 flat true`; lamp `[10.8, 0, 6.5] turn 0 flat false`; seat `[7.0, 0, 0.8] turn 0 flat false` (sofa di bawah jendela); wall `[3.8, 2.7, 0.06] turn 0 flat true`; pet `[9.2, 0, 3.6] turn 0 flat false`; ceiling `[6.5, 3.9, 6.5] turn 0 flat true`; `focus` = `at` dengan Y dinaikkan ke tinggi pusat barang (rug 0.3, lamp 1.0, seat 0.5, wall = at, pet 0.4, ceiling = at). `DECOR_SIZES`: rug `[2,0.02,1.4]`, lamp `[0.5,1.7,0.5]`, seat `[2,0.9,0.9]`, wall `[1.2,1,0.1]`, pet `[0.8,0.8,0.8]`, ceiling `[0.8,0.8,0.8]`. `walkBlockers()` = telapak `FURNITURE` yang `solid` + pot tanaman `[PLANT ± width/2]`; `decorBlockers()` = telapak slot non-`flat` (Task 6 menggabungkannya). `footprint({at,size,turn})`: lebar X = `size[0]` bila `turn` kelipatan π (genap), `size[2]` bila ganjil (tukar), `Box2` terpusat di `at`. Hotspot (nilai awal), urutan tab tetap:

| id | label `[x, y, z]` | stand `[x, z]` |
|---|---|---|
| `meja-baca` | `[3.8, 1.9, 2.2]` | `[3.8, 3.7]` |
| genre ke-i | `[0.4, 3.9, zᵢ]` | `[3.0, zᵢ]` |
| `troli` | `[1.3, 1.0, 10.6]` | `[2.6, 10.6]` |
| `meja-admin` | `[1.1, 1.4, 6.4]` | `[2.9, 6.2]` |
| `katalog` | `[1.1, 1.4, 7.6]` | `[2.9, 7.8]` |
| `lemari` | `[10.6, 2.5, 0.3]` | `[10.6, 2.0]` |
| `tanaman` | `[9.0, 1.9, 0.9]` | `[9.0, 2.2]` |
| `toko` | `[5.2, 1.2, 2.0]` | `[5.2, 3.3]` |

(`zᵢ` = `z` bagian rak genre ke-i.) Hapus semua ekspor yang tercantum di Interfaces sebagai dihapus. Run `npx vitest run src/components/lobby/scene/layout.test.ts src/components/lobby/scene/projection.test.ts`; geser angka (bukan tes) bila gagal, sesuai keputusan 3.

- [ ] **Step 3: Cangkang ruangan dan perabot**

Tanpa cerita kode panjang; tiap berkas di bawah mengganti isi lamanya:
- `room.ts` — `buildRoom(kit: Kit): void`. Lantai kayu (papan, `ROOM.width × ROOM.depth`, tebal 0,2 m, satu mesh), dua dinding (X = 0 dan Z = 0, tebal 0,2 m, tinggi `ROOM.height`, satu mesh per dinding digabung), lis bawah dan atas. Bukaan jendela (`ROOM_PARTS.window`) di dinding Z = 0: dinding dibangun dari empat balok mengelilingi bukaan; bingkai dari `windowFrame` bila ada filenya, selain itu kode. Pintu di dinding X = 0 (`door`, `ROOM_PARTS.door`), papan gabus (`corkboard`) di dinding Z = 0 pada `ROOM_PARTS.corkboard`. Tanpa dinding depan dan atap (diorama). Palet hangat (kayu `#b08a5e`, dinding `#d9c2a3`, lis `#7a5a3a`), bentuk membulat lewat `kit.block(..., { r })`.
- `furniture.ts` — `buildFurniture(kit: Kit, models: ModelSet): Furnishings` dengan `Furnishings = { lamps: Array<THREE.PointLight>, fire: THREE.PointLight, windowGlow: Array<THREE.Mesh>, emissives: Array<{ material: THREE.MeshStandardMaterial; max: number }> }`. Untuk tiap `FURNITURE`: ambil `models.get(f.model)` → bungkus `Group` → `fitTo(group, f.size[1])` → posisikan di `[at[0], f.y ?? 0, at[1]]`, `rotation.y = f.turn`, tambah ke adegan; model `null` → pembangun kode kecil per kunci (`FALLBACK: Record<…>`) yang menggambar bentuk membulat sesuai `f.size`. Perapian punya api (mesh emisif + `PointLight` hangat), lampu baca dan lampu meja punya bola emisif + `PointLight`; `PointLight` hanya dibuat bila `quality === "tinggi"` (parameter `withLights: boolean`). Mesh statis tanpa `userData.animated` digabung per material (`mergeGeometries` dari `three/addons/utils/BufferGeometryUtils.js`) bila model memberi banyak mesh kecil; laptop, notebook, katalog dibiarkan terpisah.
- `skyline.ts` — `buildSkyline(kit: Kit): { setCity: (k: number) => void }`: kota di luar jendela (gedung membulat, lampu jendela emisif, awan) di balik bukaan, dipakai ulang dari file lama (hapus burung/beacon/awan-bergerak yang bergantung `GLASS`/`ATRIUM`, sisakan siluet gedung + titik lampu), sepenuhnya di dalam kotak di belakang bukaan (X 4,6–9,4; Z −6…−0,2) supaya tidak muncul di luar jendela dari sudut kamera. `setCity(k)` mengatur intensitas emisif lampu kota (0..1).
- `people.ts` — hanya `buildPeople(kit, anda: Point2): { anda: Figure; ring: THREE.Mesh }`: hapus `walkers`, `sitters`, `librarian`, `stairSeats`, `loungeSeats`, `pagePivots`, `arts`; Anda sementara tetap figur lama (Task 5 menggayakannya ulang).
- `motion.ts` — `createMotion(people, skyline?)` dengan `update(t, dt)`, `walkTo(spot, instant)`, `finishWalk()`; hapus semua animasi walker/pembaca/pustakawan/awan/burung (`showWalkers` dihapus). Anda berjalan lurus dulu (Task 5 memakai `findPath`). `quality.ts`: hapus `walkerShare` dan tesnya.
- `decor.ts` — hapus `buildKiosk` (dan `KIOSK`); sisanya tetap berjalan di posisi slot baru (dibuat ulang di Task 6).
- `shelves.ts` + `shelves.test.ts` — hapus; `stage.books` bernilai `0` sementara.
- `showcase.ts`/`plant.ts` — hanya sesuaikan impor/konstanta supaya terkompilasi (`SHOWCASE_TURN`: bungkus dalam `Group` ber-`rotation.y = SHOWCASE_TURN`, posisi `SHOWCASE`); bentuk akhir di Task 5.

- [ ] **Step 4: Rig cahaya dan stage**

Di `stage.ts`: `createStage` menjadi `async function createStage(options): Promise<Stage>`: setelah renderer dibuat, `const models = await loadModels()` (bila menolak: lepas renderer/canvas seperti blok `catch` yang ada, lalu lempar ulang), lalu `buildStage(options, renderer, quality, models)`. `StageOptions.mood?: Mood` (default `daylight(new Date())`). Cahaya: ganti `HemisphereLight`/`DirectionalLight` lama dengan satu `HemisphereLight` + satu `DirectionalLight` (`key`, bayangan hanya `tinggi`; kamera bayangan `±9` m pusat ruangan) + lampu titik dari `Furnishings` (hanya `tinggi`). Fungsi `applyRig(rig: LightRig)` mengatur `scene.background` (kecuali mode `test`: tetap magenta), `hemi.color/groundColor/intensity`, `key.color/intensity/position`, `furniture.lamps[i].intensity = lamps × 1.6`, `furniture.fire.intensity = fire × 2`, intensitas emisif lampu (dari `emissives[i].max × lamps`), `skyline.setCity(city)`, `renderer.toneMappingExposure = exposure`. Peralihan: `let from = RIGS[mood]; let to = from; let blend = 1`; `setMood(next)`: di mode animasi (`animates()`) `from = current; to = RIGS[next]; blend = 0` lalu di `tick` `blend = min(1, blend + dt / 3)`, `applyRig(mixRig(from, to, blend))`, `needsRender` sampai selesai; selain itu langsung `applyRig(RIGS[next])`. Pewaktu: `let moodTimer = setTimeout(rollMood, msUntilNextMood(new Date()))` dengan `rollMood` memanggil `setMood(daylight(new Date()))` dan menjadwalkan ulang; `dispose` membersihkan. Hapus `EffectComposer` bloom hanya bila terlalu berat? Tidak: bloom tetap (`tinggi`), ambang naik ke 0,95 supaya siang tak berpendar. `Stage` mendapat `setMood`. Hapus `walkerShare`, `showWalkers`, `SHELF_FACES`, `buildShelves`, `buildKiosk`, `stairSeats`, `loungeSeats` dari impor/pemakaian. `LobbyCanvas.tsx`: `import("./scene/stage").then(({ createStage }) => createStage({...}))` sudah berantai; ubah menjadi `.then(({ createStage }) => createStage(...)).then((stage) => { if (cancelled) { stage.dispose(); return } ... })` dan perbarui `LobbyCanvas.test.tsx` (mock `createStage: vi.fn(() => Promise.resolve(stage))`, `stage` ditambah `setMood: vi.fn()`).

- [ ] **Step 5: Harness: parameter `mood` dan perintah `moods`**

`scripts/lobby-harness/main.ts`: baca `?mood=day|dusk|night` (default `night`), `await createStage({ ..., mood })`, bungkus modul dalam `async` bila belum (top-level await tersedia di Vite), set `document.body.dataset.ready` seperti sekarang. `scripts/lobby-harness.mjs`: tambahkan `render(viewport, query)` yang sudah ada dipakai ulang oleh perintah baru
```js
async function moods(dir) {
  mkdirSync(dir, { recursive: true })
  const sizes = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } }
  for (const mood of ["day", "dusk", "night"]) {
    for (const [name, viewport] of Object.entries(sizes)) {
      const png = await render(viewport, `mode=still&mood=${mood}`)
      await sharp(png).toFile(`${dir}/${mood}-${name}.png`)
      console.log(`wrote ${dir}/${mood}-${name}.png`)
    }
  }
}
```
dan cabang `else if (command === "moods") await moods(file ?? "scratch/moods")`; perbarui komentar kepala berkas. Mode `still` memakai latar sama seperti `normal` dan semua pustaka cahaya `tinggi`.

- [ ] **Step 6: Verifikasi dan commit**

Run: `npx tsc --noEmit` (atau skrip typecheck proyek: `npm run typecheck`), `npx vitest run --maxWorkers=2` → semua hijau (perbarui `HotspotLayer.test.tsx`, `LobbyScene.test.tsx`, `useAndaSpot.test.ts`, `LobbyStage.test.tsx` bila mengacu konstanta lama; ekspor yang dipakai React tidak berubah nama). Lalu `node scripts/lobby-harness.mjs shot scratch/check.png` (render tanpa error konsol; ruangan terlihat; lalu hapus `scratch/` dari git bila ada). Format dan commit:
```bash
npx prettier --write <semua berkas yang disentuh>
git add -A src scripts
git commit -m "feat(3f): study room shell, base furniture, diorama camera and three light rigs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: TITIK CEK PEMILIK — arah visual (BERHENTI di sini)

**Files:**
- Create (tidak di-commit): `scratch/moods/{day,dusk,night}-{desktop,phone}.png`

> **Pengendali: JEDA di task ini. Jangan lanjut ke Task 5 sebelum pemilik menyetujui secara tertulis di percakapan.**

- [ ] **Step 1: Hasilkan enam tangkapan layar**

```bash
node scripts/lobby-harness.mjs moods scratch/moods
```
Hasil: `day-desktop.png`, `day-phone.png`, `dusk-*.png`, `night-*.png` (1440 × 900 dan 390 × 844). Lihat sendiri tiap gambar lebih dulu dengan alat baca gambar; perbaiki cacat yang jelas (benda melayang, model terbalik, skala tak masuk akal, ruangan terpotong di HP, cahaya terlalu gelap/terang) lewat penyesuaian `layout.ts`/`RIGS`/`furniture.ts`, jalankan ulang tes layout, buat ulang gambar. Satu putaran perbaikan sudah cukup; sisanya urusan pemilik.

- [ ] **Step 2: Serahkan ke pemilik dan BERHENTI**

Laporkan ke pengendali: jalur enam gambar, ringkasan satu kalimat per suasana, dan daftar pilihan yang perlu diputuskan pemilik (palet, ukuran ruangan, kerapatan perabot, kesan di HP). Tunggu keputusan. Bila pemilik minta perubahan: lakukan di `layout.ts`/`daylight.ts`/`furniture.ts`/`room.ts`, ulangi Step 1, commit `fix(3f): visual direction` dengan `Co-Authored-By`, dan minta persetujuan lagi. Setelah disetujui, catat "disetujui pemilik, <tanggal>" di berkas audit (`docs/superpowers/plans/2026-11-07-tahap-3f-r1-audit-aset.md`, bagian akhir) dan commit; baru lanjut.

> **Status 2026-11-13:** tangkapan layar dibuat dan dilihat pemilik. Arah visual disetujui dengan syarat benda tanpa fungsi dibuang (spec keputusan 9). Catatan persetujuan di berkas audit ditulis di Task 4A Step 1.

---

### Task 4A: Benda bertujuan — buang benda tanpa fungsi, hotspot perapian dan pintu

**Files:**
- Modify: `src/components/lobby/scene/layout.ts`, `layout.test.ts`, `room.ts`, `model-manifest.ts`, `src/components/lobby/lobby-data.ts`, `lobby-data.test.ts`, `src/components/lobby/LobbyStage.tsx`, `LobbyStage.test.tsx`, `public/lobby/models/LICENSE.md`, `docs/superpowers/plans/2026-11-07-tahap-3f-r1-audit-aset.md`
- Delete: `public/lobby/models/rug-rectangle-a.glb` (hanya dipakai `baseRug`; cek dulu dengan `grep -n "rug-rectangle-a" src/components/lobby/scene/model-manifest.ts`)

**Interfaces:**
- Consumes: `FURNITURE`, `HOTSPOT_SPOTS`, `HotspotId`, `spotOf` (Task 3); `lobbyHotspots` (lobi lama).
- Produces:
  ```ts
  // layout.ts
  export type Furnishing = { id: string; model: ModelKey; at: Point2; y?: number; size: Point3; turn: number; solid: boolean; serves: HotspotId }
  export type HotspotId = Genre | "meja-baca" | "meja-admin" | "troli" | "katalog" | "lemari" | "tanaman" | "toko" | "perapian" | "pintu"
  // HOTSPOT_SPOTS: urutan tab ... "toko", "perapian", "pintu" (Task 4C menyisipkan "papan" di antara keduanya)
  ```
  Label hotspot baru (`lobby-data.ts`): `perapian` → `"Kilas balik"`, `pintu` → `"Pengaturan"`.

- [ ] **Step 1: Catat persetujuan Task 4**

Di akhir `docs/superpowers/plans/2026-11-07-tahap-3f-r1-audit-aset.md` tambahkan bagian:
```markdown
## Persetujuan arah visual

Disetujui pemilik, 2026-11-13, dengan syarat benda tanpa fungsi dibuang (spec 3F keputusan 9): tangga dan relnya, karpet panjang di depan rak, tanaman dekat pintu, tanaman dan buku di ambang jendela, lukisan di atas pintu, karpet dasar (`baseRug`, model `rug-rectangle-a.glb` dihapus).
```
Di tabel audit, baris `baseRug` diberi catatan "dibuang 2026-11-13".

- [ ] **Step 2: Tes (gagal dulu) di `layout.test.ts`**

Ganti harapan urutan tab di tes "lists the hotspots in tab order, once each" menjadi:
```ts
expect(HOTSPOT_SPOTS.map(({ id }) => id)).toEqual([
  "meja-baca", ...GENRE_VALUES, "troli", "meja-admin", "katalog", "lemari", "tanaman", "toko",
  "perapian", "pintu",
])
```
Tambah:
```ts
it("gives every piece of base furniture the hotspot it serves (spec 3F §3.6)", () => {
  const ids = new Set<string>(HOTSPOT_SPOTS.map(({ id }) => id))
  for (const f of FURNITURE) expect(ids.has(f.serves), f.id).toBe(true)
})

it("keeps nothing without a use in the room", () => {
  const ids = FURNITURE.map(({ id }) => id)
  for (const gone of ["baseRug", "doorPlant"]) expect(ids, gone).not.toContain(gone)
  expect(MODEL_KEYS).not.toContain("baseRug")
})
```
Run `npx vitest run src/components/lobby/scene/layout.test.ts` → FAIL (`serves` belum ada, urutan tab lama).

- [ ] **Step 3: `layout.ts` dan `model-manifest.ts`**

- `Furnishing` mendapat `serves: HotspotId`. Isi per perabot: `armchair`, `readingLamp` → `"meja-baca"`; `fireplace` → `"perapian"`; `sideTable`, `catalogue` → `"toko"`; `desk`, `deskChair`, `notebook`, `deskLamp` → `"katalog"`; `laptop` → `"meja-admin"`; `parcelBox` → `"troli"`; `glassCabinet` → `"lemari"`.
- Hapus entri `baseRug` dan `doorPlant` dari `FURNITURE` (komentar "A potted plant in the corner by the door" ikut).
- `HotspotId` mendapat `"perapian" | "pintu"`. `HOTSPOT_SPOTS` mendapat di akhir (nilai awal, keputusan 3):
  ```ts
  { id: "perapian", label: [4.0, 2.0, 0.35], stand: [5.6, 1.0] },
  { id: "pintu", label: [0.1, 2.4, ROOM_PARTS.door.z], stand: [1.4, 11.0] },
  ```
  Perbarui komentar di atas `HOTSPOT_SPOTS` (urutan tab: ..., katalog toko, perapian, pintu).
- Komentar di atas `ROOM_PARTS`: pintu melayani hotspot `pintu`, papan gabus disiapkan untuk `papan` (Task 4C), jendela adalah penunjuk waktu (spec §3.6).
- `model-manifest.ts`: hapus `"baseRug"` dari `MODEL_KEYS` dan `baseRug` dari `MODELS`. Hapus berkas glb-nya dan barisnya di `LICENSE.md`.

Run layout test → PASS. Bila hotspot baru gagal tes layar/jangkauan, geser `label`/`stand` (bukan tes).

- [ ] **Step 4: `room.ts` — buang hiasan tanpa fungsi**

- Hapus fungsi `dressing()` seluruhnya (rel kuningan, tangga, karpet panjang, lukisan di atas pintu) dan panggilannya di `buildRoom`. Hapus impor/konstanta yang jadi tak terpakai (`tsc` dan eslint menunjukkannya).
- Di `windowFrame`: hapus pot herba dan buku di ambang jendela (blok berkomentar "A small pot of herbs and a book on the sill").
- Ubah komentar `buildRoom` dan `corkboard` (papan gabus kini milik hotspot `papan`, Task 4C).

- [ ] **Step 5: Label dan aksi (tes dulu)**

`lobby-data.test.ts`: tambah
```ts
it("names the fireplace and the door", () => {
  const hotspots = lobbyHotspots(counts)
  expect(hotspots.find(({ id }) => id === "perapian")).toMatchObject({ label: "Kilas balik", count: null, badge: null, dim: false })
  expect(hotspots.find(({ id }) => id === "pintu")).toMatchObject({ label: "Pengaturan", count: null, badge: null, dim: false })
})
```
(`counts` = objek hitungan yang sudah dipakai tes lain di berkas itu.) `LobbyStage.test.tsx`: tambah
```ts
it("opens Kilas balik from the fireplace and Pengaturan from the door", async () => {
  const { router } = renderStage(false)
  await vi.waitFor(() => expect(scene.props).not.toBeNull())
  const activate = (scene.props as unknown as { onActivate: (id: string) => void }).onActivate
  await act(async () => activate("perapian"))
  expect(router.state.location.pathname).toBe("/recap")
  await act(async () => activate("pintu"))
  expect(router.state.location.pathname).toBe("/settings")
})
```
(Perluas tipe `scene.props` di mock bila perlu: `{ paused?: boolean; allow3d?: boolean; onActivate?: (id: string) => void }`.) Run → FAIL.

Implementasi: `lobby-data.ts` → `if (id === "perapian") return { ...plain, label: "Kilas balik" }`, `if (id === "pintu") return { ...plain, label: "Pengaturan" }`. `LobbyStage.activate`: `else if (id === "perapian") void navigate({ to: "/recap", search: { periode: undefined } })`, `else if (id === "pintu") void navigate({ to: "/settings" })` (keduanya sebelum cabang `else` genre). Run → PASS.

- [ ] **Step 6: Verifikasi dan commit**

`npx tsc --noEmit`, `npx vitest run --maxWorkers=2` → hijau. `node scripts/lobby-harness.mjs shot scratch/purpose.png` lalu lihat gambarnya: tak ada tangga, lukisan, karpet, tanaman kecil; label hotspot baru tidak menimpa label lain. Format dan commit:
```bash
npx prettier --write <berkas yang disentuh>
git add -A src public/lobby/models docs/superpowers/plans/2026-11-07-tahap-3f-r1-audit-aset.md
git commit -m "feat(3f): every object has a use; fireplace opens the recap, the door settings" -m "Co-Authored-By: <sesuai pengingat atribusi>"
```

---

### Task 4R: Ruangan lebih kecil (revisi titik cek 2026-11-07, diputuskan ulang 2026-11-13)

Dikerjakan **setelah 4A dan sebelum 4B**. Di titik cek 2026-11-07 pemilik menilai ruangan terlalu kosong. Pada 2026-11-13 pemilik memutuskan: prinsip benda bertujuan tetap berlaku, ruangan diperkecil, hiasan kecil hanya boleh **menempel pada benda yang punya hotspot**, tanpa hiasan berdiri sendiri, tanpa meja kopi atau sudut baca di tengah.

**Files:**
- Modify: `src/components/lobby/scene/layout.ts`, `layout.test.ts`, `projection.test.ts` (hanya bila menyebut angka 12), `room.ts`, `furniture.ts` → dipecah (lihat Step 3), `stage.ts`, `daylight.ts` (bila cahaya isi malam diatur lewat rig), `skyline.ts` (kotak di balik jendela ikut jendela), `scripts/lobby-harness/main.ts` (bila ada angka ruangan), `src/components/lobby/scene/model-manifest.ts`, `public/lobby/models/LICENSE.md`, `docs/superpowers/plans/2026-11-07-tahap-3f-r1-audit-aset.md` (bila menambah model)
- Create: `src/components/lobby/scene/furniture-builders.ts` (bila `furniture.ts` dipecah), `src/components/lobby/scene/kit.test.ts` (opsional, Step 4)

**Interfaces:**
- Consumes: semua ekspor `layout.ts` setelah Task 4A (`serves`, hotspot `perapian`/`pintu`).
- Produces: nama dan bentuk ekspor tidak berubah; hanya angka. `ROOM = { width: 10, depth: 10, height: 4.6, pad: 0.9 }` (nilai awal; tinggi tetap kecuali tampak salah). Perabot baru (hiasan yang menempel) masuk `FURNITURE` dengan `serves` ke hotspot induknya dan `solid: false`, atau dibangun di dalam pembangun benda induknya.

- [ ] **Step 1: Perkecil ruangan**

`ROOM.width`/`depth` 12 → 10. Tempatkan ulang `FURNITURE`, `ROOM_PARTS`, `WALL_SECTIONS` (8 bagian tetap muat di dinding X = 0: lebar bagian dikecilkan bila perlu, `SHELF.z0` disesuaikan), `SHOWCASE`, `PLANT`, `DECOR_SLOTS`, `ANDA_START`, `WALK_BOUNDS`, `ADMIN_DESK`, dan `HOTSPOT_SPOTS`, dengan perabot lebih berdekatan dan pintu tetap bebas. Tes yang ada (di dalam ruangan, tidak bertabrakan, terproyeksi di layar HP dan desktop, terjangkau dari `ANDA_START`, slot dekor bebas) menentukan angkanya; jangan melonggarkan tes. Kota di jendela (`skyline.ts`) tetap di dalam kotak di balik bukaan.

- [ ] **Step 2: Hiasan yang menempel pada benda bertujuan**

Hanya jenis ini, masing-masing bagian dari benda induk:
- kursi berlengan (`meja-baca`): satu atau dua bantal;
- meja tulis (`katalog`): tumpukan buku kecil, cangkir, pena dan kertas;
- perapian (`perapian`): keranjang kayu bakar menempel di sisinya (mantel sudah berisi lilin);
- meja samping (`toko`): tidak ada tambahan selain katalog.

Tidak ada tumpukan buku di lantai, foto berbingkai, tanaman kecil di sudut, meja kopi, atau karpet tengah. Pakai model KayKit yang sudah diunduh bila ada (cek daftar audit), selain itu kode dengan gaya membulat yang sama. Total model tetap ≤ 3 MB; model baru dicatat di manifest, audit, dan `LICENSE.md`. Tes `layout.test.ts` "gives every piece of base furniture the hotspot it serves" mencakup entri baru.

- [ ] **Step 3: Rapikan kode yang tersentuh**

- `furniture.ts` (±511 baris): bila hiasan menambah panjangnya, pindahkan pembangun per benda ke `furniture-builders.ts`; `buildFurniture` tetap satu-satunya pintu masuk.
- `stage.ts`: pastikan pewaktu suasana (`moodTimer`) dipasang **setelah** semua bagian yang bisa melempar selesai dibangun, atau dibersihkan di jalur gagal (temuan review Task 3).

- [ ] **Step 4: Cahaya lantai malam dan tes kecil**

Lantai depan agak keruh di malam hari: naikkan sedikit lewat cahaya isi lembut (mis. `hemi` malam di `RIGS.night`, atau satu `PointLight` lemah di tengah ruangan hanya di `tinggi`) tanpa menghilangkan suasana hangat. Opsional: `kit.test.ts` untuk `mergeStatic` (dua kotak satu material → satu mesh; `userData.animated` tidak disentuh; transformasi dunia terpanggang).

- [ ] **Step 5: Verifikasi dan commit**

`npx tsc --noEmit`, `npx vitest run --maxWorkers=2` → hijau. `node scripts/lobby-harness.mjs moods scratch/moods`, lihat keenam gambar sendiri: ruangan tampak lebih penuh dan lebih besar di HP, tak ada benda melayang/menembus, label hotspot tidak saling menimpa, lantai malam terbaca. Format dan commit `feat(3f): a smaller, fuller study`. Laporkan jalur gambar ke pengendali (pemilik melihatnya sebelum Task 5).

---

### Task 4B: Sinyal ruangan — api, lampu meja, tutup kotak paket; cincin diam

**Files:**
- Create: `src/components/lobby/room-signals.ts`, `room-signals.test.ts`, `src/lib/vocab/vocab-seen.ts`, `vocab-seen.test.ts`
- Modify: `src/lib/local/keys.ts`, `src/lib/vocab/vocab-client.ts`, `src/routes/_member/_lobi/vocabulary.tsx`, `src/components/lobby/scene/daylight.ts`, `daylight.test.ts`, `furniture.ts`, `stage.ts`, `motion.ts`, `people.ts`, `src/components/lobby/{LobbyStage,LobbyScene,LobbyCanvas}.tsx`, `LobbyCanvas.test.tsx`, `scripts/lobby-harness/main.ts`

**Interfaces:**
- Consumes: `HabitDay` (`@/lib/habit/types`), `goalSeconds` (`@/lib/reading-habit`), `addDays` (`@/lib/dates`), `WordMeetings` (`@/lib/vocab/types`), `useReadingHabit`, `summarizeLobby(...).trolley`.
- Produces:
  ```ts
  // room-signals.ts (tanpa three; boleh diimpor React dan adegan)
  export type FireLevel = "bara" | "kecil" | "besar"
  export type RoomSignals = { fire: FireLevel; deskLamp: boolean; parcelOpen: boolean }
  export const NEUTRAL_SIGNALS: RoomSignals            // { fire: "kecil", deskLamp: false, parcelOpen: false }
  export const FIRE_STRENGTH: Record<FireLevel, number>  // { bara: 0.25, kecil: 0.6, besar: 1 }
  export function fireLevel(days: ReadonlyArray<HabitDay>, today: string): FireLevel
  export function roomSignals(input: { days: ReadonlyArray<HabitDay>; today: string; meetingsTotal: number | null; vocabSeen: number | null; trolley: number }): RoomSignals
  // vocab-seen.ts
  export function meetingsTotal(meetings: WordMeetings): number
  export function readVocabSeen(): number | null
  export function rememberVocabSeen(total: number): void
  // vocab-client.ts
  export function useMeetingsTotal(): number | null     // null sampai cache Kosakata terbaca
  // keys.ts
  export const VOCAB_SEEN_KEY = "glosa:vocab-seen"
  // stage.ts
  Stage.setSignals: (signals: RoomSignals) => void       // StageOptions tidak berubah; awal = NEUTRAL_SIGNALS
  ```
  `LobbyScene`/`LobbyCanvas` mendapat prop `signals?: RoomSignals` (default `NEUTRAL_SIGNALS`).

- [ ] **Step 1: Tes fungsi murni (gagal dulu)**

`src/components/lobby/room-signals.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import type { HabitDay } from "@/lib/habit/types"
import { NEUTRAL_SIGNALS, fireLevel, roomSignals } from "./room-signals"

const TODAY = "2026-11-13"
const read = (day: string): HabitDay => ({ day, seconds: 600, goalMinutes: 5 })
const short = (day: string): HabitDay => ({ day, seconds: 60, goalMinutes: 5 })

describe("fireLevel", () => {
  it("is embers without a reading day in the last 7 days", () => {
    expect(fireLevel([], TODAY)).toBe("bara")
    expect(fireLevel([short(TODAY), read("2026-11-06")], TODAY)).toBe("bara")
  })
  it("is small for 1–2 reading days and big from 3", () => {
    expect(fireLevel([read("2026-11-07")], TODAY)).toBe("kecil")
    expect(fireLevel([read(TODAY), read("2026-11-12")], TODAY)).toBe("kecil")
    expect(fireLevel([read(TODAY), read("2026-11-12"), read("2026-11-10")], TODAY)).toBe("besar")
  })
  it("counts a day once and ignores days after today", () => {
    expect(fireLevel([read(TODAY), read(TODAY), read("2026-11-14")], TODAY)).toBe("kecil")
  })
})

describe("roomSignals", () => {
  const base = { days: [], today: TODAY, meetingsTotal: 10, vocabSeen: 10, trolley: 0 }
  it("lights the desk lamp only when words met again since Kosakata was opened", () => {
    expect(roomSignals(base).deskLamp).toBe(false)
    expect(roomSignals({ ...base, meetingsTotal: 12 }).deskLamp).toBe(true)
    expect(roomSignals({ ...base, meetingsTotal: null }).deskLamp).toBe(false)
    expect(roomSignals({ ...base, vocabSeen: null }).deskLamp).toBe(false)
  })
  it("opens the parcel box when a book has no genre", () => {
    expect(roomSignals(base).parcelOpen).toBe(false)
    expect(roomSignals({ ...base, trolley: 2 }).parcelOpen).toBe(true)
  })
  it("has neutral signals for the still image", () => {
    expect(NEUTRAL_SIGNALS).toEqual({ fire: "kecil", deskLamp: false, parcelOpen: false })
  })
})
```
`src/lib/vocab/vocab-seen.test.ts`:
```ts
import { afterEach, describe, expect, it } from "vitest"
import { VOCAB_SEEN_KEY } from "@/lib/local/keys"
import { meetingsTotal, readVocabSeen, rememberVocabSeen } from "./vocab-seen"

describe("vocab seen", () => {
  afterEach(() => localStorage.clear())
  it("adds up every saved word's meetings", () => {
    expect(meetingsTotal({})).toBe(0)
    expect(meetingsTotal({ run: { meetings: 3, books: 1 }, keen: { meetings: 4, books: 2 } })).toBe(7)
  })
  it("remembers the total on this device and ignores a broken value", () => {
    expect(readVocabSeen()).toBeNull()
    rememberVocabSeen(12)
    expect(readVocabSeen()).toBe(12)
    localStorage.setItem(VOCAB_SEEN_KEY, "lots")
    expect(readVocabSeen()).toBeNull()
  })
})
```
Run kedua berkas → FAIL.

- [ ] **Step 2: Implementasi fungsi murni**

`room-signals.ts`:
```ts
import { addDays } from "@/lib/dates"
import type { HabitDay } from "@/lib/habit/types"
import { goalSeconds } from "@/lib/reading-habit"

/** The fireplace's state (spec 3F §3.6): reading days in the last 7 days. */
export type FireLevel = "bara" | "kecil" | "besar"
/** What the room shows about the member's reading (spec 3F §3.6). */
export type RoomSignals = { fire: FireLevel; deskLamp: boolean; parcelOpen: boolean }

/** For the still image and before the data arrives. */
export const NEUTRAL_SIGNALS: RoomSignals = { fire: "kecil", deskLamp: false, parcelOpen: false }

/** Flame size and glow, 0..1. */
export const FIRE_STRENGTH: Record<FireLevel, number> = { bara: 0.25, kecil: 0.6, besar: 1 }

/** A reading day is a day whose goal was met (spec 3B §3.2), as for the streak. */
export function fireLevel(days: ReadonlyArray<HabitDay>, today: string): FireLevel {
  const from = addDays(today, -6)
  const read = new Set(
    days
      .filter((d) => d.day >= from && d.day <= today && d.seconds >= goalSeconds(d.goalMinutes))
      .map((d) => d.day)
  )
  if (read.size === 0) return "bara"
  return read.size <= 2 ? "kecil" : "besar"
}

export function roomSignals(input: {
  days: ReadonlyArray<HabitDay>
  today: string
  meetingsTotal: number | null
  vocabSeen: number | null
  trolley: number
}): RoomSignals {
  const { meetingsTotal, vocabSeen } = input
  return {
    fire: fireLevel(input.days, input.today),
    deskLamp: meetingsTotal !== null && vocabSeen !== null && meetingsTotal > vocabSeen,
    parcelOpen: input.trolley > 0,
  }
}
```
`keys.ts`: `export const VOCAB_SEEN_KEY = "glosa:vocab-seen"` (dengan komentar: total pertemuan kata saat Kosakata terakhir dibuka, spec 3F §3.6).
`vocab-seen.ts`:
```ts
import { VOCAB_SEEN_KEY } from "@/lib/local/keys"
import type { WordMeetings } from "./types"

/** Every saved word's meetings added up: it only grows while the member reads (spec 3D). */
export function meetingsTotal(meetings: WordMeetings): number {
  let total = 0
  for (const { meetings: count } of Object.values(meetings)) total += count
  return total
}

/** The total when Kosakata was last opened on this device; null when unknown. */
export function readVocabSeen(): number | null {
  try {
    const raw = localStorage.getItem(VOCAB_SEEN_KEY)
    if (raw === null) return null
    const total = Number(raw)
    return Number.isInteger(total) && total >= 0 ? total : null
  } catch {
    return null
  }
}

export function rememberVocabSeen(total: number): void {
  try {
    localStorage.setItem(VOCAB_SEEN_KEY, String(total))
  } catch {
    // Storage can be off (private windows): the desk lamp then stays off.
  }
}
```
`vocab-client.ts` (dekat `useWordMeetings`):
```ts
/** The meetings added up; null until the vocabulary cache is read (spec 3F §3.6). */
export function useMeetingsTotal(): number | null {
  const cache = useVocabState().cache
  return useMemo(() => (cache === null ? null : meetingsTotal(cache.meetings)), [cache])
}
```
(impor `useMemo` dan `meetingsTotal`.) `vocabulary.tsx` (`VocabularyPage`): `const total = useMeetingsTotal()` dan `useEffect(() => { if (total !== null) rememberVocabSeen(total) }, [total])` — membuka Kosakata memadamkan lampu. Run tes Step 1 → PASS.

- [ ] **Step 3: Rig tanpa api**

`daylight.ts`: hapus `fire` dari `LightRig`, dari ketiga `RIGS`, dan dari `mixRig`; perbarui `daylight.test.ts` (hapus harapan `fire`). `stage.ts` `applyRig` sementara memakai `FIRE_STRENGTH[signals.fire]` (Step 4).

- [ ] **Step 4: Adegan menampilkan sinyal**

`furniture.ts`:
- `Glow.kind` menjadi `"lamps" | "fire" | "desk"`; `Build.light` menerima `kind: "lamp" | "desk" | "fire"`; `Build` mendapat `mark: (role: "flame" | "flap", object: THREE.Object3D) => void` yang mengumpulkan objek ke `flames`/`flaps` dan menandai `object.userData.animated = true` (supaya `mergeStatic` melewatinya).
- `Furnishings` menjadi `{ lamps: Array<THREE.PointLight>; deskLight: THREE.PointLight | null; fire: THREE.PointLight; flames: Array<THREE.Object3D>; flaps: Array<THREE.Object3D>; emissives: Array<Glow> }`.
- `lampGlow(build, kind)`: perabot `deskLamp` memakai `"desk"` untuk glow dan cahayanya (`light(..., "desk")` → `deskLight`, hanya bila `withLights`); `readingLamp` tetap `"lamps"`. Panggil dengan `piece.id === "deskLamp" ? "desk" : "lamps"`.
- `fireplace`: lilin di mantel memakai glow `"fire"` (bagian dari sinyal api, keputusan 11); mesh nyala api dibungkus satu `Group` berporos di dasar perapian lalu `mark("flame", group)`.
- `parcelDetails`: dua tutup berengsel di tepi atas sisi panjang:
  ```ts
  for (const side of [-1, 1] as const) {
    const hinge = new THREE.Group()
    hinge.position.set(0, h, (side * d) / 2)
    hinge.userData.side = side
    group.add(hinge)
    kit.block(w * 0.98, 0.006, d / 2, "#c8a06a", 0, 0, (-side * d) / 4, { r: 0.002, parent: hinge, cast: false })
    mark("flap", hinge)
  }
  ```
  Terbuka = `hinge.rotation.x = side × 1.9`, tertutup = `0`.

`stage.ts`: `let signals: RoomSignals = NEUTRAL_SIGNALS`. Di `applyRig`: emisif `kind === "fire"` → `FIRE_STRENGTH[signals.fire]`, `"desk"` → `signals.deskLamp ? 1 : 0`, `"lamps"` → `rig.lamps`; `furniture.fire.intensity = FIRE_STRENGTH[signals.fire] × 2`; `furniture.deskLight.intensity = signals.deskLamp ? 1.6 : 0`; untuk tiap `flames` `scale.y = FIRE_STRENGTH[signals.fire]`; untuk tiap `flaps` `rotation.x = signals.parcelOpen ? side × 1.9 : 0`. `setSignals(next)`: `signals = next; applyRig(current); requestRender()`. `setQuality`: `deskLight.visible` ikut aturan lampu titik seperti `lamps`.

`motion.ts`: hapus denyut cincin (`people.ring.material.opacity = 0.55 + …`). `people.ts`: opasitas cincin tetap `0.8`. (Cincin diam, spec §3.6.)

React: `LobbyStage.tsx` menghitung
```ts
const meetingsTotal = useMeetingsTotal()
const [vocabSeen, setVocabSeen] = useState<number | null>(null)
useEffect(() => {
  if (meetingsTotal === null) return
  const seen = readVocabSeen()
  // No record yet: this visit becomes the starting point, the lamp stays off.
  if (seen === null) rememberVocabSeen(meetingsTotal)
  setVocabSeen(seen ?? meetingsTotal)
}, [meetingsTotal])
const signals = useMemo(
  () => roomSignals({ days: habit.days, today: habit.today, meetingsTotal, vocabSeen, trolley: summary.trolley.length }),
  [habit.days, habit.today, meetingsTotal, vocabSeen, summary.trolley.length]
)
```
dan meneruskan `signals={signals}` ke `LobbyScene`. `LobbyScene`/`LobbyCanvas`: prop `signals` dengan pola yang sama persis seperti `plant` (ref, efek `stageRef.current?.setSignals`, dan `stage.setSignals(signalsRef.current)` setelah stage siap). `LobbyCanvas.test.tsx`: mock stage mendapat `setSignals: vi.fn()`; tambah tes "hands the room's signals to the stage, now and on change" dengan pola tes `plant`.

Harness `main.ts`: `?fire=bara|kecil|besar`, `?lamp=1`, `?parcel=1` → `stage.setSignals({ fire, deskLamp, parcelOpen })` (default `NEUTRAL_SIGNALS`).

- [ ] **Step 5: Verifikasi dan commit**

`npx tsc --noEmit`, `npx vitest run --maxWorkers=2` → hijau. Lihat dua gambar:
```bash
node scripts/lobby-harness.mjs shot scratch/signals-off.png "mood=day&fire=bara"
node scripts/lobby-harness.mjs shot scratch/signals-on.png "mood=day&fire=besar&lamp=1&parcel=1"
```
(argumen ketiga `shot` diteruskan apa adanya ke query). Di siang hari: api besar dan lampu meja menyala terlihat pada gambar kedua, bara dan lampu padam pada gambar pertama; tutup kotak terbuka. Format dan commit `feat(3f): the fire, desk lamp and parcel box show your reading`.

---

### Task 4C: Papan gabus — sorotan terbaru

**Files:**
- Modify: `src/lib/annotations/types.ts`, `src/server/annotations.ts`, `src/components/lobby/scene/layout.ts`, `layout.test.ts`, `room.ts`, `stage.ts`, `src/components/lobby/lobby-data.ts`, `lobby-data.test.ts`, `src/components/lobby/{LobbyStage,LobbyScene,LobbyCanvas}.tsx`, `LobbyStage.test.tsx`, `LobbyCanvas.test.tsx`, `scripts/lobby-harness/main.ts`
- Create: `src/lib/annotations/highlights-client.ts`, `highlights-client.test.ts`, `src/components/lobby/CorkboardPanel.tsx`, `CorkboardPanel.test.tsx`

**Interfaces:**
- Consumes: tabel `annotations` (RLS yang ada), `HighlightColor`, `ShelfBook`, pola `TrolleyPanel` (dialog di atas lobi), pola klien `useRecap` (`src/lib/recap/recap-client.ts`).
- Produces:
  ```ts
  // types.ts
  export type Highlight = { id: string; bookId: string; cfi: string; color: HighlightColor; note: string; excerpt: string; createdAt: string }
  export type HighlightsAnswer = { ok: true; highlights: Array<Highlight> } | { ok: false; code: string }
  export const MAX_HIGHLIGHTS = 500
  // annotations.ts (server)
  export const listHighlightsFn: ({ data }: { data: { limit: number } }) => Promise<HighlightsAnswer>
  // highlights-client.ts
  export type HighlightsState = { status: "loading" } | { status: "offline" } | { status: "failed" } | { status: "ready"; highlights: Array<Highlight> }
  export function useHighlights(limit: number, online: boolean): { state: HighlightsState; retry: () => void }
  // CorkboardPanel.tsx
  export function CorkboardPanel(props: { open: boolean; onOpenChange: (open: boolean) => void; state: HighlightsState; books: ReadonlyArray<ShelfBook>; onRetry: () => void }): JSX.Element
  // room.ts
  export function buildRoom(kit: Kit, models: ModelSet): { setNotes: (colors: ReadonlyArray<HighlightColor>) => void }
  // stage.ts
  Stage.setNotes: (colors: ReadonlyArray<HighlightColor>) => void
  // layout.ts: HotspotId + "papan"; HOTSPOT_SPOTS ..., "toko", "perapian", "papan", "pintu"
  ```
  Label `papan` → `"Sorotan"`.

- [ ] **Step 1: Fungsi server (tes skema dulu)**

`types.ts`: tambah `Highlight`, `HighlightsAnswer`, `MAX_HIGHLIGHTS`. `src/lib/annotations/schemas.ts`: `export const HighlightsRequestSchema = z.object({ limit: z.number().int().min(1).max(MAX_HIGHLIGHTS) })`; `schemas.test.ts`: `limit` 0, 501, 1.5 ditolak; 3 dan 500 diterima. Run → FAIL lalu tulis skema → PASS.

`annotations.ts`:
```ts
/** The member's newest highlights across books, without tombstones (spec 3F §3.2, §4A.3). */
export const listHighlightsFn = createServerFn({ method: "GET" })
  .validator((data: { limit: number }) => HighlightsRequestSchema.parse(data))
  .handler(async ({ data }): Promise<HighlightsAnswer> => {
    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail("not_authenticated")
    const { data: rows, error } = await supabase
      .from("annotations")
      .select("id, book_id, cfi, color, note, excerpt, created_at")
      .eq("kind", "highlight")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(data.limit)
    if (error) {
      logServerError("listing highlights failed", error)
      return fail("unknown")
    }
    return {
      ok: true,
      highlights: rows.map((row) => ({
        id: row.id,
        bookId: row.book_id,
        cfi: row.cfi,
        color: row.color as HighlightColor,
        note: row.note,
        excerpt: row.excerpt,
        createdAt: row.created_at,
      })),
    }
  })
```
RLS sudah membatasi ke baris milik anggota; tidak perlu `.eq("user_id", …)` (ikuti `listAnnotationsFn`, yang juga tidak memakainya).

- [ ] **Step 2: Klien (tes dulu)**

`highlights-client.test.ts` dengan `vi.mock("@/server/annotations", () => ({ listHighlightsFn: vi.fn() }))` dan `renderHook`:
```ts
it("loads the newest highlights when online", async () => {
  vi.mocked(listHighlightsFn).mockResolvedValue({ ok: true, highlights: [one] })
  const { result } = renderHook(() => useHighlights(3, true))
  expect(result.current.state).toEqual({ status: "loading" })
  await waitFor(() => expect(result.current.state).toEqual({ status: "ready", highlights: [one] }))
  expect(listHighlightsFn).toHaveBeenCalledWith({ data: { limit: 3 } })
})
it("says offline without asking the server", () => {
  const { result } = renderHook(() => useHighlights(3, false))
  expect(result.current.state).toEqual({ status: "offline" })
  expect(listHighlightsFn).not.toHaveBeenCalled()
})
it("fails on a refused answer and asks again on retry", async () => {
  vi.mocked(listHighlightsFn).mockResolvedValueOnce({ ok: false, code: "unknown" })
  const { result } = renderHook(() => useHighlights(3, true))
  await waitFor(() => expect(result.current.state).toEqual({ status: "failed" }))
  vi.mocked(listHighlightsFn).mockResolvedValueOnce({ ok: true, highlights: [] })
  act(() => result.current.retry())
  await waitFor(() => expect(result.current.state).toEqual({ status: "ready", highlights: [] }))
})
```
(`one`: `Highlight` contoh.) Implementasi mengikuti pola `useRecap`: efek bergantung `[limit, online, attempt]`, penanda `live` untuk jawaban yang terlambat, `console.error` saat ditolak/melempar. Run → PASS.

- [ ] **Step 3: Panel papan (tes dulu)**

`CorkboardPanel.test.tsx` (render di router uji seperti tes `TrolleyPanel`):
- `ready` dengan dua sorotan → dialog berjudul "Sorotan" menampilkan kutipan, catatan, judul buku, dan tautan "Buka di buku" ke `/read/<bookId>?cfi=<cfi ter-encode>`;
- sorotan dari buku yang sudah tidak ada di `books` tidak tampil;
- `ready` kosong → "Belum ada sorotan. Tandai kalimat yang kamu suka saat membaca; tiga yang terbaru tertempel di sini.";
- `offline` → "Sorotan bisa dilihat saat online.";
- `failed` → "Sorotan belum bisa dimuat." dengan tombol "Coba lagi" yang memanggil `onRetry`.

Implementasi: komponen `Dialog` yang sama dengan `TrolleyPanel` (judul "Sorotan"), daftar paling banyak 3 sorotan (`state.highlights.slice(0, 3)` setelah disaring ke buku yang ada), kutipan dipotong 4 baris (`line-clamp-4`), garis warna kiri dari `color`, tautan `<Link to="/read/$bookId" params={{ bookId }} search={{ cfi }}>Buka di buku</Link>`. Run → PASS.

- [ ] **Step 4: Kertas di papan dan hotspot (tes dulu)**

`layout.test.ts`: urutan tab menjadi `..., "toko", "perapian", "papan", "pintu"`. `HOTSPOT_SPOTS` mendapat (nilai awal) `{ id: "papan", label: [ROOM_PARTS.corkboard.x, ROOM_PARTS.corkboard.y + 0.7, 0.1], stand: [ROOM_PARTS.corkboard.x, 1.6] }` di antara `perapian` dan `pintu`. `lobby-data.ts`: `papan` → `"Sorotan"` (tes di `lobby-data.test.ts`). `LobbyStage.test.tsx`: `activate("papan")` → dialog "Sorotan" tampil (mock `@/lib/annotations/highlights-client` mengembalikan `{ state: { status: "ready", highlights: [] }, retry: vi.fn() }`).

`room.ts`: `corkboard` tidak lagi menggambar lima kertas tetap. Buat tiga kertas sekali (ukuran dan posisi dari tiga baris pertama tabel `notes` yang ada, masing-masing `userData.animated = true`, tidak digabung) dan kembalikan `setNotes(colors)`: kertas ke-`i` tampil bila `i < colors.length`, warna kertas dari `NOTE_PAPER[color]` (`yellow #fff3b0`, `green #bfe3d0`, `blue #cfe0f5`, `pink #f2c6c2`), pin tetap. Papan kosong bila belum ada sorotan. `buildRoom` mengembalikan `{ setNotes }`; `stage.ts` menyimpannya dan menambah `setNotes(colors) { room.setNotes(colors); requestRender() }` ke `Stage`.

React: `LobbyStage` memanggil `const highlights = useHighlights(3, online && !offline)` (pakai `useOnline` dari `@/lib/use-online`), `notes = state.status === "ready" ? highlights.filter(buku ada).slice(0, 3).map((h) => h.color) : []`, state `corkboard` + `<CorkboardPanel open={corkboard} … />` di samping `TrolleyPanel`, dan `activate("papan")` → `setCorkboard(true)`. `LobbyScene`/`LobbyCanvas` mendapat prop `notes?: ReadonlyArray<HighlightColor>` (default `[]`) dengan pola `plant`; mock stage di `LobbyCanvas.test.tsx` mendapat `setNotes: vi.fn()`. Harness: `?notes=yellow,blue` → `stage.setNotes(...)`.

Run `npx vitest run src/components/lobby src/lib/annotations --maxWorkers=2` → PASS.

- [ ] **Step 5: Verifikasi dan commit**

`npx tsc --noEmit`, `npx vitest run --maxWorkers=2` → hijau. `node scripts/lobby-harness.mjs shot scratch/notes.png "notes=yellow,green,pink"` lalu lihat: tiga kertas berwarna di papan, label "papan" tidak menimpa label lain. Format dan commit `feat(3f): the corkboard pins your newest highlights`.

---

### Task 4L: Tata letak — meja tulis di bawah papan gabus (keputusan pemilik 2026-11-13)

Pemilik melihat lobi di aplikasi (dengan barang toko terpasang): meja tulis di depan rak menutupi rak genre dan menyesakkan sudut pintu, dan bola dunia gantung menutupi sudut baca. Pilihan pemilik: **tata letak A**.

**Files:**
- Modify: `src/components/lobby/scene/layout.ts`, `layout.test.ts`, `room.ts` (hanya bila papan gabus perlu bergeser), `furniture-builders.ts` (hanya bila hiasan meja/perapian bergantung pada posisi), `src/components/lobby/LibraryMap.test.tsx` (hanya bila angka bergeser)

**Interfaces:**
- Consumes/Produces: ekspor `layout.ts` tidak berubah nama atau bentuk; hanya angka.

- [ ] **Step 1: Tes jarak label (gagal dulu bila label masih berdesakan)**

Di `layout.test.ts` tambah: pada `startView` desktop 1440 × 900, untuk setiap pasangan hotspot, titik label hasil `project` (persen → piksel) berbeda **≥ 26 px secara vertikal atau ≥ 110 px secara horizontal** (label HTML berupa pil ±110 × 26 px). Tes yang sama untuk HP 390 × 844 tidak diwajibkan (denah datar dan zoom dipakai di HP).

- [ ] **Step 2: Pindahkan meja tulis**

- Kelompok meja tulis (`desk`, `deskChair`, `laptop`, `notebook`, `deskLamp`, `deskBooks`, `mug`, `papers`) pindah ke **pojok kiri dinding jendela (Z = 0)**, tepat di bawah papan gabus: meja memanjang searah X, punggungnya menempel dinding, kursi di depannya (sisi +Z) menghadap dinding. Meja tidak menyentuh rak (rak di X = 0 sedalam `SHELF.depth`) dan tidak menutupi bagian rak genre dari sudut kamera lebih dari yang tak terhindarkan di pojok.
- Papan gabus (`ROOM_PARTS.corkboard`) dipusatkan di atas meja.
- Perapian dan keranjang kayu bergeser ke kanan seperlunya; **sudut baca** (kursi berlengan, bantal, meja samping, lampu baca, katalog) tetap satu kelompok dengan perapian. Jendela, tanaman, lemari tetap kecuali tes memaksa.
- Hiasan yang dihitung dari posisi induknya (bantal, keranjang kayu, hiasan meja) ikut bergeser; bila masih berupa angka mati, turunkan dari `at` induknya plus selisih.
- Hotspot `meja-admin`, `katalog`, `papan`, `perapian`, `meja-baca`, `toko` mengikuti bendanya (label di atas benda, `stand` di depannya).

- [ ] **Step 3: Barang gantung tidak menutupi sudut baca**

`DECOR_SLOTS.ceiling` (dan `SLOT_AT.ceiling`) pindah ke atas **lantai depan** (sisi ruangan yang dekat kamera), sehingga dari kamera barang gantung tidak jatuh di depan sudut baca atau meja tulis. Periksa dengan `node scripts/lobby-harness.mjs shot scratch/decor-all.png all`. (Ukuran bola dunia dan barang dinding diperbaiki di Task 6.)

- [ ] **Step 4: Verifikasi dan commit**

Semua tes `layout.test.ts` (di dalam ruangan, tak bertabrakan, terproyeksi di layar, terjangkau dari `ANDA_START`, slot dekor bebas, jarak label), `walk.test.ts`, dan seluruh suite hijau; `npx tsc --noEmit`. Buat ulang `node scripts/lobby-harness.mjs moods scratch/moods` dan `shot scratch/decor-all.png all`, lihat sendiri: rak genre terlihat utuh, meja di bawah papan, sudut baca terlihat, tidak ada benda menembus. Format dan commit `fix(3f): the desk moves under the corkboard`.

---

### Task 5: Isi ruangan — rak genre dan hotspot, lemari kaca, tanaman, Anda, batas jalan

**Files:**
- Create: `src/components/lobby/scene/shelf-books.ts` (murni), `shelf-books.test.ts`, `shelves.ts` (three)
- Modify: `showcase.ts`, `plant.ts`, `people.ts`, `motion.ts`, `stage.ts`, `layout.ts` (hanya bila tes menuntut), `src/components/lobby/{LobbyStage,LobbyScene,LobbyCanvas}.tsx` dan tes terkait, `scripts/lobby-harness/main.ts`
- Test: `shelf-books.test.ts`, `walk.test.ts`, tes React yang ada

**Interfaces:**
- Consumes: `WALL_SECTIONS`, `SHELF`, `walkBlockers`, `WALK_BOUNDS`, `ANDA_RADIUS`, `findPath` (Task 2–3); `ModelSet`.
- Produces (`shelf-books.ts` kecuali `buildShelves` di `shelves.ts`):
  ```ts
  export type GenreHues = Record<Genre, ReadonlyArray<number>>   // sudut warna 0..360, buku terbaru dulu
  export const EMPTY_HUES: GenreHues
  export const SECTION_CAPACITY: number                          // buku maks per bagian
  export type BookInstance = { position: Point3; size: Point3; hue: number }
  export function sectionBooks(section: { genre: Genre; z: number; width: number }, hues: ReadonlyArray<number>): Array<BookInstance>   // murni; paling banyak SECTION_CAPACITY
  export function buildShelves(kit: Kit): { set: (hues: GenreHues) => void; dispose: () => void }
  ```
  `Stage` mendapat `setShelves: (hues: GenreHues) => void`. `LobbyScene`/`LobbyCanvas`/`LobbyStage` mendapat prop `shelves?: GenreHues`.
- Produces (`motion.ts`): `createMotion(...).walkTo(spot, instant)` kini mengikuti `findPath(posisiSekarang, spot, WALK_BOUNDS, walkBlockers(), ANDA_RADIUS)`; jalur kosong → Anda tidak bergerak.

- [ ] **Step 1: Tes `sectionBooks` di `shelf-books.test.ts` (gagal dulu)**

```ts
import { describe, expect, it } from "vitest"
import { SHELF, WALL_SECTIONS } from "./layout"
import { SECTION_CAPACITY, sectionBooks } from "./shelf-books"

const section = WALL_SECTIONS[2]
const hues = (n: number) => Array.from({ length: n }, (_, i) => (i * 37) % 360)

describe("sectionBooks", () => {
  it("stands one book per cover, newest first, up to the capacity", () => {
    expect(sectionBooks(section, [])).toHaveLength(0)
    expect(sectionBooks(section, hues(5))).toHaveLength(5)
    expect(sectionBooks(section, hues(5))[0].hue).toBe(0)
    expect(sectionBooks(section, hues(SECTION_CAPACITY + 40))).toHaveLength(SECTION_CAPACITY)
  })

  it("keeps every book inside its section and between the lowest and highest shelf", () => {
    for (const book of sectionBooks(section, hues(SECTION_CAPACITY))) {
      expect(book.position[0]).toBeGreaterThan(0)
      expect(book.position[0]).toBeLessThanOrEqual(SHELF.depth)
      expect(book.position[2] - book.size[2] / 2).toBeGreaterThanOrEqual(section.z - section.width / 2 - 1e-9)
      expect(book.position[2] + book.size[2] / 2).toBeLessThanOrEqual(section.z + section.width / 2 + 1e-9)
      expect(book.position[1] - book.size[1] / 2).toBeGreaterThanOrEqual(SHELF.bottom - 1e-9)
      expect(book.position[1] + book.size[1] / 2).toBeLessThanOrEqual(SHELF.top + 1e-9)
    }
  })

  it("is the same every time", () => {
    expect(sectionBooks(section, hues(30))).toEqual(sectionBooks(section, hues(30)))
  })
})
```

- [ ] **Step 2: Tulis `shelves.ts`**

`sectionBooks`: tiap bagian punya `SHELF.rows` (5) papan dengan jarak `(SHELF.top − SHELF.bottom) / rows`; di tiap papan buku tegak berjajar sepanjang Z dari tepi kiri bagian (`z − width/2 + 0.05`) dengan tebal `0.04 + 0.03 × h(i)` dan tinggi `0.28 + 0.16 × h(i + 7)` (`h(i) = ((i × 2654435761) >>> 0) / 2^32`, deterministik), lebar papan efektif `width − 0.1`; `SECTION_CAPACITY` dihitung dari fungsi pengisi itu sendiri (isi satu bagian dengan 1000 warna lalu hitung buku yang muat; kira-kira 5 papan × 18 buku), bukan konstanta tebakan. Urutan isi: papan paling bawah dulu, kiri ke kanan; buku ke-`i` memakai `hues[i]`, sisanya (di atas kapasitas) dibuang. `position[0]` = `0.2` (buku bersandar pada papan belakang rak, di dalam `SHELF.depth`). `buildShelves(kit)`: rangka rak dari balok membulat (papan belakang, tiang antar bagian, papan per baris) dibuat sekali untuk 8 bagian; `InstancedMesh` buku sebesar `8 × SECTION_CAPACITY` (satu material, warna per instans lewat `setColorAt` dari `hsl(hue, 55%, 48%)`); plat label tiap bagian dari `kit.canvasTexture` dengan teks `GENRE_LABELS[genre]` (`@/lib/genre`) di atas bagian pada `y = SHELF.top + 0.25`; bagian tanpa buku redup: panel belakang dan label memakai warna 60% lebih gelap. `set(hues)` mengisi ulang matriks/warna, `count` instans diatur, `instanceMatrix.needsUpdate = true`; `dispose` melepas geometri/material/tekstur. `books` yang dikembalikan stage = jumlah total buku ter-instans.

- [ ] **Step 3: Alirkan data rak (mekanis)**

`LobbyStage.tsx`: `useMemo` baru `shelves: GenreHues` dari `books` (`ShelfBook` dengan `genre !== null`): per genre, `books.filter(b => b.genre === genre)` diurutkan terbaru dulu (pakai bidang yang sama dengan urutan `summarizeLobby` untuk "terbaru"; bila tak ada, urutan `books` apa adanya) → `coverHue(book.title)` (sudah diimpor di file itu); diteruskan `<LobbyScene shelves={shelves} …>`. `LobbyScene.tsx` dan `LobbyCanvas.tsx`: prop `shelves?: GenreHues` (default `EMPTY_HUES`, impor tipe/nilai dari `./scene/shelves`), ref + efek yang memanggil `stageRef.current?.setShelves(...)` persis pola `showcase`/`plant`/`decor`, dan `stage.setShelves(shelvesRef.current)` setelah stage dibuat. Perbarui `LobbyCanvas.test.tsx` (mock stage mendapat `setShelves: vi.fn()`; satu tes: prop `shelves` dikirim ke `stage.setShelves`). Agar bundel utama tidak menarik three: `GenreHues`, `EMPTY_HUES`, `SECTION_CAPACITY`, `BookInstance`, dan `sectionBooks` ditulis di berkas murni `shelf-books.ts` (tanpa three); `shelves.ts` (pakai three) mengimpornya dan hanya berisi `buildShelves`. React dan tes Step 1 mengimpor dari `./shelf-books`.

- [ ] **Step 4: Lemari kaca, tanaman**

`showcase.ts`: gambar badan lemari dari model `glassCabinet` bila ada (`models.get("glassCabinet")`, kalau tidak, kode: badan membulat + kaca tipis) dalam `Group` di `SHOWCASE` dengan `rotation.y = SHOWCASE_TURN`; sampul di `showcaseSlots()` (titik dunia, sudah memperhitungkan putaran), menghadap arah yang sama; sampul tanpa gambar memakai wajah berwarna dari `hue` (cadangan, sudah ada). `plant.ts`: pot dari `plantPot` bila ada (skala `PLANT_POT`), batang/daun/kuncup/bunga dari kode seperti sekarang dengan palet dibulatkan; posisi `PLANT`. Pembangun menerima `models: ModelSet`; `stage.ts` meneruskannya.

- [ ] **Step 5: Anda saja, jalan dengan jalur**

`people.ts`: bentuk Anda dibuat ulang bergaya membulat (kepala bola, badan kapsul, palet hangat; atau model `anda` bila audit menyetujui, dengan bobbing ±0,03 m dan miring ±4° saat jalan); cincin penanda tetap. `motion.ts`: 
```ts
function walkTo([x, z]: Point2, instant: boolean) {
  const root = people.anda.root
  const path = findPath([root.position.x, root.position.z], [x, z], WALK_BOUNDS, walkBlockers(), ANDA_RADIUS)
  if (path.length === 0) return
  route = [new THREE.Vector3(root.position.x, 0, root.position.z), ...path.map(([px, pz]) => new THREE.Vector3(px, 0, pz))]
  if (instant) { root.position.copy(route.at(-1)!); route = []; stride(people.anda, 0); return }
  leg = 0; legProgress = 0
}
```
`update` memajukan sepanjang `route` dengan kecepatan 1,4 m/s (`legProgress += dt × 1.4 / panjangRuas`), menghadap arah ruas (`root.rotation.y = Math.atan2(dx, dz)`), memanggil `stride` seperti sekarang, dan mengosongkan `route` di ujung; `finishWalk()` melompat ke ujung. Agar bisa diuji tanpa WebGL: ekstrak fungsi murni `advance(route: Array<Point2>, leg: number, progress: number, distance: number): { leg: number; progress: number; at: Point2; done: boolean }` ke `walk.ts` dan uji (a) berhenti di titik terakhir, (b) tidak pernah melompati ruas, (c) `done` hanya di ujung; kode:
```ts
export function advance(route: ReadonlyArray<Point2>, leg: number, progress: number, distance: number) {
  let i = leg
  let d = progress + distance
  while (i < route.length - 1) {
    const length = Math.hypot(route[i + 1][0] - route[i][0], route[i + 1][1] - route[i][1])
    if (d < length) {
      const t = length === 0 ? 1 : d / length
      return { leg: i, progress: d, done: false, at: [route[i][0] + (route[i + 1][0] - route[i][0]) * t, route[i][1] + (route[i + 1][1] - route[i][1]) * t] as Point2 }
    }
    d -= length
    i++
  }
  return { leg: Math.max(0, route.length - 1), progress: 0, done: true, at: route[route.length - 1] }
}
```
Tes menambah di `walk.test.ts`: (a) `advance` dengan rute `[[0,0],[2,0],[2,2]]` dan jarak 1 → `at [1,0]`, jarak 3 → `at [2,1]`, jarak 99 → `done` dan `at [2,2]`; (b) **"Anda tidak bisa berjalan menembus perabot"**: untuk tiap `HOTSPOT_SPOTS` dari `ANDA_START` dan antar-pasang berurutan, `findPath` dengan `walkBlockers()` tak pernah memotong telapak `solid` (pakai fungsi `crosses` dari tes walk, dipindah ke `walk.test-helpers.ts` bila dipakai dua berkas).

- [ ] **Step 6: Harness dan verifikasi**

Harness: parameter `?books=1` memberi `stage.setShelves` hue contoh (tiap genre 0–120 buku) untuk melihat rak penuh/kosong; pastikan bagian kosong redup dan label terbaca di HP (`node scripts/lobby-harness.mjs shot scratch/shelves.png`, lihat gambarnya). Run `npx tsc --noEmit`, `npx vitest run --maxWorkers=2` → hijau. Format dan commit `feat(3f): genre shelves, showcase cabinet, plant and Anda only`.

---

### Task 6: Slot dekorasi dan 18 barang dibuat ulang, pratinjau toko

**Files:**
- Modify: `src/components/lobby/scene/decor.ts`, `decor.test.ts`, `layout.ts` (slot/ukuran bila tes menuntut), `scripts/lobby-harness/main.ts`
- Test: `decor.test.ts`, `layout.test.ts`

**Interfaces:**
- Consumes: `DECOR_SLOTS`, `DECOR_SIZES`, `decorBlockers`, `PREVIEW_SHIFT` (Task 3); `ModelSet`, `fitTo`, kunci `decor_<id>` (Task 1).
- Produces: `buildDecor(scene: THREE.Scene, models: ModelSet, onChange: () => void): Decor` (`set(placed)`, `dispose()` tak berubah); `DECOR_BUILDERS` tetap `Record<string, (part: Part) => void>` kuncinya ID barang; `walkBlockers()` tidak berubah; barang non-datar yang terpasang dihindari Anda lewat `motion.setExtraBlockers(boxes: Array<Box2>)` yang diisi `stage.setDecor` (Step 3).

- [ ] **Step 1: Tes (gagal dulu)**

Di `decor.test.ts` pertahankan tes yang ada (semua `SHOP_ITEMS` punya pembangun, `Part` diisi) dan tambah:
```ts
import { SHOP_ITEMS } from "@/lib/shop/catalog"
import { MODELS } from "./model-manifest"

it("has a model-manifest entry for every shop item", () => {
  for (const { id } of SHOP_ITEMS) {
    expect(Object.keys(MODELS), id).toContain(`decor_${id}`)
  }
})

it("keeps the ids, names and prices of the 18 items", () => {
  expect(SHOP_ITEMS).toHaveLength(18)
  expect(new Set(SHOP_ITEMS.map((item) => item.id)).size).toBe(18)
})
```
Run → PASS bila Task 1 mengisi manifest (tes penjaga), lalu tulis tes tabrakan di `layout.test.ts` (sudah ada dari Task 3; jalankan lagi dengan slot final).

- [ ] **Step 2: Buat ulang 18 barang**

Untuk tiap barang: bila `MODELS["decor_<id>"].file !== null`, `DECOR_BUILDERS[id]` memakai `models.get(key)` → `fitTo(group, tinggi)` (tinggi di tabel di bawah) dan menempelkannya ke `part` (di titik dan putaran slot); selain itu pembangun kode yang ada diperbarui bergaya membulat/palet hangat (`r` pada balok, bentuk bulat untuk lentera/bola/akuarium). Tinggi (m): rug_* 0,03; lamp_floor 1,5; lamp_arc 1,7; lamp_lantern 0,5 (menggantung dari `y = 3,3` bila lentera; atur `at[1]` di pembangun, bukan di slot); seat_beanbag 0,55; seat_armchair 0,9; seat_sofa 0,9; wall_map 1,0; wall_painting 0,9; wall_clock 0,8; pet_cat 0,35; pet_bird 0,7; pet_aquarium 0,7; ceiling_lights 0,5; ceiling_books 0,7; ceiling_globe 0,7. Efek berjalan (burung, ikan, buku berputar, bola berputar) **hanya bermain selama 4 detik setelah barang itu muncul di slotnya** lewat `decor.set(placed)` (dipratinjau di toko atau baru dipasang: respons atas tindakan, spec §3.6), lalu berhenti di pose awalnya. Barang yang sudah terpasang saat lobi dimuat langsung diam. Animasi memakai `onChange` seperti sekarang selama jendela 4 detik itu; tes di `decor.test.ts`: fungsi murni `animating(since: number | null, now: number): boolean` (benar hanya untuk `0 ≤ now − since < 4000`, `null` → salah); barang menyala (`lamp_*`, `ceiling_lights`) menaikkan emisif dengan `RIGS[mood].lamps` (kait `setMood` lewat `decor.setLamps(k: number)` yang dipanggil `applyRig`). `buildDecor` kini menerima `models`; `stage.ts` meneruskannya dan memanggil `decor.setLamps(rig.lamps)`. Kiosk toko sudah dihapus di Task 3; katalog toko = hotspot `toko` di meja samping.

- [ ] **Step 3: Pratinjau toko dan jalan**

`LobbyScene.showDecor` tidak berubah (memakai `DECOR_SLOTS[slot].focus` + `PREVIEW_SHIFT`); verifikasi tiap slot dalam jangkauan layar dengan tes tambahan di `layout.test.ts`: untuk tiap slot dan `VIEWPORTS`, `isInView(slot.focus, centerOn(startView(vp), slot.focus) lalu panBy(…, PREVIEW_SHIFT, 0, vp) lalu clampView, vp)` benar (gunakan `clampView` dari `projection.ts`). `stage.setDecor(placed)` mengirim telapak barang non-datar terpasang ke gerak: `motion.setExtraBlockers(boxes: Array<Box2>)` (disimpan, ditambahkan ke `walkBlockers()` pada `findPath`); jika Anda sedang berdiri di dalam telapak baru, ia digeser ke titik bebas terdekat (`nearestWalkable` kecil: cari cincin 0,25 m yang membesar sampai `walkable`) — tambahkan fungsi itu ke `walk.ts` dengan tes (titik di dalam kotak → hasil `walkable`). Harness: `?decor=all` dan `?decor=<id>` tetap bekerja (kamera `centerOn` + zoom `MAX_ZOOM`).

- [ ] **Step 4: Verifikasi dan commit**

`node scripts/lobby-harness.mjs shot scratch/decor.png all` (semua slot terisi; lihat gambarnya: tak ada barang menembus perabot/dinding, burung/ikan terlihat). `npx tsc --noEmit`, `npx vitest run --maxWorkers=2` → hijau. Format dan commit `feat(3f): rebuilt shop items in the new room`.

---

### Task 7: Alur pemuatan, gambar diam malam, thumbnail toko, cache PWA

**Files:**
- Modify: `src/components/lobby/LobbyScene.tsx`, `LobbyScene.test.tsx`, `src/styles.css`, `scripts/lobby-harness.mjs`, `scripts/build-sw.mjs`
- Create/replace: `public/lobby/lobby-still.{avif,webp}`, `public/lobby/lobby-still-1280.{avif,webp}`, `public/lobby/shop/*.webp` (18)
- Test: `LobbyScene.test.tsx`, `scripts/build-sw` check (Step 4)

**Interfaces:**
- Consumes: `createStage` async (Task 3), `moods`/`mood` harness (Task 3).
- Produces: atribut `data-live` pada `.lobby-scene` (ada saat 3D tampil) dan kelas `lobby-canvas-host` memudar masuk; harness `still` dan `thumbs` membuat gambar versi malam.

- [ ] **Step 1: Tes memudar masuk (gagal dulu)**

Di `LobbyScene.test.tsx`, dengan `LobbyCanvas` yang sudah di-mock di file itu: (a) sebelum `onReady`, `LobbyStill` dan hotspot tampil, `.lobby-scene` tanpa `data-live`; (b) setelah `onReady` + `onView`, `data-live="true"` dan gambar diam **masih** terpasang sampai `vi.advanceTimersByTime(600)`, hotspot tidak diremount (elemen yang sama, fokus terjaga); (c) `onFail` → mode diam, tanpa teks pesan error. Sesuaikan dengan pola tes yang ada di file itu.

- [ ] **Step 2: Implementasi memudar masuk**

`LobbyScene.tsx`: state `fading` (boolean); efek: ketika `live` berubah menjadi `true`, `setFading(true)` lalu `setTimeout(() => setFading(false), 600)` (dibersihkan di cleanup); `{(!live || fading) && <LobbyStill … />}`; atribut `data-live={live ? "true" : undefined}` pada `<section>`. `src/styles.css` (dekat `.lobby-canvas-host`, baris ±1109): `.lobby-canvas-host { opacity: 0; transition: opacity 0.5s ease-out }`, `.lobby-scene[data-live] .lobby-canvas-host { opacity: 1 }`, dan `@media (prefers-reduced-motion: reduce) { .lobby-canvas-host { transition: none } }`. Pastikan `.lobby-still` berada di bawah kanvas selama `fading` (urutan z sudah: gambar diam di `lobby-still-frame`, kanvas di host); bila kanvas transparan sebelum `data-live`, gambar diam terlihat. Kegagalan (`onFail`) sudah memanggil `setMode("still")` tanpa pesan.

- [ ] **Step 3: Gambar diam dan thumbnail dari adegan baru**

Harness `still`: tambahkan `?mood=night` pada query (`render(STILL, "mode=still&mood=night")`), batas 250 kB avif tetap. Gambar diam memakai sinyal netral dan papan kosong (default stage `NEUTRAL_SIGNALS` dan `setNotes([])`; jangan memberi `fire`/`lamp`/`parcel`/`notes` di query `still`), sesuai spec §3.5. Hotspot `perapian`, `papan`, dan `pintu` ikut tampil di atas gambar diam lewat `HotspotLayer` (sudah dari `HOTSPOT_SPOTS`); periksa di gambar bahwa titiknya jatuh di perapian, papan, dan pintu. Harness `thumbs`: `render(THUMB, \`mode=still&mood=night&decor=${id}\`)`; batas 60 kB tetap. Jalankan (lambat; SwiftShader):
```bash
node scripts/lobby-harness.mjs still
node scripts/lobby-harness.mjs thumbs
```
Lihat `lobby-still.webp` dan tiga thumbnail acak dengan alat baca gambar; ulangi satu thumbnail dengan `thumbs <id>` bila bingkai buruk (barang di luar bingkai → ubah `focus` di `DECOR_SLOTS`). `STILL_VIEW`/`STILL_SIZE` di `LobbyStill.tsx` tidak berubah (`startView` baru menampilkan seluruh ruangan). Periksa halaman login dan welcome yang memakai gambar yang sama (`SceneBackdrop`, zoom CSS `.scene-canvas[data-focus="admin"]` ke titik `ADMIN_DESK` = laptop di meja tulis): jalankan aplikasi (`npm run dev`, atau `vite preview` setelah `npm run build`), buka `/login` dan `/register` pada 1440 × 900 dan 390 × 844, dan lihat bahwa zoom jatuh di meja tulis tanpa memotong formulir; sesuaikan `--desk-x/--desk-y` hanya lewat `ADMIN_DESK` di `layout.ts`, atau skala zoom di `src/styles.css` (blok `.scene-canvas[data-focus="admin"]`, baris ±159) bila perlu.

- [ ] **Step 4: Cache PWA**

`scripts/build-sw.mjs`: tambahkan `/(^|\/)LICENSE\.md$/` ke `SKIP` (berkas lisensi tidak perlu di-cache). Tidak ada perubahan lain: semua `*.glb` di `dist/client/lobby/models/` otomatis masuk `PRECACHE`. Verifikasi: `npm run build` lalu
```bash
grep -o "/lobby/models/[a-z0-9-]*\.glb" dist/client/sw.js | sort -u | wc -l
```
harus sama dengan jumlah berkas glb unik di `MODELS` (`node -e` pada `public/lobby/models`: `ls public/lobby/models/*.glb | wc -l`); `LICENSE.md` tidak muncul. Kunjungan kedua/offline dicek manual setelah deploy (spec §7).

- [ ] **Step 5: Verifikasi dan commit**

`npx tsc --noEmit`, `npx vitest run --maxWorkers=2` → hijau. Format dan commit `feat(3f): fade the 3D room in over the still, night stills and shop thumbnails` (gambar biner ikut).

---

### Task 8: E2E dan verifikasi akhir R1

**Files:**
- Modify: `e2e/lobby-3d.spec.ts`, `e2e/shop.spec.ts`, `e2e/lobby.spec.ts` (hanya bila menyebut posisi/benda lama), `e2e/lobby-popup.spec.ts`, `e2e/collections.spec.ts`, `e2e/habit.spec.ts` bila gagal

**Interfaces:**
- Consumes: semua task sebelumnya. Teks UI (label hotspot, "Adegan lobi", "Toko lobi") **belum** berubah; R2 menggantinya.

- [ ] **Step 1: Ganti tes batas kamera**

`e2e/lobby-3d.spec.ts` tes "the camera never shows anything outside the map" → "the room never leaves the screen": jalankan `sweep` seperti sekarang, tetapi alih-alih `voidPixels === 0` pastikan ruangan tetap terlihat: hitung `voidPixels` dan pastikan `< 0.9 × total piksel` setelah tiap arah (`const { info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })`; `info.width * info.height`). Pertahankan pernyataan `moved` (kamera memang bisa digeser saat zoom-in; di zoom 1 sumbu yang lebih sempit tidak bergeser, jadi `sweep` dijalankan setelah memperbesar dengan roda `page.mouse.wheel(0, -600)` dua kali). Tambah satu tes: pada start view tiap hotspot yang tampil di mode 3D berada di dalam kotak scene (`boundingBox`).

- [ ] **Step 2: Sesuaikan tes lain**

Jalankan lobi/toko/lemari/tanaman: `npx playwright test e2e/lobby-3d.spec.ts e2e/lobby.spec.ts e2e/lobby-popup.spec.ts e2e/shop.spec.ts e2e/collections.spec.ts e2e/habit.spec.ts e2e/offline.spec.ts --workers=2` (cek port 3000 lebih dulu, lihat Global Constraints). Perbaiki hanya yang bergantung pada letak benda/koordinat/jumlah buku lama; jangan melonggarkan pernyataan tentang perilaku (toko: pratinjau dan pasang; lemari; tanaman; offline menampilkan gambar diam). Offline: E2E tanpa WebGL sudah memakai gambar diam; tambahkan satu pernyataan di `offline.spec.ts` bila file itu memeriksa aset lobi: gambar diam malam dimuat.

Tambah di `e2e/lobby.spec.ts` (benda bertujuan, spec §3.2): ketuk hotspot "Kilas balik" → URL `/recap` dan popup Kilas balik tampil; ketuk "Pengaturan" (hotspot pintu, bukan tombol bilah atas; pilih lewat wadah hotspot yang dipakai tes lain di berkas itu) → URL `/settings` dengan tautan "Keluar"; ketuk "Sorotan" → dialog "Sorotan" dengan teks kosong "Belum ada sorotan." untuk anggota uji tanpa sorotan.

- [ ] **Step 3: Verifikasi akhir**

```bash
npx tsc --noEmit
npx vitest run --maxWorkers=2
npm run check
npm run build
```
Semua hijau; ukuran `du -cb public/lobby/models/*.glb` ≤ 3.145.728. Pastikan tidak ada sisa: `grep -rn "ATRIUM\|SHELF_FACES\|WALKER_ROUTES\|LIBRARIAN\|buildKiosk\|KIOSK" src scripts e2e` kosong. Hapus `scratch/` bila ada. Laporkan ke pengendali: daftar berkas aset terpakai dan ukurannya, ringkasan hasil, dan daftar cek manual setelah deploy (spec §7: kesan detail di HP, kinerja HP lama, suasana berganti saat jam berganti, offline setelah kunjungan pertama).

- [ ] **Step 4: Commit**

```bash
npx prettier --write e2e/*.ts
git add -A e2e src scripts public docs
git commit -m "test(3f): E2E for the study room" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-review (dijalankan penulis rencana)

**Cakupan spec.** §3.1 ruangan → Task 3 (+ keputusan 1, 2); §3.2 benda/hotspot → Task 3 (perabot, hotspot), Task 5 (rak, lemari, tanaman, Anda), katalog toko = `catalogue` di meja samping (Task 3); jendela/papan gabus tanpa hotspot → `ROOM_PARTS` (Task 3); §3.3 slot/18 barang → Task 6; §3.4 cahaya → Task 2–3; §3.5 kualitas, diam, pemuatan → Task 3 (`rendah` tanpa lampu titik/bayangan), Task 7, kegagalan model → keputusan 7; §5.1 aset → Task 1; §5.2 kode → Task 3/5/6; §5.3 → Task 1 (loader), Task 7 (PWA), Task 3/5 (gabung mesh, instancing); §5.4 modul → tabel file; §7 tes → hotspot di ruangan + terproyeksi (Task 3), daylight (Task 2), manifest (Task 1), slot dekor (Task 3/6), Anda tak menembus perabot (Task 5), harness tiga suasana/gambar diam/thumbnail (Task 3, 7), E2E (Task 8). §6 titik cek → Task 4. Pemindaian teks dan bahasa → R2.

**Pembaruan 2026-11-13.** Spec keputusan 9 (buang benda tanpa fungsi) → Task 4A Step 3–4 (+ keputusan 11); §3.2 hotspot `perapian`, `pintu` → Task 4A, `papan` → Task 4C (+ keputusan 12 untuk pintu); §3.4 catatan sinyal di semua suasana dan §3.6 sinyal → Task 4B (+ keputusan 13, 15); §3.5 sinyal netral di gambar diam → Task 7 Step 3; §3.6 tes "setiap perabot punya tujuan" → Task 4A Step 2; cincin diam → Task 4B Step 4; §7 E2E perapian/papan/pintu → Task 8 Step 2. Kegiatan Anda, momen perubahan, dan `/highlights` (§4A) ada di R3.

**Placeholder.** Nilai posisi/palet berlabel "nilai awal" dengan tes penentu (keputusan 3); langkah audit bergantung isi paket yang sengaja tidak ditebak (aturan pemetaan dan keputusan ada di Task 1).

**Konsistensi tipe.** `Box2`/`findPath`/`walkable` (Task 2) dipakai `layout.ts`/`motion.ts`; `ModelKey`/`ModelSet` (Task 1) dipakai `furniture.ts`, `decor.ts`, `showcase.ts`, `plant.ts`; `GenreHues`/`EMPTY_HUES`/`sectionBooks` dari `shelf-books.ts` (Task 5) dipakai tes dan React; `Mood`/`RIGS`/`mixRig` (Task 2) dipakai `stage.ts`; `createStage` async (Task 3) ditunggu `LobbyCanvas` dan harness.
