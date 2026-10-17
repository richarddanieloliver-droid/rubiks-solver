// "Find the piece" guide. Instead of entering the whole cube, the person taps
// where each piece is as it's needed (white cross, white corners, middle
// layer), and answers simple "what do you see?" questions for the last layer.
//
// The guide only tracks stickers it has been told about; everything else is
// null. Pieces are placed with searches that keep every known piece solved.

import {
  COLOR_NAMES,
  STICKERS,
  applyMoves,
  centreIndex,
  describeSlot,
  findPiece,
  homeColor,
  homeSlot,
  knownSolved,
  pieceName,
  slotOf,
  solvedCube,
  type Color,
  type Cube,
} from './cube'
import {
  CORNER_CYCLE,
  LEFT_INSERT,
  RIGHT_INSERT,
  SEXY,
  SUNE,
  TWIST,
  YELLOW_CROSS_ALG,
  bfsStickers,
  combos,
  macroMoves,
  search,
  type Macro,
} from './search'

/** Little top-face diagrams used in the last-layer questions. */
export type Pic = 'dot' | 'L' | 'line' | 'cross'

export interface Option {
  id: string
  label: string
  pic?: Pic
}

export type Prompt =
  | { kind: 'orient' }
  | { kind: 'locate'; title: string; text: string; piece: Color[]; ask: Color; error?: string }
  | { kind: 'moves'; title: string; text: string; moves: string[] }
  | { kind: 'choice'; id: string; title: string; text: string; options: Option[] }
  | { kind: 'instruction'; id: string; title: string; text: string; pic?: Pic; rotates?: boolean }
  | { kind: 'done' }

export type Answer = { color: Color } | { tap: number } | { choice: string } | { done: true }

export interface Guide {
  stage: number
  cube: Cube
  /** queue[0] is what's on screen now. */
  queue: Prompt[]
  /** Pieces still to place in the current stage (stages 0-2). */
  pieces: Color[][]
}

export const STAGES = [
  {
    name: 'White cross',
    goal: 'A white cross on top, each edge’s other colour matching the centre beside it.',
    intro: 'Hold the cube with white on top. For each white edge, find it on your cube, tap where it is, then follow the moves.',
  },
  {
    name: 'White corners',
    goal: 'The whole white layer solved.',
    intro: 'White goes on the bottom now. For each white corner: find it, tap where it is, follow the moves.',
  },
  {
    name: 'Middle layer',
    goal: 'The bottom two layers solved.',
    intro: 'Now the four middle edges — the ones with no white or yellow. Find each, tap it, follow the moves.',
  },
  {
    name: 'Yellow cross',
    goal: 'A yellow cross on top (corners don’t matter yet).',
    intro: 'From here you don’t need to tap pieces — just say what you see on top.',
  },
  {
    name: 'Yellow edges',
    goal: 'Every top edge matches the centre below it.',
    intro: 'Line the top edges up with their centres.',
  },
  {
    name: 'Corners in place',
    goal: 'Every top corner in its right spot (it may still be twisted).',
    intro: 'Move the top corners to their right spots. Don’t worry about twists yet.',
  },
  {
    name: 'Twist the corners',
    goal: 'A solved cube!',
    intro: 'Twist each top corner until yellow faces up.',
  },
]

const name = (c: Color) => COLOR_NAMES[c]

/** Side centre colours in order front, right, back, left. */
const sides = (cube: Cube) => (['F', 'R', 'B', 'L'] as const).map((f) => cube[centreIndex(f)] as Color)

function centresFacing(front: Color): Cube {
  let c: Cube = solvedCube().map((x, i) => (i % 9 === 4 ? x : null))
  for (let k = 0; k < 4 && c[centreIndex('F')] !== front; k++) c = applyMoves(c, ['y'])
  return c
}

// ---- Locating pieces ---------------------------------------------------------

function locatePrompt(piece: Color[], ask: Color): Prompt {
  const kind = piece.length === 2 ? 'edge' : 'corner'
  const colours =
    piece.length === 2 ? `${name(piece[0])} and ${name(piece[1])}` : `${name(piece[0])}, ${name(piece[1])} and ${name(piece[2])}`
  return {
    kind: 'locate',
    piece,
    ask,
    title: `Find the ${pieceName(piece)} ${kind}`,
    text: `Look for the ${kind} piece with ${colours} on it. Tap where its ${name(ask)} square is.`,
  }
}

