import type { Node } from 'relatives-tree/lib/types'
import type { LayoutConnector } from './types'

export function spouseLines(
  nodes: readonly Node[],
  positions: Map<string, { x: number; y: number }>,
  nodeWidth: number,
  nodeHeight: number,
): LayoutConnector[] {
  const connectors: LayoutConnector[] = []
  const seen = new Set<string>()
  for (const node of nodes) {
    if (!positions.has(node.id)) continue
    for (const spouse of node.spouses) {
      if (!positions.has(spouse.id)) continue
      const key = [node.id, spouse.id].sort().join('+')
      if (seen.has(key)) continue
      seen.add(key)
      const a = positions.get(node.id)!
      const b = positions.get(spouse.id)!
      const y = a.y + nodeHeight * 0.55
      const left = a.x < b.x ? a : b
      const right = a.x < b.x ? b : a
      const x1 = left.x + nodeWidth
      const x2 = right.x
      if (x2 <= x1) continue
      const leftId = a.x < b.x ? node.id : spouse.id
      const rightId = a.x < b.x ? spouse.id : node.id
      connectors.push({
        x1,
        y1: y,
        x2,
        y2: y,
        kind: 'spouse',
        spouseIds: [leftId, rightId],
      })
    }
  }
  return connectors
}

export function bloodBrackets(
  nodes: readonly Node[],
  positions: Map<string, { x: number; y: number }>,
  nodeWidth: number,
  nodeHeight: number,
  gapY: number,
): LayoutConnector[] {
  const connectors: LayoutConnector[] = []
  const mid = (id: string) => {
    const pos = positions.get(id)!
    return {
      cx: pos.x + nodeWidth / 2,
      top: pos.y,
      bottom: pos.y + nodeHeight,
    }
  }

  const childrenByParents = new Map<string, string[]>()
  for (const node of nodes) {
    if (!positions.has(node.id)) continue
    const parentIds = node.parents
      .map((p) => p.id)
      .filter((id) => positions.has(id))
      .sort()
    if (!parentIds.length) continue
    const key = parentIds.join('+')
    const list = childrenByParents.get(key) ?? []
    list.push(node.id)
    childrenByParents.set(key, list)
  }

  for (const [key, childIds] of childrenByParents) {
    const parentIds = key.split('+').filter((id) => positions.has(id))
    if (!parentIds.length) continue
    const parentMids = parentIds.map((id) => mid(id))
    const childMids = childIds
      .filter((id) => positions.has(id))
      .map((id) => ({ id, ...mid(id) }))
      .sort((a, b) => a.cx - b.cx)
    if (!childMids.length) continue

    const joinX =
      parentMids.reduce((sum, p) => sum + p.cx, 0) / parentMids.length
    const joinY = Math.max(...parentMids.map((p) => p.bottom)) + gapY * 0.35
    const childXs = childMids.map((c) => c.cx)
    const childMin = Math.min(...childXs)
    const childMax = Math.max(...childXs)
    const childCenter = (childMin + childMax) / 2
    const barY = Math.min(...childMids.map((c) => c.top)) - gapY * 0.35
    const bloodLink = { childIds: childMids.map((c) => c.id), parentIds }

    for (const p of parentMids) {
      connectors.push({
        x1: p.cx,
        y1: p.bottom,
        x2: p.cx,
        y2: joinY,
        kind: 'blood',
        bloodLink,
      })
    }
    if (parentMids.length > 1) {
      const xs = parentMids.map((p) => p.cx)
      connectors.push({
        x1: Math.min(...xs),
        y1: joinY,
        x2: Math.max(...xs),
        y2: joinY,
        kind: 'blood',
        bloodLink,
      })
    }
    if (Math.abs(childCenter - joinX) > 1) {
      connectors.push({
        x1: joinX,
        y1: joinY,
        x2: childCenter,
        y2: joinY,
        kind: 'blood',
        bloodLink,
      })
    }
    connectors.push({
      x1: childCenter,
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
    for (const child of childMids) {
      connectors.push({
        x1: child.cx,
        y1: barY,
        x2: child.cx,
        y2: child.top,
        kind: 'blood',
        bloodLink,
      })
    }
  }
  return connectors
}
