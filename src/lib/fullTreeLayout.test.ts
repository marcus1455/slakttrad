import { describe, expect, it } from 'vitest'
import { layoutFullTree } from './fullTreeLayout'
import { node } from './testNodes'

const OPTS = { nodeWidth: 220, nodeHeight: 100, gapY: 80 } as const
const ROW = OPTS.nodeHeight + OPTS.gapY

function pos(layout: ReturnType<typeof layoutFullTree>) {
  return Object.fromEntries(
    layout.people.map((p) => [p.id, { x: p.x, y: p.y }]),
  )
}

function overlaps(
  layout: ReturnType<typeof layoutFullTree>,
  a: string,
  b: string,
  nodeWidth = OPTS.nodeWidth,
) {
  const A = layout.people.find((p) => p.id === a)!
  const B = layout.people.find((p) => p.id === b)!
  if (A.y !== B.y) return false
  const left = A.x < B.x ? A : B
  const right = A.x < B.x ? B : A
  return left.x + nodeWidth > right.x + 0.5
}

describe('layoutFullTree', () => {
  it('places a parent directly above their child', () => {
    const nodes = [
      node({
        id: 'david',
        gender: 'male',
        children: [{ id: 'anna', type: 'blood' }],
      }),
      node({
        id: 'anna',
        gender: 'female',
        parents: [{ id: 'david', type: 'blood' }],
        children: [{ id: 'orjan', type: 'blood' }],
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
      node({
        id: 'mikael',
        gender: 'male',
        parents: [
          { id: 'orjan', type: 'blood' },
          { id: 'inger', type: 'blood' },
        ],
        spouses: [{ id: 'annsofie', type: 'married' }],
      }),
      node({
        id: 'annsofie',
        gender: 'female',
        parents: [
          { id: 'lena', type: 'blood' },
          { id: 'bjorn', type: 'blood' },
        ],
        spouses: [{ id: 'mikael', type: 'married' }],
      }),
    ]

    const p = pos(layoutFullTree(nodes, OPTS))
    expect(p.david!.y).toBeLessThan(p.anna!.y)
    expect(p.anna!.y - p.david!.y).toBe(ROW)
    expect(p.orjan!.y).toBe(p.lena!.y)
    expect(p.orjan!.y - p.anna!.y).toBe(ROW)
  })

  it('does not overlap siblings and a partner under the same parents', () => {
    const nodes = [
      node({
        id: 'lena',
        gender: 'female',
        spouses: [{ id: 'bjorn', type: 'married' }],
        children: [
          { id: 'susanne', type: 'blood' },
          { id: 'mattias', type: 'blood' },
        ],
      }),
      node({
        id: 'bjorn',
        gender: 'male',
        spouses: [{ id: 'lena', type: 'married' }],
        children: [
          { id: 'susanne', type: 'blood' },
          { id: 'mattias', type: 'blood' },
        ],
      }),
      node({
        id: 'susanne',
        gender: 'female',
        parents: [
          { id: 'lena', type: 'blood' },
          { id: 'bjorn', type: 'blood' },
        ],
        spouses: [{ id: 'wladimir', type: 'married' }],
        siblings: [{ id: 'mattias', type: 'blood' }],
        children: [{ id: 'oscar', type: 'blood' }],
      }),
      node({
        id: 'wladimir',
        gender: 'male',
        spouses: [{ id: 'susanne', type: 'married' }],
        children: [{ id: 'oscar', type: 'blood' }],
      }),
      node({
        id: 'mattias',
        gender: 'male',
        parents: [
          { id: 'lena', type: 'blood' },
          { id: 'bjorn', type: 'blood' },
        ],
        siblings: [{ id: 'susanne', type: 'blood' }],
      }),
      node({
        id: 'oscar',
        gender: 'male',
        parents: [
          { id: 'susanne', type: 'blood' },
          { id: 'wladimir', type: 'blood' },
        ],
      }),
    ]

    const layout = layoutFullTree(nodes, OPTS)
    expect(overlaps(layout, 'susanne', 'mattias')).toBe(false)
    expect(overlaps(layout, 'susanne', 'wladimir')).toBe(false)
    expect(overlaps(layout, 'mattias', 'wladimir')).toBe(false)
  })

  it('keeps a cross-family couple between both parent sides', () => {
    const nodes = [
      node({
        id: 'orjan',
        gender: 'male',
        spouses: [{ id: 'inger', type: 'married' }],
        children: [
          { id: 'camilla', type: 'blood' },
          { id: 'mikael', type: 'blood' },
        ],
      }),
      node({
        id: 'inger',
        gender: 'female',
        spouses: [{ id: 'orjan', type: 'married' }],
        children: [
          { id: 'camilla', type: 'blood' },
          { id: 'mikael', type: 'blood' },
        ],
      }),
      node({
        id: 'lena',
        gender: 'female',
        spouses: [{ id: 'bjorn', type: 'married' }],
        children: [
          { id: 'susanne', type: 'blood' },
          { id: 'annsofie', type: 'blood' },
        ],
      }),
      node({
        id: 'bjorn',
        gender: 'male',
        spouses: [{ id: 'lena', type: 'married' }],
        children: [
          { id: 'susanne', type: 'blood' },
          { id: 'annsofie', type: 'blood' },
        ],
      }),
      node({
        id: 'camilla',
        gender: 'female',
        parents: [
          { id: 'orjan', type: 'blood' },
          { id: 'inger', type: 'blood' },
        ],
      }),
      node({
        id: 'mikael',
        gender: 'male',
        parents: [
          { id: 'orjan', type: 'blood' },
          { id: 'inger', type: 'blood' },
        ],
        spouses: [{ id: 'annsofie', type: 'married' }],
        siblings: [{ id: 'camilla', type: 'blood' }],
      }),
      node({
        id: 'annsofie',
        gender: 'female',
        parents: [
          { id: 'lena', type: 'blood' },
          { id: 'bjorn', type: 'blood' },
        ],
        spouses: [{ id: 'mikael', type: 'married' }],
        siblings: [{ id: 'susanne', type: 'blood' }],
      }),
      node({
        id: 'susanne',
        gender: 'female',
        parents: [
          { id: 'lena', type: 'blood' },
          { id: 'bjorn', type: 'blood' },
        ],
        siblings: [{ id: 'annsofie', type: 'blood' }],
      }),
    ]

    const p = pos(layoutFullTree(nodes, OPTS))
    const left = Math.min(p.camilla!.x, p.susanne!.x)
    const right = Math.max(p.camilla!.x, p.susanne!.x)
    expect(p.mikael!.x).toBeGreaterThan(left)
    expect(p.mikael!.x).toBeLessThan(right)
    expect(p.annsofie!.x).toBeGreaterThan(left)
    expect(p.annsofie!.x).toBeLessThan(right)
  })

  it('separates nearly collinear sibling bars from different parent groups', () => {
    const nodes = [
      node({
        id: 'per',
        gender: 'male',
        spouses: [{ id: 'anna', type: 'married' }],
        children: [
          { id: 'orjan', type: 'blood' },
          { id: 'inger', type: 'blood' },
        ],
      }),
      node({
        id: 'anna',
        gender: 'female',
        spouses: [{ id: 'per', type: 'married' }],
        children: [
          { id: 'orjan', type: 'blood' },
          { id: 'inger', type: 'blood' },
        ],
      }),
      node({
        id: 'linnea',
        gender: 'female',
        children: [{ id: 'lena', type: 'blood' }],
      }),
      node({
        id: 'orjan',
        gender: 'male',
        parents: [
          { id: 'per', type: 'blood' },
          { id: 'anna', type: 'blood' },
        ],
        siblings: [{ id: 'inger', type: 'blood' }],
        spouses: [{ id: 'inger', type: 'married' }],
      }),
      node({
        id: 'inger',
        gender: 'female',
        parents: [
          { id: 'per', type: 'blood' },
          { id: 'anna', type: 'blood' },
        ],
        siblings: [{ id: 'orjan', type: 'blood' }],
        spouses: [{ id: 'orjan', type: 'married' }],
      }),
      node({
        id: 'lena',
        gender: 'female',
        parents: [{ id: 'linnea', type: 'blood' }],
      }),
    ]

    const layout = layoutFullTree(nodes, OPTS)
    const siblingBars = layout.connectors.filter(
      (c) =>
        c.kind === 'blood' &&
        Math.abs(c.y1 - c.y2) < 0.5 &&
        Math.abs(c.x2 - c.x1) > OPTS.nodeWidth * 0.4,
    )

    // Two parent groups on the same child row should not share one bar Y
    // when their bars sit close in X (Per/Anna → Örjan/Inger vs Linnea → Lena).
    const childRowY = pos(layout).orjan!.y
    const barsAboveChildren = siblingBars.filter(
      (c) => c.y1 < childRowY && c.y1 > childRowY - OPTS.gapY,
    )
    const barYs = [...new Set(barsAboveChildren.map((c) => c.y1))]
    expect(barYs.length).toBeGreaterThanOrEqual(2)
    expect(Math.abs(barYs[0]! - barYs[1]!)).toBeGreaterThanOrEqual(6)
  })

  it('draws a spouse line even when the couple has shared children in view', () => {
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
        id: 'inger',
        gender: 'female',
        parents: [
          { id: 'harry', type: 'blood' },
          { id: 'linnea', type: 'blood' },
        ],
      }),
    ]

    const layout = layoutFullTree(nodes, OPTS)
    const spouseLines = layout.connectors.filter((c) => c.kind === 'spouse')
    expect(spouseLines.length).toBe(1)
    const line = spouseLines[0]!
    expect(Math.abs(line.y1 - line.y2)).toBeLessThan(0.5)
    expect(line.x2).toBeGreaterThan(line.x1)
  })

  it('places a lone parent above their child, not far from unrelated in-laws', () => {
    const nodes = [
      node({
        id: 'david',
        gender: 'male',
        spouses: [{ id: 'annaG', type: 'married' }],
        children: [
          { id: 'annaL', type: 'blood' },
          { id: 'gunnar', type: 'blood' },
        ],
      }),
      node({
        id: 'annaG',
        gender: 'female',
        spouses: [{ id: 'david', type: 'married' }],
        children: [
          { id: 'annaL', type: 'blood' },
          { id: 'gunnar', type: 'blood' },
        ],
      }),
      node({
        id: 'annaL',
        gender: 'female',
        parents: [
          { id: 'david', type: 'blood' },
          { id: 'annaG', type: 'blood' },
        ],
        siblings: [{ id: 'gunnar', type: 'blood' }],
        children: [{ id: 'orjan', type: 'blood' }],
      }),
      node({
        id: 'gunnar',
        gender: 'male',
        parents: [
          { id: 'david', type: 'blood' },
          { id: 'annaG', type: 'blood' },
        ],
        siblings: [{ id: 'annaL', type: 'blood' }],
      }),
      node({
        id: 'linnea',
        gender: 'female',
        children: [{ id: 'inger', type: 'blood' }],
      }),
      node({
        id: 'orjan',
        gender: 'male',
        parents: [{ id: 'annaL', type: 'blood' }],
        spouses: [{ id: 'inger', type: 'married' }],
      }),
      node({
        id: 'inger',
        gender: 'female',
        parents: [{ id: 'linnea', type: 'blood' }],
        spouses: [{ id: 'orjan', type: 'married' }],
      }),
      node({
        id: 'lena',
        gender: 'female',
        spouses: [{ id: 'bjorn', type: 'married' }],
      }),
      node({
        id: 'bjorn',
        gender: 'male',
        spouses: [{ id: 'lena', type: 'married' }],
      }),
    ]

    const p = pos(layoutFullTree(nodes, OPTS))
    // Linnea is Inger's mother — sit above Inger, not on Lena/Björn's row.
    expect(Math.abs(p.linnea!.x - p.inger!.x)).toBeLessThan(OPTS.nodeWidth * 1.5)
    expect(p.linnea!.y).not.toBe(p.lena!.y)
    expect(p.linnea!.y).toBeLessThan(p.inger!.y)
  })

  it('keeps an in-law beside their spouse, not separated by a sibling', () => {
    const nodes = [
      node({
        id: 'david',
        gender: 'male',
        spouses: [{ id: 'annaG', type: 'married' }],
        children: [
          { id: 'per', type: 'blood' },
          { id: 'annaL', type: 'blood' },
          { id: 'gunnar', type: 'blood' },
        ],
      }),
      node({
        id: 'annaG',
        gender: 'female',
        spouses: [{ id: 'david', type: 'married' }],
        children: [
          { id: 'per', type: 'blood' },
          { id: 'annaL', type: 'blood' },
          { id: 'gunnar', type: 'blood' },
        ],
      }),
      node({
        id: 'per',
        gender: 'male',
        parents: [
          { id: 'david', type: 'blood' },
          { id: 'annaG', type: 'blood' },
        ],
        siblings: [
          { id: 'annaL', type: 'blood' },
          { id: 'gunnar', type: 'blood' },
        ],
      }),
      node({
        id: 'annaL',
        gender: 'female',
        parents: [
          { id: 'david', type: 'blood' },
          { id: 'annaG', type: 'blood' },
        ],
        siblings: [
          { id: 'per', type: 'blood' },
          { id: 'gunnar', type: 'blood' },
        ],
        spouses: [{ id: 'karl', type: 'married' }],
        children: [{ id: 'orjan', type: 'blood' }],
      }),
      node({
        id: 'gunnar',
        gender: 'male',
        parents: [
          { id: 'david', type: 'blood' },
          { id: 'annaG', type: 'blood' },
        ],
        siblings: [
          { id: 'per', type: 'blood' },
          { id: 'annaL', type: 'blood' },
        ],
      }),
      node({
        id: 'karl',
        gender: 'male',
        spouses: [{ id: 'annaL', type: 'married' }],
        children: [{ id: 'orjan', type: 'blood' }],
      }),
      node({
        id: 'orjan',
        gender: 'male',
        parents: [
          { id: 'annaL', type: 'blood' },
          { id: 'karl', type: 'blood' },
        ],
      }),
    ]

    const p = pos(layoutFullTree(nodes, OPTS))
    const coupleLeft = Math.min(p.karl!.x, p.annaL!.x)
    const coupleRight = Math.max(p.karl!.x, p.annaL!.x) + OPTS.nodeWidth
    // Per must not sit between Karl-Erik and Anna-Lisa.
    const perCenter = p.per!.x + OPTS.nodeWidth / 2
    expect(perCenter < coupleLeft || perCenter > coupleRight).toBe(true)
    // Couple should be adjacent (gap ≈ coupleGap, not a sibling width).
    expect(coupleRight - coupleLeft).toBeLessThan(OPTS.nodeWidth * 2 + 40)
  })

  it('keeps a root couple together when one partner has a solo child', () => {
    const nodes = [
      node({
        id: 'harry',
        gender: 'male',
        spouses: [{ id: 'linnea', type: 'married' }],
        children: [
          { id: 'inger', type: 'blood' },
          { id: 'ingrid', type: 'blood' },
        ],
      }),
      node({
        id: 'linnea',
        gender: 'female',
        spouses: [{ id: 'harry', type: 'married' }],
        children: [{ id: 'inger', type: 'blood' }],
      }),
      node({
        id: 'inger',
        gender: 'female',
        parents: [
          { id: 'harry', type: 'blood' },
          { id: 'linnea', type: 'blood' },
        ],
      }),
      node({
        id: 'ingrid',
        gender: 'female',
        parents: [{ id: 'harry', type: 'blood' }],
      }),
    ]

    const p = pos(layoutFullTree(nodes, OPTS))
    // Couple stays adjacent (not torn apart by Harry's exclusive child).
    expect(Math.abs(p.harry!.x - p.linnea!.x)).toBeLessThan(OPTS.nodeWidth + 40)
    expect(p.harry!.y).toBe(p.linnea!.y)
    // Shared child remains under the couple.
    const coupleLeft = Math.min(p.harry!.x, p.linnea!.x)
    const coupleRight = Math.max(p.harry!.x, p.linnea!.x) + OPTS.nodeWidth
    const ingerCx = p.inger!.x + OPTS.nodeWidth / 2
    expect(ingerCx).toBeGreaterThan(coupleLeft - 20)
    expect(ingerCx).toBeLessThan(coupleRight + 20)
  })

  it('keeps a natal sibling beside a bridged sibling without a mega sibling bar', () => {
    const nodes = [
      node({
        id: 'harry',
        gender: 'male',
        spouses: [{ id: 'linnea', type: 'married' }],
        children: [
          { id: 'inger', type: 'blood' },
          { id: 'goran', type: 'blood' },
        ],
      }),
      node({
        id: 'linnea',
        gender: 'female',
        spouses: [{ id: 'harry', type: 'married' }],
        children: [
          { id: 'inger', type: 'blood' },
          { id: 'goran', type: 'blood' },
        ],
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
        siblings: [{ id: 'goran', type: 'blood' }],
        children: [{ id: 'mikael', type: 'blood' }],
      }),
      node({
        id: 'goran',
        gender: 'male',
        parents: [
          { id: 'harry', type: 'blood' },
          { id: 'linnea', type: 'blood' },
        ],
        siblings: [{ id: 'inger', type: 'blood' }],
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

    const before = layoutFullTree(
      nodes.filter((n) => n.id !== 'goran').map((n) => {
        if (n.id === 'harry' || n.id === 'linnea') {
          return {
            ...n,
            children: n.children.filter((c) => c.id !== 'goran'),
          }
        }
        if (n.id === 'inger') {
          return { ...n, siblings: [] }
        }
        return n
      }),
      OPTS,
    )
    const layout = layoutFullTree(nodes, OPTS)
    const p = pos(layout)

    // Göran sits on the same row as Inger and close to the Inger–Örjan unit.
    expect(p.goran!.y).toBe(p.inger!.y)
    const gap = Math.abs(p.goran!.x - p.inger!.x)
    expect(gap).toBeLessThan(OPTS.nodeWidth * 2.5)

    // Sibling bar between Inger and Göran must stay short.
    const bar = layout.connectors.find(
      (c) =>
        c.kind === 'blood' &&
        c.y1 === c.y2 &&
        Math.abs(c.x2 - c.x1) > 10 &&
        c.bloodLink?.childIds.includes('inger') &&
        c.bloodLink?.childIds.includes('goran'),
    )
    if (bar) {
      expect(Math.abs(bar.x2 - bar.x1)).toBeLessThan(OPTS.nodeWidth * 2.5)
    }

    expect(layout.width).toBeLessThan(before.width * 1.35)
    expect(overlaps(layout, 'inger', 'goran')).toBe(false)

    // Parent couples must stay near each other — adding a natal sibling
    // must not shove Harry/Linnea and Anna/David to opposite edges.
    const mid = (a: string, b: string) =>
      (p[a]!.x + p[b]!.x) / 2 + OPTS.nodeWidth / 2
    const parentGap = Math.abs(mid('harry', 'linnea') - mid('anna', 'david'))
    expect(parentGap).toBeLessThan(OPTS.nodeWidth * 5)
  })
})
