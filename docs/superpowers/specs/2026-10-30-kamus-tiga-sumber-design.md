# Glosa: Kamus Tiga Sumber (Wiktionary, WordNet Bahasa, AI): Desain

Tanggal: 2026-10-30
Spec induk: [`2026-10-22-tahap-2-ketuk-kata-design.md`](2026-10-22-tahap-2-ketuk-kata-design.md) §4.1 (kamus), §6.3 (popup arti), §11 (alternatif yang ditolak)

## 1. Ringkasan

Kamus Glosa sekarang hanya berisi terjemahan Indonesia dari English Wiktionary (ekstrak kaikki.org), yaitu 14.543 entri. Di buku *The Adventures of Sherlock Holmes*, arti tersedia untuk 81,7% kemunculan kata, tetapi hanya untuk 46,2% kata yang berbeda.

Banyak kata umum tidak punya arti karena English Wiktionary memang tidak punya terjemahan Indonesianya, misalnya *it, from, upon, out, should, case, quite, however, make, mind*. *make*, misalnya, punya 522 terjemahan ke bahasa lain tanpa satu pun ke bahasa Indonesia. Jadi masalahnya bukan di skrip impor.

Desain ini menambah dua sumber:

- **WordNet Bahasa** (MIT): gratis, untuk kata isi.
- **Arti buatan AI** (Claude Opus 5.5, Batch API, dibuat sekali lalu disimpan): untuk kata yang masih kosong, termasuk kata fungsi.

Pembaca tetap memakai satu kamus. Baris kredit di popup arti menyebut sumber arti yang tampil.

Perbaikan kelas kata (article, det, num, particle) sudah selesai lebih dulu di commit `14cbb9f`, dan tidak termasuk desain ini.

## 2. Keputusan

| # | Keputusan | Alasan |
|---|---|---|
| 1 | **Prioritas per (kata, kelas kata): Wiktionary → WordNet → AI.** Sumber berikutnya hanya mengisi pasangan yang masih kosong. Satu entri berasal dari satu sumber. | Wiktionary disunting manusia. WordNet gratis tetapi bercampur Melayu. AI dipakai paling akhir dan paling sedikit. Satu sumber per entri membuat kredit jujur. |
| 2 | **Hasil AI disimpan permanen di tabel `dict_generated`** dan tidak pernah ditukar. Impor membaca tiga sumber (file kaikki, file WordNet, tabel AI), menyusun satu kamus, lalu menukarnya sekaligus dengan `dict_swap`. | Hasil AI berbayar, jadi harus awet dan tidak boleh hanya ada di laptop. Satu tempat penggabungan berarti satu aturan prioritas. |
| 3 | **Calon kata AI:** 50.000 kata Inggris teratas dari daftar frekuensi `wordfreq` (data CC BY-SA 4.0), ditambah kata yang pernah diketuk member tetapi tidak punya arti. | Celah besar tertutup di awal. Sisanya menyusul sesuai pemakaian nyata. |
| 4 | **AI dijalankan manual oleh pemilik**, lewat skrip dari laptop, seperti impor kamus. | Tidak ada kunci API di server atau CI, tidak ada biaya yang berjalan sendiri, dan tidak ada celah untuk menyalahgunakan AI lewat ketukan. |
| 5 | **Model:** Claude Opus 5.5 (`claude-opus-5-5`) lewat Message Batches API. Uji coba 200 kata dijalankan sebelum batch penuh. | Paling teliti untuk nuansa arti dan kata fungsi. Batch API memotong biaya 50%. Uji coba menunjukkan biaya nyata sebelum pemilik menyetujui batch penuh. |
| 6 | **Kelas kata yang ditanyakan ke AI diambil dari Wiktionary.** Entri Inggris tetap ada di kaikki walau tanpa terjemahan Indonesia. | AI hanya mengisi kelas kata yang memang dimiliki kata itu, misalnya *like*: verb, prep, noun. AI tidak mengarang kelas kata. |
| 7 | **Mutu WordNet:** bawaannya hanya lemma bahasa `I` atau `B` dengan tanda mutu `Y` atau `O`. Plan memuat langkah ukur: cakupan Sherlock dengan `Y`+`O` dibandingkan dengan ditambah `L`. Pemilik memutuskan apakah `L` ikut. `M` (Melayu saja) dan `X` (ditandai salah) selalu dibuang. | Hanya 12.362 baris yang bertanda `Y` dan 107.613 bertanda `O`, sedangkan `L` 398.874. `L` menambah cakupan, tetapi mutunya rendah. |
| 8 | **Urutan arti WordNet mengikuti frekuensi sense Princeton WordNet 3.0** (tag count). | Ini menjawab kelemahan yang disebut di spec induk §11: arti WordNet tidak diurutkan dari yang paling umum. |
| 9 | **Bentuk kata dipertahankan bila kata dasarnya punya arti dari sumber mana pun.** Sekarang bentuk kata dibuang bila Wiktionary tidak punya artinya. | Tanpa ini, *made* dan *cases* tetap kosong walaupun *make* dan *case* sudah diisi WordNet atau AI. |
| 10 | **Kata yang diketuk tanpa arti dicatat di `dict_misses` tanpa identitas:** kata, jumlah, dan waktu terakhir. Tidak ada user, buku, atau waktu per orang. | Cukup untuk memilih kata bagi batch berikutnya, tanpa data pribadi. |
| 11 | **Kredit di popup mengikuti sumber entri yang tampil:** "Wiktionary · CC BY-SA" (tautan), "WordNet Bahasa" (tautan), "Dibuat AI" (teks). Sumber yang campur ditulis dalam satu baris, dipisah "·". Arti AI tidak ditandai per baris. | Jujur tanpa membuat popup ramai. |
| 12 | **Kosakata tidak berubah.** Arti tetap disalin saat kata disimpan, tanpa kolom sumber. | YAGNI. Kata yang sudah dipelajari tidak bergantung pada sumber. |

