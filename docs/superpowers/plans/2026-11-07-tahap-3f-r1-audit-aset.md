# Audit aset — Tahap 3F-R1 ruang studi

Sumber tunggal: **KayKit Furniture Bits 1.0** (Kay Lousberg), CC0 1.0. Paket ini hanya berisi 53 model perabot
(satu tekstur palet 15 KB dipakai bersama). Paket CC0 lain (Poly Pizza) **tidak dipakai**: tidak ada sumber yang
sudah diperiksa, jadi semua benda yang tak ada di paket dibuat lewat kode (gaya membulat, palet hangat sama).
Dari 35 kunci, 19 memakai model dan 16 dibuat lewat kode. Pembaruan: tiga benda (parcelBox, door, decor_lamp_lantern) diambil dari dua paket KayKit lain yang bergaya sama (lihat bagian (e)).

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
| parcelBox | paket Prototype Bits | `Box_B` — kotak karton (KayKit kedua) | 0,35 |
| door | paket Prototype Bits | `Door_A` — pintu kayu berpanel | 2,2 |
| fireplace | kode | tak ada perapian di paket | 1,4 |
| glassCabinet | kode | `cabinet_*` tidak berkaca dan tak bisa memuat 12 sampul; dibuat kode | 2,0 |
| windowFrame | kode | tak ada jendela di paket | 1,6 |
| corkboard | kode | tak ada papan gabus di paket | 0,9 |
| plantPot | paket | `cactus_medium_A` — kaktus berpot | 0,6 |
| baseRug | paket | `rug_rectangle_A` — karpet dasar (dibuang 2026-11-13) | 0,02 |
| anda | kode | lihat (b) | 1,5 |
| decor_rug_woven | paket | `rug_rectangle_stripes_A` | 0,02 |
| decor_rug_round | paket | `rug_oval_A` (oval, terdekat dengan bulat) | 0,02 |
| decor_rug_pattern | paket | `rug_rectangle_B` (warna beda dari baseRug) | 0,02 |
| decor_lamp_floor | paket | `lamp_standing` | 1,6 |
| decor_lamp_arc | kode | tak ada lampu busur di paket | 2,0 |
| decor_lamp_lantern | paket Halloween Bits | `lantern_standing` — lentera berdiri | 0,4 |
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

19 berkas `.glb` (16 pertama; konversi `gltf-pipeline`, tanpa Draco, tekstur palet 15 KB tertanam di tiap berkas):
**449.944 byte** (≈ 439 KB), batas 3.145.728 byte.

## (d) Lisensi

- KayKit Furniture Bits 1.0: CC0 1.0, <http://creativecommons.org/publicdomain/zero/1.0/>; teks lisensi di `LICENSE.txt`
  repositori (diverifikasi: "License: (Creative Commons Zero, CC0) ... free to use in personal, educational and commercial projects").
  Halaman: <https://kaylousberg.itch.io/furniture-bits>; repo: <https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0>.
- Kredit per berkas: `public/lobby/models/LICENSE.md`.

## (e) Sumber kedua (KayKit Prototype Bits dan Halloween Bits)

Pemilik meminta sumber CC0 kedua yang gayanya paling dekat dengan KayKit untuk benda yang kurang. Diperiksa:

- **KayKit Prototype / Halloween / Restaurant Bits dan Dungeon Remastered** (Kay Lousberg, gaya identik). Repositori
  `KayKit-Game-Assets/KayKit-<paket>-1.0`, `LICENSE.txt`: "License: (Creative Commons Zero, CC0)
  http://creativecommons.org/publicdomain/zero/1.0/ ... free to use in personal, educational and commercial projects".
- **Kenney Furniture Kit**: halaman menyatakan CC0, tetapi tidak ada tautan unduh langsung (tombol JavaScript); tidak diunduh.
- **Quaternius**: halaman paket menyatakan CC0, tetapi unduhan lewat Google Drive; tidak diunduh (tak bisa diperiksa dengan aman).
- **KayKit Holiday Bits**: CC0 menurut halaman itch, tetapi unduhan hanya lewat itch.io (tanpa repositori); tidak diunduh.

Hasil per benda (kunci manifest tidak berubah):

| Kunci | Hasil | Alasan |
|---|---|---|
| fireplace | tetap kode | tak ada perapian di paket KayKit mana pun yang bisa diunduh |
| windowFrame | tetap kode | jendela paket hanyalah potongan dinding 4 × 4 m, bukan bingkai berdiri |
| glassCabinet | tetap kode | tak ada lemari berkaca; rak Dungeon terbuka dan tak memuat 12 sampul |
| door | **model** `Door_A` (Prototype Bits) | pintu kayu berpanel, gaya sama; 46 KB |
| laptop | tetap kode | tak ada |
| parcelBox | **model** `Box_B` (Prototype Bits) | kotak karton cokelat; 37 KB |
| corkboard | tetap kode | `menu` Restaurant bukan papan gabus |
| decor_pet_cat, decor_pet_bird, decor_pet_aquarium | tetap kode | tak ada hewan atau akuarium (stoples kaca saja) |
| decor_wall_clock, decor_wall_map | tetap kode | tak ada |
| decor_lamp_arc | tetap kode | tak ada |
| decor_lamp_lantern | **model** `lantern_standing` (Halloween Bits) | lentera hitam berlampu hangat; 29 KB |
| decor_seat_beanbag, decor_ceiling_* | tetap kode | tak ada |
| anda | tetap kode | tak ada karakter statis satu-mesh di paket yang diperiksa |

Ukuran baru: 562.496 byte (19 berkas), batas 3.145.728 byte.

## Persetujuan arah visual

Disetujui pemilik, 2026-11-13, dengan syarat benda tanpa fungsi dibuang (spec 3F keputusan 9): tangga dan relnya, karpet panjang di depan rak, tanaman dekat pintu, tanaman dan buku di ambang jendela, lukisan di atas pintu, karpet dasar (`baseRug`, model `rug-rectangle-a.glb` dihapus).
