import { useCallback, useMemo, useRef } from 'react'
import './TreeMinimap.css'

export type MinimapMarker = {
  x: number
  y: number
  gender?: string
}

export type MinimapWorld = {
  width: number
  height: number
  markers: MinimapMarker[]
  nodeWidth: number
  nodeHeight: number
}

type Props = {
  world: MinimapWorld
  scale: number
  offset: { x: number; y: number }
  viewportSize: { width: number; height: number }
  onNavigate: (worldX: number, worldY: number) => void
  /** Extra right inset when a side panel covers the corner. */
  insetRight?: number
}

const MAP_MAX_W = 168
const MAP_MAX_H = 120
const MAP_PAD = 6

export function TreeMinimap({
  world,
  scale,
  offset,
  viewportSize,
  onNavigate,
  insetRight = 0,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  const layout = useMemo(() => {
    const contentW = Math.max(world.width, 1)
    const contentH = Math.max(world.height, 1)
    const innerW = MAP_MAX_W - MAP_PAD * 2
    const innerH = MAP_MAX_H - MAP_PAD * 2
    const fit = Math.min(innerW / contentW, innerH / contentH)
    const mapW = contentW * fit
    const mapH = contentH * fit
    return {
      fit,
      mapW,
      mapH,
      boxW: mapW + MAP_PAD * 2,
      boxH: mapH + MAP_PAD * 2,
    }
  }, [world.width, world.height])

  const viewRect = useMemo(() => {
    if (viewportSize.width < 1 || viewportSize.height < 1) {
      return { left: 0, top: 0, width: 0, height: 0 }
    }
    const left = (-offset.x / scale) * layout.fit + MAP_PAD
    const top = (-offset.y / scale) * layout.fit + MAP_PAD
    const width = (viewportSize.width / scale) * layout.fit
    const height = (viewportSize.height / scale) * layout.fit
    return { left, top, width, height }
  }, [offset, scale, viewportSize, layout.fit])

  const navigateFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const localX = clientX - rect.left - MAP_PAD
      const localY = clientY - rect.top - MAP_PAD
      onNavigate(localX / layout.fit, localY / layout.fit)
    },
    [layout.fit, onNavigate],
  )

  if (world.markers.length < 2) return null

  return (
    <div
      ref={rootRef}
      className="tree-minimap"
      role="navigation"
      aria-label="Översiktskarta — klicka eller dra för att flytta vyn"
      title="Översikt"
      style={{
        width: layout.boxW,
        height: layout.boxH,
        right: `calc(1rem + ${insetRight}px)`,
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        navigateFromClient(e.clientX, e.clientY)
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
        e.stopPropagation()
        navigateFromClient(e.clientX, e.clientY)
      }}
      onPointerUp={(e) => {
        e.stopPropagation()
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      }}
    >
      <div
        className="tree-minimap__world"
        style={{
          left: MAP_PAD,
          top: MAP_PAD,
          width: layout.mapW,
          height: layout.mapH,
        }}
      >
        {world.markers.map((m, i) => (
          <i
            key={i}
            className={[
              'tree-minimap__dot',
              m.gender === 'female' ? 'tree-minimap__dot--female' : '',
              m.gender === 'male' ? 'tree-minimap__dot--male' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              left: (m.x + world.nodeWidth / 2) * layout.fit,
              top: (m.y + world.nodeHeight / 2) * layout.fit,
            }}
          />
        ))}
      </div>
      <div
        className="tree-minimap__viewport"
        style={{
          left: viewRect.left,
          top: viewRect.top,
          width: Math.max(viewRect.width, 8),
          height: Math.max(viewRect.height, 8),
        }}
      />
    </div>
  )
}
