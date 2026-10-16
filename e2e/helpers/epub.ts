import { randomUUID } from "node:crypto"
import { strToU8, zipSync } from "fflate"
import sharp from "sharp"

const escapeXml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

/** A small valid EPUB 3 for tests: one chapter, a navigation document and an optional cover. */
export async function makeEpub(book: {
  title: string
  author: string
  subjects: ReadonlyArray<string>
  cover?: boolean
}): Promise<Buffer> {
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
    <item id="bab1" href="bab1.xhtml" media-type="application/xhtml+xml"/>
    ${cover ? '<item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/>' : ""}
  </manifest>
  <spine><itemref idref="bab1"/></spine>
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
        '<nav epub:type="toc"><ol><li><a href="bab1.xhtml">Bab 1</a></li></ol></nav>'
      )
    ),
    "OEBPS/bab1.xhtml": strToU8(
      xhtml("Bab 1", `<h1>Bab 1</h1><p>${escapeXml(book.title)}</p>`)
    ),
  }
  if (cover) files["OEBPS/cover.png"] = cover
  return Buffer.from(zipSync(files))
}
