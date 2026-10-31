import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { drawCard } from "@/lib/quote-card/draw"
import { cardFontsReady } from "@/lib/quote-card/fonts"
import {
  CARD_DIMENSIONS,
  type CardHit,
  type CardInput,
  type CardLayoutKind,
  type CardSize,
  layoutCard,
} from "@/lib/quote-card/layout"
import {
  type CardPrefs,
  loadCardPrefs,
  saveCardPrefs,
} from "@/lib/quote-card/prefs"
import {
  defaultWord,
  prepareQuote,
  quoteTokens,
} from "@/lib/quote-card/quote-text"
import {
  canCopyImage,
  canShareFiles,
  cardFileName,
  copyCard,
  saveCard,
  shareCard,
  shareText,
} from "@/lib/quote-card/share"
import { CARD_THEMES, THEMES, coverPalette } from "@/lib/quote-card/themes"
import type { ReaderBook } from "@/lib/reader-types"
import { useWideScreen } from "@/lib/use-wide-screen"
import { POS_LABELS } from "@/lib/words/labels"
import { type LookupOutcome, lookUp } from "@/lib/words/lookup"
import type { SavedForms } from "@/lib/words/saved-marks"
import type { LookupEntry } from "@/lib/words/types"

/** Meanings a card carries at most (spec kartu kutipan, decision 3). */
const MAX_CARD_MEANINGS = 3
/** The PNG is made this long after the last change, ready before Bagikan is tapped. */
const PNG_DELAY_MS = 250
/** The cover is shrunk to this many pixels a side to read its colours. */
const PALETTE_SIZE = 12

const LAYOUT_OPTIONS: ReadonlyArray<[CardLayoutKind, string]> = [
  ["glosa", "Glosa"],
  ["kutipan", "Kutipan"],
]
const SIZE_OPTIONS: ReadonlyArray<[CardSize, string]> = [
  ["story", "Story"],
  ["square", "Persegi"],
]

type WordState =
  | { kind: "none" }
  | { kind: "loading"; token: number }
  | {
      kind: "ready"
      token: number
      entries: Array<LookupEntry>
      /** The entry (part of speech) the meanings come from. */
      entry: number
      meanings: Array<string>
    }
type Art = { cover: ImageBitmap | null; palette: Array<string> | null }

const lookUpWord = (word: string) => lookUp(word, [])

function paletteOf(bitmap: ImageBitmap): Array<string> | null {
  try {
    const small = document.createElement("canvas")
    small.width = PALETTE_SIZE
    small.height = PALETTE_SIZE
    const context = small.getContext("2d")
    if (!context) return null
    context.drawImage(bitmap, 0, 0, PALETTE_SIZE, PALETTE_SIZE)
    const { data } = context.getImageData(0, 0, PALETTE_SIZE, PALETTE_SIZE)
    return coverPalette(data, PALETTE_SIZE, PALETTE_SIZE)
  } catch {
    return null
  }
}

