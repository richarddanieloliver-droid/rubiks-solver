import { useEffect, useState } from 'react'
import type { Cube } from './lib/cube'
import { solve, type Stage } from './lib/solver'
import { CubeInput, blankDraft, type Draft } from './components/CubeInput'
import { Notation } from './components/Notation'
import { SolutionView } from './components/SolutionView'

const KEY = 'rubiks-draft'

function loadDraft(): Draft {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (Array.isArray(saved) && saved.length === 54) return saved
  } catch {
    // ignore unavailable storage
  }
  return blankDraft()
}

export function App() {
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [stages, setStages] = useState<Stage[] | null>(null)
  const [help, setHelp] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(draft))
    } catch {
      // ignore unavailable storage
    }
  }, [draft])

  const run = () => {
    try {
      setStages(solve(draft as Cube))
      setError(null)
      window.scrollTo(0, 0)
    } catch {
      setError("Couldn't solve this cube — please double-check the colours.")
    }
  }

  return (
    <main>
      <header className="top">
        <h1>
          <span className="logo" aria-hidden /> Cube Coach
        </h1>
        <div className="row">
          {stages && !help && (
            <button className="link" onClick={() => setStages(null)}>
              Edit cube
            </button>
          )}
          <button className="link" onClick={() => setHelp((h) => !h)}>
            {help ? 'Close' : 'Move guide'}
          </button>
        </div>
      </header>

      {help ? (
        <Notation onClose={() => setHelp(false)} />
      ) : stages ? (
        <SolutionView stages={stages} onEdit={() => setStages(null)} />
      ) : (
        <>
          <p className="lede">
            Enter your scrambled cube and get step-by-step beginner instructions — starting from the very first move of the
            white cross.
          </p>
          <CubeInput draft={draft} setDraft={setDraft} onSolve={run} />
          {error && <p className="errors">{error}</p>}
        </>
      )}
    </main>
  )
}
