import { useState } from 'react'
import { COLOR_HEX, COLOR_NAMES, applyMove, slotOf, type Color, type Cube } from '../lib/cube'
import type { Answer, Prompt } from '../lib/guided'
import { describeMove } from '../lib/notation'
import { CubeIso } from './CubeIso'
import { TopPic } from './TopPic'

type MovesPrompt = Extract<Prompt, { kind: 'moves' }>
type LocatePrompt = Extract<Prompt, { kind: 'locate' }>

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

function Orient({ onAnswer }: { onAnswer: (a: Answer) => void }) {
  return (
    <div className="card">
      <h3>Hold your cube with white on top</h3>
      <p>Turn the whole cube until the white centre square is on top. Which colour centre is facing you?</p>
      <div className="choices">
        {SIDES.map((c) => (
          <button key={c} className="choice colour" onClick={() => onAnswer({ color: c })}>
            <span className="swatch" style={{ background: COLOR_HEX[c] }} />
            {COLOR_NAMES[c][0].toUpperCase() + COLOR_NAMES[c].slice(1)}
          </button>
        ))}
      </div>
      <p className="muted small">
        Keep holding it this way. Every picture in the app shows the cube the way you’re holding it.
      </p>
    </div>
  )
}

const VIEWS = [
  { view: undefined, label: 'Front, top & right', hint: 'as you’re holding it' },
  { view: 'y2', label: 'Back, top & left', hint: 'turn the cube round to look' },
  { view: 'x', label: 'Bottom', hint: 'tip the top away from you to look underneath' },
]

function Locate({ prompt, cube, onAnswer }: { prompt: LocatePrompt; cube: Cube; onAnswer: (a: Answer) => void }) {
  const [selected, setSelected] = useState<number | null>(null)
  const size = prompt.piece.length
  const canTap = (i: number) => {
    const slot = slotOf(i)
    return !!slot && slot.length === size && slot.every((j) => cube[j] === null)
  }
  return (
    <div className="card">
      <h3>{prompt.title}</h3>
      <p>{prompt.text}</p>
      {prompt.error && (
        <p className="errors" role="alert">
          {prompt.error}
        </p>
      )}
      <div className="tap-views">
        {VIEWS.map((v) => (
          <figure key={v.label}>
            <CubeIso
              cube={cube}
              view={v.view}
              size={v.view ? 150 : 210}
              canTap={canTap}
              onTap={setSelected}
              selected={selected}
              selectedColor={prompt.ask}
            />
            <figcaption>
              <b>{v.label}</b>
              <br />
              {v.hint}
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="muted small">
        Grey squares are ones the app doesn’t know yet. Coloured ones are already solved.
      </p>
      <button className="primary wide" disabled={selected === null} onClick={() => selected !== null && onAnswer({ tap: selected })}>
        {selected === null ? `Tap where the ${COLOR_NAMES[prompt.ask]} square is` : 'That’s where it is'}
      </button>
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
