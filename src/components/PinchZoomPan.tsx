import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { TreeMinimap, type MinimapWorld } from './TreeMinimap'
import './PinchZoomPan.css'

export type CenterRequest = {
  x: number
  y: number
  key: number
}

export type FitRequest = {
  width: number
  height: number
  key: number
}

type Props = {
  children: ReactNode
  centerRequest?: CenterRequest | null
  fitRequest?: FitRequest | null
  onBackgroundClick?: () => void
  /** Pointer position in tree/world coordinates (null when pointer leaves). */
  onPointerWorldMove?: (world: { x: number; y: number } | null) => void
  /** World bounds + markers for the bottom-right overview map. */
  minimap?: MinimapWorld | null
  /** Shift minimap left when a side panel is open. */
  minimapInsetRight?: number
}

const MIN_SCALE = 0.25
const MAX_SCALE = 1.8

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

/**
 * Pan/zoom viewport that updates the canvas transform imperatively during
 * interaction so the heavy tree children are not re-rendered every frame.
 */
export function PinchZoomPan({
  children,
  centerRequest,
  fitRequest,
  onBackgroundClick,
  onPointerWorldMove,
  minimap,
  minimapInsetRight = 0,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const levelRef = useRef<HTMLSpanElement>(null)
  const scaleRef = useRef(0.7)
  const offsetRef = useRef({ x: 48, y: 48 })
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  // Throttled mirror for minimap only — not used for the canvas transform.
  const [view, setView] = useState({ scale: 0.7, offset: { x: 48, y: 48 } })
  const drag = useRef<{
    x: number
    y: number
    ox: number
    oy: number
    moved: boolean
  } | null>(null)
  const onPointerWorldMoveRef = useRef(onPointerWorldMove)
  onPointerWorldMoveRef.current = onPointerWorldMove
  const minimapTimer = useRef<number | null>(null)
  const transitionTimer = useRef<number | null>(null)
  const interactingRef = useRef(false)

  const setCanvasTransition = useCallback((value: string) => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.style.transition = value
  }, [])

  const animateCanvas = useCallback(
    (durationMs = 280) => {
      setCanvasTransition(`transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`)
      if (transitionTimer.current != null) {
        window.clearTimeout(transitionTimer.current)
      }
      transitionTimer.current = window.setTimeout(() => {
        transitionTimer.current = null
        setCanvasTransition('none')
      }, durationMs + 80)
    },
    [setCanvasTransition],
  )

  const paintCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const { x, y } = offsetRef.current
      const s = scaleRef.current
      canvas.style.transform = `translate(${x}px, ${y}px) scale(${s})`
    }
    if (levelRef.current) {
      levelRef.current.textContent = `${Math.round(scaleRef.current * 100)}%`
    }
  }, [])

  const syncMinimap = useCallback((immediate = false) => {
    const flush = () => {
      minimapTimer.current = null
      setView({
        scale: scaleRef.current,
        offset: { ...offsetRef.current },
      })
    }
    if (minimapTimer.current != null) {
      window.clearTimeout(minimapTimer.current)
      minimapTimer.current = null
    }
    if (immediate) {
      flush()
      return
    }
    // Defer React state (minimap) so zoom/pan never re-renders the tree mid-gesture.
    minimapTimer.current = window.setTimeout(flush, 120)
  }, [])

  const toWorld = (clientX: number, clientY: number) => {
    const el = viewportRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const vx = clientX - rect.left
    const vy = clientY - rect.top
    return {
      x: (vx - offsetRef.current.x) / scaleRef.current,
      y: (vy - offsetRef.current.y) / scaleRef.current,
    }
  }

  const applyScale = useCallback(
    (nextScale: number, originX: number, originY: number) => {
      const prev = scaleRef.current
      const next = clampScale(nextScale)
      if (next === prev) return

      const ox = offsetRef.current.x
      const oy = offsetRef.current.y
      const worldX = (originX - ox) / prev
      const worldY = (originY - oy) / prev
      offsetRef.current = {
        x: originX - worldX * next,
        y: originY - worldY * next,
      }
      scaleRef.current = next
      paintCanvas()
      syncMinimap()
    },
    [paintCanvas, syncMinimap],
  )

  useEffect(() => {
    paintCanvas()
  }, [paintCanvas])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const measure = () => {
      const rect = el.getBoundingClientRect()
      setViewportSize({ width: rect.width, height: rect.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      interactingRef.current = true
      setCanvasTransition('none')
      const rect = el.getBoundingClientRect()
      const originX = event.clientX - rect.left
      const originY = event.clientY - rect.top

      // Smooth multiplicative zoom (trackpads send many small deltas).
      let dy = event.deltaY
      if (event.deltaMode === 1) dy *= 16
      else if (event.deltaMode === 2) dy *= rect.height
      const factor = Math.exp(-dy * 0.0034)
      applyScale(scaleRef.current * factor, originX, originY)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [applyScale, setCanvasTransition])

  useEffect(() => {
    if (!centerRequest || !viewportRef.current) return
    animateCanvas(300)
    const rect = viewportRef.current.getBoundingClientRect()
    const s = scaleRef.current
    offsetRef.current = {
      x: rect.width / 2 - centerRequest.x * s,
      y: rect.height / 2 - centerRequest.y * s,
    }
    paintCanvas()
    syncMinimap(true)
  }, [centerRequest, paintCanvas, syncMinimap, animateCanvas])

  useEffect(() => {
    if (!fitRequest || !viewportRef.current) return
    animateCanvas(320)
    const rect = viewportRef.current.getBoundingClientRect()
    const pad = 64
    const nextScale = clampScale(
      Math.min(
        1,
        Math.min(
          (rect.width - pad) / Math.max(fitRequest.width, 1),
          (rect.height - pad) / Math.max(fitRequest.height, 1),
        ),
      ),
    )
    scaleRef.current = nextScale
    offsetRef.current = {
      x: (rect.width - fitRequest.width * nextScale) / 2,
      y: (rect.height - fitRequest.height * nextScale) / 2,
    }
    paintCanvas()
    syncMinimap(true)
  }, [fitRequest, paintCanvas, syncMinimap, animateCanvas])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const onMove = (event: PointerEvent) => {
      const world = toWorld(event.clientX, event.clientY)
      if (world) onPointerWorldMoveRef.current?.(world)
    }
    const onLeave = () => {
      onPointerWorldMoveRef.current?.(null)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (minimapTimer.current != null) window.clearTimeout(minimapTimer.current)
      if (transitionTimer.current != null) window.clearTimeout(transitionTimer.current)
    }
  }, [])

  const zoomBy = (delta: number) => {
    animateCanvas(180)
    const el = viewportRef.current
    if (!el) {
      applyScale(scaleRef.current + delta, 0, 0)
      syncMinimap(true)
      return
    }
    const rect = el.getBoundingClientRect()
    applyScale(scaleRef.current + delta, rect.width / 2, rect.height / 2)
    syncMinimap(true)
  }

  const fitToWorld = () => {
    if (!minimap || !viewportRef.current) return
    animateCanvas(320)
    const rect = viewportRef.current.getBoundingClientRect()
    const pad = 48
    const nextScale = clampScale(
      Math.min(
        (rect.width - pad) / Math.max(minimap.width, 1),
        (rect.height - pad) / Math.max(minimap.height, 1),
      ),
    )
    scaleRef.current = nextScale
    offsetRef.current = {
      x: (rect.width - minimap.width * nextScale) / 2,
      y: (rect.height - minimap.height * nextScale) / 2,
    }
    paintCanvas()
    syncMinimap(true)
  }

  const navigateToWorld = useCallback(
    (worldX: number, worldY: number) => {
      const el = viewportRef.current
      if (!el) return
      animateCanvas(260)
      const rect = el.getBoundingClientRect()
      const s = scaleRef.current
      offsetRef.current = {
        x: rect.width / 2 - worldX * s,
        y: rect.height / 2 - worldY * s,
      }
      paintCanvas()
      syncMinimap(true)
    },
    [paintCanvas, syncMinimap, animateCanvas],
  )

  return (
    <div
      ref={viewportRef}
      className="pan-zoom"
      onPointerDown={(e) => {
        const target = e.target as HTMLElement
        if (
          target.closest(
            '.person-card-slot, .pan-zoom__controls, .spouse-edge, .blood-edge, .tree-edge, .tree-minimap',
          )
        ) {
          return
        }
        drag.current = {
          x: e.clientX,
          y: e.clientY,
          ox: offsetRef.current.x,
          oy: offsetRef.current.y,
          moved: false,
        }
        interactingRef.current = true
        setCanvasTransition('none')
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const world = toWorld(e.clientX, e.clientY)
        if (world) onPointerWorldMoveRef.current?.(world)

        if (!drag.current) return
        const dx = e.clientX - drag.current.x
        const dy = e.clientY - drag.current.y
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          drag.current.moved = true
        }
        offsetRef.current = {
          x: drag.current.ox + dx,
          y: drag.current.oy + dy,
        }
        paintCanvas()
        syncMinimap()
      }}
      onPointerLeave={() => {
        onPointerWorldMoveRef.current?.(null)
      }}
      onPointerUp={() => {
        if (drag.current && !drag.current.moved) {
          onBackgroundClick?.()
        }
        drag.current = null
        interactingRef.current = false
        setCanvasTransition('none')
        syncMinimap(true)
      }}
    >
      <div className="pan-zoom__controls">
        <button
          type="button"
          aria-label="Zooma in"
          title="Zooma in"
          onClick={(e) => {
            e.stopPropagation()
            zoomBy(0.2)
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span aria-hidden>+</span>
        </button>
        <button
          type="button"
          aria-label="Zooma ut"
          title="Zooma ut"
          onClick={(e) => {
            e.stopPropagation()
            zoomBy(-0.2)
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span aria-hidden>−</span>
        </button>
        {minimap ? (
          <button
            type="button"
            className="pan-zoom__fit"
            aria-label="Passa in trädet"
            title="Passa in trädet"
            onClick={(e) => {
              e.stopPropagation()
              fitToWorld()
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden>
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"
              />
            </svg>
          </button>
        ) : null}
        <span ref={levelRef} className="pan-zoom__level">
          {Math.round(view.scale * 100)}%
        </span>
      </div>
      {minimap ? (
        <TreeMinimap
          world={minimap}
          scale={view.scale}
          offset={view.offset}
          viewportSize={viewportSize}
          onNavigate={navigateToWorld}
          insetRight={minimapInsetRight}
        />
      ) : null}
      <div ref={canvasRef} className="pan-zoom__canvas">
        {children}
      </div>
    </div>
  )
}
