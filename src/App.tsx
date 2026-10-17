import { useEffect, useState } from 'react'
import { classify, sameCentres } from './lib/colors'
import { COLOR_NAMES, centreIndex, type Color, type Cube } from './lib/cube'
import { solve, type Stage } from './lib/solver'
import { CubeIso } from './components/CubeIso'
import { Notation } from './components/Notation'
import { Review, type Face } from './components/Review'
import { Scanner, type Shot } from './components/Scanner'
import { SolutionView } from './components/SolutionView'

type Screen = 'scan' | 'review' | 'hold' | 'solve'

const HAND_CENTRES: Color[] = ['W', 'Y', 'G', 'B', 'R', 'O']
const blankFaces = (): Face[] => HAND_CENTRES.map((c) => Array.from({ length: 9 }, (_, i) => (i === 4 ? c : null)))

export function App() {
  const [screen, setScreen] = useState<Screen>('scan')
  const [shots, setShots] = useState<Shot[]>([])
  const [faces, setFaces] = useState<Face[]>([])
  const [scanError, setScanError] = useState<string | null>(null)
  const [cube, setCube] = useState<Cube | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [help, setHelp] = useState(false)

  // Once six faces are in, read the colours and move on to checking them.
  useEffect(() => {
    if (shots.length < 6) return setScanError(null)
    const twice = sameCentres(shots.map((s) => s.samples[4]))
    if (twice) {
      setScanError(
        `Photos ${twice[0] + 1} and ${twice[1] + 1} look like the same face (their centres match). Delete one and scan the face you missed.`,
      )
      return
    }
    setFaces(chunk(classify(shots.flatMap((s) => s.samples))))
    setScreen('review')
  }, [shots])

  const restart = () => {
    setShots([])
    setFaces([])
    setCube(null)
    setScreen('scan')
  }

  const go = (s: Screen) => {
    setScreen(s)
    window.scrollTo(0, 0)
  }

  return (
    <main>
      <header className="top">
        <h1>
          <span className="logo" aria-hidden /> Cube Coach
        </h1>
        <div className="row">
          {screen !== 'scan' && !help && (
            <button className="link" onClick={restart}>
              New cube
            </button>
          )}
          <button className="link" onClick={() => setHelp((h) => !h)}>
            {help ? 'Close' : 'Move guide'}
          </button>
        </div>
      </header>

      {help ? (
        <Notation onClose={() => setHelp(false)} />
      ) : screen === 'scan' ? (
        <Scanner
          shots={shots}
          setShots={setShots}
          error={scanError}
          onManual={() => {
            setShots([])
            setFaces(blankFaces())
            go('review')
          }}
        />
      ) : screen === 'review' ? (
        <Review
          faces={faces}
          photos={shots.map((s) => s.photo)}
          setFaces={setFaces}
          onRescan={restart}
          onSolve={(c) => {
            setCube(c)
            setStages(solve(c))
            go('hold')
          }}
        />
      ) : screen === 'hold' && cube ? (
        <Hold cube={cube} solved={stages.length === 0} onReady={() => go('solve')} />
      ) : (
        <SolutionView stages={stages} onEdit={restart} />
      )}
    </main>
  )
}

const chunk = (colors: Color[]): Face[] => [0, 1, 2, 3, 4, 5].map((f) => colors.slice(f * 9, f * 9 + 9))

function Hold({ cube, solved, onReady }: { cube: Cube; solved: boolean; onReady: () => void }) {
  const top = COLOR_NAMES[cube[centreIndex('U')]]
  const front = COLOR_NAMES[cube[centreIndex('F')]]
  if (solved)
    return (
      <div className="card center">
        <h2>Your cube is already solved! 🎉</h2>
        <CubeIso cube={cube} />
      </div>
    )
  return (
    <div className="card">
      <h3>Hold your cube like this</h3>
      <p>
        <b>{top[0].toUpperCase() + top.slice(1)}</b> centre on top, <b>{front}</b> centre facing you. Check the squares match
        the picture — then keep holding it this way.
      </p>
      <div className="views">
        <figure>
          <CubeIso cube={cube} size={210} />
          <figcaption>What you should see</figcaption>
        </figure>
        <figure>
          <CubeIso cube={cube} view="y2" size={110} />
          <figcaption>The back (turn it round to check, then turn it back)</figcaption>
        </figure>
      </div>
      <button className="primary wide" onClick={onReady}>
        I’m holding it like this — show me the moves
      </button>
    </div>
  )
}
