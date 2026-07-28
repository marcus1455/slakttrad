import type { Gender, Node, Relation, RelType } from 'relatives-tree/lib/types'
import type { FamilyStore, Gender as AppGender, PersonProfile } from '../types'
import { assertParentBornBeforeChild, effectiveBirthYear } from './personLife'

type MutableNode = {
  id: string
  gender: Gender
  parents: Relation[]
  children: Relation[]
  siblings: Relation[]
  spouses: Relation[]
}

const bloodType = 'blood' as RelType
const marriedType = 'married' as RelType
const divorcedType = 'divorced' as RelType
const adoptedType = 'adopted' as RelType
const halfType = 'half' as RelType

export type SpouseRelType = 'married' | 'divorced'
export type ParentChildRelType = 'blood' | 'adopted' | 'half'

function newId(): string {
  return crypto.randomUUID().slice(0, 8)
}

function toLibGender(gender: AppGender): Gender {
  return (gender === 'male' ? 'male' : 'female') as Gender
}

function blood(id: string): Relation {
  return { id, type: bloodType }
}

function married(id: string): Relation {
  return { id, type: marriedType }
}

function spouseRel(id: string, type: SpouseRelType): Relation {
  return { id, type: (type === 'divorced' ? divorcedType : marriedType) as RelType }
}

function parentChildRel(id: string, type: ParentChildRelType): Relation {
  const map: Record<ParentChildRelType, RelType> = {
    blood: bloodType,
    adopted: adoptedType,
    half: halfType,
  }
  return { id, type: map[type] }
}

export function spouseTypeLabel(type: RelType | string): string {
  if (type === divorcedType || type === 'divorced') return 'Frånskild'
  if (type === marriedType || type === 'married') return 'Partner'
  return 'Partner'
}

export function parentChildTypeLabel(type: RelType | string): string {
  if (type === adoptedType || type === 'adopted') return 'Adoptiv'
  if (type === halfType || type === 'half') return 'Halv'
  return 'Blod'
}

function cloneNodes(nodes: readonly Node[]): MutableNode[] {
  return nodes.map((n) => ({
    id: n.id,
    gender: n.gender,
    parents: [...n.parents],
    children: [...n.children],
    siblings: [...n.siblings],
    spouses: [...n.spouses],
  }))
}

function asNodes(nodes: MutableNode[]): Node[] {
  return nodes as unknown as Node[]
}

function getMutable(nodes: MutableNode[], id: string): MutableNode {
  const node = nodes.find((n) => n.id === id)
  if (!node) throw new Error(`Saknar person: ${id}`)
  return node
}

function ensureRel(list: Relation[], id: string, rel: Relation): Relation[] {
  if (list.some((r) => r.id === id)) return list
  return [...list, rel]
}

function linkSiblings(nodes: MutableNode[], childIds: string[]): void {
  for (const id of childIds) {
    const node = getMutable(nodes, id)
    node.siblings = childIds.filter((sid) => sid !== id).map((sid) => blood(sid))
  }
}

export function updateProfile(
  store: FamilyStore,
  id: string,
  patch: Partial<Omit<PersonProfile, 'id'>>,
): FamilyStore {
  const profile = store.profiles[id]
  if (!profile) return store

  const nextProfile = { ...profile, ...patch }

  if (patch.birthYear !== undefined || patch.birthDate !== undefined) {
    const node = store.nodes.find((n) => n.id === id)
    if (node) {
      for (const parent of node.parents) {
        assertParentBornBeforeChild(
          effectiveBirthYear(store.profiles[parent.id]),
          effectiveBirthYear(nextProfile),
        )
      }
      for (const child of node.children) {
        assertParentBornBeforeChild(
          effectiveBirthYear(nextProfile),
          effectiveBirthYear(store.profiles[child.id]),
        )
      }
    }
  }

  const profiles = {
    ...store.profiles,
    [id]: nextProfile,
  }

  if (!patch.gender) {
    return { ...store, profiles }
  }

  const nodes = cloneNodes(store.nodes)
  getMutable(nodes, id).gender = toLibGender(patch.gender)

  return { ...store, profiles, nodes: asNodes(nodes) }
}