/** Put a located piece into the known cube, or explain why the tap can't be right. */
export function place(cube: Cube, piece: Color[], ask: Color, tap: number): Cube | string {
  const slot = slotOf(tap)
  if (!slot || slot.length !== piece.length)
    return piece.length === 2
      ? 'That’s not an edge square. Tap the middle square along an edge, between two corners.'
      : 'That’s not a corner square. Tap a square in one of the corners.'
  if (slot.some((i) => cube[i] !== null)) return 'That piece is already solved, so it can’t be there. Look again.'
  const home = homeSlot(cube, piece)
  const homeColors = home.map((i) => homeColor(cube, i) as Color)
  const k = homeColors.indexOf(ask)
  const j = slot.indexOf(tap)
  const out = cube.slice()
  // Slots list their stickers in the same rotational order, so the colours
  // follow round from the tapped square.
  slot.forEach((_, m) => {
    out[slot[(j + m) % slot.length]] = homeColors[(k + m) % slot.length]
  })
  return out
}

const already = (piece: Color[]): Prompt => ({
  kind: 'instruction',
  id: 'already',
  title: 'Already in place',
  text: `The ${pieceName(piece)} ${piece.length === 2 ? 'edge' : 'corner'} is already in the right place. Nothing to do!`,
})

// ---- Stage 1: cross, by breadth-first search ---------------------------------

function crossSteps(cube: Cube, piece: Color[]): Prompt[] {
  const known = sides(cube)
    .map((c): Color[] => ['W', c])
    .filter((p) => findPiece(cube, p))
  const moves = bfsStickers(
    known.map((p) => findPiece(cube, p)!.find((i) => cube[i] === 'W')!),
    known.map((p) => homeSlot(cube, p).find((i) => STICKERS[i].face === 'U')!),
  )
  if (!moves.length) return [already(piece)]
  const keep = known.length > 1 ? ' These moves leave the edges you’ve already placed where they are.' : ''
  return [
    {
      kind: 'moves',
      title: `Place the ${pieceName(piece)} edge`,
      text: `It’s at the ${describeSlot(findPiece(cube, piece)!)}. These moves bring it to the top with white facing up, next to the ${name(piece[1])} centre.${keep}`,
      moves,
    },
  ]
}

// ---- Stages 2-3: macro search ------------------------------------------------

interface Words {
  rotate: (cube: Cube, first: boolean) => string
  pre: string
  alg: (m: Macro, pullOut: boolean) => { title: string; text: string }
}

function macroSteps(cube: Cube, piece: Color[], macros: Macro[], words: Words): Prompt[] {
  const chain = search(cube, macros, knownSolved, 2)
  if (!chain.length) return [already(piece)]
  const out: Prompt[] = []
  let c = cube
  chain.forEach((m, n) => {
    const pullOut = chain.length > 1 && n === 0
    if (m.rot) {
      c = applyMoves(c, [m.rot])
      out.push({
        kind: 'moves',
        title: `Turn the whole cube: ${name(c[centreIndex('F')] as Color)} to the front`,
        text: `${words.rotate(c, pullOut)} Keep ${name(c[centreIndex('U')] as Color)} on top.`,
        moves: [m.rot],
      })
    }
    if (m.pre) {
      out.push({ kind: 'moves', title: `Turn the top layer`, text: words.pre, moves: [m.pre] })
      c = applyMoves(c, [m.pre])
    }
    const moves = macroMoves({ ...m, rot: null, pre: null })
    out.push({ kind: 'moves', ...words.alg(m, pullOut), moves })
    c = applyMoves(c, moves)
  })
  return out
}

function cornerSteps(cube: Cube, piece: Color[]): Prompt[] {
  const label = `${pieceName(piece)} corner`
  return macroSteps(cube, piece, combos([SEXY], [1, 2, 3, 4, 5]), {
    rotate: (_, pullOut) =>
      pullOut
        ? `This brings the ${label} to the front-right so you can lift it out.`
        : `This puts the ${label}’s slot at the front-right of the bottom layer.`,
    pre: `This puts the ${label} directly above the front-right slot of the bottom layer.`,
    alg: (m, pullOut) =>
      pullOut
        ? {
            title: `Lift the ${label} out`,
            text: `It’s stuck in the wrong slot. Do R U R' U' once to lift it into the top layer.`,
          }
        : {
            title: `Insert the ${label}`,
            text: `Do R U R' U' ${m.times === 1 ? 'once' : `${m.times} times`}. The corner drops into place with white facing down.`,
          },
  })
}

