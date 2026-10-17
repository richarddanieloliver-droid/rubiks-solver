import { describe, expect, it } from 'vitest'
import { assemble, rotateGrid, type Grid } from './assemble'
import { classify, type RGB } from './colors'
import { applyMoves, isSolved, randomScramble, solvedCube, type Color, type Cube } from './cube'
import { solve } from './solver'

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const rotate = rotateGrid

/** The six faces as someone might scan them: shuffled, each turned at random. */
function scanFaces(cube: Cube, r: () => number): Grid[] {
  const grids = [0, 1, 2, 3, 4, 5].map((f) => {
    let g = cube.slice(f * 9, f * 9 + 9)
    for (let k = Math.floor(r() * 4); k > 0; k--) g = rotate(g)
    return g
  })
  return grids.sort(() => r() - 0.5)
}

describe('assemble', () => {
  it('rebuilds 300 cubes from faces scanned in any order, any way up', () => {
    const r = rng(3)
    for (let i = 0; i < 300; i++) {
      const cube = applyMoves(solvedCube(), randomScramble(25, r))
      const res = assemble(scanFaces(cube, r))
      if (!('cube' in res)) throw new Error(res.error)
      // Rarely two cubes fit the photos; then both are offered and one is the real one.
      expect(res.alternatives).toContainEqual(cube)
      expect(res.alternatives.length).toBeLessThanOrEqual(2)
      if (!res.ambiguous) expect(res.cube).toEqual(cube)
    }
  })

  it('handles cubes with red and orange the other way round', () => {
    const r = rng(4)
    const mirrored = solvedCube().map((c) => (c === 'R' ? 'O' : c === 'O' ? 'R' : c))
    for (let i = 0; i < 50; i++) {
      const cube = applyMoves(mirrored, randomScramble(25, r))
      const res = assemble(scanFaces(cube, r))
      expect('cube' in res && res.alternatives).toContainEqual(cube)
    }
  })

  it('explains bad scans', () => {
    const r = rng(5)
    const cube = applyMoves(solvedCube(), randomScramble(25, r))
    const faces = scanFaces(cube, r)

    const miscount = faces.map((g) => g.slice())
    miscount[0][0] = miscount[0][0] === 'R' ? 'O' : 'R'
    expect('error' in assemble(miscount) && assemble(miscount)).toMatchObject({ error: expect.stringMatching(/don’t add up/) })

    const twice = [...faces.slice(0, 5), faces[0]]
    expect(assemble(twice)).toMatchObject({ error: expect.stringMatching(/don’t add up|centre/) })

    // Swap two stickers of different colours on one face: counts still fine, cube impossible.
    const swapped = faces.map((g) => g.slice())
    const g = swapped[1]
    const j = [0, 1, 2, 3, 5, 6, 7, 8].find((k) => g[k] !== g[0])!
    ;[g[0], g[j]] = [g[j], g[0]]
    expect(assemble(swapped)).toMatchObject({ error: expect.stringMatching(/real cube/) })
  })
})

describe('classify', () => {
  const BASE: Record<Color, RGB> = {
    W: [225, 228, 222],
    Y: [228, 205, 40],
    G: [20, 150, 80],
    B: [25, 75, 165],
    R: [175, 30, 45],
    O: [240, 105, 25],
  }

  it('reads colours under warm, uneven light with noise', () => {
    const r = rng(6)
    let wrong = 0
    for (let i = 0; i < 200; i++) {
      const cube = applyMoves(solvedCube(), randomScramble(25, r))
      const tint: RGB = [1.08, 0.98, 0.78] // warm indoor light
      const samples = cube.map((c): RGB => {
        const shade = 0.75 + r() * 0.35
        return BASE[c].map((v, k) => Math.max(0, Math.min(255, v * tint[k] * shade + (r() - 0.5) * 20))) as RGB
      })
      const got = classify(samples)
      wrong += got.filter((c, k) => c !== cube[k]).length
    }
    expect(wrong).toBe(0)
  })
})

describe('solve', () => {
  it('gives a one-move answer for a cube one move from solved', () => {
    const stages = solve(applyMoves(solvedCube(), ['U']))
    expect(stages).toHaveLength(1)
    expect(stages[0].steps.flatMap((s) => s.moves)).toEqual(["U'"])
  })

  it('returns nothing for a solved cube, and short answers for nearly solved ones', () => {
    expect(solve(solvedCube())).toEqual([])
    const start = applyMoves(solvedCube(), ['R', 'U', 'F'])
    const moves = solve(start).flatMap((s) => s.steps.flatMap((st) => st.moves))
    expect(moves).toHaveLength(3)
    expect(isSolved(applyMoves(start, moves))).toBe(true)
  })
})
