import { solvedCube } from '../lib/cube'
import { describeMove } from '../lib/notation'
import { CubeIso } from './CubeIso'

const EXAMPLES = ['R', "R'", 'U', "U'", 'F', "F'", 'L', 'D', 'B']

export function Notation({ onClose }: { onClose: () => void }) {
  return (
    <section className="notation">
      <h2>How to read the moves</h2>
      <p>
        Each letter is a face, named from how you are holding the cube: <b>U</b>p (top), <b>D</b>own (bottom),{' '}
        <b>F</b>ront, <b>B</b>ack, <b>L</b>eft, <b>R</b>ight.
      </p>
      <ul>
        <li>
          A letter on its own (<code>R</code>) means turn that face a quarter turn <b>clockwise, as if you were looking straight at
          that face</b>.
        </li>
        <li>
          An apostrophe (<code>R'</code>, said “R prime”) means anticlockwise.
        </li>
        <li>
          A 2 (<code>R2</code>) means a half turn — twice.
        </li>
        <li>Keep the cube in the same position between moves unless the app tells you to turn the whole cube.</li>
      </ul>
      <div className="notation-grid">
        {EXAMPLES.map((m) => (
          <figure key={m}>
            <CubeIso cube={solvedCube()} move={m} size={110} />
            <figcaption>
              <b>{m}</b> — {describeMove(m).head.toLowerCase()}: {describeMove(m).detail}
            </figcaption>
          </figure>
        ))}
      </div>
      <button className="primary" onClick={onClose}>
        Got it
      </button>
    </section>
  )
}
