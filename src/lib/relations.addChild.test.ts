import { describe, expect, it } from 'vitest'
import { createBlankFamily } from '../data/blank'
import { addChild, addPartner, soleSpouseId } from './relations'

describe('addChild', () => {
  it('links only to the chosen parent when no coParentId is passed', () => {
    let store = createBlankFamily('Linnea')
    const linneaId = store.rootId
    store = addPartner(store, linneaId, { name: 'Harry', gender: 'male' })
    const harryId = Object.keys(store.profiles).find((id) => id !== linneaId)!

    store = addChild(store, harryId, { name: 'Ingrid', gender: 'female' })
    const ingridId = Object.keys(store.profiles).find(
      (id) => id !== linneaId && id !== harryId,
    )!
    const ingrid = store.nodes.find((n) => n.id === ingridId)!

    expect(ingrid.parents.map((p) => p.id).sort()).toEqual([harryId])
    expect(store.nodes.find((n) => n.id === harryId)!.children.some((c) => c.id === ingridId)).toBe(
      true,
    )
    expect(
      store.nodes.find((n) => n.id === linneaId)!.children.some((c) => c.id === ingridId),
    ).toBe(false)
  })

  it('links to both partners when the person has exactly one spouse (UI path)', () => {
    let store = createBlankFamily('Linnea')
    const linneaId = store.rootId
    store = addPartner(store, linneaId, { name: 'Harry', gender: 'male' })
    const harryId = Object.keys(store.profiles).find((id) => id !== linneaId)!

    const coParentId = soleSpouseId(store, harryId)
    expect(coParentId).toBe(linneaId)

    store = addChild(
      store,
      harryId,
      { name: 'Inger', gender: 'female' },
      { coParentId },
    )
    const ingerId = Object.keys(store.profiles).find(
      (id) => id !== linneaId && id !== harryId,
    )!
    const inger = store.nodes.find((n) => n.id === ingerId)!

    expect(inger.parents.map((p) => p.id).sort()).toEqual([harryId, linneaId].sort())
    expect(store.nodes.find((n) => n.id === harryId)!.children.some((c) => c.id === ingerId)).toBe(
      true,
    )
    expect(store.nodes.find((n) => n.id === linneaId)!.children.some((c) => c.id === ingerId)).toBe(
      true,
    )
  })

  it('soleSpouseId returns the only partner, else undefined', () => {
    let store = createBlankFamily('Linnea')
    const linneaId = store.rootId
    expect(soleSpouseId(store, linneaId)).toBeUndefined()

    store = addPartner(store, linneaId, { name: 'Harry', gender: 'male' })
    const harryId = Object.keys(store.profiles).find((id) => id !== linneaId)!
    expect(soleSpouseId(store, harryId)).toBe(linneaId)
    expect(soleSpouseId(store, linneaId)).toBe(harryId)

    store = addPartner(store, harryId, { name: 'Other', gender: 'female' })
    expect(soleSpouseId(store, harryId)).toBeUndefined()
  })
})
