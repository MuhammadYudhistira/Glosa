# Tahap 3B: kebiasaan membaca — desain

Tanggal: 2026-11-06 · Cabang: `tahap-3b-kebiasaan`
Spec induk: [`2026-10-31-tahap-3-koleksi-dan-kebiasaan-baca-design.md`](2026-10-31-tahap-3-koleksi-dan-kebiasaan-baca-design.md) §1–§2

## 1. Tujuan

Mendorong orang membaca sedikit setiap hari, tanpa rasa dihukum. 3B mencatat waktu baca aktif, menghitung streak dengan jeda gratis, dan memberi dua target pribadi: menit per hari dan buku per tahun. Hasilnya tampil di panel lobi, sebagai tanaman di lobi 3D, sebagai cincin kecil di reader, dan di kartu anggota.

Prinsip Tahap 3 tetap berlaku: semua hadiah datang dari halaman yang dibaca. Tidak ada XP, papan peringkat, notifikasi yang mendesak, atau kata "gagal".

## 2. Keputusan pemilik

| # | Keputusan | Alasan |
|---|---|---|
| 1 | Streak harian dengan **2 hari jeda gratis per minggu** (Senin–Minggu). Jeda tidak perlu diaktifkan. | Lembut: cukup 5 dari 7 hari. Angkanya tetap, jadi tidak ada pengaturan tambahan. |
| 2 | Hari membaca = total waktu baca aktif hari itu ≥ **target menit hari itu**, atau ≥ 5 menit bila belum ada target. | Target terasa bermakna, dan pengguna tanpa target tetap punya streak. |
| 3 | Tampil di **empat tempat**: panel lobi, benda 3D di lobi, penanda kecil di reader, kartu anggota. | |
| 4 | Benda 3D: **tanaman yang tumbuh** mengikuti streak, dan tidak pernah layu. | Sejalan dengan nada lembut dan dengan lemari pajang 3A. |
| 5 | Pencatatan waktu: **total per hari × buku × perangkat, idempoten** (§5). | Aman untuk offline dan retry; pola antrean 2B sudah ada. |
| 6 | Ide "toko lobi" dari `inspiration.md` menjadi **sub-tahap tersendiri setelah 3B** (3C). | Toko butuh data waktu baca 3B. Ukurannya sebesar 3A, jadi perlu spec sendiri. |

"Hari" mengikuti **tanggal lokal perangkat**, sehingga pengguna di WITA/WIT dan yang sedang bepergian tetap dihitung benar.

## 3. Perilaku

### 3.1 Waktu baca aktif

- Waktu dihitung per halaman, mulai saat halaman tampil sampai halaman berpindah. Untuk mode Gulir, "berpindah" berarti `relocate` foliate.
- Halaman yang tampil kurang dari **5 detik** tidak dihitung, karena itu membalik halaman, bukan membaca.
- Halaman yang tampil lebih dari **10 menit** hanya dihitung 10 menit (plafon). Ini berbeda dengan pengukur kecepatan, yang membuang sampel seperti itu: untuk waktu baca, 10 menit pertama tetap dianggap membaca.
- Jam berhenti saat tab tersembunyi, reader ditutup, atau panel reader terbuka (daftar isi, pengaturan, Anotasi, kartu kutipan). Popup kata dan popup catatan kaki **tidak** menghentikan jam, karena itu bagian dari membaca.
- Potongan waktu masuk ke **tanggal lokal** saat potongan itu terjadi. Potongan yang melewati tengah malam dibagi ke dua tanggal.
- Halaman yang sedang terbuka ikut dihitung saat ditutup atau tab disembunyikan, dengan aturan 5 detik dan plafon yang sama. Selama halaman masih terbuka, waktunya ditampilkan langsung di cincin (§6.2) tapi baru disimpan saat halaman berpindah, tab disembunyikan, atau setiap 30 detik, mana yang lebih dulu. Plafon 10 menit tetap berlaku.

### 3.2 Hari membaca dan target yang dibekukan

