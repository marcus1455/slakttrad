import { describe, expect, it } from 'vitest'
import { createBlankFamily } from '../data/blank'
import {
  addChild,
  addPartner,
  linkParentChild,
  linkSpouse,
  unlinkParent,
  unlinkSpouse,
} from './relations'

describe('link existing people', () => {
  it('links two roots as spouses', () => {
    let a = createBlankFamily('Anna')
    const b = createBlankFamily('Erik')
    // Merge Erik into Anna's store
    const erik = Object.values(b.profiles)[0]!
    const erikNode = b.nodes[0]!
    a = {
      ...a,
      profiles: { ...a.profiles, [erik.id]: erik },
      nodes: [...a.nodes, erikNode],
    }
    const annaId = a.rootId
    a = linkSpouse(a, annaId, erik.id)
    const anna = a.nodes.find((n) => n.id === annaId)!
    const erikN = a.nodes.find((n) => n.id === erik.id)!
    expect(anna.spouses.some((s) => s.id === erik.id)).toBe(true)
    expect(erikN.spouses.some((s) => s.id === annaId)).toBe(true)
    a = unlinkSpouse(a, annaId, erik.id)
    expect(a.nodes.find((n) => n.id === annaId)!.spouses).toHaveLength(0)
  })

  it('links an existing child under a parent', () => {
    let store = createBlankFamily('Mor')
    store = addPartner(store, store.rootId, { name: 'Far', gender: 'male' })
    const parentId = store.rootId
    const other = createBlankFamily('Barn')
    const child = Object.values(other.profiles)[0]!
    store = {
      ...store,
      profiles: { ...store.profiles, [child.id]: child },
      nodes: [...store.nodes, other.nodes[0]!],
    }
    store = linkParentChild(store, parentId, child.id)
    expect(
      store.nodes.find((n) => n.id === child.id)!.parents.some((p) => p.id === parentId),
    ).toBe(true)
    store = unlinkParent(store, child.id, parentId)
    expect(store.nodes.find((n) => n.id === child.id)!.parents).toHaveLength(0)
  })

  it('still supports addChild after partner', () => {
    let store = createBlankFamily('A')
    store = addPartner(store, store.rootId, { name: 'B', gender: 'male' })
    const spouseId = store.nodes.find((n) => n.id !== store.rootId)!.id
    store = addChild(
      store,
      store.rootId,
      { name: 'C', gender: 'female' },
      { coParentId: spouseId },
    )
    expect(Object.keys(store.profiles)).toHaveLength(3)
  })
})
