import { expect, test } from "@playwright/test"
import {
  createConfirmedMember,
  hydrated,
  newMember,
  recoveryPath,
  signIn,
  signInAndOnboard,
  signupConfirmPath,
} from "./helpers/members"

test("a guest opening the lobby is sent to the guest book", async ({
  page,
}) => {
  await page.goto("/lobby")
  await expect(page).toHaveURL(/\/login\?next=%2Flobby$/)
  await expect(
    page.getByRole("status").filter({ hasText: "Silakan isi buku tamu" })
  ).toBeVisible()
})

test("the membership form checks usernames as they are typed", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("link", { name: "Daftar jadi anggota" }).click()
  await expect(page).toHaveURL(/\/register$/)
  await hydrated(page)
  const usernameField = page.getByLabel("Nama pengguna")
  await usernameField.fill("Ani Baca!")
  await expect(usernameField).toHaveValue("anibaca")
  await usernameField.fill(newMember().username)
  await expect(page.getByText("Nama pengguna tersedia ✓")).toBeVisible()
})

test("a confirmed new member receives a card and enters the lobby", async ({
  page,
}) => {
  const member = newMember()
  await page.goto(await signupConfirmPath(member))
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByText("DITERIMA")).toBeVisible()
  await hydrated(page)
  const card = page.getByRole("figure", { name: "Kartu anggota Glosa" })
  await expect(card).toContainText(`@${member.username}`)
  await expect(card).toContainText("GRATIS · 100 MB")

  await page.getByRole("button", { name: /Masuk ke perpustakaan/ }).click()
  await expect(page).toHaveURL(/\/lobby$/)
  await expect(page.getByRole("heading", { name: "Lobi" })).toBeVisible()
})

test("the librarian flags a wrong password, then a returning member goes straight to the lobby", async ({
  page,
}) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await page.goto("/logout")
  await expect(page).toHaveURL(/\/$/)

  await signIn(page, member, "salah-sandi-1")
  await expect(page.getByRole("alert").first()).toContainText("belum cocok")

  await page.getByLabel("Kata sandi", { exact: true }).fill(member.password)
  await page.getByRole("button", { name: "Tanda tangan & masuk" }).click()
  await expect(page).toHaveURL(/\/lobby$/)

  await page.goto("/")
  await expect(page).toHaveURL(/\/lobby\?kembali=1$/)
  await expect(
    page.getByRole("status").filter({ hasText: "Selamat datang kembali" })
  ).toBeVisible()
})

test("a member sets a new password from a recovery link", async ({ page }) => {
  const member = await createConfirmedMember()
  await page.goto(await recoveryPath(member.email))
  await expect(page).toHaveURL(/\/reset-password$/)
  await hydrated(page)
  await page
    .getByLabel("Kata sandi baru", { exact: true })
    .fill("sandi-baru-456")
  await page.getByLabel("Ulangi kata sandi baru").fill("sandi-baru-456")
  await page.getByRole("button", { name: "Simpan kata sandi" }).click()
  await expect(page).toHaveURL(/\/welcome$/)

  await page.goto("/logout")
  await signIn(page, member, "sandi-baru-456")
  await expect(page).toHaveURL(/\/welcome$/)
})

test("a member deletes their account", async ({ page }) => {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await page.goto("/settings")
  await hydrated(page)

  const confirmField = page.getByLabel(/Ketik nama penggunamu untuk konfirmasi/)
  await confirmField.fill("bukan-saya")
  await page.getByRole("button", { name: "Hapus akun saya permanen" }).click()
  await expect(page.getByRole("alert")).toContainText(
    "Ketik nama penggunamu persis."
  )

  await confirmField.fill(member.username)
  await page.getByRole("button", { name: "Hapus akun saya permanen" }).click()
  await expect(page).toHaveURL(/\/$/)

  await signIn(page, member)
  await expect(page.getByRole("alert").first()).toContainText("belum cocok")
})

test.describe("with custom SMTP", () => {
  const template = process.env.E2E_SMTP_EMAIL
  test.skip(
    !template,
    "Set E2E_SMTP_EMAIL (e.g. delivered+{id}@resend.dev) once custom SMTP is on"
  )
  const emailFor = (id: string) => (template ?? "").replace("{id}", id)

  test("the membership form sends a confirmation email", async ({ page }) => {
    const member = newMember(emailFor)
    await page.goto("/register")
    await hydrated(page)
    await page.getByLabel("Nama lengkap").fill(member.name)
    await page.getByLabel("Nama pengguna").fill(member.username)
    await expect(page.getByText("Nama pengguna tersedia ✓")).toBeVisible()
    await page.getByLabel("Email").fill(member.email)
    await page.getByLabel("Kata sandi", { exact: true }).fill(member.password)
    await page.getByLabel("Saya setuju dengan tata tertib").check()
    await page.getByRole("button", { name: "Ajukan keanggotaan" }).click()
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Kami kirim surat konfirmasi" })
    ).toBeVisible()
  })

  test("the forgotten-password form sends a reset email", async ({ page }) => {
    const member = await createConfirmedMember(newMember(emailFor))
    await page.goto("/forgot-password")
    await hydrated(page)
    await page.getByLabel("Email").fill(member.email)
    await page.getByRole("button", { name: "Kirim surat atur ulang" }).click()
    await expect(
      page.getByRole("status").filter({ hasText: "sudah kami kirim" })
    ).toBeVisible()
  })
})