function middleSteps(cube: Cube, piece: Color[]): Prompt[] {
  const label = `${pieceName(piece)} edge`
  return macroSteps(cube, piece, combos([RIGHT_INSERT, LEFT_INSERT], [1]), {
    rotate: (_, pullOut) =>
      pullOut
        ? `This brings the ${label} to the front so you can pop it out.`
        : `This gets the cube ready to insert the ${label}.`,
    pre: `This lines the ${label} up above the centre that matches it.`,
    alg: (m, pullOut) => {
      const side = m.alg === RIGHT_INSERT ? 'right' : 'left'
      return pullOut
        ? {
            title: `Pop the ${label} out`,
            text: `It’s in the middle layer but in the wrong place. These moves swap it out into the top layer.`,
          }
        : { title: `Insert the ${label} to the ${side}`, text: `These moves drop it into the ${side} slot.` }
    },
  })
}

// ---- Stages 4-7: questions ---------------------------------------------------

const movesPrompt = (title: string, text: string, moves: string[]): Extract<Prompt, { kind: 'moves' }> => ({
  kind: 'moves',
  title,
  text,
  moves,
})

const yellowCross: Prompt = {
  kind: 'choice',
  id: 'yellow-cross',
  title: 'What’s on top?',
  text: 'Look at the yellow face. Ignore the corners — just the centre and the four edges around it. Which do you see?',
  options: [
    { id: 'dot', label: 'Just the centre', pic: 'dot' },
    { id: 'L', label: 'An L shape', pic: 'L' },
    { id: 'line', label: 'A line', pic: 'line' },
    { id: 'cross', label: 'A cross', pic: 'cross' },
  ],
}

const yellowEdges: Prompt = {
  kind: 'choice',
  id: 'yellow-edges',
  title: 'How many edges match?',
  text: 'Turn the top layer until as many top edges as possible match the centre below them (look at each edge’s side colour). How many match?',
  options: [
    { id: 'all', label: 'All four' },
    { id: 'adjacent', label: 'Two, side by side' },
    { id: 'opposite', label: 'Two, opposite each other' },
  ],
}

const yellowCorners: Prompt = {
  kind: 'choice',
  id: 'yellow-corners',
  title: 'Which corners are in the right place?',
  text: 'A top corner is in the right place when its three colours are the same as the three centres around it — even if it’s twisted. Check all four.',
  options: [
    { id: 'all', label: 'All four' },
    { id: 'one', label: 'Just one' },
    { id: 'none', label: 'None' },
  ],
}

const twistFind: Prompt = {
  kind: 'choice',
  id: 'twist-find',
  title: 'Find a corner to twist',
  text: 'Turn ONLY the top layer until a corner without yellow on top is at the top-front-right.',
  options: [
    { id: 'ready', label: 'Done — it’s at the front-right' },
    { id: 'all', label: 'Every corner has yellow on top' },
  ],
}

const twistCheck: Prompt = {
  kind: 'choice',
  id: 'twist-check',
  title: 'Is yellow on top of that corner now?',
  text: 'Look at the top-front-right corner.',
  options: [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'Not yet' },
  ],
}

/** Forget the side colours after a whole-cube turn we can't see. */
const blankSides = (cube: Cube) =>
  cube.map((c, i) => (STICKERS[i].face === 'D' || i === centreIndex('U') ? c : null))