- Total sehari = jumlah detik dari semua buku dan semua perangkat.
- Hari membaca: total ≥ `goal_minutes` hari itu × 60, atau ≥ 300 detik bila `goal_minutes` kosong.
- Target **dibekukan per hari**. Setiap catatan waktu ikut menyimpan target saat itu, dan target sebuah hari diambil dari catatan terbaru hari itu. Menaikkan target hari ini tidak mengubah status hari yang sudah lewat. Hari tanpa catatan tidak butuh target, karena hari itu pasti bukan hari membaca.

### 3.3 Streak dengan jeda gratis

- Minggu dihitung Senin–Minggu, menurut tanggal lokal.
- Dalam satu minggu boleh ada **2 hari bukan-hari-membaca** tanpa memutus streak. Streak putus saat hari kosong **ketiga** dalam minggu yang sama berakhir.
- Hari ini belum dihitung kosong sampai harinya lewat.
- Di minggu awal streak, hari-hari sebelum streak dimulai tidak dihitung sebagai jeda.
- **Angka streak = jumlah hari membaca** dalam rangkaian. Hari jeda tidak menambah angka dan tidak memutus rangkaian.
- **Rekor** = streak terpanjang sepanjang riwayat.
- **Sisa jeda minggu ini** = 2 − hari kosong minggu ini yang sudah lewat (sejak awal streak), minimal 0.
- Saat tidak ada streak aktif, teksnya "Mulai lagi hari ini" (atau "Baca 5 menit hari ini untuk menanam tunas pertama" bagi yang belum punya riwayat). Tidak ada kata "gagal" dan tidak ada warna merah.

Contoh: membaca Senin–Jumat lalu libur Sabtu–Minggu tidak memutus streak (streak 5). Kalau Senin berikutnya juga libur, itu jeda pertama di minggu baru, jadi streak tetap utuh.

### 3.4 Target pribadi

Keduanya opsional dan diatur di panel lobi.

- **Menit per hari:** mati, 5, 10, 15, 20, 30, 45, atau 60.
- **Buku per tahun:** mati atau 1–365. Yang dihitung adalah buku dengan `finished_at` (3A) dalam tahun berjalan, menurut tanggal lokal. Buku yang dihapus dari rak tidak ikut dihitung lagi.

### 3.5 Tanaman streak

| Streak | Tahap |
|---|---|
| 0 (belum pernah atau tidak ada streak aktif) | biji |
| 1–2 | tunas |
| 3–6 | daun |
| 7–20 | rimbun |
| 21–49 | kuncup |
| ≥ 50 | berbunga |

Tanaman tidak pernah layu. Setelah streak putus, tahapnya mengikuti streak baru, mulai dari biji lalu tunas begitu ada hari membaca.

## 4. Tampilan

### 4.1 Lobi 3D

- Hotspot baru `tanaman` di `scene/layout.ts`: pot di sekitar `READING_TABLE` [19.5, 26]. Titik akhirnya dipilih lewat screenshot harness, supaya tidak menghalangi jalur NPC, kursi pembaca, atau lemari pajang (cara yang sama dengan 3A).
- `scene/plant.ts` membangun tanaman prosedural untuk 6 tahap. Mesh dibangun ulang hanya saat tahap berubah. Saat masuk tahap baru ada animasi tumbuh singkat, yang dimatikan untuk `prefers-reduced-motion`. Geometri dan material dibuang saat adegan ditutup.
- `LobbyStill` (gambar diam) menampilkan tahap yang sama.

### 4.2 Panel "Kebiasaan baca"

`HabitPanel` dibuka lewat `LobbyPopup` dari hotspot tanaman, dan dari `LibraryMap` di HP (tujuan baru setelah "Sudah dibaca"). Isinya dari atas ke bawah:

1. **Kepala:** angka streak besar dengan tulisan "hari membaca beruntun", lalu "Rekor 31 · Jeda tersisa minggu ini: 1".
2. **Hari ini:** batang menit hari ini dibanding target, misalnya "12 / 20 menit". Tanpa target: "12 menit hari ini · Pasang target harian".
3. **Tahun ini:** "4 / 12 buku selesai", dengan tautan ke koleksi Sudah dibaca. Tanpa target: "4 buku selesai tahun ini".
4. **Kalender 5 minggu** (baris Senin–Minggu, minggu ini di bawah). Sel terisi penuh untuk hari membaca, samar untuk hari yang ada bacaan tapi di bawah batas, dan kosong untuk hari tanpa bacaan. Tanggal sesudah hari ini tidak ditampilkan. Tiap sel punya label, misalnya "Rabu, 4 November: 23 menit".
5. **Atur target:** select menit per hari dan input buku per tahun (kosong berarti mati). Perubahan disimpan langsung. Kalau gagal, nilai kembali seperti semula dan pesan error tampil lewat `bookMessage`.

