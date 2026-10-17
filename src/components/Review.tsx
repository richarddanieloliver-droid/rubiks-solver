import { useState } from 'react'
import { assemble } from '../lib/assemble'
import { COLOR_HEX, COLOR_NAMES, applyMoves, centreIndex, type Color, type Cube } from '../lib/cube'
import { CubeIso } from './CubeIso'

export type Face = (Color | null)[]

const COLORS: Color[] = ['W', 'Y', 'G', 'B', 'R', 'O']

/** The whole-cube turn that brings face U, R, F, D, L or B to the front of a picture. */
const VIEW_FOR = (face: number) => ["x'", 'y', undefined, 'x', "y'", 'y2'][face]

interface Props {
  faces: Face[]
  photos: (string | undefined)[]
  setFaces: (f: Face[]) => void
  onSolve: (cube: Cube) => void
  onRescan: () => void
}

export function Review({ faces, photos, setFaces, onSolve, onRescan }: Props) {
  const [paint, setPaint] = useState<Color>('W')
  const complete = faces.every((f) => f.every(Boolean))
  const result = complete ? assemble(faces as Color[][]) : null

  const tap = (f: number, i: number) => {
    if (i === 4 && photos[f] === undefined) return // hand-entered centres are fixed
    const next = faces.map((x) => x.slice())
    next[f][i] = paint
    setFaces(next)
  }

  // When two cubes fit, find the face that differs and show it at the front.
  let choice: { cubes: Cube[]; view: string | undefined } | null = null
  if (result && 'cube' in result && result.ambiguous) {
    const [a, b] = result.alternatives
    const face = [0, 1, 2, 3, 4, 5].find((k) => a.slice(k * 9, k * 9 + 9).join() !== b.slice(k * 9, k * 9 + 9).join())!
    choice = { cubes: [a, b], view: VIEW_FOR(face) }
  }

  return (
    <section className="review">
      <div className="card">
        <h3>Check the colours</h3>
        <p>
          {photos.some(Boolean)
            ? 'Compare each face with its photo. If a square is wrong, pick the right colour below and tap the square.'
            : 'For each face, pick a colour below and tap the squares to match your cube. Hold each face any way up.'}
        </p>
      </div>

      <div className="palette">
        {COLORS.map((c) => (
          <button
            key={c}
            className={`swatch-btn${paint === c ? ' on' : ''}`}
            style={{ background: COLOR_HEX[c] }}
            onClick={() => setPaint(c)}
            aria-label={`Paint ${COLOR_NAMES[c]}`}
          />
        ))}
      </div>

      <div className="faces">
        {faces.map((face, f) => (
          <div key={f} className="face-card">
            {photos[f] ? (
              <img src={photos[f]} alt={`Photo of face ${f + 1}`} />
            ) : (
              face[4] && <span className="face-label">{COLOR_NAMES[face[4]]} centre</span>
            )}
            <div className="face-grid">
              {face.map((c, i) => (
                <button
                  key={i}
                  className={`cell${c ? '' : ' empty'}`}
                  style={{ background: c ? COLOR_HEX[c] : undefined }}
                  onClick={() => tap(f, i)}
                  aria-label={c ? COLOR_NAMES[c] : 'blank'}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {!complete && <p className="muted center">Fill in every square to continue.</p>}
      {result && 'error' in result && (
        <div className="errors" role="alert">
          <p>{result.error}</p>
        </div>
      )}

      {choice ? (
        <div className="card">
          <h3>Your photos fit two ways</h3>
          <p>
            Hold your cube with <b>{COLOR_NAMES[applyMoves(choice.cubes[0], choice.view ? [choice.view] : [])[centreIndex('F')]]}</b>{' '}
            facing you and <b>{COLOR_NAMES[applyMoves(choice.cubes[0], choice.view ? [choice.view] : [])[centreIndex('U')]]}</b> on
            top. Which picture matches?
          </p>
          <div className="choices">
            {choice.cubes.map((c, k) => (
              <button key={k} className="choice" onClick={() => onSolve(c)}>
                <CubeIso cube={c} view={choice.view} size={130} />
                This one
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          className="primary wide"
          disabled={!result || !('cube' in result)}
          onClick={() => result && 'cube' in result && onSolve(result.cube)}
        >
          Solve it
        </button>
      )}
      <button className="link wide-link" onClick={onRescan}>
        ‹ Start again
      </button>
    </section>
  )
}
