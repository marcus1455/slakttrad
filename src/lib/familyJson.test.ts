import { describe, expect, it } from 'vitest'
import { importFamilyJson } from './familyJson'
import type { FamilyStore } from '../types'

const sample: FamilyStore = {
  rootId: 'a1',
  profiles: {
    a1: { id: 'a1', name: 'Anna', gender: 'female' },
    b2: { id: 'b2', name: 'Bo', gender: 'male' },
  },
  nodes: [
    {
      id: 'a1',
      gender: 'female',
      parents: [],
      siblings: [],
      spouses: [],
      children: [],
    },
    {
      id: 'b2',
      gender: 'male',
      parents: [],
      siblings: [],
      spouses: [],
      children: [],
    },
  ],
}

describe('importFamilyJson', () => {
  it('imports valid export JSON', () => {
    const text = JSON.stringify({
      name: 'Test',
      rootId: sample.rootId,
      profiles: sample.profiles,
      nodes: sample.nodes,
    })
    const next = importFamilyJson(text)
    expect(next.rootId).toBe('a1')
    expect(Object.keys(next.profiles)).toHaveLength(2)
    expect(next.nodes).toHaveLength(2)
    expect(next.checkpoints).toBeUndefined()
  })

  it('rejects invalid JSON', () => {
    expect(() => importFamilyJson('{')).toThrow(/Ogiltig JSON/)
  })

  it('rejects missing rootId', () => {
    expect(() =>
      importFamilyJson(JSON.stringify({ profiles: {}, nodes: [] })),
    ).toThrow(/rootId/)
  })

  it('rejects rootId not in profiles or nodes', () => {
    expect(() =>
      importFamilyJson(
        JSON.stringify({
          rootId: 'missing',
          profiles: sample.profiles,
          nodes: sample.nodes,
        }),
      ),
    ).toThrow(/rootId finns inte/)
  })
})
