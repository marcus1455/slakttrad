import type { Node } from 'relatives-tree/lib/types'

export type LayoutPerson = {
  id: string
  x: number
  y: number
  gender: Node['gender']
}

export type LayoutConnector = {
  x1: number
  y1: number
  x2: number
  y2: number
  kind: 'blood' | 'spouse'
  spouseIds?: [string, string]
  bloodLink?: { childIds: string[]; parentIds: string[] }
}

export type TreeLayout = {
  people: LayoutPerson[]
  connectors: LayoutConnector[]
  width: number
  height: number
}

/** @deprecated Prefer TreeLayout — same shape. */
export type FullTreeLayout = TreeLayout

export type LayoutMode = 'full' | 'pedigree' | 'fan'

export type LayoutOptions = {
  nodeWidth: number
  nodeHeight: number
  coupleGap?: number
  unitGap?: number
  familyGap?: number
  gapY?: number
  padding?: number
  /** Focus person for pedigree / fan (usually store.rootId). */
  rootId?: string
  /** Max ancestor generations for pedigree / fan. */
  maxGenerations?: number
}
