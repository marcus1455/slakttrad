import './LoadingScreen.css'

type Props = {
  title?: string
  message?: string
}

/** Full-viewport loading state with a branded DNA helix animation. */
export function LoadingScreen({
  title = 'Släktträd',
  message = 'Laddar…',
}: Props) {
  const rungs = Array.from({ length: 8 }, (_, i) => i)
  return (
    <div className="loading-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-screen__glow" aria-hidden />
      <div className="loading-screen__mark" aria-hidden>
        <div className="loading-screen__dna" role="img" aria-label="Laddar släktträd">
          {rungs.map((i) => (
            <div key={i} className="loading-screen__dna-rung" style={{ ['--i' as string]: i }} />
          ))}
        </div>
      </div>

      <p className="loading-screen__brand">{title}</p>
      <p className="loading-screen__message">
        <span className="loading-screen__message-text">{message}</span>
        <span className="loading-screen__dots" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </p>
    </div>
  )
}
