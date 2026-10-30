import { Fragment } from "react"
import { Button } from "@/components/ui/button"
import { POS_LABELS } from "@/lib/words/labels"
import type { DictSource, LookupResult } from "@/lib/words/types"
import { ReaderPopup, type WordRect } from "./ReaderPopup"
import type { WordLookupState } from "./useWordLookup"

export type { WordRect } from "./ReaderPopup"

/** A tapped word and what Simpan keeps with it (spec 2 §6.2). */
export type WordTap = {
  word: string
  sentence: string
  next: Array<string>
  cfi: string | null
  rect: WordRect
}

const WIKTIONARY = "https://en.wiktionary.org/wiki/"
const WORDNET_BAHASA = "https://wn-msa.sourceforge.net/"
const SOURCE_ORDER: ReadonlyArray<DictSource> = ["wiktionary", "wordnet", "ai"]

/**
 * Where the shown meanings came from (spec kamus tiga sumber §5), on one
 * line in a fixed order. Entries cached before the source column came are
 * Wiktionary's, and so are phrasal verbs and phrases.
 */
function Credit({ result, page }: { result: LookupResult; page: string }) {
  const used = new Set<DictSource>(
    result.entries.map((entry) => entry.source ?? "wiktionary")
  )
  if (result.phrases.length > 0) used.add("wiktionary")
  const sources = SOURCE_ORDER.filter((source) => used.has(source))
  if (sources.length === 0) return null
  return (
    <p className="word-credit">
      {sources.map((source, i) => (
        <Fragment key={source}>
          {i > 0 && " · "}
          {source === "wiktionary" && (
            <a
              href={`${WIKTIONARY}${encodeURIComponent(page)}`}
              target="_blank"
              rel="noreferrer"
            >
              Wiktionary · CC BY-SA
            </a>
          )}
          {source === "wordnet" && (
            <a href={WORDNET_BAHASA} target="_blank" rel="noreferrer">
              WordNet Bahasa
            </a>
          )}
          {source === "ai" && "Dibuat AI"}
        </Fragment>
      ))}
    </p>
  )
}

type CardProps = {
  tap: WordTap
  lookup: WordLookupState
  saved: boolean
  onToggleSave: () => void
  onRetry: () => void
}

function Meanings({
  result,
  base,
}: {
  result: LookupResult
  base: string | null
}) {
  return (
    <>
      {result.phrases.map((phrase) => (
        <section key={phrase.headword} className="word-sense">
          <h3>
            <span className="font-bold">{phrase.headword}</span>{" "}
            <span className="word-tag">frasa</span>
          </h3>
          <p>{phrase.meanings.join(", ")}</p>
        </section>
      ))}
      {result.entries.map((entry) => (
        <section key={`${entry.headword} ${entry.pos}`} className="word-sense">
          <h3 className="word-pos">
            {entry.headword === base
              ? POS_LABELS[entry.pos]
              : `${POS_LABELS[entry.pos]} · ${entry.headword}`}
          </h3>
          <p>{entry.meanings.join(", ")}</p>
        </section>
      ))}
    </>
  )
}

function WordCard({ tap, lookup, saved, onToggleSave, onRetry }: CardProps) {
  const result = lookup.kind === "result" ? lookup.result : null
  const base = result?.entries.at(0)?.headword ?? null
  const empty =
    result !== null &&
    result.entries.length === 0 &&
    result.phrases.length === 0
  return (
    <div className="word-card">
      <p className="word-head">
        <span className="font-heading text-xl font-bold">{tap.word}</span>
        {base && base !== tap.word && (
          <span className="text-muted-foreground">→ {base}</span>
        )}
      </p>
      {lookup.kind === "loading" && lookup.slow && (
        <div aria-hidden="true" className="word-skeleton">
          <span />
          <span />
        </div>
      )}
      {lookup.kind === "offline" && (
        <p className="word-note">Arti butuh koneksi</p>
      )}
      {lookup.kind === "failed" && (
        <div className="word-note">
          <p>Arti tidak bisa dimuat</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Coba lagi
          </Button>
        </div>
      )}
      {empty && <p className="word-note">Belum ada arti untuk kata ini</p>}
      {result && <Meanings result={result} base={base} />}
      <div className="word-actions">
        <Button
          size="lg"
          aria-pressed={saved}
          disabled={lookup.kind === "loading"}
          onClick={onToggleSave}
        >
          {saved ? "Tersimpan" : "Simpan"}
        </Button>
        {result && <Credit result={result} page={base ?? tap.word} />}
      </div>
    </div>
  )
}

/**
 * A tapped word's meanings (spec 2 §6.3): a popover beside the word on wide
 * screens, a bottom sheet on phones.
 */
export function WordPopup({
  tap,
  onClose,
  finalFocus,
  ...card
}: Omit<CardProps, "tap"> & {
  tap: WordTap | null
  onClose: () => void
  finalFocus: () => HTMLElement | null
}) {
  if (!tap) return null
  return (
    <ReaderPopup
      rect={tap.rect}
      label={`Arti ${tap.word}`}
      onClose={onClose}
      finalFocus={finalFocus}
    >
      <WordCard tap={tap} {...card} />
    </ReaderPopup>
  )
}