### 4.3 Reader

- `HabitRing` di `ReaderToolbar`: cincin kecil berisi menit hari ini dibanding target, dengan `aria-label` "12 dari 20 menit hari ini". Tanpa target, cincin memakai batas 5 menit dan labelnya "12 menit hari ini".
- Toast lembut **sekali per hari** saat batas hari itu tercapai di reader: "Target hari ini tercapai. Selamat membaca terus." Tanpa target, toast ini tidak muncul. Penanda "sudah tampil" disimpan di localStorage per tanggal. Toast tidak menghalangi halaman, hilang sendiri, dan tidak muncul saat bilah reader tersembunyi (mode fokus); dalam keadaan itu, toast menunggu sampai bilah tampil lagi di hari yang sama.

### 4.4 Kartu anggota

`MembershipCard` mendapat baris "Streak 12 hari · Rekor 31". Pengguna tanpa riwayat tidak melihat baris ini.

### 4.5 Keadaan kosong dan error

- **Pengguna baru:** tanaman biji, kalender kosong, kalimat ajakan dari §3.3.
- **`reading_days` gagal dimuat:** tampilkan cache terakhir ditambah catatan "Data mungkin belum terbaru". Tanpa cache, panel menampilkan keadaan kosong dengan tombol "Coba lagi".
- **Offline:** angka tetap berjalan dari cache dan catatan lokal. Pengaturan target dinonaktifkan dengan keterangan, seperti ubah koleksi di 3A.

## 5. Data

### 5.1 Tabel `reading_time`

Satu baris per (pengguna, tanggal lokal, perangkat, buku).

| Kolom | Tipe | Isi |
|---|---|---|
| `user_id` | `uuid` | → `profiles (id)` `on delete cascade` |
| `day` | `date` | tanggal lokal perangkat |
| `device_id` | `uuid` | id perangkat (§5.4) |
| `book_id` | `uuid` | **tanpa FK**, supaya menghapus buku tidak menghapus riwayat dan tidak memutus streak. Kepemilikan dicek saat menulis. |
| `seconds` | `integer` | 0–86400, total kumulatif perangkat ini untuk buku ini pada hari itu |
| `goal_minutes` | `smallint` null | target saat baris terakhir ditulis |
| `updated_at` | `timestamptz` | waktu server saat tulis terakhir |

- Primary key `(user_id, day, device_id, book_id)`.
- RLS: `select` hanya baris milik sendiri. Tidak ada grant tulis langsung.

### 5.2 Fungsi

Semua fungsi `security definer`, `search_path = ''`. Sesi yang hilang menjadi exception `not_authenticated`, seperti fungsi lain.

- `record_reading_time(p_entries jsonb) returns text`
  - Entri berbentuk `{ day, device_id, book_id, seconds, goal_minutes }`, maksimal 50 per panggilan. Batch yang lebih besar atau bentuk yang salah dijawab `'invalid'`.
  - Untuk setiap entri: `seconds = greatest(lama, baru)`, dan `goal_minutes` serta `updated_at` diganti. Kirim ulang dan retry tidak menggandakan waktu.
  - Entri dilewati diam-diam (bukan error) kalau buku bukan milik pemanggil atau `day` di luar [tanggal UTC server − 30 hari, tanggal UTC server + 1 hari]. Dengan begitu, satu entri basi tidak menahan seluruh antrean.
  - Jawaban: `'ok'`.
- `reading_days() returns table (day date, seconds integer, goal_minutes smallint)`
  - Satu baris per hari milik pemanggil. `seconds` adalah jumlah dari semua perangkat dan buku, dengan plafon 86400. `goal_minutes` diambil dari baris dengan `updated_at` terbaru hari itu.
  - Seluruh riwayat dikirim (sekitar 365 baris per tahun), supaya rekor bisa dihitung di klien.

