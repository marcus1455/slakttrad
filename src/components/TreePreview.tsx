import { useEffect, useMemo, useState } from 'react'
import type { Node } from 'relatives-tree/lib/types'
import { layoutFullTree } from '../lib/fullTreeLayout'
import { supabase } from '../lib/supabase'
import './TreePreview.css'

type Marker = { x: number; y: number; gender: string }
type Segment = { x1: number; y1: number; x2: number; y2: number }
type PreviewData = { markers: Marker[]; segments: Segment[] }

const previewCache = new Map<string, PreviewData>()

async function loadPreview(slug: string): Promise<PreviewData> {
  const cached = previewCache.get(slug)
  if (cached) return cached

  const empty: PreviewData = { markers: [], segments: [] }
  const { data, error } = await supabase
    .from('family_trees')
    .select('nodes')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !data?.nodes?.length) {
    previewCache.set(slug, empty)
    return empty
  }

  const nodes = data.nodes as Node[]
  const layout = layoutFullTree(nodes, {
    nodeWidth: 16,
    nodeHeight: 12,
    coupleGap: 4,
    unitGap: 14,
    familyGap: 28,
    gapY: 18,
    padding: 10,
  })
  const markers = layout.people.map((p) => ({
    x: p.x + 8,
    y: p.y + 6,
    gender: String(p.gender),
  }))
  // Cap segments so dense trees stay readable in the tiny preview
  const segments = layout.connectors
    .filter((c) => Math.hypot(c.x2 - c.x1, c.y2 - c.y1) > 2)
    .slice(0, 180)
    .map((c) => ({ x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2 }))

  const next = { markers, segments }
  previewCache.set(slug, next)
  return next
}

function seededPreview(
  slug: string,
  genders: Array<'male' | 'female'>,
): PreviewData {
  if (!genders.length) return { markers: [], segments: [] }
  let seed = 0
  for (let i = 0; i < slug.length; i++) seed = (seed * 31 + slug.charCodeAt(i)) >>> 0
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0xffffffff
  }

  const count = Math.min(genders.length, 36)
  const gens = Math.max(2, Math.ceil(Math.sqrt(count)))
  const markers: Marker[] = []
  const rows: Marker[][] = []
  let i = 0
  for (let g = 0; g < gens && i < count; g++) {
    const row: Marker[] = []
    const rowCount = Math.min(
      count - i,
      Math.max(2, Math.ceil(count / gens) + (g % 2)),
    )
    for (let c = 0; c < rowCount && i < count; c++, i++) {
      const m = {
        x: 24 + c * 28 + rand() * 8 + (g % 2) * 10,
        y: 18 + g * 26 + rand() * 6,
        gender: genders[i]!,
      }
      row.push(m)
      markers.push(m)
    }
    rows.push(row)
  }

  const segments: Segment[] = []
  for (let g = 1; g < rows.length; g++) {
    const parents = rows[g - 1]!
    const kids = rows[g]!
    for (let k = 0; k < kids.length; k++) {
      const child = kids[k]!
      const parent = parents[Math.min(k, parents.length - 1)]!
      segments.push({
        x1: parent.x,
        y1: parent.y,
        x2: child.x,
        y2: child.y,
      })
    }
  }
  return { markers, segments }
}

type Props = {
  slug: string
  previewGenders: Array<'male' | 'female'>
}

export function TreePreview({ slug, previewGenders }: Props) {
  const fallback = useMemo(() => seededPreview(slug, previewGenders), [slug, previewGenders])
  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const safeId = slug.replace(/[^a-zA-Z0-9_-]/g, '')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setData(null)
    void loadPreview(slug).then((next) => {
      if (cancelled) return
      setData(next.markers.length ? next : fallback)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [slug, fallback, previewGenders])

  const bounds = useMemo(() => {
    if (!data?.markers.length) {
      return { minX: 0, minY: 0, width: 160, height: 100 }
    }
    const xs = data.markers.map((m) => m.x)
    const ys = data.markers.map((m) => m.y)
    const minX = Math.min(...xs) - 12
    const minY = Math.min(...ys) - 12
    const maxX = Math.max(...xs) + 12
    const maxY = Math.max(...ys) + 12
    return {
      minX,
      minY,
      width: Math.max(80, maxX - minX),
      height: Math.max(60, maxY - minY),
    }
  }, [data])

  return (
    <div className={loading ? 'tree-preview tree-preview--loading' : 'tree-preview'} aria-hidden>
      {loading ? (
        <div className="tree-preview__skeleton">
          <span className="tree-preview__skeleton-line tree-preview__skeleton-line--a" />
          <span className="tree-preview__skeleton-line tree-preview__skeleton-line--b" />
          <span className="tree-preview__skeleton-line tree-preview__skeleton-line--c" />
        </div>
      ) : null}
      <svg
        className={loading ? 'tree-preview__svg tree-preview__svg--hidden' : 'tree-preview__svg'}
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={`tp-bg-${safeId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(47, 93, 80, 0.08)" />
            <stop offset="100%" stopColor="rgba(61, 90, 128, 0.06)" />
          </linearGradient>
        </defs>
        <rect
          x={bounds.minX}
          y={bounds.minY}
          width={bounds.width}
          height={bounds.height}
          fill={`url(#tp-bg-${safeId})`}
        />
        {(data?.segments ?? []).map((s, i) => (
          <line
            key={`s-${i}`}
            className="tree-preview__line"
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
          />
        ))}
        {(data?.markers ?? []).map((m, i) => (
          <circle
            key={`${m.x}-${m.y}-${i}`}
            className={
              m.gender === 'female'
                ? 'tree-preview__dot tree-preview__dot--female'
                : m.gender === 'male'
                  ? 'tree-preview__dot tree-preview__dot--male'
                  : 'tree-preview__dot'
            }
            cx={m.x}
            cy={m.y}
            r={(data?.markers.length ?? 0) > 30 ? 3.2 : 4.2}
          />
        ))}
      </svg>
    </div>
  )
}
