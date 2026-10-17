// Facelet model of a 3x3 cube. 54 stickers, face order U R F D L B, each face
// stored row-major as seen in the standard net (U with front at the bottom,
// D with front at the top, side faces with U above).
//
// Moves are derived from 3D geometry rather than hand-written tables:
// x points right, y up, z towards you (front).

export type Color = 'W' | 'Y' | 'G' | 'B' | 'R' | 'O'
/** A cube's stickers; null where a sticker's colour isn't known. */
export type Cube = (Color | null)[]
export type Vec = [number, number, number]

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const
export type Face = (typeof FACES)[number]

export const NORMALS: Record<Face, Vec> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
}

export const COLOR_NAMES: Record<Color, string> = {
  W: 'white',
  Y: 'yellow',
  G: 'green',
  B: 'blue',
  R: 'red',
  O: 'orange',
}

export const COLOR_HEX: Record<Color, string> = {
  W: '#f7f7f2',
  Y: '#ffd500',
  G: '#00a651',
  B: '#0a5bd6',
  R: '#d7262b',
  O: '#ff7a00',
}

/** The colour scheme when held white on top, green facing you. */
export const SCHEME: Record<Face, Color> = { U: 'W', R: 'R', F: 'G', D: 'Y', L: 'O', B: 'B' }

export const FACE_NAMES: Record<Face, string> = {
  U: 'top',
  D: 'bottom',
  F: 'front',
  B: 'back',
  L: 'left',
  R: 'right',
}

function stickerPos(face: Face, row: number, col: number): Vec {
  switch (face) {
    case 'U': return [col - 1, 1, row - 1]
    case 'D': return [col - 1, -1, 1 - row]
    case 'F': return [col - 1, 1 - row, 1]
    case 'B': return [1 - col, 1 - row, -1]
    case 'R': return [1, 1 - row, 1 - col]
    case 'L': return [-1, 1 - row, col - 1]
  }
}

export interface Sticker {
  index: number
  face: Face
  row: number
  col: number
  pos: Vec
  normal: Vec
}

export const STICKERS: Sticker[] = FACES.flatMap((face, f) =>
  Array.from({ length: 9 }, (_, i) => ({
    index: f * 9 + i,
    face,
    row: Math.floor(i / 3),
    col: i % 3,
    pos: stickerPos(face, Math.floor(i / 3), i % 3),
    normal: NORMALS[face],
  })),
)

const key = (p: Vec, n: Vec) => `${p.join()}|${n.join()}`
const BY_KEY = new Map(STICKERS.map((s) => [key(s.pos, s.normal), s.index]))

export const faceIndex = (face: Face) => FACES.indexOf(face)
export const centreIndex = (face: Face) => faceIndex(face) * 9 + 4

export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

/** Quarter turn clockwise, as seen looking at the face whose normal is `axis`. */
function quarter(v: Vec, axis: Vec): Vec {
  const c = cross(v, axis)
  const d = dot(axis, v)
  return [c[0] + d * axis[0], c[1] + d * axis[1], c[2] + d * axis[2]]
}

/** perm[i] = where sticker i ends up. */
type Perm = number[]

function makePerm(axis: Vec, wholeCube: boolean): Perm {
  return STICKERS.map((s) => {
    if (!wholeCube && dot(s.pos, axis) !== 1) return s.index
    return BY_KEY.get(key(quarter(s.pos, axis), quarter(s.normal, axis)))!
  })
}

const compose = (a: Perm, b: Perm): Perm => a.map((dest) => b[dest])

export const MOVES: Record<string, Perm> = {}
const BASE: [string, Vec, boolean][] = [
  ...FACES.map((f) => [f, NORMALS[f], false] as [string, Vec, boolean]),
  ['x', NORMALS.R, true],
  ['y', NORMALS.U, true],
  ['z', NORMALS.F, true],
]
for (const [name, axis, whole] of BASE) {
  const p = makePerm(axis, whole)
  const p2 = compose(p, p)
  MOVES[name] = p
  MOVES[name + '2'] = p2
  MOVES[name + "'"] = compose(p2, p)
}

/** The 18 face turns (no whole-cube rotations). */
export const FACE_MOVES = FACES.flatMap((f) => [f, f + "'", f + '2'])

export const isRotation = (m: string) => /^[xyz]/.test(m)

export function toMoves(moves: string | string[]): string[] {
  return typeof moves === 'string' ? moves.split(/\s+/).filter(Boolean) : moves
}

export function applyMove(cube: Cube, move: string): Cube {
  const perm = MOVES[move]
  if (!perm) throw new Error(`Unknown move ${move}`)
  const out: Cube = new Array(54)
  for (let i = 0; i < 54; i++) out[perm[i]] = cube[i]
  return out
}

