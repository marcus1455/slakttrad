import type { Node } from 'relatives-tree/lib/types'
import { layoutFullTree } from '../fullTreeLayout'
import { layoutFan } from './fan'
import { layoutPedigree } from './pedigree'
import type { LayoutMode, LayoutOptions, TreeLayout } from './types'

export type { LayoutMode, LayoutOptions, TreeLayout } from './types'
export type {
  FullTreeLayout,
  LayoutConnector,
  LayoutPerson,
} from './types'

export function layoutTree(
  nodes: readonly Node[],
  options: LayoutOptions & { mode?: LayoutMode },
): TreeLayout {
  const mode = options.mode ?? 'full'
  if (mode === 'pedigree') return layoutPedigree(nodes, options)
  if (mode === 'fan') return layoutFan(nodes, options)
  return layoutFullTree(nodes, options)
}

export { layoutFullTree } from '../fullTreeLayout'
export { layoutPedigree } from './pedigree'
export { layoutFan } from './fan'