### 5.3 Target di `profiles`

- `daily_goal_minutes smallint null`, dengan check `in (5, 10, 15, 20, 30, 45, 60)`.
- `yearly_goal_books smallint null`, dengan check `between 1 and 365`.
- Masuk grant `update` kolom yang sudah ada, dan diubah lewat `updateProfileFn` (zod) atau server function kecil di `src/server/habit.ts` yang memakai jalur yang sama.

### 5.4 Di perangkat (Dexie)

- **Id perangkat:** UUID acak di tabel `meta` (kunci `deviceId`), dibuat saat pertama dibutuhkan. Saat data lokal dihapus (keluar akun), id ini ikut hilang dan perangkat mendapat id baru. Ini tetap benar: baris lama tetap terhitung, dan baris baru mulai dari nol.
- **Tabel `readingTime`**, kunci `[day+bookId]`: `seconds` (kumulatif perangkat ini), `sent` (detik terakhir yang dikonfirmasi server), `goalMinutes`. Dexie naik satu versi, dan `wipeMemberData` ikut mengosongkan tabel ini.
- **Antrean:** `createQueueSync` (`src/lib/sync/queue-sync.ts`). Pengiriman di-debounce, di-flush saat tab disembunyikan (keepalive) dan saat koneksi kembali, dan dikirim dalam batch maksimal 50. Baris yang `seconds > sent` adalah yang tertunda.
- **Cache:** hasil `reading_days()` terakhir disimpan di `meta`, supaya lobi dan reader tetap menampilkan angka saat offline.
- **Angka yang ditampilkan** per hari = `seconds` server + Σ(`seconds − sent`) baris lokal yang belum terkirim. Jadi cincin dan panel bergerak tanpa menunggu sinkronisasi, dan setelah terkirim tidak ada waktu yang terhitung dua kali.

## 6. Kode

### 6.1 Logika murni

- `src/lib/reading-clock.ts`: jam baca. Masukannya peristiwa `show(at)`, `turn(at)`, `pause(at)`, `resume(at)`, `tick(at)`. Keluarannya potongan `{ day, seconds }`. Di dalamnya ada batas 5 detik, plafon 10 menit, dan pemotongan saat tengah malam. Tanggal lokal dihitung lewat fungsi yang disuntikkan, supaya bisa diuji dengan zona waktu tetap.
- `src/lib/reading-habit.ts`, dengan masukan daftar `{ day, seconds, goalMinutes }`, tanggal hari ini, dan target sekarang:
  - `isReadingDay(day)`;
  - `habitSummary(days, today)` → `{ streak, record, gapsLeft, todaySeconds, todayGoalSeconds, stage }`;
  - `calendarCells(days, today, weeks = 5)`;
  - `booksThisYear(books, today)`.
- Fungsi tanggal (tambah hari, awal minggu Senin, tanggal lokal `YYYY-MM-DD`) masuk ke `src/lib/dates.ts`.

### 6.2 Reader

- `useReadingClock(bookId)` di `src/components/reader/` menyalurkan `relocate`, `visibilitychange`, buka/tutup panel, dan unmount dari `ReaderView` ke `reading-clock`. Hook ini mencatat potongan ke Dexie, lalu memanggil antrean. Ia terpisah dari `useReadingSpeed`.
- `HabitRing` di `ReaderToolbar` dan toast target tercapai di `read.$bookId.tsx`.

### 6.3 Server dan sinkronisasi

- `src/server/habit.ts`: `recordReadingTimeFn` (POST, zod, dipakai antrean dengan dukungan keepalive seperti `saveProgressFn`), `readingDaysFn` (GET), `updateGoalsFn`.
- `src/lib/habit/habit-sync-client.ts`: satu antrean per tab, flush saat aplikasi dibuka, tab disembunyikan, dan koneksi kembali. Ikut didaftarkan di tempat flush yang sudah ada (`useProgressFlush`).
- `useReadingHabit()` menggabungkan cache, data server, dan catatan lokal menjadi `habitSummary`, dan dipakai lobi, panel, reader, dan kartu anggota.

