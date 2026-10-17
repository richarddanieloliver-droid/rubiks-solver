import { COLOR_HEX } from '../lib/cube'
import type { Pic } from '../lib/guided'

// Top face seen from above, back edge at the top.
const LIT: Record<Pic, number[]> = {
  dot: [4],
  L: [1, 3, 4],
  line: [3, 4, 5],
  cross: [1, 3, 4, 5, 7],
}

export function TopPic({ pic, size = 64, labels = false }: { pic: Pic; size?: number; labels?: boolean }) {
  return (
    <div className="top-pic">
      {labels && <span className="muted small">back</span>}
      <div className="top-grid" style={{ width: size, height: size }}>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} style={{ background: LIT[pic].includes(i) ? COLOR_HEX.Y : 'var(--unknown)' }} />
        ))}
      </div>
      {labels && <span className="muted small">front (facing you)</span>}
    </div>
  )
}
