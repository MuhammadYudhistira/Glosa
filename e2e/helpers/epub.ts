import { randomUUID } from "node:crypto"
import { strToU8, zipSync } from "fflate"
import sharp from "sharp"

const escapeXml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

/**
 * A small valid EPUB 3 for tests: one chapter (or `chapters`), a navigation
 * document and an optional cover.
 */
export async function makeEpub(book: {
  title: string
  author: string
  subjects: ReadonlyArray<string>
  cover?: boolean
  /** The chapter's body (XHTML, epub: namespace available); by default a heading and the title. */
  body?: string
  /** Several chapters instead, each its own file and entry in the contents. */
  chapters?: ReadonlyArray<{ title: string; body: string }>
}): Promise<Buffer> {
  const chapters = book.chapters ?? [
    {
      title: "Bab 1",
      body: book.body ?? `<h1>Bab 1</h1><p>${escapeXml(book.title)}</p>`,
    },
  ]
  const cover =
    book.cover === false
      ? null
      : await sharp({
          create: {
            width: 600,
            height: 900,
            channels: 3,
            background: { r: 30, g: 70, b: 60 },
          },
        })
          .png()
          .toBuffer()
  const subjects = book.subjects
    .map((subject) => `<dc:subject>${escapeXml(subject)}</dc:subject>`)
    .join("")
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">urn:uuid:${randomUUID()}</dc:identifier>
    <dc:title>${escapeXml(book.title)}</dc:title>
    <dc:creator>${escapeXml(book.author)}</dc:creator>
    <dc:language>id</dc:language>
    ${subjects}
    <meta property="dcterms:modified">2026-10-16T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${chapters.map((_, i) => `<item id="bab${i + 1}" href="bab${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join("")}
    ${cover ? '<item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/>' : ""}
  </manifest>
  <spine>${chapters.map((_, i) => `<itemref idref="bab${i + 1}"/>`).join("")}</spine>
</package>`
  const xhtml = (title: string, body: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${escapeXml(title)}</title></head><body>${body}</body></html>`

  const files: Parameters<typeof zipSync>[0] = {
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(
      '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
    ),
    "OEBPS/content.opf": strToU8(opf),
    "OEBPS/nav.xhtml": strToU8(
      xhtml(
        "Daftar isi",
        `<nav epub:type="toc"><ol>${chapters
          .map(
            (chapter, i) =>
              `<li><a href="bab${i + 1}.xhtml">${escapeXml(chapter.title)}</a></li>`
          )
          .join("")}</ol></nav>`
      )
    ),
  }
  for (const [i, chapter] of chapters.entries())
    files[`OEBPS/bab${i + 1}.xhtml`] = strToU8(
      xhtml(chapter.title, chapter.body)
    )
  if (cover) files["OEBPS/cover.png"] = cover
  return Buffer.from(zipSync(files))
}
