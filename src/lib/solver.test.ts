import { describe, expect, it } from 'vitest'
import {
  CORNER_SLOTS,
  EDGE_SLOTS,
  FACE_MOVES,
  MOVES,
  applyMoves,
  invertMoves,
  isSolved,
  randomScramble,
  solvedCube,
  type Cube,
} from './cube'
import { solve, totalFaceTurns } from './solver'
import { validate } from './validate'

// Small seeded RNG so failures are reproducible.
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

  it('four quarter turns are the identity', () => {
    for (const m of ['U', 'D', 'L', 'R', 'F', 'B', 'x', 'y', 'z']) {
      expect(applyMoves(solvedCube(), [m, m, m, m])).toEqual(solvedCube())
    }
  })

  it('R takes the front-right column to the top', () => {
    const c = solvedCube()
    const after = applyMoves(c, ['R'])
    expect([2, 5, 8].map((i) => after[i])).toEqual(['G', 'G', 'G'])
  })

  it('U takes the right face to the front', () => {
    const after = applyMoves(solvedCube(), ['U'])
    expect(after.slice(18, 21)).toEqual(['R', 'R', 'R'])
  })

  it('sexy move has order 6', () => {
    const six = Array(6).fill("R U R' U'").join(' ')
    expect(isSolved(applyMoves(solvedCube(), six))).toBe(true)
  })

  it('has 12 edges and 8 corners', () => {
    expect(EDGE_SLOTS).toHaveLength(12)
    expect(CORNER_SLOTS).toHaveLength(8)
  })
})

describe('validate', () => {
  it('accepts solved and scrambled cubes', () => {
    const r = rng(1)
    expect(validate(solvedCube())).toEqual([])
    for (let i = 0; i < 300; i++) expect(validate(applyMoves(solvedCube(), randomScramble(25, r)))).toEqual([])
  })

  it('rejects a flipped edge', () => {
    const c = solvedCube()
    const [a, b] = EDGE_SLOTS[0]
    ;[c[a], c[b]] = [c[b], c[a]]
    expect(validate(c).join()).toMatch(/edge is flipped/)
  })

  it('rejects a twisted corner', () => {
    const c = solvedCube()
    const [a, b, d] = CORNER_SLOTS[0]
    ;[c[a], c[b], c[d]] = [c[d], c[a], c[b]]
    expect(validate(c).join()).toMatch(/corner is twisted/)
  })

  it('rejects two swapped edges', () => {
    const c = solvedCube()
    const [a1, b1] = EDGE_SLOTS.find((s) => s.includes(7))! // U-F edge
    const [a2, b2] = EDGE_SLOTS.find((s) => s.includes(5))! // U-R edge
    ;[c[a1], c[b1], c[a2], c[b2]] = [c[a2], c[b2], c[a1], c[b1]]
    expect(validate(c).join()).toMatch(/swapped/)
  })

  it('rejects wrong colour counts and blanks', () => {
    const c: Cube = solvedCube()
    c[0] = 'Y'
    expect(validate(c).join()).toMatch(/10 yellow/)
    expect(validate([...solvedCube().slice(0, 53), null]).join()).toMatch(/blank/)
  })
})

describe('solver', () => {
  it('handles an already-solved cube', () => {
    expect(() => solve(solvedCube())).not.toThrow()
  })

  it('solves 1,000 random scrambles, with the cross done after stage 1', () => {
    const r = rng(42)
    let maxTurns = 0
    for (let i = 0; i < 1000; i++) {
      const start = applyMoves(solvedCube(), randomScramble(25, r))
      const stages = solve(start)
      const all = stages.flatMap((s) => s.steps.flatMap((st) => st.moves))
      expect(isSolved(applyMoves(start, all))).toBe(true)

      const afterCross = applyMoves(start, stages[0].steps.flatMap((s) => s.moves))
      for (const i of [1, 3, 5, 7]) expect(afterCross[i]).toBe('W')
      maxTurns = Math.max(maxTurns, totalFaceTurns(stages))
    }
    expect(maxTurns).toBeLessThan(400)
  }, 600_000)

  it('only uses known moves', () => {
    const stages = solve(applyMoves(solvedCube(), randomScramble(25, rng(7))))
    for (const m of stages.flatMap((s) => s.steps.flatMap((st) => st.moves)))
      expect([...FACE_MOVES, 'y', 'y2', "y'", 'z2', 'x', 'x2', "x'", 'z', "z'"]).toContain(m)
  })
})