type NewPersonInput = {
  name: string
  nickname?: string
  birthYear?: string
  occupation?: string
  gender: AppGender
}

function profileFromInput(id: string, input: NewPersonInput) {
  const nickname = input.nickname?.trim()
  return {
    id,
    name: input.name.trim() || 'Namnlös',
    ...(nickname ? { nickname } : {}),
    birthYear: input.birthYear?.trim(),
    occupation: input.occupation?.trim(),
    gender: input.gender,
  }
}

export function addPartner(
  store: FamilyStore,
  personId: string,
  input: NewPersonInput,
  options?: { spouseType?: SpouseRelType },
): FamilyStore {
  const nodes = cloneNodes(store.nodes)
  const person = getMutable(nodes, personId)
  const id = newId()
  const spouseType = options?.spouseType ?? 'married'

  const partner: MutableNode = {
    id,
    gender: toLibGender(input.gender),
    parents: [],
    siblings: [],
    spouses: [spouseRel(personId, spouseType)],
    children: person.children.map((c) => ({ ...c })),
  }

  person.spouses = ensureRel(person.spouses, id, spouseRel(id, spouseType))

  for (const child of person.children) {
    const childNode = getMutable(nodes, child.id)
    childNode.parents = ensureRel(childNode.parents, id, blood(id))
  }

  nodes.push(partner)

  const profiles = {
    ...store.profiles,
    [id]: profileFromInput(id, input),
  }

  return { ...store, nodes: asNodes(nodes), profiles }
}

export function addChild(
  store: FamilyStore,
  parentId: string,
  input: NewPersonInput,
  options?: { coParentId?: string; linkType?: ParentChildRelType },
): FamilyStore {
  const nodes = cloneNodes(store.nodes)
  const parent = getMutable(nodes, parentId)
  const coParentId = options?.coParentId
  const linkType = options?.linkType ?? 'blood'
  const id = newId()

  if (coParentId) {
    if (!parent.spouses.some((s) => s.id === coParentId)) {
      throw new Error('Medförälder måste vara partner till personen')
    }
    if (!nodes.some((n) => n.id === coParentId)) {
      throw new Error('Medföräldern finns inte i trädet')
    }
  }

  assertParentBornBeforeChild(
    effectiveBirthYear(store.profiles[parentId]),
    input.birthYear,
  )
  if (coParentId) {
    assertParentBornBeforeChild(
      effectiveBirthYear(store.profiles[coParentId]),
      input.birthYear,
    )
  }

  const parents: Relation[] = [parentChildRel(parentId, linkType)]
  if (coParentId) parents.push(parentChildRel(coParentId, linkType))

  // Full + half siblings via the parent(s) this child is linked to.
  const siblingIds = new Set<string>()
  for (const pid of [parentId, ...(coParentId ? [coParentId] : [])]) {
    for (const child of getMutable(nodes, pid).children) {
      siblingIds.add(child.id)
    }
  }

  const child: MutableNode = {
    id,
    gender: toLibGender(input.gender),
    parents,
    siblings: [...siblingIds].map((sid) => blood(sid)),
    spouses: [],
    children: [],
  }

  parent.children = ensureRel(parent.children, id, parentChildRel(id, linkType))
  if (coParentId) {
    const spouse = getMutable(nodes, coParentId)
    spouse.children = ensureRel(spouse.children, id, parentChildRel(id, linkType))
  }

  nodes.push(child)
  linkSiblings(nodes, [...siblingIds, id])

  const profiles = {
    ...store.profiles,
    [id]: profileFromInput(id, input),
  }

  return { ...store, nodes: asNodes(nodes), profiles }
}

