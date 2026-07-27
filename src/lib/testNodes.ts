import type { Node } from 'relatives-tree/lib/types'

export function node(
  partial: Partial<Node> & { id: string; gender: Node['gender'] },
): Node {
  return {
    parents: [],
    siblings: [],
    spouses: [],
    children: [],
    ...partial,
  }
}
