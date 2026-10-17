// Beginner (layer-by-layer) solver. Every step it returns has been applied to a
// simulated cube and checked, so the instructions can't drift from reality.

import {
  COLOR_NAMES,
  FACE_MOVES,
  FACE_NAMES,
  MOVES,
  applyMove,
  STICKERS,
  applyMoves,
  centreIndex,
  describeSlot,
  faceOfColor,
  findPiece,
  homeSlot,
  isRotation,
  isSolved,
  pieceName,
  pieceSolved,
  sameSet,
  type Color,
  type Cube,
} from './cube'

export interface Step {
  title: string
  text: string
  /** Every move to do, in order, including whole-cube turns. */
  moves: string[]
  /** For "repeat this N times" steps. */
  alg?: string[]
  times?: number
}

export interface Stage {
  name: string
  goal: string
  intro: string
  steps: Step[]
  start: Cube
  end: Cube
}

const SIDES: Color[] = ['G', 'R', 'B', 'O']
const SIDE_PAIRS = SIDES.map((c, i) => [c, SIDES[(i + 1) % 4]])

const WHITE_EDGES = SIDES.map((c): Color[] => ['W', c])
const WHITE_CORNERS = SIDE_PAIRS.map((p): Color[] => ['W', ...p])
const MIDDLE_EDGES = SIDE_PAIRS
const YELLOW_EDGES = SIDES.map((c): Color[] => ['Y', c])
const YELLOW_CORNERS = SIDE_PAIRS.map((p): Color[] => ['Y', ...p])

const solvedPiece = (c: Cube, colors: Color[]) => pieceSolved(c, findPiece(c, colors))
const countSolved = (c: Cube, pieces: Color[][]) => pieces.filter((p) => solvedPiece(c, p)).length
const allSolved = (c: Cube, pieces: Color[][]) => pieces.every((p) => solvedPiece(c, p))

const crossDone = (c: Cube) => allSolved(c, WHITE_EDGES)
const firstLayerDone = (c: Cube) => crossDone(c) && allSolved(c, WHITE_CORNERS)
const twoLayersDone = (c: Cube) => firstLayerDone(c) && allSolved(c, MIDDLE_EDGES)
const yellowCross = (c: Cube) =>
  twoLayersDone(c) &&
  YELLOW_EDGES.every((p) => {
    const slot = findPiece(c, p)
    return slot.some((i) => c[i] === 'Y' && STICKERS[i].face === 'U')
  })
const yellowEdgesDone = (c: Cube) => twoLayersDone(c) && allSolved(c, YELLOW_EDGES)
const cornersPlaced = (c: Cube) =>
  yellowEdgesDone(c) && YELLOW_CORNERS.every((p) => sameSet(homeSlot(c, p).map((i) => c[i]), p))

const fmt = (moves: string[]) => moves.join(' ')
const faceTurns = (moves: string[]) => moves.filter((m) => !isRotation(m)).length

// ---- Stage 1: white cross, one edge at a time by breadth-first search ------

