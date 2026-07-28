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
  edgeKey: string
  active?: boolean
  onSelect: () => void
  onHoverChange?: (hovered: boolean) => void
}

/** Interactive spouse connector: click the line to open the relation panel. */
export function SpouseEdge({
  line,
  label,
  edgeKey,
  active = false,
  onSelect,
  onHoverChange,
}: Props) {
  const left = Math.min(line.x1, line.x2)
  const top = Math.min(line.y1, line.y2)
  const width = Math.max(Math.abs(line.x2 - line.x1), 8)
  const padY = 18

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
        'spouse-edge',
        active ? 'spouse-edge--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ left, top: top - padY, width, height: padY * 2 }}
      data-edge="spouse"
      data-edge-key={edgeKey}
    >
      <svg
        className="tree-edge__svg"
        width={width}
        height={padY * 2}
        aria-hidden
      >
        <line
          className="tree-edge__hit"
          x1={0}
          y1={padY}
          x2={width}
          y2={padY}
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerEnter={() => notifyHover(true)}
          onPointerLeave={(e) => notifyHover(false, e.relatedTarget)}
        />
        <line
          className="tree-edge__stroke tree-edge__stroke--spouse"
          x1={0}
          y1={padY}
          x2={width}
          y2={padY}
        />
      </svg>
      <button
        type="button"
        className="tree-edge__sr"
        aria-label={`Partnerband: ${label}. Klicka för att öppna.`}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  )
}