Spec induk keputusan 12 menyebut "AI konteks" sebagai bagian dari Tahap 5. Fitur itu tidak berubah. Arti AI di desain ini adalah data kamus yang dibuat sekali secara offline, bukan AI yang membaca konteks kalimat saat member mengetuk kata.

## 3. Data dan server

Semua perubahan skema hanya menambah, sesuai [`docs/ops/deploy.md`](../../ops/deploy.md) §7.

### 3.1 Kolom `source`

`dict_entries` dan `dict_entries_staging` mendapat kolom `source text not null default 'wiktionary'` dengan `check (source in ('wiktionary', 'wordnet', 'ai'))`. `dict_swap` ikut menyalin kolom ini.

`lookup_word` mengembalikan `source` untuk setiap entri. Phrasal verb dan frasa selalu berasal dari Wiktionary.

### 3.2 `dict_generated`

| Kolom | Isi |
|---|---|
| `headword` | Teks, 1–64 karakter, sudah dinormalisasi (`normalizeWord`) |
| `pos` | Kelas kata kamus (`DICT_POS`) |
| `meanings` | `text[]`, 0–8 arti, tiap arti maksimal 100 karakter. Kosong berarti AI menjawab "tidak ada padanan", supaya kata itu tidak dikirim ulang. |
| `model` | Model yang membuat arti, misalnya `claude-opus-5-5` |
| `created_at` | Waktu dibuat |

Kunci tabel adalah `(headword, pos)`. RLS aktif tanpa policy untuk member. Hanya service role (skrip) yang membaca dan menulis.

### 3.3 `dict_misses`

| Kolom | Isi |
|---|---|
| `word` | Kata yang dicari, sudah dinormalisasi (kunci) |
| `count` | Berapa kali dicari tanpa hasil |
| `last_seen` | Waktu terakhir dicari |

`lookup_word` menulis (upsert, `count + 1`) hanya bila hasilnya kosong, dan hanya untuk kata yang lolos batas panjang yang sudah ada. Penulisan dibungkus `begin … exception when others then null end`, sehingga kegagalan mencatat tidak menggagalkan pencarian. Member tidak bisa membaca tabel ini.

## 4. Skrip pemilik

### 4.1 Unduhan baru di `dict/` (tidak masuk git)

- **`wn-msa-all.tab`**: WordNet Bahasa.
- **Princeton WordNet 3.0**, yaitu file `data.*` dan `index.sense` dari paket `WNdb-3.0`. Isinya lemma Inggris tiap synset dan tag count untuk urutan sense.
- **Daftar 50.000 kata teratas `wordfreq`**, satu kata per baris. Dibuat sekali dengan perintah Python yang ditulis di panduan operasi.

### 4.2 `scripts/import-dictionary.ts` (diperluas)

1. Membangun entri Wiktionary seperti sekarang. Bentuk kata disimpan untuk semua kata dasar, lalu disaring di akhir.
2. Membaca WordNet:
   - synset → lemma Indonesia (sesuai keputusan 7);
   - synset → lemma Inggris dan kelas kata (`n`/`v`/`a`/`s`/`r` → `noun`/`verb`/`adj`/`adj`/`adv`);
   - urutan berdasarkan tag count.

   Hasilnya hanya mengisi pasangan (kata, kelas kata) yang kosong di Wiktionary, maksimal 8 arti.
3. Membaca `dict_generated` (service role). Baris dengan arti tidak kosong mengisi pasangan yang masih kosong.
4. Menyaring bentuk kata ke kata dasar yang punya entri, lalu mengisi staging dan menjalankan `dict_swap`.
5. Mencetak jumlah entri per sumber. Pengaman "jumlah entri turun lebih dari 20%" tetap berlaku.