export function applyMoves(cube: Cube, moves: string | string[]): Cube {
  return toMoves(moves).reduce(applyMove, cube)
}

export function invertMove(m: string): string {
  if (m.endsWith('2')) return m
  if (m.endsWith("'")) return m.slice(0, -1)
  return m + "'"
}

export const invertMoves = (moves: string | string[]) => toMoves(moves).slice().reverse().map(invertMove)

export const solvedCube = (): Cube => FACES.flatMap((f) => Array<Color>(9).fill(SCHEME[f]))

export function isSolved(cube: Cube): boolean {
  return FACES.every((_, f) => cube.slice(f * 9, f * 9 + 9).every((c) => c === cube[f * 9 + 4]))
}

export function randomScramble(length = 25, rand = Math.random): string[] {
  const out: string[] = []
  while (out.length < length) {
    const m = FACE_MOVES[Math.floor(rand() * FACE_MOVES.length)]
    if (out.length && out[out.length - 1][0] === m[0]) continue
    out.push(m)
  }
  return out
}

// ---- Pieces --------------------------------------------------------------

const nonZero = (p: Vec) => p.filter((v) => v !== 0).length

function groupPieces(kind: 2 | 3): number[][] {
  const groups = new Map<string, number[]>()
  for (const s of STICKERS) {
    if (nonZero(s.pos) !== kind) continue
    const k = s.pos.join()
    groups.set(k, [...(groups.get(k) ?? []), s.index])
  }
  return [...groups.values()]
}

const det = (a: Vec, b: Vec, c: Vec) => dot(a, cross(b, c))
const isUD = (i: number) => STICKERS[i].face === 'U' || STICKERS[i].face === 'D'
const isFB = (i: number) => STICKERS[i].face === 'F' || STICKERS[i].face === 'B'

/** Edge slots as [primary, other] sticker indices (primary: on U/D, else on F/B). */
export const EDGE_SLOTS: number[][] = groupPieces(2).map((g) =>
  isUD(g[0]) || (!isUD(g[1]) && isFB(g[0])) ? g : [g[1], g[0]],
)

/** Corner slots as [U/D sticker, then the other two in a fixed rotational order]. */
export const CORNER_SLOTS: number[][] = groupPieces(3).map((g) => {
  const first = g.find(isUD)!
  const [a, b] = g.filter((i) => i !== first)
  return det(STICKERS[first].normal, STICKERS[a].normal, STICKERS[b].normal) < 0 ? [first, a, b] : [first, b, a]
})

/** Colour of the centre on the face this sticker belongs to. */
export const homeColor = (cube: Cube, sticker: number) => cube[centreIndex(STICKERS[sticker].face)]

export const pieceSolved = (cube: Cube, slot: number[]) => slot.every((i) => cube[i] === homeColor(cube, i))

export const colorsOf = (cube: Cube, slot: number[]) => slot.map((i) => cube[i])

export const sameSet = (a: (Color | null)[], b: (Color | null)[]) => a.length === b.length && a.every((c) => b.includes(c))

/** The slot currently holding the piece with exactly these colours. */
export function findPiece(cube: Cube, colors: Color[]): number[] | undefined {
  const slots = colors.length === 2 ? EDGE_SLOTS : CORNER_SLOTS
  return slots.find((s) => sameSet(colorsOf(cube, s), colors))
}

/** The edge or corner slot that contains this sticker (undefined for centres). */
export const slotOf = (sticker: number) => [...EDGE_SLOTS, ...CORNER_SLOTS].find((s) => s.includes(sticker))

/** True when every known sticker matches the centre on its face. */
export const knownSolved = (cube: Cube) => cube.every((c, i) => c === null || c === homeColor(cube, i))

/** The slot where the piece with these colours belongs (given the centres). */
export function homeSlot(cube: Cube, colors: Color[]): number[] {
  const slots = colors.length === 2 ? EDGE_SLOTS : CORNER_SLOTS
  return slots.find((s) => sameSet(s.map((i) => homeColor(cube, i)), colors))!
}

/** e.g. "front-right" or "top-front-left", relative to how the cube is held. */
export function describeSlot(slot: number[]): string {
  const order: Face[] = ['U', 'D', 'F', 'B', 'L', 'R']
  return slot
    .map((i) => STICKERS[i].face)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((f) => FACE_NAMES[f])
    .join('-')
}

export const pieceName = (colors: Color[]) => colors.map((c) => COLOR_NAMES[c]).join('–')

export const faceOfColor = (cube: Cube, color: Color): Face => FACES.find((f) => cube[centreIndex(f)] === color)!