export function addParent(
  store: FamilyStore,
  personId: string,
  input: NewPersonInput,
  options?: { linkType?: ParentChildRelType },
): FamilyStore {
  const nodes = cloneNodes(store.nodes)
  const person = getMutable(nodes, personId)
  const linkType = options?.linkType ?? 'blood'

  if (person.parents.length >= 2) {
    throw new Error('Personen har redan två föräldrar')
  }

  assertParentBornBeforeChild(input.birthYear, effectiveBirthYear(store.profiles[personId]))
  for (const sib of person.siblings) {
    assertParentBornBeforeChild(input.birthYear, effectiveBirthYear(store.profiles[sib.id]))
  }

  const id = newId()
  const otherParentId = person.parents[0]?.id

  const parent: MutableNode = {
    id,
    gender: toLibGender(input.gender),
    parents: [],
    siblings: [],
    spouses: otherParentId ? [married(otherParentId)] : [],
    children: [
      parentChildRel(personId, linkType),
      ...person.siblings.map((s) => blood(s.id)),
    ],
  }

  person.parents = ensureRel(person.parents, id, parentChildRel(id, linkType))

  for (const sib of person.siblings) {
    const sibNode = getMutable(nodes, sib.id)
    sibNode.parents = ensureRel(sibNode.parents, id, blood(id))
  }

  if (otherParentId) {
    const other = getMutable(nodes, otherParentId)
    other.spouses = ensureRel(other.spouses, id, married(id))
    for (const child of parent.children) {
      other.children = ensureRel(other.children, child.id, blood(child.id))
    }
  }

  nodes.push(parent)

  const profiles = {
    ...store.profiles,
    [id]: profileFromInput(id, input),
  }

  return { ...store, nodes: asNodes(nodes), profiles }
}

export function setSpouseRelationType(
  store: FamilyStore,
  personId: string,
  spouseId: string,
  spouseType: SpouseRelType,
): FamilyStore {
  const nodes = cloneNodes(store.nodes)
  const person = getMutable(nodes, personId)
  const spouse = getMutable(nodes, spouseId)
  if (!person.spouses.some((s) => s.id === spouseId)) {
    throw new Error('Personerna är inte partners')
  }
  person.spouses = person.spouses.map((s) =>
    s.id === spouseId ? spouseRel(spouseId, spouseType) : s,
  )
  spouse.spouses = spouse.spouses.map((s) =>
    s.id === personId ? spouseRel(personId, spouseType) : s,
  )
  return { ...store, nodes: asNodes(nodes) }
}

export function setParentChildRelationType(
  store: FamilyStore,
  childId: string,
  parentId: string,
  linkType: ParentChildRelType,
): FamilyStore {
  const nodes = cloneNodes(store.nodes)
  const child = getMutable(nodes, childId)
  const parent = getMutable(nodes, parentId)
  if (!child.parents.some((p) => p.id === parentId)) {
    throw new Error('Personen är inte förälder')
  }
  child.parents = child.parents.map((p) =>
    p.id === parentId ? parentChildRel(parentId, linkType) : p,
  )
  parent.children = parent.children.map((c) =>
    c.id === childId ? parentChildRel(childId, linkType) : c,
  )
  return { ...store, nodes: asNodes(nodes) }
}

function withoutRel(list: Relation[], id: string): Relation[] {
  return list.filter((r) => r.id !== id)
}

export function removePerson(store: FamilyStore, personId: string): FamilyStore {
  if (!store.profiles[personId]) {
    throw new Error('Personen finns inte')
  }
  if (store.nodes.length <= 1) {
    throw new Error('Kan inte ta bort den sista personen')
  }

  const nodes = cloneNodes(store.nodes)
  const target = getMutable(nodes, personId)

  const parentIds = target.parents.map((p) => p.id)
  const childIds = target.children.map((c) => c.id)
  const spouseIds = target.spouses.map((s) => s.id)
  const siblingIds = target.siblings.map((s) => s.id)

  for (const parentId of parentIds) {
    const parent = getMutable(nodes, parentId)
    parent.children = withoutRel(parent.children, personId)
  }

  for (const childId of childIds) {
    const child = getMutable(nodes, childId)
    child.parents = withoutRel(child.parents, personId)
  }

  for (const spouseId of spouseIds) {
    const spouse = getMutable(nodes, spouseId)
    spouse.spouses = withoutRel(spouse.spouses, personId)
  }

  for (const siblingId of siblingIds) {
    const sibling = getMutable(nodes, siblingId)
    sibling.siblings = withoutRel(sibling.siblings, personId)
  }

  // Rebuild sibling groups among remaining children of each former parent
  for (const parentId of parentIds) {
    const parent = getMutable(nodes, parentId)
    linkSiblings(
      nodes,
      parent.children.map((c) => c.id),
    )
  }

  const nextNodes = nodes.filter((n) => n.id !== personId)
  const { [personId]: _removed, ...profiles } = store.profiles

  let rootId = store.rootId
  if (rootId === personId) {
    rootId =
      spouseIds[0] ??
      parentIds[0] ??
      childIds[0] ??
      nextNodes[0]?.id ??
      store.rootId
  }

  return {
    rootId,
    profiles,
    nodes: asNodes(nextNodes),
  }
}

