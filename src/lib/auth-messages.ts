export type AuthMessage = { bubble: string; field: string }

const MESSAGES: Record<string, AuthMessage> = {
  invalid_credentials: {
    bubble: "Hmm, email atau kata sandinya belum cocok. Coba lagi, ya.",
    field: "Email atau kata sandi salah.",
  },
  email_not_confirmed: {
    bubble:
      "Surat konfirmasimu belum dibuka. Cek kotak masuk emailmu dulu, ya.",
    field: "Email belum dikonfirmasi.",
  },
  user_already_exists: {
    bubble: "Sepertinya email ini sudah terdaftar. Coba masuk saja.",
    field: "Email sudah terdaftar.",
  },
  email_address_invalid: {
    bubble: "Alamat email itu sepertinya keliru.",
    field: "Format email tidak valid.",
  },
  email_address_not_authorized: {
    bubble:
      "Meja admin belum bisa mengirim surat ke alamat itu. Coba alamat lain, ya.",
    field: "Email belum bisa menerima surat dari kami.",
  },
  weak_password: {
    bubble:
      "Kata sandinya terlalu mudah ditebak. Pakai minimal 8 karakter, ya.",
    field: "Kata sandi minimal 8 karakter.",
  },
  same_password: {
    bubble: "Kata sandi baru harus berbeda dari yang lama.",
    field: "Gunakan kata sandi yang berbeda.",
  },
  password_mismatch: {
    bubble: "Dua kata sandi yang kamu tulis belum sama.",
    field: "Kata sandi tidak sama.",
  },
  over_email_send_rate_limit: {
    bubble:
      "Terlalu banyak surat terkirim. Tunggu sebentar sebelum mencoba lagi.",
    field: "Coba lagi beberapa menit lagi.",
  },
  over_request_rate_limit: {
    bubble: "Meja admin sedang ramai. Tunggu sebentar, ya.",
    field: "Coba lagi beberapa menit lagi.",
  },
  otp_expired: {
    bubble:
      "Tautan di suratmu sudah kedaluwarsa atau sudah dipakai. Minta surat baru, ya.",
    field: "Tautan kedaluwarsa.",
  },
  username_taken: {
    bubble: "Nama pengguna itu sudah dipakai anggota lain.",
    field: "Nama pengguna sudah dipakai.",
  },
  username_invalid: {
    bubble:
      "Nama pengguna hanya boleh huruf kecil, angka, dan garis bawah (3–20 karakter).",
    field: "3–20 karakter: huruf kecil, angka, _",
  },
  display_name_invalid: {
    bubble: "Tulis namamu dulu, maksimal 60 karakter.",
    field: "Nama wajib diisi (maks. 60 karakter).",
  },
  terms_required: {
    bubble: "Sebelum jadi anggota, setujui tata tertib perpustakaan dulu, ya.",
    field: "Centang persetujuan tata tertib.",
  },
  confirm_mismatch: {
    bubble: "Nama pengguna yang kamu ketik belum sama.",
    field: "Ketik nama penggunamu persis.",
  },
  not_authenticated: {
    bubble: "Sesimu sudah berakhir. Silakan isi buku tamu lagi.",
    field: "Silakan masuk lagi.",
  },
}

const FALLBACK: AuthMessage = {
  bubble: "Maaf, ada gangguan di meja admin. Coba lagi sebentar lagi.",
  field: "Terjadi kesalahan. Coba lagi.",
}

export function authMessage(code: string | null | undefined): AuthMessage {
  return (code && Object.hasOwn(MESSAGES, code) && MESSAGES[code]) || FALLBACK
}
