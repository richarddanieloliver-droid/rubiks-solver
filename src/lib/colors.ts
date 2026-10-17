// Turning camera samples into sticker colours. Rather than fixed thresholds,
// stickers are grouped against the cube's own centre squares (as lit right
// now), nine to a colour, so warm or dim lighting shifts everything together.

import type { Color } from './cube'

export type RGB = [number, number, number]
type Lab = [number, number, number]

export const COLORS: Color[] = ['W', 'Y', 'G', 'B', 'R', 'O']

/** Typical sticker colours, only used to name the six groups. */
const REFERENCE: Record<Color, RGB> = {
  W: [235, 235, 230],
  Y: [235, 215, 20],
  G: [0, 155, 72],
  B: [0, 70, 173],
  R: [183, 18, 52],
  O: [255, 88, 0],
}

export function rgbToLab([r, g, b]: RGB): Lab {
  const lin = (c: number) => {
    c /= 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

// Lightness matters less than hue: shadows change it a lot.
const dist = (p: Lab, q: Lab) => Math.hypot((p[0] - q[0]) * 0.5, p[1] - q[1], p[2] - q[2])

const mean = (labs: Lab[]): Lab => {
  const s = labs.reduce((a, l) => [a[0] + l[0], a[1] + l[1], a[2] + l[2]], [0, 0, 0])
  return [s[0] / labs.length, s[1] / labs.length, s[2] / labs.length]
}

/** Minimum-cost assignment of rows to columns (rows <= columns). Returns the column for each row. */
export function hungarian(cost: number[][]): number[] {
  const n = cost.length
  const m = cost[0].length
  const u = new Array(n + 1).fill(0)
  const v = new Array(m + 1).fill(0)
  const p = new Array(m + 1).fill(0)
  const way = new Array(m + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minv = new Array(m + 1).fill(Infinity)
    const used = new Array(m + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = Infinity
      let j1 = 0
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
        if (cur < minv[j]) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j] < delta) {
          delta = minv[j]
          j1 = j
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta
          v[j] -= delta
        } else minv[j] -= delta
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0)
  }
  const out = new Array(n).fill(-1)
  for (let j = 1; j <= m; j++) if (p[j]) out[p[j] - 1] = j - 1
  return out
}

/**
 * Colours for 6 scanned faces (54 samples, face by face, centre at index 4 of
 * each). Every colour gets exactly nine stickers.
 */
export function classify(samples: RGB[]): Color[] {
  const labs = samples.map(rgbToLab)
  let means: Lab[] = [0, 1, 2, 3, 4, 5].map((s) => labs[s * 9 + 4])
  let group: number[] = []
  for (let iter = 0; iter < 4; iter++) {
    const cost = labs.map((l, i) =>
      Array.from({ length: 54 }, (_, j) => {
        const k = Math.floor(j / 9)
        // A face's centre always belongs to its own group.
        if (i % 9 === 4) return Math.floor(i / 9) === k ? 0 : 1e6
        return dist(l, means[k])
      }),
    )
    group = hungarian(cost).map((j) => Math.floor(j / 9))
    means = means.map((_, k) => mean(labs.filter((_, i) => group[i] === k)))
  }
  const refs = COLORS.map((c) => rgbToLab(REFERENCE[c]))
  const names = hungarian(means.map((m) => refs.map((r) => dist(m, r))))
  return group.map((k) => COLORS[names[k]])
}

/** Rough name for a single sample, for quick feedback while scanning. */
export function nearest(rgb: RGB): Color {
  const l = rgbToLab(rgb)
  return COLORS.reduce((best, c) => (dist(l, rgbToLab(REFERENCE[c])) < dist(l, rgbToLab(REFERENCE[best])) ? c : best))
}

/** Two scans whose centres look like the same colour (a face scanned twice), if any. */
export function sameCentres(centres: RGB[]): [number, number] | null {
  const labs = centres.map(rgbToLab)
  let best: [number, number] | null = null
  let min = Infinity
  for (let i = 0; i < labs.length; i++)
    for (let j = i + 1; j < labs.length; j++) {
      const d = dist(labs[i], labs[j])
      if (d < min) {
        min = d
        best = [i, j]
      }
    }
  return min < 10 ? best : null
}
