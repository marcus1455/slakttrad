import { describe, expect, it } from 'vitest'
import { layoutFan, layoutPedigree, layoutTree } from './index'
import { layoutFullTree } from '../fullTreeLayout'
import { node } from '../testNodes'

const OPTS = { nodeWidth: 220, nodeHeight: 100, gapY: 80, rootId: 'sofia' } as const

function lineage() {
  return [
    node({
      id: 'gf',
      gender: 'male',
      spouses: [{ id: 'gm', type: 'married' }],
      children: [{ id: 'far', type: 'blood' }],
    }),
    node({
      id: 'gm',
      gender: 'female',
      spouses: [{ id: 'gf', type: 'married' }],
      children: [{ id: 'far', type: 'blood' }],
    }),
    node({
      id: 'far',
      gender: 'male',
      parents: [
        { id: 'gf', type: 'blood' },
        { id: 'gm', type: 'blood' },
      ],
      spouses: [{ id: 'mor', type: 'married' }],
      children: [{ id: 'sofia', type: 'blood' }],
    }),
    node({
      id: 'mor',
      gender: 'female',
      spouses: [{ id: 'far', type: 'married' }],
      children: [{ id: 'sofia', type: 'blood' }],
    }),
    node({
      id: 'sofia',
      gender: 'female',
      parents: [
        { id: 'far', type: 'blood' },
        { id: 'mor', type: 'blood' },
      ],
      spouses: [{ id: 'marcus', type: 'married' }],
      children: [{ id: 'barn', type: 'blood' }],
    }),
    node({
      id: 'marcus',
      gender: 'male',
      spouses: [{ id: 'sofia', type: 'married' }],
      children: [{ id: 'barn', type: 'blood' }],
    }),
    node({
      id: 'barn',
      gender: 'male',
      parents: [
        { id: 'sofia', type: 'blood' },
        { id: 'marcus', type: 'blood' },
      ],
    }),
    node({
      id: 'cousin',
      gender: 'female',
      // Not an ancestor of sofia — should be omitted from pedigree/fan
    }),
  ]
}

describe('layoutPedigree', () => {
  it('shows ancestors above focus and omits unrelated people', () => {
    const layout = layoutPedigree(lineage(), OPTS)
    const ids = new Set(layout.people.map((p) => p.id))
    expect(ids.has('sofia')).toBe(true)
    expect(ids.has('far')).toBe(true)
    expect(ids.has('gf')).toBe(true)
    expect(ids.has('marcus')).toBe(true)
    expect(ids.has('barn')).toBe(true)
    expect(ids.has('cousin')).toBe(false)

    const y = Object.fromEntries(layout.people.map((p) => [p.id, p.y]))
    expect(y.gf!).toBeLessThan(y.far!)
    expect(y.far!).toBeLessThan(y.sofia!)
    expect(y.barn!).toBeGreaterThan(y.sofia!)
  })
})

describe('layoutFan', () => {
  it('places focus at the hub and ancestors on outer rings', () => {
    const layout = layoutFan(lineage(), OPTS)
    const ids = new Set(layout.people.map((p) => p.id))
    expect(ids.has('sofia')).toBe(true)
    expect(ids.has('gf')).toBe(true)
    expect(ids.has('cousin')).toBe(false)

    const pos = Object.fromEntries(
      layout.people.map((p) => [p.id, p]),
    )
    // Ancestors sit above (smaller y) than focus in a classic fan
    expect(pos.gf!.y).toBeLessThan(pos.sofia!.y)
    expect(pos.far!.y).toBeLessThan(pos.sofia!.y)

    // Blood connectors to ancestors are straight spokes (not long orthogonal bars)
    const ancestorBlood = layout.connectors.filter(
      (c) =>
        c.kind === 'blood' &&
        c.bloodLink?.parentIds.includes('gf') &&
        c.bloodLink.childIds.includes('far'),
    )
    expect(ancestorBlood.length).toBeGreaterThan(0)
    // A spoke is a single segment from parent toward child
    const spoke = ancestorBlood[0]!
    expect(spoke.x1 !== spoke.x2 || spoke.y1 !== spoke.y2).toBe(true)

    for (let i = 0; i < layout.people.length; i++) {
      for (let j = i + 1; j < layout.people.length; j++) {
        const a = layout.people[i]!
        const b = layout.people[j]!
        const overlapX =
          a.x < b.x + OPTS.nodeWidth && b.x < a.x + OPTS.nodeWidth
        const overlapY =
          a.y < b.y + OPTS.nodeHeight && b.y < a.y + OPTS.nodeHeight
        expect(overlapX && overlapY).toBe(false)
      }
    }
  })
})

describe('layoutTree facade', () => {
  it('delegates full mode to layoutFullTree', () => {
    const nodes = lineage()
    const viaFacade = layoutTree(nodes, { ...OPTS, mode: 'full' })
    const direct = layoutFullTree(nodes, OPTS)
    expect(viaFacade.people.length).toBe(direct.people.length)
    expect(viaFacade.width).toBe(direct.width)
  })
})