function Segments<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: ReadonlyArray<[T, string]>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div>
      <p className="quote-label">{label}</p>
      <div role="group" aria-label={label} className="quote-segment">
        {options.map(([option, name]) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Bagikan kutipan (spec kartu kutipan §4): a card of the quote drawn on a
 * canvas, a word of it highlighted with meanings from the dictionary, to
 * share, save or copy. Give it a `key` per quote.
 */
export function QuoteCardDialog({
  quote,
  book,
  savedForms,
  loadCover,
  onClose,
  finalFocus,
  lookup = lookUpWord,
}: {
  quote: string | null
  book: ReaderBook
  savedForms: SavedForms
  loadCover: () => Promise<Blob | null>
  onClose: () => void
  finalFocus: () => HTMLElement | null
  lookup?: (word: string) => Promise<LookupOutcome>
}) {
  const wide = useWideScreen()
  const prepared = useMemo(() => prepareQuote(quote ?? ""), [quote])
  const tokens = useMemo(() => quoteTokens(prepared.text), [prepared])
  const [prefs, setPrefs] = useState<CardPrefs>(loadCardPrefs)
  const [word, setWord] = useState<WordState>(() => {
    const token = defaultWord(tokens, savedForms)
    return token === null ? { kind: "none" } : { kind: "loading", token }
  })
  const [notice, setNotice] = useState<string | null>(null)
  const [art, setArt] = useState<Art>({ cover: null, palette: null })
  const [fontsReady, setFontsReady] = useState(false)
  const [png, setPng] = useState<Blob | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hitsRef = useRef<Array<CardHit>>([])
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
    let bitmap: ImageBitmap | null = null
    loadCover()
      .then(async (blob) => {
        if (!blob || !("createImageBitmap" in globalThis)) return
        bitmap = await createImageBitmap(blob)
        if (live) setArt({ cover: bitmap, palette: paletteOf(bitmap) })
        else bitmap.close()
      })
      .catch(() => undefined)
    return () => {
      live = false
      bitmap?.close()
    }
  }, [loadCover])

  useEffect(() => {
    if (word.kind !== "loading") return
    let live = true
    void lookup(tokens[word.token].word ?? "").then((outcome) => {
      if (!live) return
      if (outcome.kind !== "result") {
        setNotice("Arti belum bisa dimuat.")
        setWord({ kind: "none" })
        return
      }
      const entries = outcome.result.entries.filter(
        (entry) => entry.meanings.length > 0
      )
      if (entries.length === 0) {
        setNotice("Belum ada arti untuk kata ini.")
        setWord({ kind: "none" })
        return
      }
      setWord({
        kind: "ready",
        token: word.token,
        entries,
        entry: 0,
        meanings: [entries[0].meanings[0]],
      })
    })
    return () => {
      live = false
    }
  }, [word, tokens, lookup])

  const chosen = word.kind === "ready" ? word : null
  const input = useMemo((): CardInput => {
    const entry = chosen ? chosen.entries[chosen.entry] : null
    return {
      layout: prefs.layout,
      size: prefs.size,
      tokens,
      highlight: chosen ? chosen.token : null,
      word:
        chosen && entry
          ? {
              label: entry.headword,
              pos: POS_LABELS[entry.pos],
              meanings: chosen.meanings.join(", "),
            }
          : null,
      title: book.title,
      author: book.author,
      hasCover: art.cover !== null,
      host: location.host,
    }
  }, [
    prefs.layout,
    prefs.size,
    tokens,
    chosen,
    book.title,
    book.author,
    art.cover,
  ])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !fontsReady) return
    const context = canvas.getContext("2d")
    if (!context) return
    const { width, height } = CARD_DIMENSIONS[input.size]
    canvas.width = width
    canvas.height = height
    const measure = (text: string, name: string) => {
      context.font = name
      return context.measureText(text).width
    }
    const layout = layoutCard(input, measure)
    hitsRef.current = layout.hits
    drawCard(context, layout, prefs.theme, {
      cover: art.cover,
      palette: art.palette,
      seed: book.id,
    })
    setPng(null)
    let live = true
    const timer = setTimeout(() => {
      canvas.toBlob((blob) => {
        if (!live) return
        setPng(blob)
        if (!blob) setNotice("Gambar belum bisa dibuat. Coba lagi.")
      }, "image/png")
    }, PNG_DELAY_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [input, prefs.theme, art, fontsReady, book.id])

  if (quote === null) return null

  const change = (next: Partial<CardPrefs>) => {
    const merged = { ...prefs, ...next }
    saveCardPrefs(merged)
    setPrefs(merged)
  }
  const pick = (token: number | null) => {
    setNotice(null)
    if (token === null) setWord({ kind: "none" })
    else if (tokens[token]?.word) setWord({ kind: "loading", token })
  }
  const toggleMeaning = (entry: number, meaning: string) => {
    if (word.kind !== "ready") return
    if (entry !== word.entry) {
      setWord({ ...word, entry, meanings: [meaning] })
      return
    }
    const picked = new Set(word.meanings)
    if (picked.has(meaning)) {
      if (picked.size === 1) return
      picked.delete(meaning)
    } else {
      if (picked.size >= MAX_CARD_MEANINGS) return
      picked.add(meaning)
    }
    const order = word.entries[entry].meanings
    setWord({
      ...word,
      meanings: order.filter((candidate) => picked.has(candidate)),
    })
  }
  const onPreviewClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    const box = canvas.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return
    const x = ((event.clientX - box.left) * canvas.width) / box.width
    const y = ((event.clientY - box.top) * canvas.height) / box.height
    const hit = hitsRef.current.find(
      (candidate) =>
        x >= candidate.x &&
        x <= candidate.x + candidate.width &&
        y >= candidate.y &&
        y <= candidate.y + candidate.height
    )
    if (hit) pick(hit.token)
  }
  const fileOf = (blob: Blob) =>
    new File([blob], cardFileName(book.title), { type: "image/png" })
  const share = () => {
    if (!png) return
    setNotice("Link Glosa sudah disalin, tempel di stiker Link Instagram.")
    void shareCard(
      fileOf(png),
      shareText(book.title, location.origin),
      location.origin
    ).then((result) => {
      if (result === "failed")
        setNotice("Gagal membagikan. Coba Simpan gambar.")
    })
  }
  const save = () => {
    if (png) saveCard(png, cardFileName(book.title))
  }
  const copy = () => {
    if (!png) return
    void copyCard(png).then((copied) => {
      setNotice(
        copied
          ? "Gambar sudah disalin."
          : "Gagal menyalin gambar. Coba Simpan gambar."
      )
    })
  }

  const lit = word.kind === "none" ? null : word.token
  const description = `Kartu kutipan: “${prepared.text}”${
    input.word
      ? `. ${input.word.label}, ${input.word.pos}: ${input.word.meanings}`
      : ""
  }`

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="word-sheet-backdrop" />
        <DialogPrimitive.Popup
          aria-label="Bagikan kutipan"
          className={wide ? "quote-dialog" : "quote-sheet"}
          finalFocus={finalFocus}
        >
          <div className="quote-head">
            <DialogPrimitive.Title className="font-heading text-lg">
              Bagikan kutipan
            </DialogPrimitive.Title>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Tutup"
              onClick={onClose}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
          <div className="quote-body">
            <div className="quote-preview">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={description}
                className={`quote-canvas quote-canvas-${prefs.size}`}
                onClick={onPreviewClick}
              />
              <p className="quote-hint">
                Ketuk kata di kutipan untuk menyorotnya
              </p>
              <div
                role="group"
                aria-label="Kata di kutipan"
                className="quote-words sr-only focus-within:not-sr-only"
              >
                {tokens.map((token, i) =>
                  token.word ? (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={lit === i}
                      onClick={() => pick(i)}
                    >
                      {token.word}
                    </button>
                  ) : null
                )}
              </div>
            </div>
            <div className="quote-controls">
              <Segments
                label="Layout"
                options={LAYOUT_OPTIONS}
                value={prefs.layout}
                onChange={(layout) => change({ layout })}
              />
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
              <div className="quote-word">
                <div className="quote-word-head">
                  <span>
                    {lit === null
                      ? "Tanpa kata sorotan"
                      : `Kata: ${tokens[lit].word ?? ""}`}
                  </span>
                  {lit !== null && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => pick(null)}
                    >
                      Tanpa kata
                    </Button>
                  )}
                </div>
                {word.kind === "loading" && (
                  <div className="word-skeleton" aria-label="Memuat arti">
                    <span />
                    <span />
                  </div>
                )}
                {word.kind === "ready" && (
                  <div role="group" aria-label="Arti di kartu (pilih 1–3)">
                    <p className="quote-label">Arti di kartu (pilih 1–3)</p>
                    {word.entries.map((entry, e) => (
                      <div
                        key={`${entry.headword} ${entry.pos}`}
                        className="quote-sense"
                      >
                        <p className="quote-pos">
                          {entry.headword === tokens[word.token].word
                            ? POS_LABELS[entry.pos]
                            : `${POS_LABELS[entry.pos]} · ${entry.headword}`}
                        </p>
                        <div className="quote-chips">
                          {entry.meanings.map((meaning) => {
                            const on =
                              e === word.entry &&
                              word.meanings.includes(meaning)
                            const full =
                              e === word.entry &&
                              word.meanings.length >= MAX_CARD_MEANINGS
                            return (
                              <button
                                key={meaning}
                                type="button"
                                className="quote-chip"
                                aria-pressed={on}
                                disabled={!on && full}
                                onClick={() => toggleMeaning(e, meaning)}
                              >
                                {meaning}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {prepared.cut && (
                <p className="quote-note">
                  Kutipan dipendekkan menjadi 300 karakter.
                </p>
              )}
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
                onClick={copy}
              >
                Salin gambar
              </Button>
            )}
            <Button size="lg" variant="outline" disabled={!png} onClick={save}>
              Simpan gambar
            </Button>
            {shareable && (
              <Button size="lg" disabled={!png} onClick={share}>
                Bagikan
              </Button>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
