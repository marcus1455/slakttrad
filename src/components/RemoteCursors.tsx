import type { RemoteCursor } from '../lib/treePresence'
import './RemoteCursors.css'

type Props = {
  cursors: RemoteCursor[]
}

export function RemoteCursors({ cursors }: Props) {
  if (!cursors.length) return null

  return (
    <div className="remote-cursors" aria-hidden>
      {cursors.map((cursor) => (
        <div
          key={cursor.key}
          className="remote-cursors__item"
          style={{
            transform: `translate(${cursor.x}px, ${cursor.y}px)`,
            color: cursor.color,
          }}
        >
            <svg
            className="remote-cursors__pointer"
            viewBox="0 0 24 24"
            width="22"
            height="22"
          >
            <path
              fill="currentColor"
              stroke="#fff"
              strokeWidth="1.2"
              d="M5.5 3.2 19 12.1l-6.2 1.4 2.8 7.1-2.7 1.1-2.8-7.1L5.5 20.2V3.2Z"
            />
          </svg>
          <span className="remote-cursors__label" style={{ background: cursor.color }}>
            {cursor.name}
          </span>
        </div>
      ))}
    </div>
  )
}
