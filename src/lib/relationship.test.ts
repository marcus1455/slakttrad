import { describe, expect, it } from 'vitest'
import { relationToFocus } from './relationship'
import { node } from './testNodes'
import type { FamilyStore } from '../types'

function store(partial: Partial<FamilyStore> & Pick<FamilyStore, 'nodes' | 'profiles'>): FamilyStore {
  return { rootId: 'sofia', ...partial }
}

describe('relationToFocus', () => {
  const base = store({
    nodes: [
      node({
        id: 'sofia',
        gender: 'female',
        parents: [
          { id: 'mikael', type: 'blood' },
          { id: 'annsofie', type: 'blood' },
        ],
        spouses: [{ id: 'marcus', type: 'married' }],
      }),
      node({
        id: 'marcus',
        gender: 'male',
        spouses: [{ id: 'sofia', type: 'married' }],
      }),
      node({
        id: 'mikael',
        gender: 'male',
        parents: [
          { id: 'orjan', type: 'blood' },
          { id: 'inger', type: 'blood' },
        ],
        spouses: [{ id: 'annsofie', type: 'married' }],
        children: [{ id: 'sofia', type: 'blood' }],
      }),
      node({
        id: 'annsofie',
        gender: 'female',
        parents: [
          { id: 'lena', type: 'blood' },
          { id: 'bjorn', type: 'blood' },
        ],
        spouses: [{ id: 'mikael', type: 'married' }],
        children: [{ id: 'sofia', type: 'blood' }],
      }),
      node({
        id: 'orjan',
        gender: 'male',
        parents: [{ id: 'anna', type: 'blood' }],
        spouses: [{ id: 'inger', type: 'married' }],
        children: [{ id: 'mikael', type: 'blood' }],
      }),
      node({
        id: 'inger',
        gender: 'female',
        spouses: [{ id: 'orjan', type: 'married' }],
        children: [{ id: 'mikael', type: 'blood' }],
      }),
      node({
        id: 'anna',
        gender: 'female',
        parents: [{ id: 'david', type: 'blood' }],
        children: [{ id: 'orjan', type: 'blood' }],
      }),
      node({
        id: 'david',
        gender: 'male',
        children: [{ id: 'anna', type: 'blood' }],
      }),
      node({
        id: 'lena',
        gender: 'female',
        spouses: [{ id: 'bjorn', type: 'married' }],
        children: [{ id: 'annsofie', type: 'blood' }],
      }),
      node({
        id: 'bjorn',
        gender: 'male',
        spouses: [{ id: 'lena', type: 'married' }],
        children: [{ id: 'annsofie', type: 'blood' }],
      }),
    ],
    profiles: {
      sofia: { id: 'sofia', name: 'Sofia', gender: 'female' },
      marcus: { id: 'marcus', name: 'Marcus', gender: 'male' },
      mikael: { id: 'mikael', name: 'Mikael', gender: 'male' },
      annsofie: { id: 'annsofie', name: 'Ann-sofie', gender: 'female' },
      orjan: { id: 'orjan', name: 'Örjan', gender: 'male' },
      inger: { id: 'inger', name: 'Inger', gender: 'female' },
      anna: { id: 'anna', name: 'Anna-Lisa', gender: 'female' },
      david: { id: 'david', name: 'David', gender: 'male' },
      lena: { id: 'lena', name: 'Lena', gender: 'female' },
      bjorn: { id: 'bjorn', name: 'Björn', gender: 'male' },
    },
  })

  it('labels close family', () => {
    expect(relationToFocus(base, 'sofia')).toBe('Centrum')
    expect(relationToFocus(base, 'marcus')).toBe('Partner')
    expect(relationToFocus(base, 'mikael')).toBe('Far')
    expect(relationToFocus(base, 'annsofie')).toBe('Mor')
    expect(relationToFocus(base, 'orjan')).toBe('Farfar')
    expect(relationToFocus(base, 'inger')).toBe('Farmor')
    expect(relationToFocus(base, 'lena')).toBe('Mormor')
    expect(relationToFocus(base, 'bjorn')).toBe('Morfar')
  })

  it('labels gammel- and tipp-ancestors', () => {
    expect(relationToFocus(base, 'anna')).toBe('Gammelfarmor')
    expect(relationToFocus(base, 'david')).toBe('Tippfarfar')
  })
})
