import { useState } from 'react'
import {
  COLOR_HEX,
  COLOR_NAMES,
  FACES,
  FACE_NAMES,
  SCHEME,
  applyMoves,
  faceIndex,
  randomScramble,
  solvedCube,
  type Color,
  type Face,
} from '../lib/cube'
import { validate } from '../lib/validate'
import { CubeNet } from './CubeNet'

export type Draft = (Color | null)[]

const COLORS: Color[] = ['W', 'Y', 'G', 'B', 'R', 'O']

const HOLD: Record<Face, string> = {
  F: 'White on top, green facing you. Enter the face you see.',
  R: 'White on top. Turn the cube so red faces you.',
  B: 'White on top. Turn the cube so blue faces you.',
  L: 'White on top. Turn the cube so orange faces you.',
  U: 'Green facing you, then tip the cube towards you so you look down on white. Green is now at the bottom edge.',
  D: 'Green facing you, then tip the cube away so you see the yellow bottom. Green is now at the top edge.',
}

const ORDER: Face[] = ['F', 'R', 'B', 'L', 'U', 'D']

export const blankDraft = (): Draft =>
  FACES.flatMap((f) => Array.from({ length: 9 }, (_, i) => (i === 4 ? SCHEME[f] : null)))

interface Props {
  draft: Draft
  setDraft: (d: Draft) => void
  onSolve: () => void
}

export function CubeInput({ draft, setDraft, onSolve }: Props) {
  const [face, setFace] = useState<Face>('F')
  const [paint, setPaint] = useState<Color>('W')
  const [scramble, setScramble] = useState<string | null>(null)

  const fi = faceIndex(face)
  const filled = draft.filter(Boolean).length
  const errors = filled === 54 ? validate(draft) : []
  const counts = Object.fromEntries(COLORS.map((c) => [c, draft.filter((x) => x === c).length]))

  const tap = (i: number) => {
    if (i === 4) return
    const next = draft.slice()
    next[fi * 9 + i] = next[fi * 9 + i] === paint ? null : paint
    setDraft(next)
    setScramble(null)
  }

  const step = (d: number) => setFace(ORDER[(ORDER.indexOf(face) + d + 6) % 6])

  return (
    <section className="input">
      <div className="face-tabs" role="tablist">
        {ORDER.map((f) => {
          const done = draft.slice(faceIndex(f) * 9, faceIndex(f) * 9 + 9).every(Boolean)
          return (
            <button
              key={f}
              role="tab"
              aria-selected={face === f}
              className={`face-tab${face === f ? ' on' : ''}${done ? ' done' : ''}`}
              onClick={() => setFace(f)}
            >
              <span className="dot" style={{ background: COLOR_HEX[SCHEME[f]] }} />
              {FACE_NAMES[f]}
            </button>
          )
        })}
      </div>

      <p className="hold">
        <strong>
          {FACE_NAMES[face][0].toUpperCase() + FACE_NAMES[face].slice(1)} ({COLOR_NAMES[SCHEME[face]]} centre):
        </strong>{' '}
        {HOLD[face]}
      </p>

      <div className="editor">
        <button className="nav" onClick={() => step(-1)} aria-label="Previous face">
          ‹
        </button>
        <div className="face-grid">
          {Array.from({ length: 9 }, (_, i) => {
            const c = draft[fi * 9 + i]
            return (
              <button
                key={i}
                className={`cell${i === 4 ? ' centre' : ''}${c ? '' : ' empty'}`}
                style={{ background: c ? COLOR_HEX[c] : undefined }}
                onClick={() => tap(i)}
                aria-label={c ? COLOR_NAMES[c] : 'blank'}
              />
            )
          })}
        </div>
        <button className="nav" onClick={() => step(1)} aria-label="Next face">
          ›
        </button>
      </div>

      <div className="palette">
        {COLORS.map((c) => (
          <button
            key={c}
            className={`swatch${paint === c ? ' on' : ''}`}
            style={{ background: COLOR_HEX[c] }}
            onClick={() => setPaint(c)}
            aria-label={`Paint ${COLOR_NAMES[c]}`}
          >
            <span className="count">{9 - counts[c]}</span>
          </button>
        ))}
      </div>
      <p className="muted small center">Pick a colour, then tap squares. Numbers show how many of each are left to place.</p>

      <div className="overview">
        <CubeNet cube={draft} active={face} onFace={setFace} />
      </div>

      {errors.length > 0 && (
        <div className="errors" role="alert">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}
      {scramble && (
        <p className="muted small">
          Random scramble (white top, green front): <code>{scramble}</code>
        </p>
      )}

      <div className="actions">
        <button className="primary" disabled={filled < 54 || errors.length > 0} onClick={onSolve}>
          {filled < 54 ? `${54 - filled} squares to go` : 'Solve it'}
        </button>
        <div className="row">
          <button
            onClick={() => {
              const s = randomScramble()
              setDraft(applyMoves(solvedCube(), s))
              setScramble(s.join(' '))
            }}
          >
            Random scramble
          </button>
          <button
            onClick={() => {
              setDraft(blankDraft())
              setScramble(null)
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </section>
  )
}
