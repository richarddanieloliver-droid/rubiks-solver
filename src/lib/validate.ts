import {
  CORNER_SLOTS,
  COLOR_NAMES,
  EDGE_SLOTS,
  FACES,
  centreIndex,
  colorsOf,
  homeColor,
  pieceName,
  sameSet,
  type Color,
  type Cube,
} from './cube'

const COLORS: Color[] = ['W', 'Y', 'G', 'B', 'R', 'O']

const IMPOSSIBLE =
  "check for a misread sticker. If every sticker is right, a piece has been popped out and put back wrong, or a sticker swapped, so the cube can't be solved by turning."

const homeColors = (cube: Cube, slot: number[]) => slot.map((i) => homeColor(cube, i))

/** true if `b` is `a` rotated (same cyclic order). */
const cyclicMatch = (a: Color[], b: Color[]) =>
  [0, 1, 2].some((k) => a.every((c, i) => c === b[(i + k) % 3]))

function parity(perm: number[]): number {
  const seen = new Array(perm.length).fill(false)
  let swaps = 0
  for (let i = 0; i < perm.length; i++) {
    let j = i
    let len = 0
    while (!seen[j]) {
      seen[j] = true
      j = perm[j]
      len++
    }
    if (len) swaps += len - 1
  }
  return swaps % 2
}

/** Returns a list of plain-English problems; empty means the cube is solvable. */
export function validate(cube: (Color | null)[]): string[] {
  const missing = cube.filter((c) => !c).length
  if (missing) return [`${missing} sticker${missing === 1 ? ' is' : 's are'} still blank.`]
  const c = cube as Cube

  const errors: string[] = []
  for (const col of COLORS) {
    const n = c.filter((x) => x === col).length
    if (n !== 9) errors.push(`There are ${n} ${COLOR_NAMES[col]} stickers — there should be 9.`)
  }
  const centres = FACES.map((f) => c[centreIndex(f)])
  if (new Set(centres).size !== 6) errors.push('Each centre must be a different colour.')
  if (errors.length) return errors

  const ud = [c[centreIndex('U')], c[centreIndex('D')]]
  const fb = [c[centreIndex('F')], c[centreIndex('B')]]

  // Edges: every piece must exist exactly once.
  const edgeHomes = EDGE_SLOTS.map((s) => homeColors(c, s))
  const edgePerm: number[] = []
  let flip = 0
  for (const slot of EDGE_SLOTS) {
    const cols = colorsOf(c, slot)
    const home = edgeHomes.findIndex((h) => sameSet(h, cols))
    if (home < 0) {
      errors.push(`There's a ${pieceName(cols)} edge, which doesn't exist on a real cube.`)
      continue
    }
    if (edgePerm.includes(home)) {
      errors.push(`The ${pieceName(cols)} edge appears twice.`)
      continue
    }
    edgePerm.push(home)
    const primary = cols.find((x) => ud.includes(x)) ?? cols.find((x) => fb.includes(x))
    if (cols[0] !== primary) flip++
  }

  const cornerHomes = CORNER_SLOTS.map((s) => homeColors(c, s))
  const cornerPerm: number[] = []
  let twist = 0
  for (const slot of CORNER_SLOTS) {
    const cols = colorsOf(c, slot)
    const home = cornerHomes.findIndex((h) => sameSet(h, cols))
    if (home < 0) {
      errors.push(`There's a ${pieceName(cols)} corner, which doesn't exist on a real cube.`)
      continue
    }
    if (cornerPerm.includes(home)) {
      errors.push(`The ${pieceName(cols)} corner appears twice.`)
      continue
    }
    if (!cyclicMatch(cornerHomes[home], cols)) {
      errors.push(`The ${pieceName(cols)} corner has its colours in an impossible order — one of its stickers is probably wrong.`)
      continue
    }
    cornerPerm.push(home)
    twist += cols.findIndex((x) => ud.includes(x))
  }
  if (errors.length) return errors

  if (flip % 2) errors.push(`One edge is flipped: ${IMPOSSIBLE}`)
  if (twist % 3) errors.push(`One corner is twisted: ${IMPOSSIBLE}`)
  if (parity(edgePerm) !== parity(cornerPerm)) errors.push(`Two pieces are swapped: ${IMPOSSIBLE}`)
  return errors
}

