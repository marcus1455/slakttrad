import type { Node } from 'relatives-tree/lib/types'
import type { LayoutOptions, TreeLayout } from './types'
import { bloodBrackets, spouseLines } from './connectorsShared'

function byId(nodes: readonly Node[]) {
  return new Map(nodes.map((n) => [n.id, n]))
}

/** Ancestors of root (including root), keyed by generations-from-root. */
export function collectAncestors(
  map: Map<string, Node>,
  rootId: string,
  maxGenerations: number,
): Map<string, number> {
  const depth = new Map<string, number>()
  if (!map.has(rootId)) return depth
  depth.set(rootId, 0)
  const queue = [rootId]
  while (queue.length) {
    const id = queue.shift()!
    const d = depth.get(id)!
    if (d >= maxGenerations) continue
    const node = map.get(id)
    if (!node) continue
    for (const p of node.parents) {
      if (!map.has(p.id) || depth.has(p.id)) continue
      depth.set(p.id, d + 1)
      queue.push(p.id)
    }
  }
  return depth
}

function sortParents(ids: string[], map: Map<string, Node>) {
  return [...ids].sort((a, b) => {
    const ga = map.get(a)?.gender
    const gb = map.get(b)?.gender
    if (ga === 'male' && gb !== 'male') return -1
    if (gb === 'male' && ga !== 'male') return 1
    return a.localeCompare(b, 'sv')
  })
}

/**
 * Ancestor pedigree from root: oldest at top, focus at bottom.
 * Includes root's spouse and shared children below the focus row.
 */
export function layoutPedigree(
  nodes: readonly Node[],
  options: LayoutOptions,
): TreeLayout {
  const {
    nodeWidth,
    nodeHeight,
    coupleGap = 16,
    gapY = 88,
    padding = 48,
    rootId,
    maxGenerations = 6,
  } = options

  const empty = (): TreeLayout => ({
    people: [],
    connectors: [],
    width: padding * 2,
    height: padding * 2,
  })

  if (!nodes.length || !rootId) return empty()
  const map = byId(nodes)
  if (!map.has(rootId)) return empty()

  const ancestorDepth = collectAncestors(map, rootId, maxGenerations)
  const maxDepth = Math.max(0, ...ancestorDepth.values())
  const genOf = (id: string) => maxDepth - (ancestorDepth.get(id) ?? 0)

  type Tidy = {
    id: string
    /** Algorithm-children = blood parents further from root. */
    up: Tidy[]
    prelim: number
  }

  const cache = new Map<string, Tidy>()
  let nextLeafX = 0
  const leafGap = nodeWidth + 40

  function build(id: string): Tidy {
    const hit = cache.get(id)
    if (hit) return hit
    const node = map.get(id)!
    const parentIds = sortParents(
      node.parents.map((p) => p.id).filter((pid) => ancestorDepth.has(pid)),
      map,
    )
    const tidy: Tidy = { id, up: parentIds.map(build), prelim: 0 }
    cache.set(id, tidy)
    return tidy
  }

  function firstWalk(v: Tidy) {
    if (!v.up.length) {
      v.prelim = nextLeafX
      nextLeafX += leafGap
      return
    }
    for (const p of v.up) firstWalk(p)
    if (v.up.length === 1) {
      v.prelim = v.up[0]!.prelim
    } else {
      v.prelim = (v.up[0]!.prelim + v.up[v.up.length - 1]!.prelim) / 2
    }
  }

  const rootTidy = build(rootId)
  firstWalk(rootTidy)

  const positions = new Map<string, { x: number; y: number }>()
  const rowY = (g: number) => padding + g * (nodeHeight + gapY)

  for (const [id, t] of cache) {
    positions.set(id, {
      x: padding + t.prelim,
      y: rowY(genOf(id)),
    })
  }

  const root = map.get(rootId)!
  const rootPos = positions.get(rootId)!
  const spouse = root.spouses.map((s) => s.id).find((id) => map.has(id))
  if (spouse && !positions.has(spouse)) {
    positions.set(spouse, {
      x: rootPos.x + nodeWidth + coupleGap,
      y: rootPos.y,
    })
  }

  const childIds = root.children
    .map((c) => c.id)
    .filter((id) => map.has(id))
    .filter((id) => {
      if (!spouse) return true
      return map.get(id)!.parents.some((p) => p.id === spouse)
    })
    .sort((a, b) => a.localeCompare(b, 'sv'))

  if (childIds.length) {
    const childY = rootPos.y + nodeHeight + gapY
    const unitLeft = spouse
      ? Math.min(rootPos.x, positions.get(spouse)!.x)
      : rootPos.x
    const unitRight = spouse
      ? Math.max(rootPos.x, positions.get(spouse)!.x) + nodeWidth
      : rootPos.x + nodeWidth
    const unitCx = (unitLeft + unitRight) / 2
    const totalW =
      childIds.length * nodeWidth +
      Math.max(0, childIds.length - 1) * coupleGap
    let x = unitCx - totalW / 2
    for (const cid of childIds) {
      if (positions.has(cid)) continue
      positions.set(cid, { x, y: childY })
      x += nodeWidth + coupleGap
    }
  }

  let minLeft = Infinity
  for (const pos of positions.values()) minLeft = Math.min(minLeft, pos.x)
  if (minLeft < padding) {
    const dx = padding - minLeft
    for (const [id, pos] of positions) {
      positions.set(id, { x: pos.x + dx, y: pos.y })
    }
  }

  // Resolve overlaps on the same row
  const byY = new Map<number, string[]>()
  for (const [id, pos] of positions) {
    const list = byY.get(pos.y) ?? []
    list.push(id)
    byY.set(pos.y, list)
  }
  const minGap = nodeWidth + 12
  for (const ids of byY.values()) {
    const ordered = [...ids].sort(
      (a, b) => positions.get(a)!.x - positions.get(b)!.x,
    )
    for (let i = 1; i < ordered.length; i++) {
      const prev = positions.get(ordered[i - 1]!)!
      const cur = positions.get(ordered[i]!)!
      const need = prev.x + minGap
      if (cur.x < need) {
        positions.set(ordered[i]!, { x: need, y: cur.y })
      }
    }
  }

  const visibleNodes = nodes.filter((n) => positions.has(n.id))
  const people = visibleNodes.map((n) => {
    const pos = positions.get(n.id)!
    return { id: n.id, x: pos.x, y: pos.y, gender: n.gender }
  })

  const connectors = [
    ...spouseLines(visibleNodes, positions, nodeWidth, nodeHeight),
    ...bloodBrackets(visibleNodes, positions, nodeWidth, nodeHeight, gapY),
  ]

  const width = Math.max(
    padding * 2 + nodeWidth,
    ...people.map((p) => p.x + nodeWidth + padding),
  )
  const height = Math.max(
    padding * 2 + nodeHeight,
    ...people.map((p) => p.y + nodeHeight + padding),
  )

  return { people, connectors, width, height }
}
