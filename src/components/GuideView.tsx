import { useState } from 'react'
import {
  COLOR_HEX,
  COLOR_NAMES,
  MOVES,
  STICKERS,
  applyMove,
  applyMoves,
  centreIndex,
  findPiece,
  slotOf,
  type Color,
  type Cube,
} from '../lib/cube'
import { centresFor, rightOptions, turnToFront, type Answer, type Prompt } from '../lib/guided'
import { describeMove } from '../lib/notation'
import { CubeIso } from './CubeIso'
import { TopPic } from './TopPic'

type MovesPrompt = Extract<Prompt, { kind: 'moves' }>
type LocatePrompt = Extract<Prompt, { kind: 'locate' }>
type CheckPrompt = Extract<Prompt, { kind: 'check' }>

interface Props {
  prompt: Prompt
  cube: Cube
  onAnswer: (a: Answer) => void
}

export function GuideView({ prompt, cube, onAnswer }: Props) {
  switch (prompt.kind) {
    case 'orient':
      return <Orient onAnswer={onAnswer} />
    case 'locate':
      return <Locate key={prompt.title + (prompt.error ?? '')} prompt={prompt} cube={cube} onAnswer={onAnswer} />
    case 'moves':
      return <MovePlayer key={prompt.title + prompt.moves.join()} prompt={prompt} cube={cube} onDone={() => onAnswer({ done: true })} />
    case 'check':
      return <Check prompt={prompt} cube={cube} onAnswer={onAnswer} />
    case 'choice':
      return (
        <div className="card">
          <h3>{prompt.title}</h3>
          <p>{prompt.text}</p>
          <div className={`choices${prompt.options.some((o) => o.pic) ? ' with-pics' : ''}`}>
            {prompt.options.map((o) => (
              <button key={o.id} className="choice" onClick={() => onAnswer({ choice: o.id })}>
                {o.pic && <TopPic pic={o.pic} size={56} />}
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )
    case 'instruction':
      return (
        <div className="card">
          <h3>{prompt.title}</h3>
          <p>{prompt.text}</p>
          {prompt.pic && (
            <div className="center pic-wrap">
              <TopPic pic={prompt.pic} size={96} labels />
            </div>
          )}
          <button className="primary wide" onClick={() => onAnswer({ done: true })}>
            Done
          </button>
        </div>
      )
    case 'done':
      return null
  }
}

const SIDES: Color[] = ['G', 'R', 'B', 'O']
const cap = (c: Color) => COLOR_NAMES[c][0].toUpperCase() + COLOR_NAMES[c].slice(1)

function ColourChips({ colours, value, onPick }: { colours: Color[]; value?: Color | null; onPick: (c: Color) => void }) {
  return (
    <div className="chips">
      {colours.map((c) => (
        <button key={c} className={`chip${value === c ? ' on' : ''}`} onClick={() => onPick(c)} aria-pressed={value === c}>
          <span className="swatch" style={{ background: COLOR_HEX[c] }} />
          {cap(c)}
        </button>
      ))}
    </div>
  )
}

function Orient({ onAnswer }: { onAnswer: (a: Answer) => void }) {
  const [front, setFront] = useState<Color | null>(null)
  const [right, setRight] = useState<Color | null>(null)
  return (
    <div className="card">
      <h3>1. Hold the cube with the white centre on top</h3>
      <p>The centre is the middle square of a face. It never moves, so it tells you which colour that side will be.</p>

      <h3 className="spaced">2. Which centre is facing you?</h3>
      <ColourChips
        colours={SIDES}
        value={front}
        onPick={(c) => {
          setFront(c)
          setRight(null)
        }}
      />

      {front && (
        <>
          <h3 className="spaced">3. Which centre is on your right?</h3>
          <ColourChips colours={rightOptions(front)} value={right} onPick={setRight} />
        </>
      )}

      {front && right && (
        <>
          <div className="center pic-wrap">
            <CubeIso cube={centresFor(front, right)} size={170} />
          </div>
          <p className="center">
            Your cube should look like this from where you are: <b>white</b> on top, <b>{COLOR_NAMES[front]}</b> facing you,{' '}
            <b>{COLOR_NAMES[right]}</b> on the right. Keep holding it this way.
          </p>
          <button className="primary wide" onClick={() => onAnswer({ front, right })}>
            Looks right — start
          </button>
        </>
      )}
    </div>
  )
}

function Locate({ prompt, cube, onAnswer }: { prompt: LocatePrompt; cube: Cube; onAnswer: (a: Answer) => void }) {
  const [front, setFront] = useState<Color>(cube[centreIndex('F')] as Color)
  const [tap, setTap] = useState<number | null>(null)
  const [color, setColor] = useState<Color | null>(null)
  const turned = turnToFront(cube, front)
  const sides = (['F', 'R', 'B', 'L'] as const).map((f) => cube[centreIndex(f)] as Color)
  const size = prompt.piece.length
  const canTap = (i: number) => {
    const slot = slotOf(i)
    return !!slot && slot.length === size && slot.every((j) => turned[j] === null)
  }
  const top = COLOR_NAMES[cube[centreIndex('U')] as Color]
  return (
    <div className="card">
      <h3>{prompt.title}</h3>
      <p>{prompt.text}</p>
      {prompt.error && (
        <p className="errors" role="alert">
          {prompt.error}
        </p>
      )}

      <p className="step-label">Which centre is facing you now?</p>
      <ColourChips
        colours={sides}
        value={front}
        onPick={(c) => {
          setFront(c)
          setTap(null)
          setColor(null)
        }}
      />

      <p className="step-label">Tap where the piece is on the face in front of you</p>
      <div className="front-face">
        <span className="muted small">{top} on top</span>
        <div className="front-grid">
          {Array.from({ length: 9 }, (_, k) => {
            const i = 18 + k
            const known = turned[i]
            const ok = canTap(i)
            return (
              <button
                key={i}
                className={`sq${tap === i ? ' sel' : ''}${ok ? ' tap' : ''}`}
                style={{ background: tap === i && color ? COLOR_HEX[color] : known ? COLOR_HEX[known] : undefined }}
                disabled={!ok}
                onClick={() => {
                  setTap(i)
                  setColor(null)
                }}
                aria-label={known ? COLOR_NAMES[known] : `square ${k + 1}`}
              />
            )
          })}
        </div>
      </div>

      {tap !== null && (
        <>
          <p className="step-label">What colour is that square?</p>
          <ColourChips colours={prompt.piece} value={color} onPick={setColor} />
        </>
      )}

      <button
        className="primary wide"
        disabled={tap === null || !color}
        onClick={() => tap !== null && color && onAnswer({ front, tap, color })}
      >
        {tap === null ? 'Tap the piece’s square' : !color ? 'Pick the square’s colour' : 'Show me the moves'}
      </button>
    </div>
  )
}

const VISIBLE_FACES = ['U', 'F', 'R']

function Check({ prompt, cube, onAnswer }: { prompt: CheckPrompt; cube: Cube; onAnswer: (a: Answer) => void }) {
  // Turn the picture (not the cube) so every square of the piece can be seen.
  const slot = findPiece(cube, prompt.piece) ?? []
  const view = [undefined, 'y', "y'", 'y2'].find((v) => {
    const perm = v ? MOVES[v] : null
    return slot.every((i) => VISIBLE_FACES.includes(STICKERS[perm ? perm[i] : i].face))
  })
  const shownFront = view ? applyMoves(cube, [view])[centreIndex('F')] : null
  return (
    <div className="card">
      <h3>{prompt.title}</h3>
      <p>{prompt.text}</p>
      <figure className="center pic-wrap">
        <CubeIso cube={cube} view={view} size={200} />
        {shownFront && (
          <figcaption className="muted small">
            Picture turned so you can see the whole piece ({COLOR_NAMES[shownFront]} at the front). Don’t turn your cube.
          </figcaption>
        )}
      </figure>
      <div className="choices one-col">
        <button className="choice primary" onClick={() => onAnswer({ choice: 'yes' })}>
          Yes, it’s in place
        </button>
        <button className="choice" onClick={() => onAnswer({ choice: 'no' })}>
          No — I’ll find it again
        </button>
        <button className="choice" onClick={() => onAnswer({ choice: 'others' })}>
          No, and pieces I’d already placed have moved too
        </button>
      </div>
    </div>
  )
}

function MovePlayer({ prompt, cube, onDone }: { prompt: MovesPrompt; cube: Cube; onDone: () => void }) {
  const [at, setAt] = useState(0)
  const before = prompt.moves.slice(0, at).reduce(applyMove, cube)
  const move = prompt.moves[at]
  const after = applyMove(before, move)
  const desc = describeMove(move)
  const last = at === prompt.moves.length - 1
  return (
    <div className="card">
      <h3>{prompt.title}</h3>
      <p>{prompt.text}</p>
      <div className="views">
        <figure>
          <CubeIso cube={before} move={move} size={200} />
        </figure>
        <figure className="after">
          <CubeIso cube={after} size={90} />
          <figcaption>After</figcaption>
        </figure>
      </div>
      <div className="move">
        <div className="move-big">{move}</div>
        <div>
          <div className="move-head">{desc.head}</div>
          <div className="move-detail">{desc.detail}</div>
        </div>
      </div>
      {prompt.moves.length > 1 && (
        <p className="seq">
          {prompt.moves.map((m, i) => (
            <span key={i} className={i === at ? 'cur' : i < at ? 'past' : ''}>
              {m}
            </span>
          ))}
        </p>
      )}
      <div className="row split">
        <button onClick={() => setAt(at - 1)} disabled={at === 0}>
          ‹ Back
        </button>
        <span className="muted small">
          Move {at + 1} of {prompt.moves.length}
        </span>
        <button className="primary" onClick={() => (last ? onDone() : setAt(at + 1))}>
          {last ? 'Done ✓' : 'Next ›'}
        </button>
      </div>
    </div>
  )
}
