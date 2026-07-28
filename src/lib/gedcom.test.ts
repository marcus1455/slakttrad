import { describe, expect, it } from 'vitest'
import { exportGedcom, importGedcom } from './gedcom'
import { createBlankFamily } from '../data/blank'
import { addChild, addPartner } from './relations'

describe('gedcom', () => {
  it('round-trips a small family', () => {
    let store = createBlankFamily('Anna')
    const rootId = store.rootId
    store = addPartner(store, rootId, { name: 'Erik', gender: 'male', birthYear: '1980' })
    const partnerId = Object.keys(store.profiles).find((id) => id !== rootId)!
    store = addChild(
      store,
      rootId,
      { name: 'Lisa', gender: 'female', birthYear: '2010' },
      { coParentId: partnerId },
    )

    const text = exportGedcom(store, 'Testträd')
    expect(text).toContain('0 HEAD')
    expect(text).toContain('Anna')
    expect(text).toContain('Erik')
    expect(text).toContain('Lisa')

    const imported = importGedcom(text)
    const names = Object.values(imported.profiles)
      .map((p) => p.name)
      .sort()
    expect(names).toEqual(['Anna', 'Erik', 'Lisa'])
    expect(imported.nodes).toHaveLength(3)
  })
})
