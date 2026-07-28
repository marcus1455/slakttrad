import type { Node } from 'relatives-tree/lib/types'

export type Gender = 'male' | 'female'

export type CivilStatus =
  | 'single'
  | 'married'
  | 'divorced'
  | 'widowed'
  | ''

export type LifeEventType =
  | 'birth'
  | 'death'
  | 'marriage'
  | 'divorce'
  | 'education'
  | 'career'
  | 'move'
  | 'other'

export type LifeEvent = {
  id: string
  type: LifeEventType
  /** Year or free-form date, e.g. "1985" or "1985-06-12". */
  date?: string
  place?: string
  title?: string
  notes?: string
}

export type PersonProfile = {
  id: string
  name: string
  /** Call name / tilltalsnamn, e.g. "Anna-lisa". */
  nickname?: string
  /** Maiden name / previous surname. */
  maidenName?: string
  /** Other names the person was known as. */
  alsoKnownAs?: string
  birthYear?: string
  deathYear?: string
  /** Optional full date, e.g. "1923-03-14". */
  birthDate?: string
  deathDate?: string
  birthPlace?: string
  birthCountry?: string
  deathPlace?: string
  deathCountry?: string
  /** Current / last known residence. */
  residencePlace?: string
  residenceCountry?: string
  occupation?: string
  civilStatus?: CivilStatus
  religion?: string
  /** Source notes: ArkivDigital, books, oral history… */
  sources?: string
  email?: string
  phone?: string
  notes?: string
  photoUrl?: string
  gender: Gender
  /** Structured life events beyond birth/death years. */
  events?: LifeEvent[]
  /** Signed-in user id that claimed this person as "me". */
  claimedByUserId?: string
  /** Last invite email used to invite this person as collaborator. */
  invitedEmail?: string
}

/** Named snapshot of tree graph (profiles + nodes), without nested checkpoints. */
export type TreeCheckpoint = {
  id: string
  label: string
  createdAt: string
  rootId: string
  profiles: Record<string, PersonProfile>
  nodes: Node[]
}

export type FamilyStore = {
  rootId: string
  profiles: Record<string, PersonProfile>
  nodes: Node[]
  checkpoints?: TreeCheckpoint[]
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
