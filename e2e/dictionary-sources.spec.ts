import { expect, test } from "@playwright/test"
import { seedBook } from "./helpers/books"
import { removeWord, seedWord, testWord } from "./helpers/dictionary"
import { makeEpub } from "./helpers/epub"
import {
  createConfirmedMember,
  signInAndOnboard,
  userIdOf,
} from "./helpers/members"
import { pointOf } from "./helpers/reading"

const BOOK = { title: "Buku Kamus", author: "Penguji" }

// Spec kamus tiga sumber §7: a meaning from the AI says so in the popup.
test("a meaning made by AI is credited as such", async ({ page, isMobile }) => {
  test.setTimeout(90_000)
  const word = testWord()
  await seedWord({
    headword: word,
    pos: "noun",
    meanings: ["arti percobaan"],
    source: "ai",
  })
  try {
    const member = await createConfirmedMember()
    await signInAndOnboard(page, member)
    const bookId = await seedBook(await userIdOf(member.email), {
      ...BOOK,
      file: await makeEpub({
        ...BOOK,
        subjects: [],
        cover: false,
        body: `<h1>Bab 1</h1><p>Di sini ada <span id="w">${word}</span> saja.</p>`,
      }),
    })
    await page.goto(`/read/${bookId}`)
    await expect(
      page.getByRole("status", { name: "Posisi baca", includeHidden: true })
    ).toHaveText(/^\d+%$/, { timeout: 30_000 })

    const { x, y } = await pointOf(page, "w")
    if (isMobile) await page.touchscreen.tap(x, y)
    else await page.mouse.click(x, y)

    const popup = page.getByRole("dialog", { name: `Arti ${word}` })
    await expect(popup.getByText("arti percobaan")).toBeVisible()
    await expect(popup.getByText("Dibuat AI", { exact: true })).toBeVisible()
    await expect(
      popup.getByRole("link", { name: "Wiktionary · CC BY-SA" })
    ).toHaveCount(0)
  } finally {
    await removeWord(word)
  }
})