/** Shortest face-turn sequence moving each tracked sticker to its goal sticker. */
function bfsStickers(from: number[], to: number[]): string[] {
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
      for (const m of FACE_MOVES) {
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
  throw new Error('Cross search failed')
}

function solveCross(cube: Cube): Step[] {
  const steps: Step[] = []
  let c = cube
  const placed: Color[][] = []
  const whiteSticker = (cc: Cube, p: Color[]) => findPiece(cc, p).find((i) => cc[i] === 'W')!
  const goalSticker = (cc: Cube, p: Color[]) => homeSlot(cc, p).find((i) => STICKERS[i].face === 'U')!

  while (placed.length < 4) {
    const todo = WHITE_EDGES.filter((p) => !placed.includes(p))
    let best: { piece: Color[]; moves: string[] } | null = null
    for (const p of todo) {
      const track = [...placed, p]
      const moves = bfsStickers(
        track.map((q) => whiteSticker(c, q)),
        track.map((q) => goalSticker(c, q)),
      )
      if (!best || moves.length < best.moves.length) best = { piece: p, moves }
      if (moves.length === 0) break
    }
    const { piece, moves } = best!
    placed.push(piece)
    if (moves.length === 0) {
      steps.push({
        title: `${pieceName(piece)} edge is already in place`,
        text: `The ${pieceName(piece)} edge is already on top with white facing up and ${COLOR_NAMES[piece[1]]} matching the ${COLOR_NAMES[piece[1]]} centre. Nothing to do.`,
        moves: [],
      })
      continue
    }
    const slot = findPiece(c, piece)
    const wFace = STICKERS[slot.find((i) => c[i] === 'W')!].face
    const side = FACE_NAMES[faceOfColor(c, piece[1])]
    const keep = placed.length > 1 ? ' These moves keep the edges you have already placed where they are.' : ''
    steps.push({
      title: `Place the ${pieceName(piece)} edge`,
      text:
        `Find the ${pieceName(piece)} edge: it's at the ${describeSlot(slot)} with white facing ${FACE_NAMES[wFace]}. ` +
        `Do ${fmt(moves)} to bring it to the top, white facing up, next to the ${COLOR_NAMES[piece[1]]} centre (${side} side).${keep}`,
      moves,
    })
    c = applyMoves(c, moves)
  }
  return steps
}

// ---- Stages 2-6: search over "macros" (turn cube, turn top, do algorithm) --

interface Macro {
  rot: string | null
  pre: string | null
  alg: string[]
  times: number
}

const ROTS = [null, 'y', 'y2', "y'"]
const UPS = [null, 'U', 'U2', "U'"]

const macroMoves = (m: Macro) => [
  ...(m.rot ? [m.rot] : []),
  ...(m.pre ? [m.pre] : []),
  ...Array.from({ length: m.times }, () => m.alg).flat(),
]

const macroCost = (ms: Macro[]) => ms.reduce((n, m) => n + macroMoves(m).length, 0)

function search(start: Cube, macros: Macro[], goal: (c: Cube) => boolean, maxDepth: number): Macro[] {
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

const combos = (algs: string[][], times: number[], rots = ROTS, ups = UPS): Macro[] =>
  rots.flatMap((rot) =>
    ups.flatMap((pre) => algs.flatMap((alg) => times.map((t) => ({ rot, pre, alg, times: t })))),
  )

interface Narration {
  rotate: (c: Cube) => string
  pre: (c: Cube, m: Macro) => string
  alg: (c: Cube, m: Macro) => { title: string; text: string }
}

/** Turn macros into individual, explained steps. */
function narrate(start: Cube, chain: Macro[], n: Narration): Step[] {
  const steps: Step[] = []
  let c = start
  for (const m of chain) {
    if (m.rot) {
      c = applyMoves(c, [m.rot])
      steps.push({
        title: `Turn the whole cube — ${COLOR_NAMES[c[centreIndex('F')]]} to the front`,
        text: `${n.rotate(c)} Keep ${COLOR_NAMES[c[centreIndex('U')]]} on top.`,
        moves: [m.rot],
      })
    }
    if (m.pre) {
      steps.push({ title: `Turn the top layer: ${m.pre}`, text: n.pre(c, m), moves: [m.pre] })
      c = applyMoves(c, [m.pre])
    }
    if (m.alg.length) {
      const { title, text } = n.alg(c, m)
      const moves = macroMoves({ ...m, rot: null, pre: null })
      steps.push({ title, text, moves, alg: m.alg, times: m.times })
      c = applyMoves(c, moves)
    }
  }
  return steps
}

const SEXY = ['R', 'U', "R'", "U'"]
const RIGHT_INSERT = ['U', 'R', "U'", "R'", "U'", "F'", 'U', 'F']
const LEFT_INSERT = ["U'", "L'", 'U', 'L', 'U', 'F', "U'", "F'"]
const YELLOW_CROSS_ALG = ['F', 'R', 'U', "R'", "U'", "F'"]
const SUNE = ['R', 'U', "R'", 'U', 'R', 'U2', "R'"]
const CORNER_CYCLE = ['U', 'R', "U'", "L'", 'U', "R'", "U'", 'L']
const TWIST = ["R'", "D'", 'R', 'D']

const newlySolved = (before: Cube, after: Cube, pieces: Color[][]) =>
  pieces.find((p) => !solvedPiece(before, p) && solvedPiece(after, p))

/** Solve pieces one at a time with a macro set, narrating each. */
function pieceByPiece(
  start: Cube,
  pieces: Color[][],
  keep: (c: Cube) => boolean,
  macros: Macro[],
  maxDepth: number,
  describe: (c: Cube, piece: Color[], chain: Macro[]) => Narration,
): { steps: Step[]; end: Cube } {
  const steps: Step[] = []
  let c = start
  while (countSolved(c, pieces) < pieces.length) {
    const before = c
    const solvedBefore = pieces.filter((p) => solvedPiece(c, p))
    const chain = search(
      c,
      macros,
      (x) => keep(x) && solvedBefore.every((p) => solvedPiece(x, p)) && countSolved(x, pieces) > solvedBefore.length,
      maxDepth,
    )
    const after = applyMoves(c, chain.flatMap(macroMoves))
    const piece = newlySolved(before, after, pieces)!
    steps.push(...narrate(c, chain, describe(c, piece, chain)))
    c = after
  }
  return { steps, end: c }
}

function solveCorners(cube: Cube) {
  return pieceByPiece(cube, WHITE_CORNERS, crossDone, combos([SEXY], [1, 2, 3, 4, 5]), 2, (c, piece, chain) => {
    const where = describeSlot(findPiece(c, piece))
    const name = `${pieceName(piece)} corner`
    return {
      rotate: () =>
        `Next is the ${name} (now at the ${where}). Turn the whole cube so the slot it belongs in is at the front-right of the bottom layer.`,
      pre: () => `Turn the top layer so the ${name} sits directly above the front-right-bottom slot.`,
      alg: (_, m) => {
        const pullOut = chain.length > 1 && m === chain[0]
        return pullOut
          ? {
              title: `Lift the ${name} out`,
              text: `The ${name} is stuck in the wrong place in the bottom layer. Do R U R' U' once to lift it into the top layer.`,
            }
          : {
              title: `Insert the ${name}`,
              text: `Repeat R U R' U' until the ${name} drops into place with white facing down — here that's ${m.times} time${m.times > 1 ? 's' : ''}.`,
            }
      },
    }
  })
}

function solveMiddle(cube: Cube) {
  return pieceByPiece(cube, MIDDLE_EDGES, firstLayerDone, combos([RIGHT_INSERT, LEFT_INSERT], [1]), 2, (c, piece, chain) => {
    const name = `${pieceName(piece)} edge`
    const where = describeSlot(findPiece(c, piece))
    return {
      rotate: () =>
        chain.length > 1
          ? `Turn the whole cube so the problem edge is in the front-left or front-right slot.`
          : `Next is the ${name} (now at the ${where}). Turn the whole cube so it's ready to insert (the centre matching its front colour faces you).`,
      pre: () => `Turn the top layer so the edge lines up with the centre that matches its front colour.`,
      alg: (cc, m) => {
        const right = m.alg === RIGHT_INSERT
        const pullOut = chain.length > 1 && m === chain[0]
        return {
          title: pullOut ? `Pop out the ${name}` : `Insert the ${name} to the ${right ? 'right' : 'left'}`,
          text: pullOut
            ? `The ${name} is in the middle layer but in the wrong slot or flipped. Do ${fmt(m.alg)} to swap a top edge in and pop it out.`
            : `The ${name} is in the top layer above the ${COLOR_NAMES[cc[centreIndex('F')]]} centre. Do ${fmt(m.alg)} to drop it into the ${right ? 'right' : 'left'} slot.`,
        }
      },
    }
  })
}

const SHAPES = (c: Cube) => {
  const up = [1, 3, 5, 7].filter((i) => c[i] === c[centreIndex('U')]).length
  return up === 0 ? 'a yellow dot' : up === 4 ? 'a yellow cross' : 'a yellow line or L shape'
}

function solveWithAlg(
  cube: Cube,
  goal: (c: Cube) => boolean,
  macros: Macro[],
  depth: number,
  algText: (c: Cube, m: Macro) => { title: string; text: string },
  preText: string,
  rotText: string,
) {
  const chain = search(cube, macros, goal, depth)
  const steps = narrate(cube, chain, { rotate: () => rotText, pre: () => preText, alg: algText })
  return { steps, end: applyMoves(cube, chain.flatMap(macroMoves)) }
}

function solveTwists(cube: Cube): { steps: Step[]; end: Cube } {
  const steps: Step[] = []
  let c = cube
  const Y = c[centreIndex('U')]
  const topCorners = () => [0, 2, 6, 8].filter((i) => c[i] !== Y).length
  const turn = (n: number, title: string, text: string) => {
    const move = [null, 'U', 'U2', "U'"][n % 4]
    if (!move) return
    steps.push({ title, text, moves: [move] })
    c = applyMoves(c, [move])
  }
  let first = true
  while (topCorners() > 0) {
    let n = 0
    while (applyMoves(c, Array(n).fill('U'))[8] === Y) n++
    turn(
      n,
      'Bring the next corner to front-right',
      "Turn ONLY the top layer so a corner without yellow on top is at the top-front-right. Don't turn the whole cube.",
    )
    let reps = 0
    while (c[8] !== Y) {
      c = applyMoves(c, TWIST)
      reps++
    }
    steps.push({
      title: 'Twist the corner',
      text:
        `Repeat R' D' R D until yellow is on top of the top-front-right corner — here ${reps} times.` +
        (first ? ' The bottom layers will look scrambled; that is normal and fixes itself at the end.' : ''),
      moves: Array.from({ length: reps }, () => TWIST).flat(),
      alg: TWIST,
      times: reps,
    })
    first = false
  }
  let n = 0
  while (!isSolved(applyMoves(c, Array(n).fill('U'))) && n < 4) n++
  turn(n, 'Turn the top to finish', 'Turn the top layer to line it up. The cube is solved!')
  return { steps, end: c }
}

// ---- Putting it together ---------------------------------------------------

const ORIENT = ['', 'x', 'x2', "x'", 'z', "z'"]

const OPPOSITE_FACE: Record<string, string> = { U: 'D', D: 'U', L: 'R', R: 'L', F: 'B', B: 'F' }

/** The shortest solution of up to `maxDepth` face turns, or null if it needs more. */
export function shortSolution(cube: Cube, maxDepth = 4): string[] | null {
  if (isSolved(cube)) return []
  const path: string[] = []
  const dfs = (c: Cube, depth: number): boolean => {
    if (depth === 0) return isSolved(c)
    const last = path[path.length - 1]
    for (const m of FACE_MOVES) {
      // Skip turning the same face twice, and try opposite faces in one order only.
      if (last && (last[0] === m[0] || (OPPOSITE_FACE[last[0]] === m[0] && last[0] > m[0]))) continue
      path.push(m)
      if (dfs(applyMove(c, m), depth - 1)) return true
      path.pop()
    }
    return false
  }
  for (let d = 1; d <= maxDepth; d++) if (dfs(cube, d)) return path
  return null
}

export function solve(cube: Cube): Stage[] {
  if (isSolved(cube)) return []
  const short = shortSolution(cube)
  if (short) {
    const n = short.length
    return [
      {
        name: 'Nearly solved',
        goal: 'The solved cube!',
        intro: `Your cube is only ${n} move${n === 1 ? '' : 's'} away from solved.`,
        steps: [{ title: 'Finish it', text: `Do ${fmt(short)} and you’re done.`, moves: short }],
        start: cube,
        end: applyMoves(cube, short),
      },
    ]
  }
  const stages: Stage[] = []
  let c = cube
  const add = (name: string, goal: string, intro: string, run: (c: Cube) => { steps: Step[]; end: Cube }) => {
    if (isSolved(c)) return
    const { steps, end } = run(c)
    stages.push({ name, goal, intro, steps, start: c, end })
    c = end
  }

  add(
    'White cross',
    'A white cross on top, with each edge’s other colour matching the centre beside it.',
    'Hold the cube with white on top. You build the cross one edge at a time; each edge goes on top with white facing up, and its other colour lined up with the matching side centre.',
    (start) => {
      const pre = ORIENT.find((r) => applyMoves(start, toList(r))[centreIndex('U')] === 'W')!
      const steps: Step[] = pre
        ? [{ title: 'Hold white on top', text: 'Turn the whole cube so the white centre is on top.', moves: [pre] }]
        : []
      const held = applyMoves(start, toList(pre))
      const cross = solveCross(held)
      return { steps: [...steps, ...cross], end: applyMoves(held, cross.flatMap((s) => s.moves)) }
    },
  )

  add(
    'White corners',
    'The whole white layer solved, with matching colours on the sides.',
    'Flip the cube so white is on the bottom. Each white corner is brought above its slot and inserted by repeating R U R\' U\'.',
    (start) => {
      const flip: Step = {
        title: 'Flip the cube over',
        text: `Turn the cube upside down so white is on the bottom, keeping ${COLOR_NAMES[start[centreIndex('F')]]} facing you.`,
        moves: ['z2'],
      }
      const r = solveCorners(applyMoves(start, ['z2']))
      return { steps: [flip, ...r.steps], end: r.end }
    },
  )

  add(
    'Middle layer',
    'The bottom two layers solved.',
    'Find an edge in the top layer with no yellow on it, line it up with its centre, then insert it left or right.',
    solveMiddle,
  )

  add(
    'Yellow cross',
    'A yellow cross on top (the corners don’t matter yet).',
    'Use F R U R\' U\' F\' to turn a dot into an L, an L into a line, and a line into a cross. Hold an L at the back-left, or a line left-to-right.',
    (start) =>
      solveWithAlg(
        start,
        yellowCross,
        combos([YELLOW_CROSS_ALG], [1], [null]),
        3,
        (cc) => ({ title: 'F R U R\' U\' F\'', text: `The top shows ${SHAPES(cc)}. Do F R U R' U' F'.` }),
        'Turn the top layer so the yellow L is at the back-left, or the line runs left-to-right.',
        '',
      ),
  )

  add(
    'Yellow edges',
    'Each yellow edge matches the centre below it.',
    'Turn the top until at least two edges match their centres, then use R U R\' U R U2 R\' to swap the others.',
    (start) =>
      solveWithAlg(
        start,
        yellowEdgesDone,
        [...combos([SUNE], [1]), ...UPS.slice(1).map((pre) => ({ rot: null, pre, alg: [], times: 0 }))],
        3,
        () => ({ title: "R U R' U R U2 R'", text: "Do R U R' U R U2 R' to swap edges round." }),
        'Turn the top layer to line up edges with their centres.',
        'Turn the whole cube so the matched edges are at the back and right (or so the right pair is ready to swap).',
      ),
  )

  add(
    'Yellow corners in place',
    'Each top corner in its right spot (it may still be twisted).',
    'A corner is in place when its three colours match the three centres around it, even if twisted. Hold a correct corner at front-right and cycle the others.',
    (start) =>
      solveWithAlg(
        start,
        cornersPlaced,
        combos([CORNER_CYCLE], [1], ROTS, [null]),
        3,
        () => ({ title: "U R U' L' U R' U' L", text: "Do U R U' L' U R' U' L to cycle the other three corners." }),
        '',
        'Turn the whole cube so a corner that is already in the right spot is at the top-front-right.',
      ),
  )

  add(
    'Twist the corners',
    'The solved cube!',
    'Hold the cube still with yellow on top. Twist each corner with R\' D\' R D, turning only the top layer to bring the next corner to the front-right.',
    solveTwists,
  )

  if (!isSolved(c)) throw new Error('Solver finished without solving the cube')
  return stages
}

const toList = (m: string) => (m ? [m] : [])

export const totalFaceTurns = (stages: Stage[]) =>
  stages.reduce((n, s) => n + s.steps.reduce((k, st) => k + faceTurns(st.moves), 0), 0)
