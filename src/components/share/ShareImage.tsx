import { useEffect, useRef, useState } from "react"
import { Segments } from "@/components/reader/QuoteCardDialog"
import { Button } from "@/components/ui/button"
import { decodeCover } from "@/lib/quote-card/cover-art"
import { drawCard } from "@/lib/quote-card/draw"
import { cardFontsReady } from "@/lib/quote-card/fonts"
import {
  CARD_DIMENSIONS,
  type CardLayout,
  type CardSize,
  type Measure,
} from "@/lib/quote-card/layout"
import { loadCardPrefs, saveCardPrefs } from "@/lib/quote-card/prefs"
import {
  canCopyImage,
  canShareFiles,
  cardFileName,
  copyCard,
  saveCard,
  shareCard,
  shareText,
} from "@/lib/quote-card/share"
import { CARD_THEMES, THEMES } from "@/lib/quote-card/themes"

const PNG_DELAY_MS = 250
const IMAGE_UNAVAILABLE = "Gambar belum bisa dibuat. Coba lagi."
const LINK_COPIED = "Link Glosa sudah disalin, tempel di stiker Link Instagram."
const SIZE_OPTIONS: ReadonlyArray<[CardSize, string]> = [
  ["story", "Story"],
  ["square", "Persegi"],
]

type Decoded = {
  images: Array<CanvasImageSource>
  palette: Array<string> | null
}

/**
 * A share image of the finished-book card or the recap (spec 3E §3.3, §5.3):
 * the quote card's engine, themes, sizes and sharing, for a layout the caller
 * builds. Theme and size are the choices of the quote card (same storage).
 * `build` must be stable (useCallback) so the image is not redrawn each render.
 */
export function ShareImage({
  label,
  description,
  fileTitle,
  seed,
  covers,
  build,
}: {
  label: string
  description: string
  fileTitle: string
  seed: string
  covers: ReadonlyArray<() => Promise<Blob | null>>
  build: (size: CardSize, measure: Measure, coverCount: number) => CardLayout
}) {
  const [prefs, setPrefs] = useState(loadCardPrefs)
  const [fontsReady, setFontsReady] = useState(false)
  const [art, setArt] = useState<Decoded>({ images: [], palette: null })
  const [png, setPng] = useState<Blob | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [shareable] = useState(() => canShareFiles())
  const [copyable] = useState(() => canCopyImage())

  useEffect(() => {
    let live = true
    void cardFontsReady().then(() => {
      if (live) setFontsReady(true)
    })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    let live = true
    void Promise.all(
      covers.map((load) =>
        load()
          .then((blob) => (blob ? decodeCover(blob) : null))
          .catch(() => null)
      )
    ).then((decoded) => {
      if (!live) return
      const found = decoded.flatMap((item) => (item ? [item] : []))
      setArt({
        images: found.map((item) => item.image),
        palette: found[0]?.palette ?? null,
      })
    })
    return () => {
      live = false
    }
    // The loaders are made once per dialog.
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !fontsReady) return
    const context = canvas.getContext("2d")
    if (!context) return
    const { width, height } = CARD_DIMENSIONS[prefs.size]
    canvas.width = width
    canvas.height = height
    const measure: Measure = (text, name) => {
      context.font = name
      return context.measureText(text).width
    }
    drawCard(
      context,
      build(prefs.size, measure, art.images.length),
      prefs.theme,
      {
        cover: art.images[0] ?? null,
        covers: art.images,
        palette: art.palette,
        seed,
      }
    )
    setPng(null)
    let live = true
    const timer = setTimeout(() => {
      canvas.toBlob((blob) => {
        if (!live) return
        setPng(blob)
        setNotice((current) =>
          blob
            ? current === IMAGE_UNAVAILABLE
              ? null
              : current
            : IMAGE_UNAVAILABLE
        )
      }, "image/png")
    }, PNG_DELAY_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [build, prefs.size, prefs.theme, art, fontsReady, seed])

  const change = (next: Partial<typeof prefs>) => {
    const merged = { ...prefs, ...next }
    saveCardPrefs(merged)
    setPrefs(merged)
  }
  const fileName = cardFileName(fileTitle)
  const share = () => {
    if (!png || pending) return
    setPending(true)
    void shareCard(
      new File([png], fileName, { type: "image/png" }),
      shareText(fileTitle, location.origin),
      location.origin,
      navigator,
      () => setNotice(LINK_COPIED)
    ).then((result) => {
      setPending(false)
      if (result === "failed")
        setNotice("Belum bisa dibagikan. Coba Simpan gambar.")
    })
  }

  return (
    <>
      <div className="quote-body" role="group" aria-label={label}>
        <div className="quote-preview">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={description}
            className={`quote-canvas quote-canvas-${prefs.size}`}
          />
        </div>
        <div className="quote-controls">
          <Segments
            label="Ukuran"
            options={SIZE_OPTIONS}
            value={prefs.size}
            onChange={(size) => change({ size })}
          />
          <div>
            <p className="quote-label">Tema</p>
            <div role="group" aria-label="Tema" className="quote-themes">
              {CARD_THEMES.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-label={`Tema ${THEMES[id].label}`}
                  aria-pressed={prefs.theme === id}
                  className={`quote-swatch quote-swatch-${id}`}
                  onClick={() => change({ theme: id })}
                />
              ))}
            </div>
          </div>
          <p role="status" className="quote-note">
            {notice}
          </p>
        </div>
      </div>
      <div className="quote-actions">
        {copyable && (
          <Button
            size="lg"
            variant="outline"
            disabled={!png}
            onClick={() =>
              png &&
              void copyCard(png).then((copied) =>
                setNotice(
                  copied
                    ? "Gambar sudah disalin."
                    : "Gambar belum bisa disalin. Coba Simpan gambar."
                )
              )
            }
          >
            Salin gambar
          </Button>
        )}
        <Button
          size="lg"
          variant="outline"
          disabled={!png}
          onClick={() => png && saveCard(png, fileName)}
        >
          Simpan gambar
        </Button>
        {shareable && (
          <Button size="lg" disabled={!png || pending} onClick={share}>
            Bagikan
          </Button>
        )}
      </div>
    </>
  )
}
