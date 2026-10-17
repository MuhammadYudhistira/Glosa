import { expect, test, type Locator, type Page } from "@playwright/test"
import { makeEpub } from "./helpers/epub"
import {
  admin,
  createConfirmedMember,
  hydrated,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"

const SHERLOCK = "e2e/fixtures/the-adventures-of-sherlock-holmes.epub"
type Files = Parameters<Page["setInputFiles"]>[1]

async function openShelf(page: Page) {
  const member = await createConfirmedMember()
  await signInAndOnboard(page, member)
  await page.getByRole("link", { name: "Rak Saya" }).click()
  await expect(page).toHaveURL(/\/shelf$/)
  // The URL changes before the shelf's loader ends; the lobby stays until then.
  await expect(
    page.getByRole("heading", { name: "Rak Saya", level: 1 })
  ).toBeVisible()
  await hydrated(page)
  return member
}

async function bringBooks(page: Page, files: Files): Promise<Locator> {
  await page.getByRole("button", { name: "Bawa buku" }).first().click()
  const dialog = page.getByRole("dialog", { name: "Bawa buku ke rak" })
  await dialog.locator('input[type="file"]').setInputFiles(files)
  return dialog
}

async function acceptAll(dialog: Locator, uploaded = 1) {
  await dialog.getByRole("button", { name: "Terima semua" }).click()
  await expect(dialog.getByText("Masuk rak ✓")).toHaveCount(uploaded, {
    timeout: 30_000,
  })
}

const epubFile = async (
  name: string,
  book: Parameters<typeof makeEpub>[0]
) => ({
  name,
  mimeType: "application/epub+zip",
  buffer: await makeEpub(book),
})

test("a Standard Ebooks EPUB lands in its guessed genre and frees its space when deleted", async ({
  page,
}) => {
  await openShelf(page)
  await expect(
    page.getByText("Rakmu masih kosong. Bawa buku pertamamu ke sini!")
  ).toBeVisible()

  const dialog = await bringBooks(page, SHERLOCK)
  await expect(
    dialog.getByText("The Adventures of Sherlock Holmes", { exact: true })
  ).toBeVisible()
  await expect(dialog.getByLabel("Genre")).toHaveValue("misteri_thriller")
  await acceptAll(dialog)
  await dialog.getByRole("button", { name: "Tutup" }).click()

  const filters = page.getByRole("navigation", { name: "Filter genre" })
  const book = page.getByRole("button", {
    name: /The Adventures of Sherlock Holmes/,
  })
  await filters.getByRole("link", { name: /Misteri & Thriller/ }).click()
  await expect(book).toBeVisible()
  await filters.getByRole("link", { name: /Fiksi & Sastra/ }).click()
  await expect(book).toHaveCount(0)
  await expect(page.getByText(/^0\.[78] MB \/ 100 MB$/)).toBeVisible()

  await filters.getByRole("link", { name: /Semua/ }).click()
  await book.click()
  const detail = page.getByRole("dialog", {
    name: "The Adventures of Sherlock Holmes",
  })
  await detail.getByRole("button", { name: "Hapus buku" }).click()
  await detail.getByRole("button", { name: "Ya, hapus" }).click()
  await expect(
    page.getByText("“The Adventures of Sherlock Holmes” dihapus dari rak.")
  ).toBeVisible()
  await expect(page.getByText("0 MB / 100 MB")).toBeVisible()
})

test("a book without subjects waits in the trolley until it gets a genre", async ({
  page,
}) => {
  await openShelf(page)
  const dialog = await bringBooks(
    page,
    await epubFile("tanpa-subjek.epub", {
      title: "Catatan Tanpa Subjek",
      author: "Penulis Uji",
      subjects: [],
    })
  )
  await expect(
    dialog.getByText("Catatan Tanpa Subjek", { exact: true })
  ).toBeVisible()
  await expect(dialog.getByLabel("Genre")).toHaveValue("")
  await acceptAll(dialog)
  await dialog.getByRole("button", { name: "Tutup" }).click()

  const filters = page.getByRole("navigation", { name: "Filter genre" })
  await filters.getByRole("link", { name: /Troli Buku Baru/ }).click()
  await page
    .getByLabel("Genre untuk Catatan Tanpa Subjek")
    .selectOption("sejarah_budaya")
  await expect(page.getByText("Dipindahkan ke Sejarah & Budaya.")).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Catatan Tanpa Subjek/ })
  ).toHaveCount(0)
  await filters.getByRole("link", { name: /Sejarah & Budaya/ }).click()
  await expect(
    page.getByRole("button", { name: /Catatan Tanpa Subjek/ })
  ).toBeVisible()
})

test("explains why a file cannot come in", async ({ page }) => {
  await openShelf(page)
  const twin = await epubFile("kembar.epub", {
    title: "Buku Kembar",
    author: "Penulis Uji",
    subjects: ["History"],
  })
  const dialog = await bringBooks(page, [
    {
      name: "catatan.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("bukan buku"),
    },
    {
      name: "rusak.epub",
      mimeType: "application/epub+zip",
      buffer: Buffer.from("PK\u0003\u0004 bukan arsip yang utuh"),
    },
    twin,
  ])
  await expect(
    dialog.getByText("Hanya file .epub yang bisa dibawa masuk.")
  ).toBeVisible()
  await expect(
    dialog.getByText("File EPUB rusak atau tidak didukung.")
  ).toBeVisible()
  await acceptAll(dialog)

  await dialog.locator('input[type="file"]').setInputFiles(twin)
  await expect(
    dialog.getByRole("button", { name: "Terima semua" })
  ).toBeEnabled()
  await dialog.getByRole("button", { name: "Terima semua" }).click()
  await expect(dialog.getByText("Buku ini sudah ada di rakmu.")).toBeVisible()
})

test("a full shelf refuses new books", async ({ page }) => {
  const member = await openShelf(page)
  const { error } = await admin()
    .from("profiles")
    .update({ storage_limit_bytes: 1000 })
    .eq("id", await userIdOf(member.email))
  expect(error).toBeNull()

  const dialog = await bringBooks(
    page,
    await epubFile("penuh.epub", {
      title: "Buku Kebesaran",
      author: "Penulis Uji",
      subjects: [],
    })
  )
  await expect(
    dialog.getByText("Buku Kebesaran", { exact: true })
  ).toBeVisible()
  await dialog.getByRole("button", { name: "Terima semua" }).click()
  await expect(
    dialog.getByText("Rakmu penuh. Hapus buku lain dulu untuk memberi tempat.")
  ).toBeVisible()
})

test("deleting the account removes the member's book files", async ({
  page,
}) => {
  const member = await openShelf(page)
  const userId = await userIdOf(member.email)
  const dialog = await bringBooks(
    page,
    await epubFile("milikku.epub", {
      title: "Buku Milikku",
      author: "Penulis Uji",
      subjects: [],
    })
  )
  await expect(dialog.getByText("Buku Milikku", { exact: true })).toBeVisible()
  await acceptAll(dialog)

  const files = async () =>
    (await admin().storage.from("books").list(userId)).data ?? []
  await expect.poll(async () => (await files()).length).toBe(2)

  await page.goto("/settings")
  await hydrated(page)
  await page
    .getByLabel("Ketik nama penggunamu untuk konfirmasi")
    .fill(member.username)
  await page.getByRole("button", { name: "Hapus akun saya permanen" }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await files()).length).toBe(0)
})