### 6.4 Lobi dan kartu anggota

- `scene/layout.ts`: `PLANT: Point2` dan hotspot `tanaman`. `scene/plant.ts`: tahap tanaman.
- `summarizeLobby` mendapat `habit: { stage, streak }`. `HotspotLayer` dan `LibraryMap` mengenal tujuan `tanaman` ("Kebiasaan baca").
- `HabitPanel` dan `HabitCalendar` di `src/components/lobby/`.
- `MembershipCard`: baris streak dan rekor.

### 6.5 Privasi

Halaman `/privacy` ditambah satu paragraf: Glosa mencatat berapa lama pengguna membaca per hari dan per buku untuk streak dan target. Data ini tidak dibagikan, dan ikut terhapus saat akun dihapus.

## 7. Pengujian

- **DB (`tests/db/habit.test.ts`):**
  - `record_reading_time` memakai `greatest` (kirim ulang angka lebih kecil tidak menurunkan, angka sama tidak menggandakan);
  - entri buku orang lain dan tanggal di luar jendela dilewati, sedangkan entri lain dalam batch yang sama tetap tersimpan;
  - batch lebih dari 50 dijawab `'invalid'`;
  - RLS: pengguna lain tidak bisa membaca baris;
  - `reading_days` menjumlahkan perangkat dan buku, mengambil `goal_minutes` dari baris terbaru, dan memakai plafon 86400;
  - menghapus buku tidak menghapus `reading_time`;
  - menghapus akun menghapusnya;
  - check kolom target di `profiles`.
- **Unit:**
  - `reading-clock`: batas 5 detik, plafon 10 menit, jeda saat tab tersembunyi, potongan melewati tengah malam, `tick` 30 detik tidak menggandakan waktu;
  - `reading-habit`: jeda 2 hari per minggu, hari kosong ketiga memutus streak, minggu awal streak, hari ini belum dihitung kosong, target dibekukan (menaikkan target tidak mengubah hari lalu), rekor, sisa jeda, tahap tanaman di setiap batas, sel kalender, `booksThisYear` di batas tahun;
  - penggabungan angka server dan lokal tanpa hitung ganda;
  - fungsi tanggal baru di `dates.ts`.
- **Komponen:**
  - `HabitPanel`: keadaan baru, streak aktif, tanpa target, gagal muat dengan atau tanpa cache, simpan target gagal lalu kembali, offline menonaktifkan pengaturan;
  - `HabitCalendar`: label sel;
  - `HabitRing`: label dengan dan tanpa target;
  - toast sekali per hari dan menunggu saat mode fokus;
  - baris di `MembershipCard`;
  - `LibraryMap` dan `HotspotLayer` mengenal tujuan baru.
- **Adegan:** `layout.test.ts` untuk titik `PLANT` yang tidak bertabrakan dengan jalur NPC atau perabot; screenshot harness untuk penempatan dan untuk tiap tahap tanaman.
- **E2E (desktop dan HP, `e2e/habit.spec.ts`):**
  - membaca beberapa halaman dengan jam dipercepat (`page.clock`) membuat cincin bertambah;
  - setelah muat ulang, menit hari ini tetap ada (sudah terkirim ke server);
  - pasang target 5 menit, capai, lalu toast muncul sekali;
  - hotspot tanaman atau peta HP membuka panel dengan streak 1 dan kalender terisi hari ini;
  - offline: waktu tetap tercatat, lalu terkirim saat online.

## 8. Di luar 3B

- **Toko lobi** (3C, ide dari `inspiration.md`): membaca menghasilkan mata uang yang dipakai membeli bagian lobi, seperti perabot, hewan, suasana, pakaian karakter, dan perluasan ruang, yang dipasang di slot tetap. Mata uangnya akan dihitung server dari `reading_time` dengan batas harian. Bonus buku selesai butuh catatan yang tidak hilang saat buku dihapus; catatan itu dirancang di spec toko.
- Pengingat atau notifikasi, target halaman, statistik per jam, dan berbagi streak.
- Kilas balik bulanan/tahunan (3E) akan memakai `reading_time`.
