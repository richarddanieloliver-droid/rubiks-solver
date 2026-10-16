import { MOVES, STICKERS, type Face } from './cube'

const FACE_TURN: Record<string, [string, string]> = {
  U: ['Top layer', 'turn to the left (front goes left)'],
  D: ['Bottom layer', 'turn to the right (front goes right)'],
  R: ['Right side', 'turn up, away from you'],
  L: ['Left side', 'turn down, towards you'],
  F: ['Front face', 'turn clockwise'],
  B: ['Back face', 'turn clockwise as seen from behind (top goes left)'],
}

const FACE_TURN_PRIME: Record<string, string> = {
  U: 'turn to the right (front goes right)',
  D: 'turn to the left (front goes left)',
  R: 'turn down, towards you',
  L: 'turn up, away from you',
  F: 'turn anticlockwise',
  B: 'turn anticlockwise as seen from behind (top goes right)',
}

const ROTATIONS: Record<string, string> = {
  y: 'Turn the whole cube: the right side comes to the front',
  "y'": 'Turn the whole cube: the left side comes to the front',
  y2: 'Turn the whole cube round so the back faces you',
  x: 'Tip the whole cube: the front rolls up to the top',
  "x'": 'Tip the whole cube: the top rolls down to the front',
  x2: 'Tip the whole cube over: top and bottom swap, back comes to the front',
  z: 'Tilt the whole cube clockwise: the top goes to the right',
  "z'": 'Tilt the whole cube anticlockwise: the top goes to the left',
  z2: 'Flip the cube upside down, keeping the same face towards you',
}

export function describeMove(m: string): { head: string; detail: string } {
  if (ROTATIONS[m]) return { head: 'Whole cube', detail: ROTATIONS[m] }
  const [head, cw] = FACE_TURN[m[0]]
  if (m.endsWith('2')) return { head, detail: 'turn twice (half turn — either direction)' }
  return { head, detail: m.endsWith("'") ? FACE_TURN_PRIME[m[0]] : cw }
}

/** The face letter plus quarter-turn the arrows should show for a move. */
const quarterOf = (m: string) => (m.endsWith('2') ? m[0] : m)

const VISIBLE: Face[] = ['U', 'F', 'R']

/** Sticker index pairs (from → to) to draw as arrows on the front-top-right view. */
export function arrowsFor(m: string): [number, number][] {
  const perm = MOVES[quarterOf(m)]
  const isCentre = (i: number) => i % 9 === 4
  const isEdge = (i: number) => (i % 9) % 2 === 1
  const candidates = [...STICKERS.filter((s) => isCentre(s.index)), ...STICKERS.filter((s) => isEdge(s.index))]
  const out: [number, number][] = []
  const pairs = new Set<string>()
  for (const s of candidates) {
    const to = STICKERS[perm[s.index]]
    if (to.face === s.face || !VISIBLE.includes(s.face) || !VISIBLE.includes(to.face)) continue
    const pair = s.face + to.face
    if (pairs.has(pair)) continue
    pairs.add(pair)
    out.push([s.index, to.index])
    if (out.length === 2) break
  }
  return out
}

/** Stickers that move (dim the rest) — empty for whole-cube turns. */
export function movingStickers(m: string): Set<number> {
  if (/^[xyz]/.test(m)) return new Set()
  const perm = MOVES[quarterOf(m)]
  const face = m[0] as Face
  return new Set(STICKERS.filter((s) => perm[s.index] !== s.index || s.face === face).map((s) => s.index))
}
