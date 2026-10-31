/** From here on the reader asks whether the book is finished (spec Tahap 3 §4.4). */
export const FINISH_FRACTION = 0.95

/**
 * Whether the reader asks "Sudah selesai membaca buku ini?": once the member
 * reaches the end of the last section in the reading order, or 95% of the
 * book, unless the book is finished or the member already said "Belum".
 */
export function shouldAskFinish(
  book: { finished: boolean; finishDeclined: boolean },
  place: { fraction: number; atBookEnd: boolean }
): boolean {
  if (book.finished || book.finishDeclined) return false
  return place.atBookEnd || place.fraction >= FINISH_FRACTION
}
