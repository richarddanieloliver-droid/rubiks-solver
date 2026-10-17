import { useEffect, useRef, useState } from 'react'
import { COLOR_HEX } from '../lib/cube'
import { nearest, type RGB } from '../lib/colors'

export interface Shot {
  photo: string
  samples: RGB[]
}

/** Fraction of the camera square taken up by the guide. */
const GUIDE = 0.72
const SIZE = 150

/** Crop the guide square from the video and read the middle of each of its 9 cells. */
function grab(video: HTMLVideoElement, canvas: HTMLCanvasElement): Shot | null {
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) return null
  const box = video.clientWidth
  const scale = Math.max(box / w, box / h) // object-fit: cover
  const side = (GUIDE * box) / scale
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  canvas.width = SIZE
  canvas.height = SIZE
  ctx.drawImage(video, (w - side) / 2, (h - side) / 2, side, side, 0, 0, SIZE, SIZE)
  const cell = SIZE / 3
  const samples: RGB[] = []
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const half = cell * 0.2
      const x = Math.round((c + 0.5) * cell - half)
      const y = Math.round((r + 0.5) * cell - half)
      const { data } = ctx.getImageData(x, y, Math.round(half * 2), Math.round(half * 2))
      // Median per channel shrugs off glare spots.
      const channel = (k: number) => {
        const v: number[] = []
        for (let i = k; i < data.length; i += 4) v.push(data[i])
        v.sort((a, b) => a - b)
        return v[v.length >> 1]
      }
      samples.push([channel(0), channel(1), channel(2)])
    }
  return { photo: canvas.toDataURL('image/jpeg', 0.7), samples }
}

interface Props {
  shots: Shot[]
  setShots: (s: Shot[]) => void
  onManual: () => void
  error: string | null
}

export function Scanner({ shots, setShots, onManual, error }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [camError, setCamError] = useState<string | null>(null)
  const [live, setLive] = useState<RGB[] | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let stopped = false
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('This browser can’t use the camera.')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        stream = s
        if (video.current) {
          video.current.srcObject = s
          video.current.play().catch(() => {})
        }
      })
      .catch(() => setCamError('The camera isn’t available. Allow camera access for this site, or enter the colours by hand.'))
    // Show what the camera sees in each square, so you can line the face up.
    const timer = setInterval(() => {
      if (video.current && canvas.current) {
        const s = grab(video.current, canvas.current)
        if (s) setLive(s.samples)
      }
    }, 300)
    return () => {
      stopped = true
      clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const capture = () => {
    if (!video.current || !canvas.current || shots.length >= 6) return
    const s = grab(video.current, canvas.current)
    if (s) setShots([...shots, s])
  }

  return (
    <section className="scanner">
      <div className="card">
        <h3>Scan your cube</h3>
        <p>
          Hold one face up to the camera so it fills the square, then tap <b>Capture</b>. Do all six faces —{' '}
          <b>any order, any way up</b>. The app works out how they fit together.
        </p>
      </div>

      {camError ? (
        <div className="errors" role="alert">
          <p>{camError}</p>
        </div>
      ) : (
        <div className="camera">
          <video ref={video} playsInline muted autoPlay />
          <div className="guide" style={{ width: `${GUIDE * 100}%`, height: `${GUIDE * 100}%` }}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i}>{live && <i style={{ background: COLOR_HEX[nearest(live[i])] }} />}</span>
            ))}
          </div>
        </div>
      )}
      <canvas ref={canvas} hidden />

      {!camError && <div className="shots">
        {Array.from({ length: 6 }, (_, i) =>
          shots[i] ? (
            <button
              key={i}
              className="shot"
              onClick={() => setShots(shots.filter((_, k) => k !== i))}
              aria-label={`Face ${i + 1}: tap to retake`}
            >
              <img src={shots[i].photo} alt="" />
              <span>✕</span>
            </button>
          ) : (
            <span key={i} className="shot empty">
              {i + 1}
            </span>
          ),
        )}
      </div>}
      {shots.length > 0 && <p className="muted small center">Tap a photo to delete it and scan that face again.</p>}

      {error && (
        <div className="errors" role="alert">
          <p>{error}</p>
        </div>
      )}

      {!camError && (
        <button className="primary wide" onClick={capture} disabled={shots.length >= 6}>
          {shots.length >= 6 ? 'All six scanned' : `Capture face ${shots.length + 1} of 6`}
        </button>
      )}
      <button className="link wide-link" onClick={onManual}>
        No camera? Enter the colours by hand
      </button>
    </section>
  )
}
