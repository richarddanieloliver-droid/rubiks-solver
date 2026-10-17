import { describe, expect, it } from 'vitest'
import {
  CORNER_SLOTS,
  EDGE_SLOTS,
  MOVES,
  applyMoves,
  centreIndex,
  colorsOf,
  findPiece,
  homeColor,
  invertMoves,
  isSolved,
  randomScramble,
  sameSet,
  solvedCube,
  type Color,
  type Cube,
} from './cube'
import { advance, place, startGuide, type Answer, type Guide, type Prompt } from './guided'

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

describe('cube moves', () => {
  it('every move is a permutation and inverts cleanly', () => {
    for (const m of Object.keys(MOVES)) {
      expect(new Set(MOVES[m]).size).toBe(54)
      expect(isSolved(applyMoves(solvedCube(), [m, ...invertMoves([m])]))).toBe(true)
    }
  })

  it('R takes the front-right column to the top; U brings the right face to the front', () => {
    expect([2, 5, 8].map((i) => applyMoves(solvedCube(), ['R'])[i])).toEqual(['G', 'G', 'G'])
    expect(applyMoves(solvedCube(), ['U']).slice(18, 21)).toEqual(['R', 'R', 'R'])
  })

  it('has 12 edges and 8 corners', () => {
    expect(EDGE_SLOTS).toHaveLength(12)
    expect(CORNER_SLOTS).toHaveLength(8)
  })
})

// A pretend person holding a real (hidden) cube, answering the guide honestly.
const Y = 'Y'
const turnUntil = (cube: Cube, move: string, ok: (c: Cube) => boolean) => {
  for (let i = 0; i < 4; i++) {
    if (ok(cube)) return cube
    cube = applyMoves(cube, [move])
  }
  throw new Error(`Could not reach the state by turning ${move}`)
}
const edgeMatches = (c: Cube) => (['F', 'R', 'B', 'L'] as const).filter((f) => c[centreIndex(f) - 3] === c[centreIndex(f)])
const cornerInPlace = (c: Cube, slot: number[]) => sameSet(colorsOf(c, slot), slot.map((i) => homeColor(c, i)))
const topCorners = CORNER_SLOTS.filter((s) => s[0] < 9)
const UFR = CORNER_SLOTS.find((s) => s.includes(8))!

function respond(p: Prompt, cube: Cube): { cube: Cube; answer: Answer } {
  switch (p.kind) {
    case 'orient':
      return { cube, answer: { color: cube[centreIndex('F')] as Color } }
    case 'locate':
      return { cube, answer: { tap: findPiece(cube, p.piece)!.find((i) => cube[i] === p.ask)! } }
    case 'moves':
      return { cube: applyMoves(cube, p.moves), answer: { done: true } }
    case 'instruction': {
      const did: Record<string, (c: Cube) => Cube> = {
        'L-back-left': (c) => turnUntil(c, 'U', (x) => x[1] === Y && x[3] === Y),
        'line-across': (c) => turnUntil(c, 'U', (x) => x[3] === Y && x[5] === Y),
        'edges-back-right': (c) => turnUntil(c, 'y', (x) => ['B', 'R'].every((f) => edgeMatches(x).includes(f as 'B'))),
        'corner-front-right': (c) => turnUntil(c, 'y', (x) => cornerInPlace(x, UFR)),
        finish: (c) => turnUntil(c, 'U', isSolved),
      }
      return { cube: (did[p.id] ?? ((c) => c))(cube), answer: { done: true } }
    }
    case 'choice': {
      if (p.id === 'yellow-cross') {
        const up = [1, 3, 5, 7].filter((i) => cube[i] === Y)
        const line = ['1,7', '3,5'].includes(up.join())
        const choice = up.length === 0 ? 'dot' : up.length === 4 ? 'cross' : line ? 'line' : 'L'
        return { cube, answer: { choice } }
      }
      if (p.id === 'yellow-edges') {
        let best = cube
        for (let i = 0; i < 4; i++) {
          const t = applyMoves(cube, Array(i).fill('U'))
          if (edgeMatches(t).length > edgeMatches(best).length) best = t
        }
        const m = edgeMatches(best)
        const opposite = m.length === 2 && (['F', 'B'].every((f) => m.includes(f as 'F')) || ['R', 'L'].every((f) => m.includes(f as 'R')))
        return { cube: best, answer: { choice: m.length === 4 ? 'all' : opposite ? 'opposite' : 'adjacent' } }
      }
      if (p.id === 'yellow-corners') {
        const n = topCorners.filter((s) => cornerInPlace(cube, s)).length
        return { cube, answer: { choice: n === 4 ? 'all' : n === 1 ? 'one' : 'none' } }
      }
      if (p.id === 'twist-find') {
        if ([0, 2, 6, 8].every((i) => cube[i] === Y)) return { cube, answer: { choice: 'all' } }
        return { cube: turnUntil(cube, 'U', (x) => x[8] !== Y), answer: { choice: 'ready' } }
      }
      if (p.id === 'twist-check') return { cube, answer: { choice: cube[8] === Y ? 'yes' : 'no' } }
      throw new Error(`Unknown choice ${p.id}`)
    }
    case 'done':
      throw new Error('done')
  }
}

function run(start: Cube) {
  let cube = start
  for (const r of ['', 'x', 'x2', "x'", 'z', "z'"]) {
    const t = applyMoves(start, r ? [r] : [])
    if (t[centreIndex('U')] === 'W') cube = t
  }
  let g: Guide = startGuide()
  let prompts = 0
  while (g.queue[0].kind !== 'done') {
    const { cube: next, answer } = respond(g.queue[0], cube)
    cube = next
    g = advance(g, answer)
    if (g.queue[0].kind === 'locate') expect(g.queue[0].error).toBeUndefined()
    // Everything the guide believes must be true of the real cube.
    g.cube.forEach((c, i) => c !== null && expect(c).toBe(cube[i]))
    if (++prompts > 400) throw new Error('Guide did not finish')
  }
  expect(isSolved(cube)).toBe(true)
  return prompts
}

describe('guide', () => {
  it('solves 500 random cubes with a person following along', () => {
    const r = rng(42)
    let max = 0
    for (let i = 0; i < 500; i++) max = Math.max(max, run(applyMoves(solvedCube(), randomScramble(25, r))))
    expect(max).toBeLessThan(400)
  }, 600_000)

  it('copes with a cube that is already solved', () => {
    run(solvedCube())
  })

  it('rejects taps on the wrong kind of square or a solved piece', () => {
    let g = advance(startGuide(), { color: 'G' })
    const p = g.queue[0]
    if (p.kind !== 'locate') throw new Error('expected locate')
    expect(place(g.cube, p.piece, p.ask, 0)).toMatch(/not an edge/) // a corner square
    expect(place(g.cube, p.piece, p.ask, 4)).toMatch(/not an edge/) // a centre
    // Say the white-green edge is already home, then try to tap there for the next edge.
    g = advance(g, { tap: 7 })
    while (g.queue[0].kind !== 'locate') g = advance(g, { done: true })
    const q = g.queue[0]
    if (q.kind !== 'locate') throw new Error('expected locate')
    expect(place(g.cube, q.piece, q.ask, 7)).toMatch(/already solved/)
  })
})
