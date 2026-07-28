import { describe, expect, it } from 'vitest'
import { layoutFullTree } from './fullTreeLayout'
import { node } from './testNodes'

const OPTS = { nodeWidth: 220, nodeHeight: 100, gapY: 80 } as const

describe('bridge in-law connectors', () => {
  it('does not draw Harry+Linnea descent onto in-law Örjan', () => {
    const nodes = [
      node({
        id: 'harry',
        gender: 'male',
        spouses: [{ id: 'linnea', type: 'married' }],
        children: [{ id: 'inger', type: 'blood' }],
      }),
      node({
        id: 'linnea',
        gender: 'female',
        spouses: [{ id: 'harry', type: 'married' }],
        children: [{ id: 'inger', type: 'blood' }],
      }),
      node({
        id: 'orjan',
        gender: 'male',
        parents: [
          { id: 'anna', type: 'blood' },
          { id: 'david', type: 'blood' },
        ],
        spouses: [{ id: 'inger', type: 'married' }],
        children: [{ id: 'mikael', type: 'blood' }],
      }),
      node({
        id: 'anna',
        gender: 'female',
        spouses: [{ id: 'david', type: 'married' }],
        children: [{ id: 'orjan', type: 'blood' }],
      }),
      node({
        id: 'david',
        gender: 'male',
        spouses: [{ id: 'anna', type: 'married' }],
        children: [{ id: 'orjan', type: 'blood' }],
      }),
      node({
        id: 'inger',
        gender: 'female',
        parents: [
          { id: 'harry', type: 'blood' },
          { id: 'linnea', type: 'blood' },
        ],
        spouses: [{ id: 'orjan', type: 'married' }],
        children: [{ id: 'mikael', type: 'blood' }],
      }),
      node({
        id: 'mikael',
        gender: 'male',
        parents: [
          { id: 'orjan', type: 'blood' },
          { id: 'inger', type: 'blood' },
        ],
      }),
    ]

    const layout = layoutFullTree(nodes, OPTS)
    const harryLinks = layout.connectors.filter(
      (c) =>
        c.kind === 'blood' &&
        c.bloodLink?.parentIds.includes('harry') &&
        c.bloodLink?.parentIds.includes('linnea'),
    )
    const childIds = [
      ...new Set(harryLinks.flatMap((c) => c.bloodLink?.childIds ?? [])),
    ]
    expect(childIds).toEqual(['inger'])
    expect(childIds).not.toContain('orjan')

    const inger = layout.people.find((p) => p.id === 'inger')!
    const orjan = layout.people.find((p) => p.id === 'orjan')!
    const ingerCx = inger.x + OPTS.nodeWidth / 2
    const orjanCx = orjan.x + OPTS.nodeWidth / 2
    const midCouple = (ingerCx + orjanCx) / 2

    // Drop onto the blood child, not the couple midpoint / in-law.
    const childDrops = harryLinks.filter(
      (c) =>
        c.x1 === c.x2 &&
        c.bloodLink?.childIds.includes('inger') &&
        Math.abs(c.y2 - inger.y) < 1,
    )
    expect(childDrops.length).toBeGreaterThan(0)
    for (const drop of childDrops) {
      expect(Math.abs(drop.x1 - ingerCx)).toBeLessThan(2)
      expect(Math.abs(drop.x1 - orjanCx)).toBeGreaterThan(OPTS.nodeWidth / 2)
      expect(Math.abs(drop.x1 - midCouple)).toBeGreaterThan(OPTS.nodeWidth / 4)
    }
  })

  it('separates parent brackets when children are spouses (no fake sibling bar)', () => {
    const nodes = [
      node({
        id: 'davidG',
        gender: 'male',
        spouses: [{ id: 'annaG', type: 'married' }],
        children: [{ id: 'annaE', type: 'blood' }],
      }),
      node({
        id: 'annaG',
        gender: 'female',
        spouses: [{ id: 'davidG', type: 'married' }],
        children: [{ id: 'annaE', type: 'blood' }],
      }),
      node({
        id: 'annaE',
        gender: 'female',
        parents: [
          { id: 'davidG', type: 'blood' },
          { id: 'annaG', type: 'blood' },
        ],
        spouses: [{ id: 'karl', type: 'married' }],
        children: [{ id: 'orjan', type: 'blood' }],
      }),
      node({
        id: 'karl',
        gender: 'male',
        spouses: [{ id: 'annaE', type: 'married' }],
        children: [{ id: 'orjan', type: 'blood' }],
      }),
      node({
        id: 'linnea',
        gender: 'female',
        spouses: [{ id: 'harry', type: 'married' }],
        children: [{ id: 'inger', type: 'blood' }],
      }),
      node({
        id: 'harry',
        gender: 'male',
        spouses: [{ id: 'linnea', type: 'married' }],
        children: [{ id: 'inger', type: 'blood' }],
      }),
      node({
        id: 'orjan',
        gender: 'male',
        parents: [
          { id: 'annaE', type: 'blood' },
          { id: 'karl', type: 'blood' },
        ],
        spouses: [{ id: 'inger', type: 'married' }],
        children: [{ id: 'mikael', type: 'blood' }],
      }),
      node({
        id: 'inger',
        gender: 'female',
        parents: [
          { id: 'harry', type: 'blood' },
          { id: 'linnea', type: 'blood' },
        ],
        spouses: [{ id: 'orjan', type: 'married' }],
        children: [{ id: 'mikael', type: 'blood' }],
      }),
      node({
        id: 'mikael',
        gender: 'male',
        parents: [
          { id: 'orjan', type: 'blood' },
          { id: 'inger', type: 'blood' },
        ],
      }),
    ]

    const layout = layoutFullTree(nodes, OPTS)
    const inger = layout.people.find((p) => p.id === 'inger')!
    const orjan = layout.people.find((p) => p.id === 'orjan')!

    const dropY = (parentA: string, parentB: string, childId: string, childY: number) => {
      const drop = layout.connectors.find(
        (c) =>
          c.kind === 'blood' &&
          c.x1 === c.x2 &&
          c.bloodLink?.parentIds.includes(parentA) &&
          c.bloodLink?.parentIds.includes(parentB) &&
          c.bloodLink.childIds.includes(childId) &&
          Math.abs(c.y2 - childY) < 1,
      )
      return drop?.y1 ?? null
    }

    const ingerBarY = dropY('harry', 'linnea', 'inger', inger.y)
    const orjanBarY = dropY('annaE', 'karl', 'orjan', orjan.y)
    expect(ingerBarY).not.toBeNull()
    expect(orjanBarY).not.toBeNull()
    // Different altitudes so the two brackets can't read as one sibling bar.
    expect(Math.abs(ingerBarY! - orjanBarY!)).toBeGreaterThanOrEqual(16)

    // No Harry/Linnea blood segment should land on Örjan's center.
    const orjanCx = orjan.x + OPTS.nodeWidth / 2
    const harryOntoOrjan = layout.connectors.some(
      (c) =>
        c.kind === 'blood' &&
        c.bloodLink?.parentIds.includes('harry') &&
        c.bloodLink.parentIds.includes('linnea') &&
        c.x1 === c.x2 &&
        Math.abs(c.x1 - orjanCx) < 2 &&
        Math.abs(c.y2 - orjan.y) < 1,
    )
    expect(harryOntoOrjan).toBe(false)
  })
})
