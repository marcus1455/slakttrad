import type { Node } from 'relatives-tree/lib/types'
import type { LayoutConnector, LayoutOptions, TreeLayout } from './types'
import { spouseLines } from './connectorsShared'
import { clipSegmentToCardBorders } from './clipSegment'

function byId(nodes: readonly Node[]) {
  return new Map(nodes.map((n) => [n.id, n]))
}

/**
 * Classic fan chart: focus at the hub (bottom), ancestors in a semicircle above.
 * Each person owns an angular sector; father gets the left half, mother the right.
 * Connectors are straight spokes (child → parent), not orthogonal brackets.
 */
export function layoutFan(
  nodes: readonly Node[],
  options: LayoutOptions,
): TreeLayout {
  const {
    nodeWidth,
    nodeHeight,
    coupleGap = 20,
    padding = 64,
    rootId,
    maxGenerations = 4,
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

  // Semicircle opening upward: π (left) → 0 (right), hub at bottom.
  const ARC_LEFT = Math.PI * 0.98
  const ARC_RIGHT = Math.PI * 0.02
  // Ring 0 = focus; ring 1 = parents, …
  const ringGap = Math.max(nodeWidth * 1.55, nodeHeight * 2.4)


  type Place = { id: string; depth: number; angle: number }
  const placed = new Map<string, Place>()

  const sortParents = (ids: string[]) =>
    [...ids].sort((a, b) => {
      const ga = map.get(a)?.gender
      const gb = map.get(b)?.gender
      if (ga === 'male' && gb !== 'male') return -1
      if (gb === 'male' && ga !== 'male') return 1
      return a.localeCompare(b, 'sv')
    })

  function placeSector(
    id: string,
    depth: number,
    a0: number,
    a1: number,
  ) {
    if (placed.has(id)) return
    if (depth > maxGenerations) return
    if (!map.has(id)) return

    const angle = (a0 + a1) / 2
    placed.set(id, { id, depth, angle })

    if (depth >= maxGenerations) return

    const parents = sortParents(
      map
        .get(id)!
        .parents.map((p) => p.id)
        .filter((pid) => map.has(pid)),
    )
    if (parents.length === 0) return
    if (parents.length === 1) {
      placeSector(parents[0]!, depth + 1, a0, a1)
      return
    }
    const mid = (a0 + a1) / 2
    // Father (left) / mother (right) on the upward semicircle
    placeSector(parents[0]!, depth + 1, a0, mid)
    placeSector(parents[1]!, depth + 1, mid, a1)
  }

  placeSector(rootId, 0, ARC_LEFT, ARC_RIGHT)

  const positions = new Map<string, { x: number; y: number }>()
  for (const p of placed.values()) {
    const r = p.depth * ringGap
    // Math angle: 0 = east, π/2 = north (up on screen → smaller y)
    const cx = Math.cos(p.angle) * r
    const cy = -Math.sin(p.angle) * r
    positions.set(p.id, { x: cx - nodeWidth / 2, y: cy - nodeHeight / 2 })
  }

  // Spouse + shared children sit under the hub (not on the fan arc)
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
    .filter((id) => map.has(id) && !positions.has(id))
    .filter((id) => {
      if (!spouse) return true
      return map.get(id)!.parents.some((p) => p.id === spouse)
    })
    .sort((a, b) => a.localeCompare(b, 'sv'))
    .slice(0, 6)

  if (childIds.length) {
    const childY = rootPos.y + nodeHeight + 72
    const unitLeft = spouse
      ? Math.min(rootPos.x, positions.get(spouse)!.x)
      : rootPos.x
    const unitRight = spouse
      ? Math.max(rootPos.x, positions.get(spouse)!.x) + nodeWidth
      : rootPos.x + nodeWidth
    const unitCx = (unitLeft + unitRight) / 2
    const totalW =
      childIds.length * nodeWidth + Math.max(0, childIds.length - 1) * coupleGap
    let x = unitCx - totalW / 2
    for (const cid of childIds) {
      positions.set(cid, { x, y: childY })
      x += nodeWidth + coupleGap
    }
  }

  // Normalize into positive canvas with padding
  let minX = Infinity
  let minY = Infinity
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
  }
  const dx = padding - minX
  const dy = padding - minY
  for (const [id, pos] of positions) {
    positions.set(id, { x: pos.x + dx, y: pos.y + dy })
  }

  const mid = (id: string) => {
    const pos = positions.get(id)!
    return { cx: pos.x + nodeWidth / 2, cy: pos.y + nodeHeight / 2, ...pos }
  }

  const connectors: LayoutConnector[] = []

  // Straight spokes clipped to card borders (never drawn through faces)
  const seenBlood = new Set<string>()
  for (const [id] of placed) {
    const node = map.get(id)!
    for (const parent of node.parents) {
      if (!positions.has(parent.id)) continue
      const key = [id, parent.id].sort().join('+')
      if (seenBlood.has(key)) continue
      seenBlood.add(key)

      const childPos = positions.get(id)!
      const parPos = positions.get(parent.id)!
      const seg = clipSegmentToCardBorders(
        parPos.x,
        parPos.y,
        nodeWidth,
        nodeHeight,
        childPos.x,
        childPos.y,
        nodeWidth,
        nodeHeight,
      )
      if (!seg) continue
      connectors.push({
        ...seg,
        kind: 'blood',
        bloodLink: {
          childIds: [id],
          parentIds: [parent.id],
        },
      })
    }
  }

  // Only the hub couple gets a spouse bar. Ancestor couples on the arc
  // would draw long horizontals that peek out as weird stubs under cards.
  if (spouse && positions.has(spouse)) {
    connectors.push(
      ...spouseLines(
        [map.get(rootId)!, map.get(spouse)!],
        positions,
        nodeWidth,
        nodeHeight,
      ),
    )
  }

  if (childIds.length) {
    const parents = [rootId, spouse].filter(
      (id): id is string => !!id && positions.has(id),
    )
    const parentMids = parents.map((id) => mid(id))
    const joinX =
      parentMids.reduce((s, p) => s + p.cx, 0) / parentMids.length
    const joinY = Math.max(...parentMids.map((p) => p.y + nodeHeight)) + 28
    const childMids = childIds.map((id) => mid(id))
    const childMin = Math.min(...childMids.map((c) => c.cx))
    const childMax = Math.max(...childMids.map((c) => c.cx))
    const childCenter = (childMin + childMax) / 2
    const barY = Math.min(...childMids.map((c) => c.y)) - 28
    const bloodLink = { childIds, parentIds: parents }

    for (const p of parentMids) {
      connectors.push({
        x1: p.cx,
        y1: p.y + nodeHeight,
        x2: p.cx,
        y2: joinY,
        kind: 'blood',
        bloodLink,
      })
    }
    if (parentMids.length > 1) {
      connectors.push({
        x1: Math.min(...parentMids.map((p) => p.cx)),
        y1: joinY,
        x2: Math.max(...parentMids.map((p) => p.cx)),
        y2: joinY,
        kind: 'blood',
        bloodLink,
      })
    }
    connectors.push({
      x1: joinX,
      y1: joinY,
      x2: childCenter,
      y2: barY,
      kind: 'blood',
      bloodLink,
    })
    if (childMids.length > 1) {
      connectors.push({
        x1: childMin,
        y1: barY,
        x2: childMax,
        y2: barY,
        kind: 'blood',
        bloodLink,
      })
    }
    for (const c of childMids) {
      connectors.push({
        x1: c.cx,
        y1: barY,
        x2: c.cx,
        y2: c.y,
        kind: 'blood',
        bloodLink,
      })
    }
  }

  const visibleNodes = nodes.filter((n) => positions.has(n.id))
  const people = visibleNodes.map((n) => {
    const pos = positions.get(n.id)!
    return { id: n.id, x: pos.x, y: pos.y, gender: n.gender }
  })

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
