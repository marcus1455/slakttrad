import { useEffect, useRef, useState, type ReactNode } from 'react'
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
}

const MIN_SCALE = 0.25
const MAX_SCALE = 1.8

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

export function PinchZoomPan({
  children,
  centerRequest,
  fitRequest,
  onBackgroundClick,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(0.7)
  const offsetRef = useRef({ x: 48, y: 48 })
  const [scale, setScale] = useState(0.7)
  const [offset, setOffset] = useState({ x: 48, y: 48 })
  const drag = useRef<{
    x: number
    y: number
    ox: number
    oy: number
    moved: boolean
  } | null>(null)

  scaleRef.current = scale
  offsetRef.current = offset

  const applyScale = (nextScale: number, originX: number, originY: number) => {
    const prev = scaleRef.current
    const next = clampScale(nextScale)
    if (next === prev) return

    const ox = offsetRef.current.x
    const oy = offsetRef.current.y
    const worldX = (originX - ox) / prev
    const worldY = (originY - oy) / prev
    const nextOffset = {
      x: originX - worldX * next,
      y: originY - worldY * next,
    }

    scaleRef.current = next
    offsetRef.current = nextOffset
    setScale(next)
    setOffset(nextOffset)
  }

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const originX = event.clientX - rect.left
      const originY = event.clientY - rect.top
      const delta = event.deltaY > 0 ? -0.08 : 0.08
      applyScale(scaleRef.current + delta, originX, originY)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    if (!centerRequest || !viewportRef.current) return
    const rect = viewportRef.current.getBoundingClientRect()
    const s = scaleRef.current
    const nextOffset = {
      x: rect.width / 2 - centerRequest.x * s,
      y: rect.height / 2 - centerRequest.y * s,
    }
    offsetRef.current = nextOffset
    setOffset(nextOffset)
  }, [centerRequest])

  useEffect(() => {
    if (!fitRequest || !viewportRef.current) return
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
    const nextOffset = {
      x: (rect.width - fitRequest.width * nextScale) / 2,
      y: (rect.height - fitRequest.height * nextScale) / 2,
    }
    scaleRef.current = nextScale
    offsetRef.current = nextOffset
    setScale(nextScale)
    setOffset(nextOffset)
  }, [fitRequest])

  const zoomBy = (delta: number) => {
    const el = viewportRef.current
    if (!el) {
      applyScale(scaleRef.current + delta, 0, 0)
      return
    }
    const rect = el.getBoundingClientRect()
    applyScale(scaleRef.current + delta, rect.width / 2, rect.height / 2)
  }

  return (
    <div
      ref={viewportRef}
      className="pan-zoom"
      onPointerDown={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('.person-card-slot, .pan-zoom__controls, .spouse-edge')) return
        drag.current = {
          x: e.clientX,
          y: e.clientY,
          ox: offset.x,
          oy: offset.y,
          moved: false,
        }
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const dx = e.clientX - drag.current.x
        const dy = e.clientY - drag.current.y
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          drag.current.moved = true
        }
        const nextOffset = {
          x: drag.current.ox + dx,
          y: drag.current.oy + dy,
        }
        offsetRef.current = nextOffset
        setOffset(nextOffset)
      }}
      onPointerUp={() => {
        if (drag.current && !drag.current.moved) {
          onBackgroundClick?.()
        }
        drag.current = null
      }}
    >
      <div className="pan-zoom__controls">
        <button
          type="button"
          aria-label="Zooma in"
          title="Zooma in"
          onClick={(e) => {
            e.stopPropagation()
            zoomBy(0.12)
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
            zoomBy(-0.12)
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span aria-hidden>−</span>
        </button>
        <span className="pan-zoom__level">{Math.round(scale * 100)}%</span>
      </div>
      <div
        className="pan-zoom__canvas"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