Opsi `--no-wordnet` mengimpor tanpa WordNet, dan `--no-generated` mengimpor tanpa hasil AI. File yang dibutuhkan tetapi tidak ada membuat skrip berhenti dengan pesan yang jelas, tanpa mengubah kamus.

### 4.3 `scripts/fill-dictionary.ts` (baru)

1. **Calon kata:**
   - kata dari daftar frekuensi, ditambah semua `dict_misses`;
   - tiap kata dinormalisasi dan diberi kelas kata dari Wiktionary (keputusan 6);
   - dikurangi pasangan (kata, kelas kata) yang sudah terisi oleh Wiktionary atau WordNet, atau sudah ada di `dict_generated` (termasuk yang kosong);
   - kata tanpa kelas kata di Wiktionary diberi satu kelas yang paling mungkin oleh AI dari daftar `DICT_POS`.
2. **Uji coba** (`--trial 200`): 200 calon pertama dikirim sebagai satu batch kecil. Skrip mencetak biaya nyata dari `usage`, perkiraan biaya batch penuh, dan 20 contoh hasil. Tidak ada yang ditulis ke `dict_generated` sampai pemilik menjalankan ulang dengan `--commit`.
3. **Batch penuh:**
   - 50 kata per permintaan, dengan output JSON terstruktur (`output_config.format`): untuk setiap kata, setiap kelas kata yang diminta, berisi 0–8 padanan Indonesia dari yang paling umum;
   - model `claude-opus-5-5`, dengan effort yang ditetapkan lewat uji coba;
   - ID batch disimpan ke `dict/fill-state.json`, sehingga skrip yang terputus menunggu batch yang sama tanpa membayar ulang.
4. **Validasi:**
   - setiap hasil diperiksa dengan zod: kata dan kelas kata harus sesuai permintaan, artinya 0–8, tiap arti maksimal 100 karakter, tanpa karakter kendali;
   - hasil yang tidak valid, `refusal`, atau `errored` dicatat ke log lalu dilewati;
   - kata yang dilewati dikirim ulang pada jalan berikutnya.
5. **Hasil yang valid** ditulis ke `dict_generated` (upsert). Baris `dict_misses` untuk kata yang sudah terjawab dihapus.
6. Skrip menyarankan menjalankan `import` untuk menerbitkan hasilnya.

Kunci API hanya ada di laptop pemilik, lewat `ANTHROPIC_API_KEY` atau profil `ant auth login`.

## 5. Antarmuka

`WordPopup`:
- Baris kredit dihitung dari `source` entri yang tampil. Urutannya: Wiktionary, WordNet Bahasa, Dibuat AI.
- "Wiktionary · CC BY-SA" tetap bertaut ke halaman Wiktionary kata dasarnya.
- "WordNet Bahasa" bertaut ke situs proyek.
- "Dibuat AI" berupa teks biasa.
- Popup tanpa arti tidak menampilkan kredit, seperti sekarang.

## 6. Privasi dan atribusi

Kebijakan Privasi ditambah tiga hal:

- Kata yang dicari tetapi belum punya arti dicatat tanpa identitas, untuk melengkapi kamus.
- Atribusi WordNet Bahasa (MIT), di samping Wiktionary (CC BY-SA).
- Sebagian arti di kamus dibuat dengan AI.

## 7. Pengujian

- **Unit:**
  - parser WordNet: filter bahasa dan mutu, pemetaan kelas kata, urutan sense;
  - penggabung tiga sumber: prioritas per (kata, kelas kata), bentuk kata dipertahankan untuk kata dari WordNet atau AI, batas 8 arti;
  - penyusun calon kata AI, termasuk mengurangi kata yang sudah ada;
  - validasi jawaban AI;
  - kredit `WordPopup` untuk tiap sumber dan sumber campur.
- **DB** (fixture berawalan, tanpa `dict_swap`):
  - `lookup_word` mengembalikan `source`;
  - kata tanpa hasil tercatat di `dict_misses`, dan `count` bertambah;
  - member tidak bisa membaca `dict_generated` atau `dict_misses`;
  - kata yang terlalu panjang tidak tercatat.
- **E2E:** sebuah kata fixture bersumber `ai` ditanam dan dihapus lagi seperti fixture DB, di dalam buku buatan (`makeEpub`). Mengetuk kata itu harus menampilkan "Dibuat AI".
- **Manual (pemilik):**
  - uji coba 200 kata: biaya dan contoh hasil diperiksa sebelum `--commit` dan batch penuh;
  - setelah impor, cakupan Sherlock diukur ulang.

## 8. Tidak termasuk

- Arti yang dibuat AI langsung saat kata diketuk.
- Job berkala di server.
- Arti AI yang membaca konteks kalimat (tetap di Tahap 5).
- Mengganti terjemahan Wiktionary yang sudah ada.
- Nama diri (kelas `name`), karena setelah huruf kecil bertabrakan dengan kata biasa.
- Kolom sumber di Kosakata.
