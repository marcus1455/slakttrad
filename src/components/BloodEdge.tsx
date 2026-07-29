import './BloodEdge.css'
import './SpouseEdge.css'

type Line = {
  x1: number
  y1: number
  x2: number
  y2: number
}

type Props = {
  line: Line
  childName: string
  edgeKey: string
  /** Selected or group-hovered — highlights the whole blood link. */
  active?: boolean
  muted?: boolean
  onSelect: () => void
  onHoverChange?: (hovered: boolean) => void
}

/** Interactive blood connector segment (parent↔child). */
export function BloodEdge({
  line,
  childName,
  edgeKey,
  active = false,
  muted = false,
  onSelect,
  onHoverChange,
}: Props) {
  const x1 = line.x1
  const y1 = line.y1
  const x2 = line.x2
  const y2 = line.y2
  const left = Math.min(x1, x2)
  const top = Math.min(y1, y2)
  const width = Math.max(Math.abs(x2 - x1), 1)
  const height = Math.max(Math.abs(y2 - y1), 1)
  const pad = 14
  const svgW = width + pad * 2
  const svgH = height + pad * 2
  const lx1 = x1 - left + pad
  const ly1 = y1 - top + pad
  const lx2 = x2 - left + pad
  const ly2 = y2 - top + pad

  const notifyHover = (hovered: boolean, related?: EventTarget | null) => {
    if (!hovered && related instanceof Element) {
      if (related.closest(`[data-edge-key="${edgeKey}"]`)) return
    }
    onHoverChange?.(hovered)
  }

  return (
    <div
      className={[
        'tree-edge',
        'blood-edge',
        active ? 'blood-edge--active' : '',
        muted ? 'tree-edge--muted' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: left - pad,
        top: top - pad,
        width: svgW,
        height: svgH,
      }}
      data-edge="blood"
      data-edge-key={edgeKey}
    >
      <svg className="tree-edge__svg" width={svgW} height={svgH} aria-hidden>
        <line
          className="tree-edge__hit"
          x1={lx1}
          y1={ly1}
          x2={lx2}
          y2={ly2}
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerEnter={() => notifyHover(true)}
          onPointerLeave={(e) => notifyHover(false, e.relatedTarget)}
        />
        <line
          className="tree-edge__stroke tree-edge__stroke--blood"
          x1={lx1}
          y1={ly1}
          x2={lx2}
          y2={ly2}
        />
      </svg>
      <button
        type="button"
        className="tree-edge__sr"
        aria-label={`Band till ${childName}. Klicka för att öppna.`}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  )
}
