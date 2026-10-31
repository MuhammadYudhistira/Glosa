import { afterEach, describe, expect, it, vi } from "vitest"
import {
  canCopyImage,
  canShareFiles,
  cardFileName,
  copyCard,
  saveCard,
  shareCard,
  shareText,
} from "./share"

const file = new File(["png"], "glosa-a.png", { type: "image/png" })

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("canShareFiles", () => {
  it("asks the browser whether a PNG can be shared", () => {
    expect(canShareFiles({})).toBe(false)
    expect(canShareFiles({ canShare: () => true, share: vi.fn() })).toBe(true)
    expect(canShareFiles({ canShare: () => false, share: vi.fn() })).toBe(false)
    expect(
      canShareFiles({
        canShare: () => {
          throw new TypeError("no files")
        },
        share: vi.fn(),
      })
    ).toBe(false)
  })
})

describe("canCopyImage", () => {
  it("needs ClipboardItem and clipboard.write", () => {
    const clipboard = { write: vi.fn() } as unknown as Clipboard
    expect(canCopyImage({ clipboard })).toBe(false)
    vi.stubGlobal("ClipboardItem", class {})
    expect(canCopyImage({ clipboard })).toBe(true)
    expect(canCopyImage({})).toBe(false)
  })
})

describe("shareCard", () => {
  it("copies the link, then opens the share sheet with the card and the text", async () => {
    const writeText = vi.fn(async () => undefined)
    const share = vi.fn(async () => undefined)
    const clipboard = { writeText } as unknown as Clipboard
    const result = await shareCard(file, "Dari A", "https://glos-a.tech", {
      clipboard,
      share,
    })
    expect(result).toBe("shared")
    expect(writeText).toHaveBeenCalledWith("https://glos-a.tech")
    expect(share).toHaveBeenCalledWith({ files: [file], text: "Dari A" })
    expect(writeText.mock.invocationCallOrder[0]).toBeLessThan(
      share.mock.invocationCallOrder[0]
    )
  })

  it("shares even when the link cannot be copied", async () => {
    const clipboard = {
      writeText: vi.fn(async () => {
        throw new Error("denied")
      }),
    } as unknown as Clipboard
    const share = vi.fn(async () => undefined)
    await expect(shareCard(file, "t", "l", { clipboard, share })).resolves.toBe(
      "shared"
    )
    await expect(shareCard(file, "t", "l", { share })).resolves.toBe("shared")
  })

  it("tells when the link was copied, and not when it was refused", async () => {
    const share = vi.fn(async () => undefined)
    const copied = vi.fn()
    const clipboard = { writeText: vi.fn(async () => undefined) }
    await shareCard(
      file,
      "t",
      "l",
      { clipboard: clipboard as unknown as Clipboard, share },
      copied
    )
    await vi.waitFor(() => expect(copied).toHaveBeenCalledTimes(1))
    const refused = vi.fn()
    const denied = {
      writeText: vi.fn(async () => {
        throw new Error("denied")
      }),
    }
    await shareCard(
      file,
      "t",
      "l",
      { clipboard: denied as unknown as Clipboard, share },
      refused
    )
    await Promise.resolve()
    expect(refused).not.toHaveBeenCalled()
  })

  it("fails, not throws, when the sheet rejects with nothing", async () => {
    await expect(
      shareCard(file, "t", "l", {
        share: vi.fn(() => Promise.reject(undefined)),
      })
    ).resolves.toBe("failed")
    await expect(
      shareCard(file, "t", "l", { share: vi.fn(() => Promise.reject(null)) })
    ).resolves.toBe("failed")
  })

  it("tells a closed sheet from a failure", async () => {
    const cancel = vi.fn(async () => {
      throw new DOMException("closed", "AbortError")
    })
    await expect(shareCard(file, "t", "l", { share: cancel })).resolves.toBe(
      "cancelled"
    )
    const fail = vi.fn(async () => {
      throw new DOMException("no", "NotAllowedError")
    })
    await expect(shareCard(file, "t", "l", { share: fail })).resolves.toBe(
      "failed"
    )
    await expect(shareCard(file, "t", "l", {})).resolves.toBe("failed")
  })
})

describe("copyCard", () => {
  it("writes the PNG to the clipboard", async () => {
    vi.stubGlobal(
      "ClipboardItem",
      class {
        constructor(readonly items: Record<string, Blob>) {}
      }
    )
    const write = vi.fn(async () => undefined)
    const clipboard = { write } as unknown as Clipboard
    await expect(copyCard(file, { clipboard })).resolves.toBe(true)
    expect(write).toHaveBeenCalledTimes(1)
    const failing = {
      write: vi.fn(async () => {
        throw new Error("denied")
      }),
    } as unknown as Clipboard
    await expect(copyCard(file, { clipboard: failing })).resolves.toBe(false)
    await expect(copyCard(file, {})).resolves.toBe(false)
  })
})

describe("saveCard", () => {
  it("downloads the PNG under its name", () => {
    URL.createObjectURL = vi.fn(() => "blob:card")
    URL.revokeObjectURL = vi.fn()
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe("glosa-a.png")
        expect(this.href).toBe("blob:card")
      })
    saveCard(file, "glosa-a.png")
    expect(click).toHaveBeenCalledTimes(1)
    expect(document.querySelector("a[download]")).toBeNull()
  })
})

describe("names and text", () => {
  it("names the file after the book", () => {
    expect(cardFileName("A Scandal in Bohemia")).toBe(
      "glosa-a-scandal-in-bohemia.png"
    )
    expect(cardFileName("Café Société")).toBe("glosa-cafe-societe.png")
    expect(cardFileName("!!!")).toBe("glosa-kutipan.png")
    expect(cardFileName("word ".repeat(30)).length).toBeLessThanOrEqual(
      "glosa-".length + 40 + ".png".length
    )
  })

  it("says where the card comes from", () => {
    expect(shareText("A Scandal in Bohemia", "https://glos-a.tech")).toBe(
      "Dari A Scandal in Bohemia, dibaca di Glosa → https://glos-a.tech"
    )
  })
})
