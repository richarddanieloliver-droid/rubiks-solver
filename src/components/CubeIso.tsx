import { COLOR_HEX, MOVES, NORMALS, STICKERS, applyMoves, type Color, type Cube, type Face, type Vec } from '../lib/cube'
import { arrowsFor, movingStickers } from '../lib/notation'

// Isometric view from front-top-right, the way you look at a cube in your hand.
const project = ([x, y, z]: Vec): [number, number] => [(x - z) / Math.SQRT2, (x + z - 2 * y) / Math.sqrt(6)]

const TANGENTS: Record<Face, [Vec, Vec]> = {
  U: [[1, 0, 0], [0, 0, 1]],
  D: [[1, 0, 0], [0, 0, 1]],
  F: [[1, 0, 0], [0, 1, 0]],
  B: [[1, 0, 0], [0, 1, 0]],
  R: [[0, 1, 0], [0, 0, 1]],
  L: [[0, 1, 0], [0, 0, 1]],
}

const VISIBLE: Face[] = ['U', 'F', 'R']

const add = (a: Vec, b: Vec, k = 1): Vec => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]

function quad(centre: Vec, face: Face, h: number) {
  const [t1, t2] = TANGENTS[face]
  return [
    [h, h],
    [h, -h],
    [-h, -h],
    [-h, h],
  ]
    .map(([a, b]) => project(add(add(centre, t1, a), t2, b)))
    .map((p) => p.map((v) => v.toFixed(3)).join(','))
    .join(' ')
}

const stickerCentre = (i: number): Vec => add(STICKERS[i].pos, STICKERS[i].normal, 0.5)

interface Props {
  cube: Cube
  /** Show the move's arrows and dim stickers that don't move. */
  move?: string | null
  /** Draw the cube as it looks after this whole-cube turn (e.g. "y2" for the back). */
  view?: string
  size?: number
  canTap?: (index: number) => boolean
  onTap?: (index: number) => void
  selected?: number | null
  selectedColor?: Color
}

export function CubeIso({ cube, move, view, size = 240, canTap, onTap, selected, selectedColor }: Props) {
  const shown = view ? applyMoves(cube, [view]) : cube
  // Which original sticker is drawn at each position.
  const original = STICKERS.map((s) => s.index)
  if (view) MOVES[view].forEach((dest, i) => (original[dest] = i))
  const moving = move ? movingStickers(move) : new Set<number>()
  const arrows = move ? arrowsFor(move) : []
  return (
    <svg viewBox="-2.4 -2.7 4.8 5.4" width={size} height={(size * 5.4) / 4.8} role="img" aria-label="Cube view">
      <defs>
        <marker id="head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--arrow)" stroke="var(--arrow-outline)" strokeWidth="1" />
        </marker>
      </defs>
      {VISIBLE.map((f) => (
        <polygon key={f} points={quad(NORMALS[f].map((v) => v * 1.5) as Vec, f, 1.5)} fill="var(--cube-body)" />
      ))}
      {STICKERS.filter((s) => VISIBLE.includes(s.face)).map((s) => {
        const orig = original[s.index]
        const tappable = !!onTap && !!canTap?.(orig)
        const isSel = selected === orig
        const color = isSel && selectedColor ? selectedColor : shown[s.index]
        return (
          <polygon
            key={s.index}
            points={quad(stickerCentre(s.index), s.face, 0.43)}
            fill={color ? COLOR_HEX[color] : 'var(--unknown)'}
            opacity={moving.size && !moving.has(s.index) ? 0.35 : 1}
            stroke={isSel ? 'var(--accent)' : tappable ? 'var(--tap-outline)' : 'none'}
            strokeWidth={isSel ? 0.14 : 0.05}
            strokeLinejoin="round"
            className={tappable ? 'tappable' : undefined}
            onClick={tappable ? () => onTap!(orig) : undefined}
          />
        )
      })}
      {arrows.map(([from, to]) => {
        const [x1, y1] = project(stickerCentre(from))
        const [x2, y2] = project(stickerCentre(to))
        // Stop short of the target so the arrowhead sits on the sticker.
        const k = 0.82
        const d = `M${x1},${y1} L${x1 + (x2 - x1) * k},${y1 + (y2 - y1) * k}`
        return (
          <g key={`${from}-${to}`}>
            <path d={d} stroke="var(--arrow-outline)" strokeWidth="0.26" strokeLinecap="round" fill="none" />
            <path d={d} stroke="var(--arrow)" strokeWidth="0.14" strokeLinecap="round" fill="none" markerEnd="url(#head)" />
          </g>
        )
      })}
    </svg>
  )
}
