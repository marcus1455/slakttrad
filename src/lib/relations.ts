import type { Gender, Node, Relation, RelType } from 'relatives-tree/lib/types'
import type { FamilyStore, Gender as AppGender, PersonProfile } from '../types'
import { assertParentBornBeforeChild } from './personLife'

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

  if (patch.birthYear !== undefined) {
    const node = store.nodes.find((n) => n.id === id)
    if (node) {
      for (const parent of node.parents) {
        assertParentBornBeforeChild(
          store.profiles[parent.id]?.birthYear,
          nextProfile.birthYear,
        )
      }
      for (const child of node.children) {
        assertParentBornBeforeChild(
          nextProfile.birthYear,
          store.profiles[child.id]?.birthYear,
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
): FamilyStore {
  const nodes = cloneNodes(store.nodes)
  const person = getMutable(nodes, personId)
  const id = newId()

  const partner: MutableNode = {
    id,
    gender: toLibGender(input.gender),
    parents: [],
    siblings: [],
    spouses: [married(personId)],
    children: person.children.map((c) => ({ ...c })),
  }

  person.spouses = ensureRel(person.spouses, id, married(id))

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
  options?: { coParentId?: string },
): FamilyStore {
  const nodes = cloneNodes(store.nodes)
  const parent = getMutable(nodes, parentId)
  const coParentId = options?.coParentId
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
    store.profiles[parentId]?.birthYear,
    input.birthYear,
  )
  if (coParentId) {
    assertParentBornBeforeChild(
      store.profiles[coParentId]?.birthYear,
      input.birthYear,
    )
  }

  const parents: Relation[] = [blood(parentId)]
  if (coParentId) parents.push(blood(coParentId))

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

  parent.children = ensureRel(parent.children, id, blood(id))
  if (coParentId) {
    const spouse = getMutable(nodes, coParentId)
    spouse.children = ensureRel(spouse.children, id, blood(id))
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
): FamilyStore {
  const nodes = cloneNodes(store.nodes)
  const person = getMutable(nodes, personId)

  if (person.parents.length >= 2) {
    throw new Error('Personen har redan två föräldrar')
  }

  assertParentBornBeforeChild(input.birthYear, store.profiles[personId]?.birthYear)
  for (const sib of person.siblings) {
    assertParentBornBeforeChild(input.birthYear, store.profiles[sib.id]?.birthYear)
  }

  const id = newId()
  const otherParentId = person.parents[0]?.id

  const parent: MutableNode = {
    id,
    gender: toLibGender(input.gender),
    parents: [],
    siblings: [],
    spouses: otherParentId ? [married(otherParentId)] : [],
    children: [blood(personId), ...person.siblings.map((s) => blood(s.id))],
  }

  person.parents = ensureRel(person.parents, id, blood(id))

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

