import './LoadingScreen.css'

type Props = {
  title?: string
  message?: string
}

/** Full-viewport loading state with a small pedigree animation. */
export function LoadingScreen({
  title = 'Släktträd',
  message = 'Laddar…',
}: Props) {
  return (
    <div className="loading-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-screen__glow" aria-hidden />
      <div className="loading-screen__mark" aria-hidden>
        <svg
          className="loading-screen__tree"
          viewBox="0 0 120 140"
          width="88"
          height="102"
          fill="none"
        >
          {/* Connector lines — draw in */}
          <path
            className="loading-screen__line loading-screen__line--a"
            d="M60 28 V48"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            className="loading-screen__line loading-screen__line--b"
            d="M36 70 H84"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            className="loading-screen__line loading-screen__line--c"
            d="M36 70 V88"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            className="loading-screen__line loading-screen__line--d"
            d="M84 70 V88"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            className="loading-screen__line loading-screen__line--e"
            d="M60 70 V100"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />

          {/* People nodes */}
          <circle
            className="loading-screen__node loading-screen__node--1"
            cx="60"
            cy="22"
            r="10"
            fill="url(#loading-node-a)"
            stroke="currentColor"
            strokeWidth="1.25"
          />
          <circle
            className="loading-screen__node loading-screen__node--2"
            cx="36"
            cy="98"
            r="10"
            fill="url(#loading-node-b)"
            stroke="currentColor"
            strokeWidth="1.25"
          />
          <circle
            className="loading-screen__node loading-screen__node--3"
            cx="84"
            cy="98"
            r="10"
            fill="url(#loading-node-a)"
            stroke="currentColor"
            strokeWidth="1.25"
          />
          <rect
            className="loading-screen__node loading-screen__node--4"
            x="46"
            y="108"
            width="28"
            height="22"
            rx="7"
            fill="url(#loading-node-focus)"
            stroke="currentColor"
            strokeWidth="1.5"
          />

          <defs>
            <linearGradient id="loading-node-a" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e8f0f4" />
              <stop offset="100%" stopColor="#d5e4ec" />
            </linearGradient>
            <linearGradient id="loading-node-b" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f6e8e4" />
              <stop offset="100%" stopColor="#edd5cf" />
            </linearGradient>
            <linearGradient id="loading-node-focus" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fcfaf5" />
              <stop offset="100%" stopColor="#e7efe9" />
            </linearGradient>
          </defs>
        </svg>
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
