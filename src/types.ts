import type { Node } from 'relatives-tree/lib/types'

export type Gender = 'male' | 'female'

export type PersonProfile = {
  id: string
  name: string
  /** Call name / tilltalsnamn, e.g. "Anna-lisa". */
  nickname?: string
  birthYear?: string
  deathYear?: string
  birthPlace?: string
  occupation?: string
  email?: string
  phone?: string
  notes?: string
  photoUrl?: string
  gender: Gender
}

export type FamilyStore = {
  rootId: string
  profiles: Record<string, PersonProfile>
  nodes: Node[]
}

export type TreeMeta = {
  id: string
  slug: string
  name: string
  shareToken: string
  ownerId?: string | null
}

export type LoadedTree = {
  store: FamilyStore
  meta: TreeMeta
}

export type AddRelationKind = 'partner' | 'child' | 'parent'
