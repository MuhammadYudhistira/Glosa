import { GENRE_VALUES, type Genre } from "@/lib/genre"
import { type Point3, SHELF, WALL_SECTIONS } from "./layout"

/**
 * The books on the genre shelves, as data (spec 3F §3.2). Pure: no three.js,
 * so React and the tests can use it; shelves.ts draws it.
 */

/** Per genre, the hue (0..360) of each book's cover, the newest book first. */
export type GenreHues = Record<Genre, ReadonlyArray<number>>

/** Hues for every genre, from what `of` gives each. */
export function genreHues(
  of: (genre: Genre, index: number) => ReadonlyArray<number>
): GenreHues {
  return Object.fromEntries(
    GENRE_VALUES.map((genre, i) => [genre, of(genre, i)])
  ) as Record<string, ReadonlyArray<number>> as GenreHues
}

export const EMPTY_HUES: GenreHues = genreHues(() => [])

/** One book standing on a shelf: its centre, its size (X deep, Y tall, Z thick) and its hue. */
export type BookInstance = { position: Point3; size: Point3; hue: number }

/** How far each book reaches into the shelf (X); it leans on the back panel. */
const BOOK_DEPTH = 0.3
/** The centre of every book on X. */
const BOOK_X = 0.2
/** Room left at each end of a shelf, clear of the dividers. */
const END = 0.05
/** The shelf boards above the lowest stand this much proud of their row line. */
const BOARD_TOP = 0.02

/** A fixed pseudo-random value in [0, 1) for book `i` (Knuth's multiplicative hash). */
const h = (i: number) => ((i * 2654435761) >>> 0) / 2 ** 32

type Spot = { y: number; z: number; size: Point3 }

/**
 * Where up to `count` books stand in a section `width` wide, measured from
 * its left edge: the lowest shelf first, left to right, each book as thick
 * and tall as its index says. Stops when the top shelf is full.
 */
function fill(width: number, count: number): Array<Spot> {
  const { bottom, top, rows } = SHELF
  const step = (top - bottom) / rows
  const length = width - 2 * END
  const spots: Array<Spot> = []
  let row = 0
  let along = 0
  for (let i = 0; i < count; i++) {
    const thick = 0.04 + 0.03 * h(i)
    const tall = 0.28 + 0.16 * h(i + 7)
    if (along + thick > length) {
      row++
      along = 0
    }
    if (row >= rows) break
    const base = bottom + row * step + (row > 0 ? BOARD_TOP : 0)
    spots.push({
      y: base + tall / 2,
      z: END + along + thick / 2,
      size: [BOOK_DEPTH, tall, thick],
    })
    along += thick
  }
  return spots
}

/** The most books one section holds, counted by filling one to the top. */
export const SECTION_CAPACITY: number = Math.min(
  ...WALL_SECTIONS.map(({ width }) => fill(width, 1000).length)
)

/**
 * The books of one genre section: one per hue, the newest (first) at the
 * bottom left; hues past the capacity are left out. Pure and deterministic.
 */
export function sectionBooks(
  section: { genre: Genre; z: number; width: number },
  hues: ReadonlyArray<number>
): Array<BookInstance> {
  const left = section.z - section.width / 2
  return fill(section.width, Math.min(hues.length, SECTION_CAPACITY)).map(
    ({ y, z, size }, i) => ({
      position: [BOOK_X, y, left + z],
      size,
      hue: hues[i],
    })
  )
}
