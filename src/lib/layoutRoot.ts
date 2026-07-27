import calcTree from 'relatives-tree'
import type { Node } from 'relatives-tree/lib/types'

/** Top ancestor preference for bloodline views (Örjan if present). */
export function pickLayoutRoot(nodes: readonly Node[]): string {
  const withoutParents = nodes.filter((n) => n.parents.length === 0)
  const preferred = withoutParents.find((n) => n.id === 'orjan')
  if (preferred) return preferred.id

  withoutParents.sort(
    (a, b) => (b.children?.length ?? 0) - (a.children?.length ?? 0),
  )
  if (withoutParents[0]) return withoutParents[0].id
  return nodes[0]?.id ?? ''
}

/**
 * Pick the layout root that reveals the most people.
 * Used for "Visa hela" so both maternal and paternal sides can appear together.
 */
export function pickBestLayoutRoot(
  nodes: readonly Node[],
  preferId?: string,
): string {
  if (!nodes.length) return ''

  const candidates = new Set<string>()
  if (preferId && nodes.some((n) => n.id === preferId)) {
    candidates.add(preferId)
  }
  for (const node of nodes) {
    if (node.parents.length === 0 || node.children.length > 0) {
      candidates.add(node.id)
    }
  }
  if (nodes.length <= 50) {
    for (const node of nodes) candidates.add(node.id)
  }

  let bestId =
    preferId && nodes.some((n) => n.id === preferId) ? preferId : nodes[0].id
  let bestCount = -1

  for (const id of candidates) {
    try {
      const tree = calcTree(nodes as Node[], { rootId: id })
      const count = tree.nodes.filter((n) => !n.placeholder).length
      const preferBonus = id === preferId ? 0.5 : 0
      if (count + preferBonus > bestCount) {
        bestCount = count + preferBonus
        bestId = id
      }
    } catch {
      // skip roots the layout engine rejects
    }
  }

  return bestId
}

/** How many people are visible when laying out from a given root. */
export function countVisibleNodes(nodes: readonly Node[], rootId: string): number {
  try {
    const tree = calcTree(nodes as Node[], { rootId })
    return tree.nodes.filter((n) => !n.placeholder).length
  } catch {
    return 0
  }
}
