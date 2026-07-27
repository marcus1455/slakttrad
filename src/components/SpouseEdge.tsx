import './SpouseEdge.css'

type Line = {
  x1: number
  y1: number
  x2: number
  y2: number
}

type Props = {
  line: Line
  label: string
  onAddChild: () => void
}

/** Interactive spouse connector: hover to add a shared child. */
export function SpouseEdge({ line, label, onAddChild }: Props) {
  const left = Math.min(line.x1, line.x2)
  const top = Math.min(line.y1, line.y2)
  const width = Math.max(Math.abs(line.x2 - line.x1), 2)
  const midX = width / 2

  return (
    <div
      className="spouse-edge"
      style={{ left, top: top - 14, width, height: 28 }}
    >
      <i className="spouse-edge__line" aria-hidden />
      <button
        type="button"
        className="spouse-edge__add"
        style={{ left: midX }}
        title={`Lägg till barn till ${label}`}
        aria-label={`Lägg till barn till ${label}`}
        onClick={(e) => {
          e.stopPropagation()
          onAddChild()
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span aria-hidden>+</span>
      </button>
    </div>
  )
}