function choose(g: Guide, id: string, choice: string, rest: Prompt[]): Guide {
  const q = (...prompts: Prompt[]) => ({ ...g, queue: [...prompts, ...rest] })
  const cross = movesPrompt("F R U R' U' F'", "Do F R U R' U' F'.", YELLOW_CROSS_ALG)
  const sune = movesPrompt("R U R' U R U2 R'", "Do R U R' U R U2 R'.", SUNE)
  const cycle = movesPrompt("U R U' L' U R' U' L", "Do U R U' L' U R' U' L.", CORNER_CYCLE)
  const twist = movesPrompt("R' D' R D", "Do R' D' R D.", TWIST)
  switch (`${id}:${choice}`) {
    case 'yellow-cross:dot':
      return q(cross)
    case 'yellow-cross:L':
      return q(
        { kind: 'instruction', id: 'L-back-left', title: 'Turn the top', pic: 'L', text: 'Turn the top layer so the L points to the back and to the left, like this.' },
        cross,
      )
    case 'yellow-cross:line':
      return q(
        { kind: 'instruction', id: 'line-across', title: 'Turn the top', pic: 'line', text: 'Turn the top layer so the line runs from left to right, like this.' },
        cross,
      )
    case 'yellow-cross:cross':
      return { ...g, stage: 4, queue: rest }
    case 'yellow-edges:adjacent':
      return q(
        {
          kind: 'instruction',
          id: 'edges-back-right',
          title: 'Turn the whole cube',
          text: 'Keep yellow on top and turn the whole cube so the two matching edges are at the back and on the right.',
          rotates: true,
        },
        sune,
      )
    case 'yellow-edges:opposite':
      return q({ ...sune, text: "Do R U R' U R U2 R' from any side. After this, two edges will match side by side." })
    case 'yellow-edges:all':
      return { ...g, stage: 5, queue: rest }
    case 'yellow-corners:one':
      return q(
        {
          kind: 'instruction',
          id: 'corner-front-right',
          title: 'Turn the whole cube',
          text: 'Keep yellow on top and turn the whole cube so the corner that’s in the right place is at the top-front-right.',
          rotates: true,
        },
        cycle,
      )
    case 'yellow-corners:none':
      return q({ ...cycle, text: "Do U R U' L' U R' U' L from any side. After this, at least one corner will be in place." })
    case 'yellow-corners:all':
      return {
        ...g,
        stage: 6,
        queue: [
          {
            kind: 'instruction',
            id: 'hold-still',
            title: 'Hold it still from now on',
            text: 'Keep yellow on top and don’t turn the whole cube again. Between twists you only turn the top layer. The bottom will look messed up while you work — that’s normal and fixes itself at the end.',
          },
          ...rest,
        ],
      }
    case 'twist-find:ready':
      return q(twist, twistCheck)
    case 'twist-find:all':
      return {
        ...g,
        stage: 7,
        queue: [
          { kind: 'instruction', id: 'finish', title: 'Last move', text: 'Turn the top layer until it lines up with the rest of the cube.' },
          ...rest,
        ],
      }
    case 'twist-check:no':
      return q({ ...twist, text: "Do R' D' R D again." }, twistCheck)
    default:
      return q()
  }
}

// ---- The guide ---------------------------------------------------------------

export const startGuide = (): Guide => ({ stage: 0, cube: Array(54).fill(null), queue: [{ kind: 'orient' }], pieces: [] })

/** If nothing is queued, work out what to ask next. */
function fill(g: Guide): Guide {
  if (g.queue.length) return g
  const { stage, cube } = g
  if (stage <= 2 && g.pieces.length) {
    const piece = g.pieces[0]
    return { ...g, queue: [locatePrompt(piece, stage === 2 ? piece[0] : 'W')] }
  }
  switch (stage) {
    case 0: {
      const flipped = applyMoves(cube, ['z2'])
      const s = sides(flipped)
      return {
        ...g,
        stage: 1,
        pieces: s.map((c, i): Color[] => ['W', c, s[(i + 1) % 4]]),
        queue: [
          movesPrompt(
            'Flip the cube over',
            `Turn the cube upside down so white is on the bottom, keeping ${name(cube[centreIndex('F')] as Color)} facing you.`,
            ['z2'],
          ),
        ],
      }
    }
    case 1: {
      const s = sides(cube)
      return fill({ ...g, stage: 2, pieces: s.map((c, i): Color[] => [c, s[(i + 1) % 4]]) })
    }
    case 2:
    case 3:
      return { ...g, stage: 3, queue: [yellowCross] }
    case 4:
      return { ...g, queue: [yellowEdges] }
    case 5:
      return { ...g, queue: [yellowCorners] }
    case 6:
      return { ...g, queue: [twistFind] }
    default:
      return { ...g, queue: [{ kind: 'done' }] }
  }
}

export function advance(g: Guide, a: Answer): Guide {
  const [p, ...rest] = g.queue
  switch (p.kind) {
    case 'orient': {
      if (!('color' in a)) return g
      const cube = centresFacing(a.color)
      return fill({ stage: 0, cube, queue: [], pieces: sides(cube).map((c): Color[] => ['W', c]) })
    }
    case 'locate': {
      if (!('tap' in a)) return g
      const placed = place(g.cube, p.piece, p.ask, a.tap)
      if (typeof placed === 'string') return { ...g, queue: [{ ...p, error: placed }, ...rest] }
      const steps =
        g.stage === 0 ? crossSteps(placed, p.piece) : g.stage === 1 ? cornerSteps(placed, p.piece) : middleSteps(placed, p.piece)
      return fill({ ...g, cube: placed, pieces: g.pieces.slice(1), queue: [...steps, ...rest] })
    }
    case 'moves':
      return fill({ ...g, cube: applyMoves(g.cube, p.moves), queue: rest })
    case 'instruction':
      return fill({ ...g, cube: p.rotates ? blankSides(g.cube) : g.cube, queue: rest })
    case 'choice':
      if (!('choice' in a)) return g
      return fill(choose(g, p.id, a.choice, rest))
    case 'done':
      return g
  }
}