/** When the person has exactly one partner, return that partner id. */
export function soleSpouseId(
  store: FamilyStore,
  personId: string,
): string | undefined {
  const node = store.nodes.find((n) => n.id === personId)
  if (!node || node.spouses.length !== 1) return undefined
  const id = node.spouses[0]?.id
  return id && store.nodes.some((n) => n.id === id) ? id : undefined
}

export function unlinkSpouse(store: FamilyStore, personId: string, spouseId: string): FamilyStore {
  const nodes = cloneNodes(store.nodes)
  const person = getMutable(nodes, personId)
  const spouse = getMutable(nodes, spouseId)
  person.spouses = withoutRel(person.spouses, spouseId)
  spouse.spouses = withoutRel(spouse.spouses, personId)
  return { ...store, nodes: asNodes(nodes) }
}

export function unlinkParent(
  store: FamilyStore,
  childId: string,
  parentId: string,
): FamilyStore {
  const nodes = cloneNodes(store.nodes)
  const child = getMutable(nodes, childId)
  const parent = getMutable(nodes, parentId)

  child.parents = withoutRel(child.parents, parentId)
  parent.children = withoutRel(parent.children, childId)

  // Refresh siblings among remaining children of this parent
  linkSiblings(
    nodes,
    parent.children.map((c) => c.id),
  )

  // Also drop sibling links that only existed via this parentage
  const remainingParentIds = child.parents.map((p) => p.id)
  if (remainingParentIds.length === 0) {
    child.siblings = []
  } else {
    const coParent = getMutable(nodes, remainingParentIds[0])
    linkSiblings(
      nodes,
      coParent.children.map((c) => c.id),
    )
  }

  return { ...store, nodes: asNodes(nodes) }
}

/** Link two existing people as partners. */
export function linkSpouse(
  store: FamilyStore,
  personId: string,
  spouseId: string,
  spouseType: SpouseRelType = 'married',
): FamilyStore {
  if (personId === spouseId) {
    throw new Error('Kan inte koppla en person till sig själv')
  }
  const nodes = cloneNodes(store.nodes)
  const person = getMutable(nodes, personId)
  const spouse = getMutable(nodes, spouseId)
  if (person.spouses.some((s) => s.id === spouseId)) {
    return store
  }
  person.spouses = ensureRel(person.spouses, spouseId, spouseRel(spouseId, spouseType))
  spouse.spouses = ensureRel(spouse.spouses, personId, spouseRel(personId, spouseType))
  return { ...store, nodes: asNodes(nodes) }
}

/** Link an existing parent to an existing child. */
export function linkParentChild(
  store: FamilyStore,
  parentId: string,
  childId: string,
  linkType: ParentChildRelType = 'blood',
): FamilyStore {
  if (parentId === childId) {
    throw new Error('Kan inte koppla en person till sig själv')
  }
  const nodes = cloneNodes(store.nodes)
  const parent = getMutable(nodes, parentId)
  const child = getMutable(nodes, childId)

  if (child.parents.some((p) => p.id === parentId)) {
    return store
  }
  if (child.parents.length >= 2) {
    throw new Error('Personen har redan två föräldrar')
  }
  if (parent.parents.some((p) => p.id === childId)) {
    throw new Error('Kan inte skapa cirkulär relation')
  }

  assertParentBornBeforeChild(
    effectiveBirthYear(store.profiles[parentId]),
    effectiveBirthYear(store.profiles[childId]),
  )

  child.parents = ensureRel(child.parents, parentId, parentChildRel(parentId, linkType))
  parent.children = ensureRel(parent.children, childId, parentChildRel(childId, linkType))

  const siblingIds = parent.children.map((c) => c.id)
  linkSiblings(nodes, siblingIds)

  return { ...store, nodes: asNodes(nodes) }
}

