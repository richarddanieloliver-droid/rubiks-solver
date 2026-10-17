import { useEffect, useMemo, useState } from 'react'
import { applyMove, type Cube } from '../lib/cube'
import { describeMove } from '../lib/notation'
import type { Stage } from '../lib/solver'
import { CubeIso } from './CubeIso'
import { CubeNet } from './CubeNet'

interface Frame {
  stage: number
  step: number
  /** Index of this move within its step, and the step's total. */
  moveNo: number
  moveCount: number
  move: string | null
  before: Cube
  after: Cube
}

function buildFrames(stages: Stage[]): Frame[] {
  const frames: Frame[] = []
  stages.forEach((st, si) => {
    let c = st.start
    st.steps.forEach((step, pi) => {
      if (!step.moves.length) {
        frames.push({ stage: si, step: pi, moveNo: 0, moveCount: 0, move: null, before: c, after: c })
        return
      }
      step.moves.forEach((m, mi) => {
        const after = applyMove(c, m)
        frames.push({ stage: si, step: pi, moveNo: mi, moveCount: step.moves.length, move: m, before: c, after })
        c = after
      })
    })
    if (!st.steps.length) frames.push({ stage: si, step: -1, moveNo: 0, moveCount: 0, move: null, before: c, after: c })
  })
  return frames
}

export function SolutionView({ stages, onEdit }: { stages: Stage[]; onEdit: () => void }) {
  const frames = useMemo(() => buildFrames(stages), [stages])
  const [at, setAt] = useState(0)
  const [showList, setShowList] = useState(false)
  const [showNet, setShowNet] = useState(false)
  const finished = at >= frames.length
  const f = frames[Math.min(at, frames.length - 1)]
  const stage = stages[f.stage]
  const step = f.step >= 0 ? stage.steps[f.step] : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setAt((a) => Math.min(a + 1, frames.length))
      if (e.key === 'ArrowLeft') setAt((a) => Math.max(a - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [frames.length])

  const jump = (stageIdx: number, stepIdx = 0) => {
    const i = frames.findIndex((fr) => fr.stage === stageIdx && (fr.step === stepIdx || fr.step === -1))
    setAt(i < 0 ? frames.findIndex((fr) => fr.stage === stageIdx) : i)
    setShowList(false)
  }

  const firstOfStage = frames.findIndex((fr) => fr.stage === f.stage) === at
  const rep = step?.alg && f.move ? Math.floor(f.moveNo / step.alg.length) + 1 : null
  const desc = f.move ? describeMove(f.move) : null

  return (
    <section className="solution">
      <ol className="stages">
        {stages.map((s, i) => (
          <li key={s.name}>
            <button
              className={`${i === f.stage && !finished ? 'on' : ''} ${i < f.stage || finished ? 'done' : ''}`}
              onClick={() => jump(i)}
              title={s.name}
            >
              {i < f.stage || finished ? '✓' : i + 1}
            </button>
          </li>
        ))}
      </ol>

      {finished ? (
        <div className="card center">
          <h2>Solved! 🎉</h2>
          <CubeIso cube={frames[frames.length - 1].after} />
          <div className="row center">
            <button onClick={() => setAt(0)}>Start again</button>
            <button className="primary" onClick={onEdit}>
              Enter another cube
            </button>
          </div>
        </div>
      ) : (
        <>
          <header className="stage-head">
            <p className="eyebrow">
              Stage {f.stage + 1} of {stages.length}
            </p>
            <h2>{stage.name}</h2>
            <p className="muted small">Goal: {stage.goal}</p>
            <details className="intro" open={firstOfStage} key={f.stage}>
              <summary>How this stage works</summary>
              {stage.intro}
            </details>
          </header>

          <div className="views">
            <figure>
              <CubeIso cube={f.before} move={f.move} />
              <figcaption>Now — do the move shown</figcaption>
            </figure>
            <figure className="after">
              <CubeIso cube={f.after} size={120} />
              <figcaption>After</figcaption>
            </figure>
          </div>

          <div className="card step">
            {step ? (
              <>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </>
            ) : (
              <p>This stage is already done on your cube — move on.</p>
            )}

            {f.move && desc && (
              <div className="move">
                <div className="move-big">{f.move}</div>
                <div>
                  <div className="move-head">{desc.head}</div>
                  <div className="move-detail">{desc.detail}</div>
                  <div className="muted small">
                    Move {f.moveNo + 1} of {f.moveCount}
                    {rep && step?.times && step.times > 1 ? ` · repeat ${rep} of ${step.times}` : ''}
                  </div>
                </div>
              </div>
            )}

            {step && step.moves.length > 1 && (
              <p className="seq">
                {step.moves.map((m, i) => (
                  <span key={i} className={i === f.moveNo ? 'cur' : i < f.moveNo ? 'past' : ''}>
                    {m}
                  </span>
                ))}
              </p>
            )}
          </div>

          <div className="row">
            <button className="link" onClick={() => setShowNet((s) => !s)}>
              {showNet ? 'Hide' : 'Show'} all six faces
            </button>
            <button className="link" onClick={() => setShowList((s) => !s)}>
              {showList ? 'Hide' : 'Show'} whole stage
            </button>
          </div>
          {showNet && (
            <div className="overview">
              <CubeNet cube={f.before} />
            </div>
          )}
          {showList && (
            <ol className="step-list">
              {stage.steps.map((s, i) => (
                <li key={i} className={i === f.step ? 'cur' : ''}>
                  <button className="link" onClick={() => jump(f.stage, i)}>
                    {s.title}
                  </button>
                  {s.moves.length > 0 && (
                    <code>{s.alg && s.times && s.times > 1 ? `(${s.alg.join(' ')}) ×${s.times}` : s.moves.join(' ')}</code>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      <div className="pager">
        <button onClick={() => setAt((a) => Math.max(a - 1, 0))} disabled={at === 0}>
          ‹ Back
        </button>
        <span className="muted small">
          {Math.min(at + 1, frames.length)} / {frames.length}
        </span>
        <button className="primary" onClick={() => setAt((a) => Math.min(a + 1, frames.length))} disabled={finished}>
          {f.move ? 'Done ›' : 'Next ›'}
        </button>
      </div>
    </section>
  )
}
