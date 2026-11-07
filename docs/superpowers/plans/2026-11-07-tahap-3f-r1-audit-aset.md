# Audit aset — Tahap 3F-R1 ruang studi

Sumber tunggal: **KayKit Furniture Bits 1.0** (Kay Lousberg), CC0 1.0. Paket ini hanya berisi 53 model perabot
(satu tekstur palet 15 KB dipakai bersama). Paket CC0 lain (Poly Pizza) **tidak dipakai**: tidak ada sumber yang
sudah diperiksa, jadi semua benda yang tak ada di paket dibuat lewat kode (gaya membulat, palet hangat sama).
Dari 35 kunci, 16 memakai model paket dan 19 dibuat lewat kode.

## (a) Tabel benda

Tinggi nyata = perkiraan tinggi di ruangan (m); `fitTo` menskala model ke angka ini (satuan asli paket berbeda).

| Kunci | Sumber | Model / alasan | Tinggi nyata |
|---|---|---|---|
| armchair | paket | `armchair` — kursi santai | 0,95 |
| readingLamp | paket | `lamp_table` — lampu meja | 0,45 |
| desk | paket | `table_medium_long` — meja tulis | 0,75 |
| deskChair | paket | `chair_A_wood` — kursi kayu | 0,95 |
| laptop | kode | tak ada di paket; kotak tipis + layar | 0,25 |
| notebook | paket | `book_single` — buku catatan | 0,04 |
| sideTable | paket | `table_small` — meja samping | 0,55 |
| catalogue | paket | `book_set` — tumpukan buku katalog | 0,15 |
| parcelBox | kode | tak ada kotak di paket; kotak karton + pita | 0,35 |
| door | kode | tak ada pintu di paket | 2,2 |
| fireplace | kode | tak ada perapian di paket | 1,4 |
| glassCabinet | kode | `cabinet_*` tidak berkaca dan tak bisa memuat 12 sampul; dibuat kode | 2,0 |
| windowFrame | kode | tak ada jendela di paket | 1,6 |
| corkboard | kode | tak ada papan gabus di paket | 0,9 |
| plantPot | paket | `cactus_medium_A` — kaktus berpot | 0,6 |
| baseRug | paket | `rug_rectangle_A` — karpet dasar | 0,02 |
| anda | kode | lihat (b) | 1,5 |
| decor_rug_woven | paket | `rug_rectangle_stripes_A` | 0,02 |
| decor_rug_round | paket | `rug_oval_A` (oval, terdekat dengan bulat) | 0,02 |
| decor_rug_pattern | paket | `rug_rectangle_B` (warna beda dari baseRug) | 0,02 |
| decor_lamp_floor | paket | `lamp_standing` | 1,6 |
| decor_lamp_arc | kode | tak ada lampu busur di paket | 2,0 |
| decor_lamp_lantern | kode | tak ada lentera di paket | 0,4 |
| decor_seat_beanbag | kode | `pillow_*` terlalu kecil/rata untuk bean bag; blob membulat | 0,6 |
| decor_seat_armchair | paket | `armchair_pillows` | 0,95 |
| decor_seat_sofa | paket | `couch_pillows` | 0,9 |
| decor_wall_map | kode | tak ada peta di paket | 0,8 |
| decor_wall_painting | paket | `pictureframe_large_A` | 0,8 |
| decor_wall_clock | kode | tak ada jam di paket | 0,4 |
| decor_pet_cat | kode | tak ada hewan di paket | 0,3 |
| decor_pet_bird | kode | tak ada hewan di paket | 0,3 |
| decor_pet_aquarium | kode | tak ada akuarium di paket | 0,5 |
| decor_ceiling_lights | kode | untaian lampu | 0,5 |
| decor_ceiling_books | kode | buku terbang | 0,6 |
| decor_ceiling_globe | kode | bola dunia gantung | 0,6 |

## (b) Keputusan karakter Anda

**Kode.** Furniture Bits tidak memuat karakter, dan tidak ada karakter CC0 statis satu-mesh yang sudah diperiksa
(aturan: dipakai hanya bila CC0, statis, satu mesh, gaya cocok). Anda dibuat lewat kode (membulat, palet baru) di Task 5.

## (c) Ukuran

16 berkas `.glb` (konversi `gltf-pipeline`, tanpa Draco, tekstur palet 15 KB tertanam di tiap berkas):
**449.944 byte** (≈ 439 KB), batas 3.145.728 byte.

## (d) Lisensi

- KayKit Furniture Bits 1.0: CC0 1.0, <http://creativecommons.org/publicdomain/zero/1.0/>; teks lisensi di `LICENSE.txt`
  repositori (diverifikasi: "License: (Creative Commons Zero, CC0) ... free to use in personal, educational and commercial projects").
  Halaman: <https://kaylousberg.itch.io/furniture-bits>; repo: <https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0>.
- Kredit per berkas: `public/lobby/models/LICENSE.md`.
