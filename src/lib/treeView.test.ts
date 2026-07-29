import { describe, expect, it } from 'vitest'
import type { FamilyStore, PersonProfile } from '../types'
import { node } from './testNodes'
import { nearIds, nodesForView } from './treeView'

function profile(
  id: string,
  name: string,
  gender: PersonProfile['gender'] = 'female',
): PersonProfile {
  return { id, name, gender }
}

/** Minimal Öhrner-like tree: Julia's near view should include Robert + cousins, not Staffan/Camilla. */
function ohrnerFixture(): FamilyStore {
  const profiles: Record<string, PersonProfile> = {
    staffan: profile('staffan', 'Staffan Lindström', 'male'),
    ulla: profile('ulla', 'Ulla Lindström', 'female'),
    camilla: profile('camilla', 'Camilla Sigurd', 'female'),
    asa: profile('asa', 'Åsa Öhrner', 'female'),
    lars: profile('lars', 'Lars Öhrner', 'male'),
    robert: profile('robert', 'Robert Öhrner', 'male'),
    helena: profile('helena', 'Helena Rooth', 'female'),
    hakan: profile('hakan', 'Håkan Rooth', 'male'),
    marcus: profile('marcus', 'Marcus Öhmer', 'male'),
    alexander: profile('alexander', 'Alexander Öhmer', 'male'),
    julia: profile('julia', 'Julia Rooth', 'female'),
    elsa: profile('elsa', 'Elsa Rooth', 'female'),
    erik: profile('erik', 'Erik Ring', 'male'),
  }

  return {
    rootId: 'marcus',
    profiles,
    nodes: [
      node({
        id: 'staffan',
        gender: 'male',
        spouses: [{ id: 'ulla', type: 'married' }],
        children: [
          { id: 'camilla', type: 'blood' },
          { id: 'asa', type: 'blood' },
        ],
      }),
      node({
        id: 'ulla',
        gender: 'female',
        spouses: [{ id: 'staffan', type: 'married' }],
        children: [
          { id: 'camilla', type: 'blood' },
          { id: 'asa', type: 'blood' },
        ],
      }),
      node({
        id: 'camilla',
        gender: 'female',
        parents: [
          { id: 'staffan', type: 'blood' },
          { id: 'ulla', type: 'blood' },
        ],
        siblings: [{ id: 'asa', type: 'blood' }],
      }),
      node({
        id: 'asa',
        gender: 'female',
        parents: [
          { id: 'staffan', type: 'blood' },
          { id: 'ulla', type: 'blood' },
        ],
        siblings: [{ id: 'camilla', type: 'blood' }],
        spouses: [{ id: 'robert', type: 'married' }],
        children: [
          { id: 'marcus', type: 'blood' },
          { id: 'alexander', type: 'blood' },
        ],
      }),
      node({
        id: 'lars',
        gender: 'male',
        children: [
          { id: 'robert', type: 'blood' },
          { id: 'helena', type: 'blood' },
        ],
      }),
      node({
        id: 'robert',
        gender: 'male',
        parents: [{ id: 'lars', type: 'blood' }],
        siblings: [{ id: 'helena', type: 'blood' }],
        spouses: [{ id: 'asa', type: 'married' }],
        children: [
          { id: 'marcus', type: 'blood' },
          { id: 'alexander', type: 'blood' },
        ],
      }),
      node({
        id: 'helena',
        gender: 'female',
        parents: [{ id: 'lars', type: 'blood' }],
        siblings: [{ id: 'robert', type: 'blood' }],
        spouses: [{ id: 'hakan', type: 'married' }],
        children: [
          { id: 'julia', type: 'blood' },
          { id: 'elsa', type: 'blood' },
        ],
      }),
      node({
        id: 'hakan',
        gender: 'male',
        spouses: [{ id: 'helena', type: 'married' }],
        children: [
          { id: 'julia', type: 'blood' },
          { id: 'elsa', type: 'blood' },
        ],
      }),
      node({
        id: 'marcus',
        gender: 'male',
        parents: [
          { id: 'robert', type: 'blood' },
          { id: 'asa', type: 'blood' },
        ],
        siblings: [{ id: 'alexander', type: 'blood' }],
      }),
      node({
        id: 'alexander',
        gender: 'male',
        parents: [
          { id: 'robert', type: 'blood' },
          { id: 'asa', type: 'blood' },
        ],
        siblings: [{ id: 'marcus', type: 'blood' }],
      }),
      node({
        id: 'julia',
        gender: 'female',
        parents: [
          { id: 'helena', type: 'blood' },
          { id: 'hakan', type: 'blood' },
        ],
        siblings: [{ id: 'elsa', type: 'blood' }],
        spouses: [{ id: 'erik', type: 'married' }],
      }),
      node({
        id: 'elsa',
        gender: 'female',
        parents: [
          { id: 'helena', type: 'blood' },
          { id: 'hakan', type: 'blood' },
        ],
        siblings: [{ id: 'julia', type: 'blood' }],
      }),
      node({
        id: 'erik',
        gender: 'male',
        spouses: [{ id: 'julia', type: 'married' }],
      }),
    ],
  }
}

describe('nearIds', () => {
  it('includes uncle and cousins when Julia is focus, not maternal in-laws of the uncle', () => {
    const store = ohrnerFixture()
    const near = nearIds(store, 'julia')

    expect(near.has('julia')).toBe(true)
    expect(near.has('erik')).toBe(true)
    expect(near.has('helena')).toBe(true)
    expect(near.has('hakan')).toBe(true)
    expect(near.has('elsa')).toBe(true)
    expect(near.has('lars')).toBe(true)
    expect(near.has('robert')).toBe(true)
    expect(near.has('asa')).toBe(true) // uncle's spouse
    expect(near.has('marcus')).toBe(true)
    expect(near.has('alexander')).toBe(true)

    expect(near.has('staffan')).toBe(false)
    expect(near.has('ulla')).toBe(false)
    expect(near.has('camilla')).toBe(false)
  })

  it('nodesForView uses explicit focusId for near, not only store.rootId', () => {
    const store = ohrnerFixture()
    const nodes = nodesForView(store, { type: 'near' }, 'julia')
    const ids = new Set(nodes.map((n) => n.id))
    expect(ids.has('robert')).toBe(true)
    expect(ids.has('marcus')).toBe(true)
    expect(ids.has('staffan')).toBe(false)
  })
})
