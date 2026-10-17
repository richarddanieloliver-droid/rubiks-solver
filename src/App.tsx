import { useEffect, useState } from 'react'
import { advance, startGuide, STAGES, type Answer, type Guide } from './lib/guided'
import { CubeIso } from './components/CubeIso'
import { GuideView } from './components/GuideView'
import { Notation } from './components/Notation'
import { solvedCube } from './lib/cube'

const KEY = 'rubiks-guide'

interface Saved {
  guide: Guide
  /** Earlier states we can go back to (only before any moves were done). */
  undo: Guide[]
}

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (s?.guide?.queue?.length) return s
  } catch {
    // storage unavailable
  }
  return { guide: startGuide(), undo: [] }
}

export function App() {
  const [{ guide, undo }, setSaved] = useState<Saved>(load)
  const [help, setHelp] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ guide, undo }))
    } catch {
      // storage unavailable
    }
  }, [guide, undo])

  const prompt = guide.queue[0]
  const answer = (a: Answer) => {
    const next = advance(guide, a)
    // Answers that are just taps or choices can be taken back; once moves have
    // been done on the real cube they can't.
    const undoable = 'tap' in a || 'choice' in a || 'color' in a
    setSaved({ guide: next, undo: undoable ? [...undo, guide] : [] })
    window.scrollTo(0, 0)
  }
  const restart = () => setSaved({ guide: startGuide(), undo: [] })
  const stage = STAGES[Math.min(guide.stage, STAGES.length - 1)]

  return (
    <main>
      <header className="top">
        <h1>
          <span className="logo" aria-hidden /> Cube Coach
        </h1>
        <div className="row">
          {prompt.kind !== 'orient' && !help && (
            <button className="link" onClick={() => confirm('Start again from the beginning?') && restart()}>
              Start over
            </button>
          )}
          <button className="link" onClick={() => setHelp((h) => !h)}>
            {help ? 'Close' : 'Move guide'}
          </button>
        </div>
      </header>

      {help ? (
        <Notation onClose={() => setHelp(false)} />
      ) : prompt.kind === 'done' ? (
        <div className="card center">
          <h2>Solved! 🎉</h2>
          <CubeIso cube={solvedCube()} />
          <button className="primary" onClick={restart}>
            Solve another
          </button>
        </div>
      ) : (
        <>
          {prompt.kind === 'orient' ? (
            <p className="lede">
              Get step-by-step help solving your cube, starting from the white cross. No need to enter every face: the app
              asks you to find one piece at a time.
            </p>
          ) : (
            <>
              <ol className="stages" aria-label="Stages">
                {STAGES.map((s, i) => (
                  <li key={s.name} className={i === guide.stage ? 'on' : i < guide.stage ? 'done' : ''} title={s.name}>
                    {i < guide.stage ? '✓' : i + 1}
                  </li>
                ))}
              </ol>
              <header className="stage-head">
                <p className="eyebrow">
                  Stage {guide.stage + 1} of {STAGES.length}
                </p>
                <h2>{stage.name}</h2>
                <p className="muted small">{stage.intro}</p>
              </header>
            </>
          )}
          <GuideView prompt={prompt} cube={guide.cube} onAnswer={answer} />
          {undo.length > 0 && (
            <button
              className="link"
              onClick={() => setSaved({ guide: undo[undo.length - 1], undo: undo.slice(0, -1) })}
            >
              {prompt.kind === 'moves' ? '‹ Tapped the wrong square? Go back' : '‹ Undo my last answer'}
            </button>
          )}
        </>
      )}
    </main>
  )
}
