import type { Node } from 'relatives-tree/lib/types'
import type { FamilyStore, Gender } from '../types'

export const FOCUS_PERSON_ID = 'sofia'

function genderOf(store: FamilyStore, id: string): Gender | undefined {
  return store.profiles[id]?.gender
}

function nodeMap(nodes: readonly Node[]) {
  return new Map(nodes.map((n) => [n.id, n]))
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Ancestor label from depth + which parent-side of focus we climbed. */
function ancestorLabel(
  depth: number,
  side: 'far' | 'mor',
  personGender: Gender | undefined,
): string {
  const base =
    side === 'far'
      ? personGender === 'male'
        ? 'farfar'
        : 'farmor'
      : personGender === 'male'
        ? 'morfar'
        : 'mormor'

  if (depth === 2) return capitalize(base)
  if (depth === 3) return `Gammel${base}`
  if (depth === 4) return `Tipp${base}`
  if (depth >= 5) return personGender === 'male' ? 'Förfader' : 'Ana'
  return 'Släkting'
}

/**
 * Walk up from focus through parents until personId is found.
 * Returns depth (1 = parent) and whether we entered via father or mother.
 */
function findAncestor(
  nodes: Map<string, Node>,
  focusId: string,
  personId: string,
  store: FamilyStore,
): { depth: number; side: 'far' | 'mor' } | null {
  type Frame = { id: string; depth: number; side: 'far' | 'mor' | null }
  const queue: Frame[] = [{ id: focusId, depth: 0, side: null }]
  const seen = new Set<string>([focusId])

  while (queue.length) {
    const cur = queue.shift()!
    const node = nodes.get(cur.id)
    if (!node) continue

    for (const parent of node.parents) {
      if (!nodes.has(parent.id) || seen.has(parent.id)) continue
      seen.add(parent.id)
      const parentGender = genderOf(store, parent.id)
      const side: 'far' | 'mor' =
        cur.side ?? (parentGender === 'male' ? 'far' : 'mor')
      const depth = cur.depth + 1
      if (parent.id === personId) return { depth, side }
      queue.push({ id: parent.id, depth, side })
    }
  }
  return null
}

/** Swedish kinship label relative to the focus person. */
export function relationToFocus(
  store: FamilyStore,
  personId: string,
  focusId: string = FOCUS_PERSON_ID,
): string | null {
  if (personId === focusId) return 'Centrum'

  const nodes = nodeMap(store.nodes)
  const focus = nodes.get(focusId)
  const person = nodes.get(personId)
  if (!focus || !person) return null

  const g = genderOf(store, personId)

  if (focus.spouses.some((s) => s.id === personId)) return 'Partner'

  if (focus.parents.some((p) => p.id === personId)) {
    return g === 'male' ? 'Far' : 'Mor'
  }

  if (focus.children.some((c) => c.id === personId)) {
    return g === 'male' ? 'Son' : 'Dotter'
  }

  if (focus.siblings.some((s) => s.id === personId)) {
    return g === 'male' ? 'Bror' : 'Syster'
  }

  for (const sib of focus.siblings) {
    const sibNode = nodes.get(sib.id)
    if (sibNode?.spouses.some((s) => s.id === personId)) {
      return g === 'male' ? 'Svåger' : 'Svägerska'
    }
  }

  const ancestor = findAncestor(nodes, focusId, personId, store)
  if (ancestor && ancestor.depth >= 2) {
    return ancestorLabel(ancestor.depth, ancestor.side, g)
  }

  for (const parent of focus.parents) {
    const pNode = nodes.get(parent.id)
    if (!pNode) continue
    if (pNode.siblings.some((s) => s.id === personId)) {
      const parentGender = genderOf(store, parent.id)
      if (parentGender === 'female') return g === 'male' ? 'Morbror' : 'Moster'
      return g === 'male' ? 'Farbror' : 'Faster'
    }
    for (const sib of pNode.siblings) {
      const sibNode = nodes.get(sib.id)
      if (sibNode?.spouses.some((s) => s.id === personId)) {
        return 'Mosters/farbrors partner'
      }
    }
  }

  for (const parent of focus.parents) {
    const pNode = nodes.get(parent.id)
    if (!pNode) continue
    for (const sib of pNode.siblings) {
      const sibNode = nodes.get(sib.id)
      if (!sibNode) continue
      if (sibNode.children.some((c) => c.id === personId)) return 'Kusin'
      for (const spouse of sibNode.spouses) {
        const spouseNode = nodes.get(spouse.id)
        if (spouseNode?.children.some((c) => c.id === personId)) return 'Kusin'
      }
    }
  }

  for (const parent of focus.parents) {
    const pNode = nodes.get(parent.id)
    if (!pNode) continue
    for (const sib of pNode.siblings) {
      const sibNode = nodes.get(sib.id)
      if (!sibNode) continue
      for (const cousin of sibNode.children) {
        const cousinNode = nodes.get(cousin.id)
        if (!cousinNode) continue
        if (cousinNode.spouses.some((s) => s.id === personId)) {
          return 'Kusins partner'
        }
        if (cousinNode.children.some((c) => c.id === personId)) {
          return 'Kusinbarn'
        }
        for (const spouse of cousinNode.spouses) {
          const spouseNode = nodes.get(spouse.id)
          if (spouseNode?.children.some((c) => c.id === personId)) {
            return 'Kusinbarn'
          }
        }
      }
    }
  }

  for (const sib of focus.siblings) {
    const sibNode = nodes.get(sib.id)
    if (!sibNode) continue
    if (sibNode.children.some((c) => c.id === personId)) {
      const sibGender = genderOf(store, sib.id)
      if (sibGender === 'female') {
        return g === 'male' ? 'Systerson' : 'Systerdotter'
      }
      return g === 'male' ? 'Brorson' : 'Brorsdotter'
    }
  }

  for (const child of focus.children) {
    const cNode = nodes.get(child.id)
    if (cNode?.children.some((gc) => gc.id === personId)) return 'Barnbarn'
  }

  for (const parent of focus.parents) {
    const pNode = nodes.get(parent.id)
    if (
      pNode?.spouses.some((s) => s.id === personId) &&
      !focus.parents.some((p) => p.id === personId)
    ) {
      return g === 'male' ? 'Styvfar' : 'Styvmor'
    }
  }

  return 'Släkting'
}
