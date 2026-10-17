// Move searches used to place one piece at a time. They only need the stickers
// the app knows about; unknown stickers (null) are carried along untouched.

import { FACE_MOVES, MOVES, applyMoves, type Cube } from './cube'

/** Shortest face-turn sequence moving each tracked sticker to its goal sticker. */
export function bfsStickers(from: number[], to: number[], moveSet = FACE_MOVES): string[] {
  const enc = (a: number[]) => a.reduce((k, v) => k * 64 + v, 0)
  const goal = enc(to)
  const startKey = enc(from)
  if (startKey === goal) return []
  const parent = new Map<number, [number, string]>([[startKey, [-1, '']]])
  let frontier = [from]
  while (frontier.length) {
    const next: number[][] = []
    for (const s of frontier) {
      const sk = enc(s)
      for (const m of moveSet) {
        const t = s.map((i) => MOVES[m][i])
        const k = enc(t)
        if (parent.has(k)) continue
        parent.set(k, [sk, m])
        if (k === goal) {
          const path: string[] = []
          for (let cur = k; cur !== startKey; ) {
            const [prev, move] = parent.get(cur)!
            path.push(move)
            cur = prev
          }
          return path.reverse()
        }
        next.push(t)
      }
    }
    frontier = next
  }
  throw new Error('Search failed')
}

/** A "macro": optionally turn the whole cube, optionally turn the top, then an algorithm N times. */
export interface Macro {
  rot: string | null
  pre: string | null
  alg: string[]
  times: number
}

export const ROTS = [null, 'y', 'y2', "y'"]
export const UPS = [null, 'U', 'U2', "U'"]

export const macroMoves = (m: Macro) => [
  ...(m.rot ? [m.rot] : []),
  ...(m.pre ? [m.pre] : []),
  ...Array.from({ length: m.times }, () => m.alg).flat(),
]

const macroCost = (ms: Macro[]) => ms.reduce((n, m) => n + macroMoves(m).length, 0)

/** Fewest macros (then fewest moves) reaching the goal. */
export function search(start: Cube, macros: Macro[], goal: (c: Cube) => boolean, maxDepth: number): Macro[] {
  if (goal(start)) return []
  for (let depth = 1; depth <= maxDepth; depth++) {
    let best: Macro[] | null = null
    const walk = (c: Cube, chain: Macro[]) => {
      if (chain.length === depth) {
        if (goal(c) && (!best || macroCost(chain) < macroCost(best))) best = chain
        return
      }
      for (const m of macros) walk(applyMoves(c, macroMoves(m)), [...chain, m])
    }
    walk(start, [])
    if (best) return best
  }
  throw new Error('Search failed')
}

export const combos = (algs: string[][], times: number[], rots = ROTS, ups = UPS): Macro[] =>
  rots.flatMap((rot) =>
    ups.flatMap((pre) => algs.flatMap((alg) => times.map((t) => ({ rot, pre, alg, times: t })))),
  )

export const SEXY = ['R', 'U', "R'", "U'"]
export const RIGHT_INSERT = ['U', 'R', "U'", "R'", "U'", "F'", 'U', 'F']
export const LEFT_INSERT = ["U'", "L'", 'U', 'L', 'U', 'F', "U'", "F'"]
export const YELLOW_CROSS_ALG = ['F', 'R', 'U', "R'", "U'", "F'"]
export const SUNE = ['R', 'U', "R'", 'U', 'R', 'U2', "R'"]
export const CORNER_CYCLE = ['U', 'R', "U'", "L'", 'U', "R'", "U'", 'L']
export const TWIST = ["R'", "D'", 'R', 'D']
