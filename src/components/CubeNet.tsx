import { COLOR_HEX, FACES, FACE_NAMES, type Color, type Face } from '../lib/cube'

// Unfolded cube:      U
//                  L  F  R  B
//                     D
const GRID: Record<Face, [number, number]> = { U: [0, 1], L: [1, 0], F: [1, 1], R: [1, 2], B: [1, 3], D: [2, 1] }

interface Props {
  cube: (Color | null)[]
  active?: Face
  onFace?: (f: Face) => void
}

export function CubeNet({ cube, active, onFace }: Props) {
  return (
    <div className="net">
      {FACES.map((f, fi) => (
        <button
          type="button"
          key={f}
          className={`net-face${active === f ? ' active' : ''}`}
          style={{ gridRow: GRID[f][0] + 1, gridColumn: GRID[f][1] + 1 }}
          onClick={() => onFace?.(f)}
          disabled={!onFace}
          aria-label={`${FACE_NAMES[f]} face`}
        >
          {Array.from({ length: 9 }, (_, i) => {
            const c = cube[fi * 9 + i]
            return (
              <span
                key={i}
                className="net-cell"
                style={{ background: c ? COLOR_HEX[c] : undefined }}
              />
            )
          })}
        </button>
      ))}
    </div>
  )
}
