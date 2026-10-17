// Put six scanned faces together into a cube. Faces can be scanned in any
// order and any way up: each face is identified by its centre colour, and
// quarter-turns are tried until every piece fits.

import {
  COLOR_NAMES,
  CORNER_SLOTS,
  EDGE_SLOTS,
  FACES,
  SCHEME,
  STICKERS,
  faceIndex,
  type Color,
  type Cube,
  type Face,
} from './cube'
import { validate } from './validate'

/** A face as photographed: 9 colours, row by row. */
export type Grid = Color[]

const COLORS: Color[] = ['W', 'Y', 'G', 'B', 'R', 'O']

/** Quarter-turn a 3x3 grid clockwise. */
export const rotateGrid = (g: Grid): Grid =>
  [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => g[(2 - (i % 3)) * 3 + Math.floor(i / 3)])

const MIRRORED: Record<Face, Color> = { ...SCHEME, R: SCHEME.L, L: SCHEME.R }

/** `alternatives` holds every cube that fits the photos (rarely two, differing in how one face is turned). */
export type Assembled = { cube: Cube; ambiguous: boolean; alternatives: Cube[] } | { error: string }

const SLOTS = [...EDGE_SLOTS, ...CORNER_SLOTS]
const faceOfSticker = (i: number) => FACES.indexOf(STICKERS[i].face)

/** Pieces (as "colour string in slot order, rotated to start smallest") that a cube with this scheme has. */
function pieceKeys(scheme: Record<Face, Color>) {
  const key = (cols: string[]) => {
    const rots = cols.map((_, k) => [...cols.slice(k), ...cols.slice(0, k)].join(''))
    return rots.sort()[0]
  }
  return { key, valid: new Set(SLOTS.map((s) => key(s.map((i) => scheme[STICKERS[i].face])))) }
}

function solveScheme(grids: Grid[], scheme: Record<Face, Color>, found: Cube[]) {
  const faceOf = (c: Color) => FACES.find((f) => scheme[f] === c)!
  const { key, valid } = pieceKeys(scheme)
  const options = grids
    .map((g) => {
      const rots = [g]
      for (let k = 1; k < 4; k++) rots.push(rotateGrid(rots[k - 1]))
      return { face: faceIndex(faceOf(g[4])), rots }
    })
    .sort((a, b) => a.face - b.face)
  // Slots that become fully known once faces 0..n have been placed.
  const completeAt = options.map((_, n) => {
    const placed = new Set(options.slice(0, n + 1).map((o) => o.face))
    const before = new Set(options.slice(0, n).map((o) => o.face))
    return SLOTS.filter(
      (s) => s.every((i) => placed.has(faceOfSticker(i))) && !s.every((i) => before.has(faceOfSticker(i))),
    )
  })
  const cube = new Array<Color>(54)
  const used = new Set<string>()
  const walk = (n: number) => {
    if (found.length > 3) return
    if (n === 6) {
      if (validate(cube).length === 0 && !found.some((f) => f.every((c, i) => c === cube[i]))) found.push(cube.slice())
      return
    }
    for (const r of options[n].rots) {
      r.forEach((c, i) => (cube[options[n].face * 9 + i] = c))
      const added: string[] = []
      let ok = true
      for (const s of completeAt[n]) {
        const k = key(s.map((i) => cube[i]))
        if (!valid.has(k) || used.has(k)) {
          ok = false
          break
        }
        used.add(k)
        added.push(k)
      }
      if (ok) walk(n + 1)
      added.forEach((k) => used.delete(k))
    }
  }
  walk(0)
}

export function assemble(grids: Grid[]): Assembled {
  if (grids.length !== 6) return { error: `Scan all six faces (${grids.length} so far).` }

  const counts = COLORS.map((c) => grids.flat().filter((x) => x === c).length)
  const off = COLORS.filter((_, k) => counts[k] !== 9)
  if (off.length)
    return {
      error: `The colours don’t add up: ${off.map((c) => `${counts[COLORS.indexOf(c)]} ${COLOR_NAMES[c]}`).join(', ')} (each should be 9). Tap any wrong squares to fix them.`,
    }

  const centres = grids.map((g) => g[4])
  const dup = COLORS.find((c) => centres.filter((x) => x === c).length > 1)
  if (dup) return { error: `Two faces have a ${COLOR_NAMES[dup]} centre — one face was probably scanned twice.` }

  const found: Cube[] = []
  solveScheme(grids, SCHEME, found)
  if (!found.length) solveScheme(grids, MIRRORED, found)

  if (!found.length)
    return {
      error:
        'These colours don’t make a real cube. Compare each face with its photo and tap any squares that are wrong — red/orange and white/yellow are the usual mix-ups.',
    }
  return { cube: found[0], ambiguous: found.length > 1, alternatives: found }
}
