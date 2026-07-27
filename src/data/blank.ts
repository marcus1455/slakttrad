import type { Gender, Node } from 'relatives-tree/lib/types'
import type { FamilyStore } from '../types'

const female = 'female' as Gender

/** One-person starter board for a brand-new tree. */
export function createBlankFamily(name = 'Jag'): FamilyStore {
  const id = crypto.randomUUID().replaceAll('-', '').slice(0, 12)
  return {
    rootId: id,
    profiles: {
      [id]: {
        id,
        name,
        gender: 'female',
      },
    },
    nodes: [
      {
        id,
        gender: female,
        parents: [],
        siblings: [],
        spouses: [],
        children: [],
      } satisfies Node,
    ],
  }
}
