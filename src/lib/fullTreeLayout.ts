import type { Node } from 'relatives-tree/lib/types'
import type {
  FullTreeLayout,
  LayoutConnector,
  LayoutOptions,
  LayoutPerson,
} from './layout/types'

export type {
  FullTreeLayout,
  LayoutConnector,
  LayoutPerson,
} from './layout/types'

type Options = Pick<
  LayoutOptions,
  | 'nodeWidth'
  | 'nodeHeight'
  | 'coupleGap'
  | 'unitGap'
  | 'familyGap'
  | 'gapY'
  | 'padding'
>

type Unit = { primary: string; members: string[] }

function byId(nodes: readonly Node[]) {
  return new Map(nodes.map((n) => [n.id, n]))
}

/**
 * Generation index: 0 = oldest ancestors.
 * Parent→child raises gen by 1; spouses share a gen; parents of a married
 * couple (and more generally of same-gen people) are pulled onto one row so
 * e.g. mormor/morfar align with farfar/farmor even if only one side has
 * great-grandparents in the tree.
 *
 * When someone is pulled down to align with in-laws, their ancestors must
 * move with them — otherwise a new great-grandparent (e.g. David above
 * Anna-Lisa) stays on row 0 while the child drifts several rows down.
 */
function assignGenerations(nodes: readonly Node[]): Map<string, number> {
  const map = byId(nodes)
  const gen = new Map<string, number>()

  const scoreOf = (id: string, stack: Set<string>): number => {
    if (gen.has(id)) return gen.get(id)!
    if (stack.has(id)) return 0
    stack.add(id)
    const node = map.get(id)
    if (!node) return 0
    const parents = node.parents.map((p) => p.id).filter((pid) => map.has(pid))
    const score =
      parents.length === 0
        ? 0
        : Math.max(...parents.map((pid) => scoreOf(pid, stack))) + 1
    stack.delete(id)
    gen.set(id, score)
    return score
  }

  for (const node of nodes) scoreOf(node.id, new Set())

  const bump = (id: string, next: number): boolean => {
    const cur = gen.get(id) ?? 0
    if (next <= cur) return false
    gen.set(id, next)
    return true
  }

  /** Keep each parent on the row immediately above their deepest child. */
  const pullAncestorsWithChildren = (): boolean => {
    let moved = false
    for (const node of nodes) {
      const childGen = gen.get(node.id) ?? 0
      for (const p of node.parents) {
        if (!map.has(p.id)) continue
        if (bump(p.id, childGen - 1)) moved = true
      }
    }
    return moved
  }

  let changed = true
  let guard = 0
  while (changed && guard++ < nodes.length * 12) {
    changed = false

    // Spouses share a generation (take the deeper side).
    for (const node of nodes) {
      const g = gen.get(node.id) ?? 0
      for (const spouse of node.spouses) {
        if (!map.has(spouse.id)) continue
        const next = Math.max(g, gen.get(spouse.id) ?? 0)
        if (bump(node.id, next)) changed = true
        if (bump(spouse.id, next)) changed = true
      }
    }

    // Child is at least one generation below every parent.
    for (const node of nodes) {
      const parents = node.parents.map((p) => p.id).filter((id) => map.has(id))
      if (!parents.length) continue
      const floor = Math.max(...parents.map((id) => gen.get(id) ?? 0)) + 1
      if (bump(node.id, floor)) changed = true
    }

    // Parents of people on the same row (esp. in-laws of a couple) align.
    const byGen = new Map<number, string[]>()
    for (const node of nodes) {
      const g = gen.get(node.id) ?? 0
      const list = byGen.get(g)
      if (list) list.push(node.id)
      else byGen.set(g, [node.id])
    }
    for (const ids of byGen.values()) {
      const parentIds = new Set<string>()
      for (const id of ids) {
        const node = map.get(id)!
        for (const p of node.parents) {
          if (map.has(p.id)) parentIds.add(p.id)
        }
      }
      if (parentIds.size < 2) continue
      let target = 0
      for (const pid of parentIds) target = Math.max(target, gen.get(pid) ?? 0)
      for (const pid of parentIds) {
        if (bump(pid, target)) changed = true
      }
    }

    // If a parent was pulled down to match in-laws, pull their ancestors too.
    if (pullAncestorsWithChildren()) changed = true
  }

  // Shift so the oldest row is 0.
  let min = Infinity
  for (const g of gen.values()) min = Math.min(min, g)
  if (Number.isFinite(min) && min !== 0) {
    for (const [id, g] of gen) gen.set(id, g - min)
  }

  return gen
}

function parentKey(node: Node, map: Map<string, Node>): string {
  const ids = node.parents.map((p) => p.id).filter((id) => map.has(id)).sort()
  return ids.length ? ids.join('+') : `lone:${node.id}`
}

function bloodParentKeys(unit: Unit, map: Map<string, Node>): string[] {
  const keys = new Set<string>()
  for (const id of unit.members) {
    const key = parentKey(map.get(id)!, map)
    if (!key.startsWith('lone:')) keys.add(key)
  }
  return [...keys]
}

/** Couple/unit: blood person first, then spouse(s). */
function buildUnits(ids: string[], map: Map<string, Node>): Unit[] {
  const remaining = new Set(ids)
  const units: Unit[] = []

  const isBloodInGen = (id: string) =>
    map.get(id)!.parents.some((p) => map.has(p.id))

  const starters = [...ids].sort((a, b) => {
    const aBlood = isBloodInGen(a) ? 0 : 1
    const bBlood = isBloodInGen(b) ? 0 : 1
    if (aBlood !== bBlood) return aBlood - bBlood
    return a.localeCompare(b, 'sv')
  })

  for (const start of starters) {
    if (!remaining.has(start)) continue

    const node = map.get(start)!
    if (!isBloodInGen(start)) {
      const bloodSpouse = node.spouses.find(
        (s) => remaining.has(s.id) && isBloodInGen(s.id),
      )
      if (bloodSpouse) continue
    }

    const members = [start]
    remaining.delete(start)

    for (const spouse of node.spouses) {
      if (remaining.has(spouse.id)) {
        members.push(spouse.id)
        remaining.delete(spouse.id)
      }
    }

    for (const id of [...remaining]) {
      const other = map.get(id)!
      if (other.spouses.some((s) => members.includes(s.id))) {
        members.push(id)
        remaining.delete(id)
      }
    }

    units.push({ primary: start, members })
  }

  for (const id of [...remaining].sort((a, b) => a.localeCompare(b, 'sv'))) {
    units.push({ primary: id, members: [id] })
  }

  return units
}

/**
 * Sibling group key, or bridge:… when spouses come from two different
 * parent couples (so e.g. Mikael stays between Örjan and Lena, not absorbed
 * into Ann-sofie’s natal row).
 */
function familyKeyForUnit(
  unit: Unit,
  map: Map<string, Node>,
  generationIds: string[],
): string {
  const bloodKeys = bloodParentKeys(unit, map)
  if (bloodKeys.length >= 2) {
    return `bridge:${[...bloodKeys].sort().join('~')}`
  }

  const candidates: { key: string; siblingCount: number; fromPrimary: boolean }[] =
    []

  for (const memberId of unit.members) {
    const key = parentKey(map.get(memberId)!, map)
    if (key.startsWith('lone:')) continue
    const siblingCount = generationIds.filter((otherId) => {
      if (otherId === memberId) return false
      if (unit.members.includes(otherId)) return false
      return parentKey(map.get(otherId)!, map) === key
    }).length
    candidates.push({
      key,
      siblingCount,
      fromPrimary: memberId === unit.primary,
    })
  }

  if (!candidates.length) return `lone:${unit.primary}`

  // Prefer side with more siblings; on tie, keep the blood-primary's parents.
  candidates.sort((a, b) => {
    if (b.siblingCount !== a.siblingCount) return b.siblingCount - a.siblingCount
    if (a.fromPrimary !== b.fromPrimary) return a.fromPrimary ? -1 : 1
    return a.key.localeCompare(b.key, 'sv')
  })
  return candidates[0]!.key
}

/** True if someone in the unit has blood parents other than this family. */
function hasCrossFamilySpouse(
  unit: Unit,
  map: Map<string, Node>,
  familyKey: string,
): boolean {
  if (familyKey.startsWith('bridge:')) return false
  return unit.members.some((id) => {
    const key = parentKey(map.get(id)!, map)
    return !key.startsWith('lone:') && key !== familyKey
  })
}

/** True if the unit includes an in-law (no / other parents than this family). */
function unitHasInLaw(
  unit: Unit,
  map: Map<string, Node>,
  familyKey: string,
): boolean {
  return unit.members.some((id) => {
    const key = parentKey(map.get(id)!, map)
    return key.startsWith('lone:') || key !== familyKey
  })
}

/**
 * Keep in-laws on the outer edge of their unit so the spouse line never
 * runs through a sibling sitting between them.
 */
function orderUnitMembers(
  unit: Unit,
  map: Map<string, Node>,
  familyKey: string,
  inLawOnLeft: boolean,
): Unit {
  const natal: string[] = []
  const inLaws: string[] = []
  for (const id of unit.members) {
    const key = parentKey(map.get(id)!, map)
    if (key === familyKey) natal.push(id)
    else inLaws.push(id)
  }
  if (!inLaws.length || !natal.length) return unit
  const members = inLawOnLeft ? [...inLaws, ...natal] : [...natal, ...inLaws]
  return { primary: unit.primary, members }
}

/**
 * Within one sibling group: units with in-laws sit on the left edge
 * (partner outside, blood sibling inside), plain siblings to the right.
 */
function sortUnitsInFamily(
  units: Unit[],
  map: Map<string, Node>,
  familyKey: string,
): Unit[] {
  const sorted = [...units].sort((a, b) => {
    const aIn = unitHasInLaw(a, map, familyKey) ? 0 : 1
    const bIn = unitHasInLaw(b, map, familyKey) ? 0 : 1
    if (aIn !== bIn) return aIn - bIn
    const aCross = hasCrossFamilySpouse(a, map, familyKey) ? 1 : 0
    const bCross = hasCrossFamilySpouse(b, map, familyKey) ? 1 : 0
    if (aCross !== bCross) return aCross - bCross
    return a.primary.localeCompare(b.primary, 'sv')
  })

  return sorted.map((unit, index) => {
    if (!unitHasInLaw(unit, map, familyKey)) return unit
    // First units keep in-law on the left; trailing in-law units on the right.
    const inLawOnLeft = index < sorted.length / 2
    return orderUnitMembers(unit, map, familyKey, inLawOnLeft)
  })
}

/** Midpoint of parents, or null if they aren't placed yet. */
function parentCenterX(
  familyKey: string,
  positions: Map<string, { x: number; y: number }>,
  nodeWidth: number,
): number | null {
  if (familyKey.startsWith('lone:')) return null

  if (familyKey.startsWith('bridge:')) {
    const parts = familyKey.slice('bridge:'.length).split('~')
    const centers = parts
      .map((pk) => parentCenterX(pk, positions, nodeWidth))
      .filter((c): c is number => c != null)
    if (!centers.length) return null
    return centers.reduce((a, b) => a + b, 0) / centers.length
  }

  const xs = familyKey
    .split('+')
    .map((id) => positions.get(id))
    .filter(Boolean)
    .map((p) => p!.x + nodeWidth / 2)
  if (!xs.length) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/**
 * Midpoint of already-placed children of this family — used when a parent
 * has no ancestors in the tree (e.g. Linnea above Inger) so they aren't
 * shoved to the far right as an unanchored “lone” card.
 */
function childCenterX(
  units: Unit[],
  map: Map<string, Node>,
  positions: Map<string, { x: number; y: number }>,
  nodeWidth: number,
): number | null {
  const xs: number[] = []
  for (const unit of units) {
    for (const id of unit.members) {
      const person = map.get(id)
      if (!person) continue
      for (const child of person.children) {
        const pos = positions.get(child.id)
        if (pos) xs.push(pos.x + nodeWidth / 2)
      }
    }
  }
  if (!xs.length) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function measureFamily(
  units: Unit[],
  nodeWidth: number,
  coupleGap: number,
  unitGap: number,
) {
  let w = 0
  units.forEach((unit, ui) => {
    unit.members.forEach((_, mi) => {
      w += nodeWidth
      if (mi < unit.members.length - 1) w += coupleGap
    })
    if (ui < units.length - 1) w += unitGap
  })
  return w
}

/**
 * Place each sibling group near its ideal X (under parents).
 * On overlap, spread both sides so later families aren't shoved
 * all the way to the right edge.
 */
function placeFamiliesOnRow(
  families: Map<string, Unit[]>,
  positions: Map<string, { x: number; y: number }>,
  nodeWidth: number,
  coupleGap: number,
  unitGap: number,
  familyGap: number,
  padding: number,
  y: number,
  map: Map<string, Node>,
  idealCenterForKey?: (key: string, width: number) => number | null,
) {
  type FamPlace = {
    key: string
    width: number
    idealLeft: number
    left: number
    anchored: boolean
  }

  const places: FamPlace[] = [...families.entries()].map(([key, units]) => {
    const width = measureFamily(units, nodeWidth, coupleGap, unitGap)
    const customCenter = idealCenterForKey?.(key, width) ?? null
    const parentX =
      customCenter ??
      parentCenterX(key, positions, nodeWidth) ??
      childCenterX(units, map, positions, nodeWidth)
    const anchored = parentX != null
    const idealLeft = anchored ? parentX - width / 2 : padding
    return { key, width, idealLeft, left: idealLeft, anchored }
  })

  places.sort((a, b) => {
    if (a.anchored !== b.anchored) return a.anchored ? -1 : 1
    return a.idealLeft - b.idealLeft || a.key.localeCompare(b.key, 'sv')
  })

  for (const fam of places) fam.left = fam.idealLeft

  // Expand overlapping neighbours both ways (keeps groups under parents).
  for (let iter = 0; iter < Math.max(8, places.length * 4); iter++) {
    let moved = false
    for (let i = 1; i < places.length; i++) {
      const prev = places[i - 1]!
      const cur = places[i]!
      const need = prev.left + prev.width + familyGap
      if (cur.left + 0.01 < need) {
        const overlap = need - cur.left
        prev.left -= overlap / 2
        cur.left += overlap / 2
        moved = true
      }
    }
    if (!moved) break
  }

  // Enforce non-overlap after float drift (only push right as last resort).
  for (let i = 1; i < places.length; i++) {
    const prev = places[i - 1]!
    const cur = places[i]!
    const need = prev.left + prev.width + familyGap
    if (cur.left < need) cur.left = need
  }

  const minLeft = places.length ? Math.min(...places.map((f) => f.left)) : padding
  if (minLeft < padding) {
    const shift = padding - minLeft
    for (const fam of places) fam.left += shift
  }

  let maxRight = 0
  for (const fam of places) {
    const units = families.get(fam.key)!
    let x = fam.left
    for (let ui = 0; ui < units.length; ui++) {
      const unit = units[ui]!
      for (let mi = 0; mi < unit.members.length; mi++) {
        const id = unit.members[mi]!
        positions.set(id, { x, y })
        maxRight = Math.max(maxRight, x + nodeWidth)
        x += nodeWidth
        if (mi < unit.members.length - 1) x += coupleGap
      }
      if (ui < units.length - 1) x += unitGap
    }
  }

  return maxRight
}

type GenFamilies = Map<string, Unit[]>

function buildGenerationFamilies(
  ids: string[],
  map: Map<string, Node>,
  positions: Map<string, { x: number; y: number }>,
  nodeWidth: number,
): GenFamilies {
  const units = buildUnits(ids, map)
  const families: GenFamilies = new Map()
  for (const unit of units) {
    const key = familyKeyForUnit(unit, map, ids)
    const list = families.get(key) ?? []
    list.push(unit)
    families.set(key, list)
  }
  for (const key of families.keys()) {
    families.set(key, sortUnitsInFamily(families.get(key)!, map, key))
  }
  for (const [key, famUnits] of families) {
    if (!key.startsWith('bridge:')) continue
    const sideX = (parentKeyStr: string) =>
      parentCenterX(parentKeyStr, positions, nodeWidth) ?? 0
    families.set(
      key,
      famUnits.map((unit) => {
        const ordered = [...unit.members].sort((a, b) => {
          const aKey = parentKey(map.get(a)!, map)
          const bKey = parentKey(map.get(b)!, map)
          const aLone = aKey.startsWith('lone:')
          const bLone = bKey.startsWith('lone:')
          if (aLone !== bLone) return aLone ? 1 : -1
          if (aLone && bLone) return a.localeCompare(b, 'sv')
          return sideX(aKey) - sideX(bKey) || a.localeCompare(b, 'sv')
        })
        const primary =
          ordered.find((id) => !parentKey(map.get(id)!, map).startsWith('lone:')) ??
          ordered[0]!
        return { primary, members: ordered }
      }),
    )
  }

  return attachNatalSiblingsToBridges(families, map)
}

/**
 * Unmarried natal siblings share parents with someone who sits in a
 * cross-family bridge. Park them in that bridge family on the matching
 * parental side (before = left natal key, after = right natal key).
 */
function attachNatalSiblingsToBridges(
  families: GenFamilies,
  map: Map<string, Node>,
): GenFamilies {
  const out: GenFamilies = new Map()
  const consumedNatal = new Set<string>()

  const bridges = [...families.keys()].filter((k) => k.startsWith('bridge:'))
  for (const bridgeKey of bridges) {
    const natalKeys = bridgeKey.slice('bridge:'.length).split('~')
    const leftNatal = natalKeys[0]
    const rightNatal = natalKeys[natalKeys.length - 1]
    const bridgeUnits = [...(families.get(bridgeKey) ?? [])]

    for (const natalKey of natalKeys) {
      if (consumedNatal.has(natalKey)) continue
      const natalUnits = families.get(natalKey)
      if (!natalUnits?.length) continue

      const absorbed = natalUnits.filter(
        (u) => parentKey(map.get(u.primary)!, map) === natalKey,
      )
      if (!absorbed.length) continue
      consumedNatal.add(natalKey)

      if (natalKey === leftNatal) {
        bridgeUnits.unshift(...absorbed)
      } else if (natalKey === rightNatal) {
        bridgeUnits.push(...absorbed)
      } else {
        // Middle key (rare): keep next to a member with that parent set.
        let insertAt = bridgeUnits.length
        for (let i = bridgeUnits.length - 1; i >= 0; i--) {
          if (
            bridgeUnits[i]!.members.some(
              (id) => parentKey(map.get(id)!, map) === natalKey,
            )
          ) {
            insertAt = i + 1
            break
          }
        }
        bridgeUnits.splice(insertAt, 0, ...absorbed)
      }
    }

    out.set(bridgeKey, bridgeUnits)
  }

  for (const [key, units] of families) {
    if (key.startsWith('bridge:')) continue
    if (consumedNatal.has(key)) continue
    out.set(key, units)
  }

  return out
}

/**
 * Spread families on the parent row so each child group fits underneath.
 * Re-places the whole row (avoids overlapping siblings like Mattias when
 * only Susanne+Wladimir were nudged apart).
 */
function expandParentsForChildren(
  parentIds: string[],
  childFamilies: GenFamilies,
  map: Map<string, Node>,
  positions: Map<string, { x: number; y: number }>,
  nodeWidth: number,
  coupleGap: number,
  unitGap: number,
  familyGap: number,
  padding: number,
  y: number,
) {
  if (!parentIds.length) return

  const parentFamilies = buildGenerationFamilies(
    parentIds,
    map,
    positions,
    nodeWidth,
  )

  /** How much horizontal room each parent-family key needs for its kids. */
  const childHalf = new Map<string, number>()
  const bridges: { leftKey: string; rightKey: string; width: number }[] = []

  for (const [childKey, units] of childFamilies) {
    const childWidth = measureFamily(units, nodeWidth, coupleGap, unitGap)
    if (childKey.startsWith('bridge:')) {
      const parts = childKey.slice('bridge:'.length).split('~').sort()
      if (parts.length === 2) {
        bridges.push({
          leftKey: parts[0]!,
          rightKey: parts[1]!,
          width: childWidth,
        })
      }
      continue
    }
    if (childKey.startsWith('lone:')) continue
    // Child family key is the parents' id pair — same as a parentFamilies key
    // only when those parents are the unit's family key. For couples like
    // susanne+wladimir the parent-row family key is usually their natal
    // parents (lena+bjorn). Map child-parent-key → natal family on this row.
    const natalKeys = new Set<string>()
    for (const pid of childKey.split('+')) {
      if (!parentIds.includes(pid)) continue
      // Which parent-row family does this person belong to?
      for (const [famKey, famUnits] of parentFamilies) {
        if (famUnits.some((u) => u.members.includes(pid))) {
          natalKeys.add(famKey)
        }
      }
    }
    for (const nk of natalKeys) {
      childHalf.set(nk, Math.max(childHalf.get(nk) ?? 0, childWidth / 2))
    }
  }

  for (const bridge of bridges) {
    for (const pkey of [bridge.leftKey, bridge.rightKey]) {
      for (const [famKey, famUnits] of parentFamilies) {
        const hit = pkey
          .split('+')
          .some((pid) => famUnits.some((u) => u.members.includes(pid)))
        if (hit) {
          // Reserve half the bridge on each side via extra spacing below
          childHalf.set(famKey, Math.max(childHalf.get(famKey) ?? 0, 0))
        }
      }
    }
  }

  type Place = {
    key: string
    width: number
    center: number
    halfChild: number
  }

  const places: Place[] = [...parentFamilies.entries()].map(([key, units]) => {
    const width = measureFamily(units, nodeWidth, coupleGap, unitGap)
    const xs = units.flatMap((u) =>
      u.members
        .map((id) => positions.get(id))
        .filter(Boolean)
        .map((p) => p!.x + nodeWidth / 2),
    )
    let center = xs.length
      ? xs.reduce((a, b) => a + b, 0) / xs.length
      : padding + width / 2
    // Parents with no ancestors of their own should sit above their kids
    // (otherwise bridge spacing shoves them to the far right).
    if (key.startsWith('lone:')) {
      const fromKids = childCenterX(units, map, positions, nodeWidth)
      if (fromKids != null) center = fromKids
    }
    return {
      key,
      width,
      center,
      halfChild: Math.max(width / 2, childHalf.get(key) ?? width / 2),
    }
  })

  places.sort((a, b) => a.center - b.center || a.key.localeCompare(b.key, 'sv'))

  const bridgeExtra = (left: Place, right: Place) => {
    let extra = 0
    for (const b of bridges) {
      const leftHit = b.leftKey
        .split('+')
        .some((pid) =>
          parentFamilies.get(left.key)?.some((u) => u.members.includes(pid)),
        )
      const rightHit = b.rightKey
        .split('+')
        .some((pid) =>
          parentFamilies.get(right.key)?.some((u) => u.members.includes(pid)),
        )
      const leftHitSwap = b.rightKey
        .split('+')
        .some((pid) =>
          parentFamilies.get(left.key)?.some((u) => u.members.includes(pid)),
        )
      const rightHitSwap = b.leftKey
        .split('+')
        .some((pid) =>
          parentFamilies.get(right.key)?.some((u) => u.members.includes(pid)),
        )
      if ((leftHit && rightHit) || (leftHitSwap && rightHitSwap)) {
        extra += b.width + familyGap
      }
    }
    return extra
  }

  for (let iter = 0; iter < Math.max(8, places.length * 6); iter++) {
    let moved = false
    for (let i = 1; i < places.length; i++) {
      const prev = places[i - 1]!
      const cur = places[i]!
      const need =
        prev.halfChild + familyGap + cur.halfChild + bridgeExtra(prev, cur)
      const gap = cur.center - prev.center
      if (gap + 0.01 < need) {
        const shift = (need - gap) / 2
        prev.center -= shift
        cur.center += shift
        moved = true
      }
    }
    if (!moved) break
  }

  // Also keep units inside a family from overlapping — re-place via ideals.
  const idealCenterForKey = (key: string) => {
    const place = places.find((p) => p.key === key)
    return place?.center ?? null
  }

  placeFamiliesOnRow(
    parentFamilies,
    positions,
    nodeWidth,
    coupleGap,
    unitGap,
    familyGap,
    padding,
    y,
    map,
    idealCenterForKey,
  )
}

/**
 * Layout that includes every person (no hidden branches).
 * Partners stay adjacent; children sit under their parents.
 */
/**
 * Move people who have no parents in the tree directly above their children,
 * then push overlapping cards on the same row apart.
 *
 * Root couples move as one unit, preferring shared children as the anchor so
 * a solo child of one partner doesn't tear the couple apart.
 */
function snapRootParentsToChildren(
  nodes: readonly Node[],
  map: Map<string, Node>,
  positions: Map<string, { x: number; y: number }>,
  nodeWidth: number,
  minGap: number,
  padding: number,
) {
  const snappedIds = new Set<string>()
  let snapped = false

  for (const person of nodes) {
    if (snappedIds.has(person.id)) continue
    const hasParentInTree = person.parents.some((p) => map.has(p.id))
    if (hasParentInTree) continue

    // Stay with a spouse who belongs to a sibling/parent group — don't pull
    // the in-law away (that made spouse lines cut through siblings).
    const spouseKeepsThem = person.spouses.some((s) => {
      const spouse = map.get(s.id)
      return spouse?.parents.some((p) => map.has(p.id))
    })
    if (spouseKeepsThem) continue

    const unitIds = [person.id]
    for (const s of person.spouses) {
      if (!positions.has(s.id) || snappedIds.has(s.id)) continue
      const spouse = map.get(s.id)
      if (!spouse) continue
      if (spouse.parents.some((p) => map.has(p.id))) continue
      unitIds.push(s.id)
    }

    const childIdSet = new Set<string>()
    for (const uid of unitIds) {
      for (const child of map.get(uid)!.children) {
        if (positions.has(child.id)) childIdSet.add(child.id)
      }
    }
    if (!childIdSet.size) continue

    // Prefer children shared by everyone in the unit (keeps couples stable).
    const sharedIds = [...childIdSet].filter((cid) => {
      const child = map.get(cid)
      if (!child) return false
      return unitIds.every((uid) => child.parents.some((p) => p.id === uid))
    })
    const anchorIds = sharedIds.length ? sharedIds : [...childIdSet]
    const childXs = anchorIds.map((cid) => positions.get(cid)!.x + nodeWidth / 2)

    const unitXs = unitIds.map((uid) => positions.get(uid)!)
    const unitLeft = Math.min(...unitXs.map((p) => p.x))
    const unitRight = Math.max(...unitXs.map((p) => p.x + nodeWidth))
    const unitCx = (unitLeft + unitRight) / 2
    const targetCx = childXs.reduce((a, b) => a + b, 0) / childXs.length
    const dx = targetCx - unitCx
    if (Math.abs(dx) < 0.5) {
      for (const uid of unitIds) snappedIds.add(uid)
      continue
    }

    for (const uid of unitIds) {
      const pos = positions.get(uid)!
      positions.set(uid, { x: pos.x + dx, y: pos.y })
      snappedIds.add(uid)
    }
    snapped = true
  }

  if (!snapped) return

  // Only separate true overlaps — use couple-sized gap so spouses stay adjacent.
  const byY = new Map<number, string[]>()
  for (const [id, pos] of positions) {
    const list = byY.get(pos.y) ?? []
    list.push(id)
    byY.set(pos.y, list)
  }

  for (const ids of byY.values()) {
    const ordered = [...ids].sort(
      (a, b) => positions.get(a)!.x - positions.get(b)!.x || a.localeCompare(b, 'sv'),
    )
    for (let iter = 0; iter < Math.max(8, ordered.length * 4); iter++) {
      let moved = false
      for (let i = 1; i < ordered.length; i++) {
        const prev = positions.get(ordered[i - 1]!)!
        const cur = positions.get(ordered[i]!)!
        const need = prev.x + nodeWidth + minGap
        if (cur.x + 0.01 < need) {
          const overlap = need - cur.x
          positions.set(ordered[i - 1]!, { x: prev.x - overlap / 2, y: prev.y })
          positions.set(ordered[i]!, { x: cur.x + overlap / 2, y: cur.y })
          moved = true
        }
      }
      if (!moved) break
    }
    for (let i = 1; i < ordered.length; i++) {
      const prev = positions.get(ordered[i - 1]!)!
      const cur = positions.get(ordered[i]!)!
      const need = prev.x + nodeWidth + minGap
      if (cur.x < need) {
        positions.set(ordered[i]!, { x: need, y: cur.y })
      }
    }
    const minLeft = Math.min(...ordered.map((id) => positions.get(id)!.x))
    if (minLeft < padding) {
      const shift = padding - minLeft
      for (const id of ordered) {
        const pos = positions.get(id)!
        positions.set(id, { x: pos.x + shift, y: pos.y })
      }
    }
  }
}

/**
 * Layout that includes every person (no hidden branches).
 * Partners stay adjacent; children sit under their parents.
 */
export function layoutFullTree(
  nodes: readonly Node[],
  options: Options,
): FullTreeLayout {
  const {
    nodeWidth,
    nodeHeight,
    coupleGap = 16,
    unitGap = 48,
    familyGap = 100,
    gapY = 80,
    padding = 48,
  } = options

  if (!nodes.length) {
    return { people: [], connectors: [], width: padding * 2, height: padding * 2 }
  }

  const map = byId(nodes)
  const generations = assignGenerations(nodes)
  const maxGen = Math.max(0, ...generations.values())

  const byGen = new Map<number, string[]>()
  for (const node of nodes) {
    const g = generations.get(node.id) ?? 0
    const list = byGen.get(g) ?? []
    list.push(node.id)
    byGen.set(g, list)
  }

  const positions = new Map<string, { x: number; y: number }>()
  const rowY = (g: number) => padding + g * (nodeHeight + gapY)

  const placeGen = (g: number) => {
    const ids = byGen.get(g) ?? []
    const families = buildGenerationFamilies(ids, map, positions, nodeWidth)
    return placeFamiliesOnRow(
      families,
      positions,
      nodeWidth,
      coupleGap,
      unitGap,
      familyGap,
      padding,
      rowY(g),
      map,
    )
  }

  // Seed row 0, then for each deeper row: widen parents first, then place kids.
  let maxRight = placeGen(0)
  for (let g = 1; g <= maxGen; g++) {
    const childIds = byGen.get(g) ?? []
    const childFamilies = buildGenerationFamilies(
      childIds,
      map,
      positions,
      nodeWidth,
    )

    // Walk up from g-1 so grandparents also make room for wide branches.
    for (let pg = g - 1; pg >= 0; pg--) {
      const parentIds = byGen.get(pg) ?? []
      const nextIds = byGen.get(pg + 1) ?? []
      const nextFamilies =
        pg + 1 === g
          ? childFamilies
          : buildGenerationFamilies(nextIds, map, positions, nodeWidth)
      expandParentsForChildren(
        parentIds,
        nextFamilies,
        map,
        positions,
        nodeWidth,
        coupleGap,
        unitGap,
        familyGap,
        padding,
        rowY(pg),
      )
    }

    maxRight = Math.max(maxRight, placeGen(g))
  }

  // Refinement: parents without ancestors (lone cards) snap above their
  // children now that those children have positions — e.g. Linnea → Inger
  // instead of being shoved to the far right next to unrelated in-laws.
  for (let pass = 0; pass < 2; pass++) {
    for (let g = 0; g <= maxGen; g++) {
      if (g > 0) {
        const childFamilies = buildGenerationFamilies(
          byGen.get(g) ?? [],
          map,
          positions,
          nodeWidth,
        )
        for (let pg = g - 1; pg >= 0; pg--) {
          const nextFamilies =
            pg + 1 === g
              ? childFamilies
              : buildGenerationFamilies(
                  byGen.get(pg + 1) ?? [],
                  map,
                  positions,
                  nodeWidth,
                )
          expandParentsForChildren(
            byGen.get(pg) ?? [],
            nextFamilies,
            map,
            positions,
            nodeWidth,
            coupleGap,
            unitGap,
            familyGap,
            padding,
            rowY(pg),
          )
        }
      }
      maxRight = Math.max(maxRight, placeGen(g))
    }
  }

  // Final snap: anyone with no parents in the tree sits above their kids.
  // Runs after expand/place so bridge spacing can't shove them away again.
  snapRootParentsToChildren(
    nodes,
    map,
    positions,
    nodeWidth,
    coupleGap,
    padding,
  )
  maxRight = Math.max(
    maxRight,
    ...[...positions.values()].map((p) => p.x + nodeWidth),
  )

  const people: LayoutPerson[] = nodes.map((node) => {
    const pos = positions.get(node.id)!
    return {
      id: node.id,
      gender: node.gender,
      x: pos.x,
      y: pos.y,
    }
  })

  const connectors: LayoutConnector[] = []
  const mid = (id: string) => {
    const pos = positions.get(id)!
    return {
      cx: pos.x + nodeWidth / 2,
      top: pos.y,
      bottom: pos.y + nodeHeight,
    }
  }

  const childrenByParents = new Map<string, string[]>()
  for (const node of nodes) {
    const parentIds = node.parents
      .map((p) => p.id)
      .filter((id) => positions.has(id))
      .sort()
    if (!parentIds.length) continue
    const key = parentIds.join('+')
    const list = childrenByParents.get(key) ?? []
    list.push(node.id)
    childrenByParents.set(key, list)
  }

  // Partner line between spouses (even when they share children — the
  // parent bracket below shows descent; this line shows the couple).
  const seenSpouse = new Set<string>()
  for (const node of nodes) {
    for (const spouse of node.spouses) {
      if (!positions.has(spouse.id)) continue
      const pairKey = [node.id, spouse.id].sort().join('+')
      if (seenSpouse.has(pairKey)) continue
      seenSpouse.add(pairKey)

      const a = positions.get(node.id)!
      const b = positions.get(spouse.id)!
      const y = a.y + nodeHeight * 0.55
      const left = a.x < b.x ? a : b
      const right = a.x < b.x ? b : a
      const x1 = left.x + nodeWidth
      const x2 = right.x
      if (x2 > x1) {
        const leftId = a.x < b.x ? node.id : spouse.id
        const rightId = a.x < b.x ? spouse.id : node.id
        connectors.push({
          x1,
          y1: y,
          x2,
          y2: y,
          kind: 'spouse',
          spouseIds: [leftId, rightId],
        })
      }
    }
  }

  type ParentGroupGeom = {
    parentIds: string[]
    parentMids: { cx: number; top: number; bottom: number }[]
    joinX: number
    joinY: number
    childMids: { id: string; cx: number; top: number; bottom: number }[]
    childMin: number
    childMax: number
    childCenter: number
    barY: number
    /** X-range used to detect nearly-collinear sibling bars. */
    barX1: number
    barX2: number
  }

  const BAR_NEAR_GAP = 24
  const BAR_NUDGE = 8
  /** Stronger vertical split when two parent brackets feed a married couple. */
  const SPOUSE_BAR_NUDGE = 22

  const spouseOf = new Map<string, Set<string>>()
  for (const node of nodes) {
    if (!positions.has(node.id)) continue
    for (const spouse of node.spouses) {
      if (!positions.has(spouse.id)) continue
      const a = spouseOf.get(node.id) ?? new Set<string>()
      a.add(spouse.id)
      spouseOf.set(node.id, a)
    }
  }

  const groups: ParentGroupGeom[] = []
  for (const [key, childIds] of childrenByParents) {
    const parentIds = key.split('+').filter((id) => positions.has(id))
    if (!parentIds.length) continue

    const parentMids = parentIds.map((id) => mid(id))
    const joinX =
      parentMids.reduce((sum, p) => sum + p.cx, 0) / parentMids.length
    const joinY = Math.max(...parentMids.map((p) => p.bottom)) + gapY * 0.42

    const childMids = childIds
      .filter((id) => positions.has(id))
      .map((id) => ({ id, ...mid(id) }))
      .sort((a, b) => a.cx - b.cx)
    if (!childMids.length) continue

    // Split far-apart children into clusters so a bridge sibling and a
    // natal sibling don't share one mega sibling bar across the tree.
    const clusterGap = nodeWidth + unitGap
    const clustersOfChildren: (typeof childMids)[] = []
    for (const child of childMids) {
      const last = clustersOfChildren[clustersOfChildren.length - 1]
      const prev = last?.[last.length - 1]
      if (last && prev && child.cx - prev.cx <= clusterGap) {
        last.push(child)
      } else {
        clustersOfChildren.push([child])
      }
    }

    for (const cluster of clustersOfChildren) {
      const childXs = cluster.map((c) => c.cx)
      const childMin = Math.min(...childXs)
      const childMax = Math.max(...childXs)
      const childCenter = (childMin + childMax) / 2
      const barY = Math.min(...cluster.map((c) => c.top)) - gapY * 0.42

      groups.push({
        parentIds,
        parentMids,
        joinX,
        joinY,
        childMids: cluster,
        childMin,
        childMax,
        childCenter,
        barY,
        barX1: childMin,
        barX2: childMax,
      })
    }
  }

  const groupsShareSpouseChildren = (a: ParentGroupGeom, b: ParentGroupGeom) => {
    for (const child of a.childMids) {
      const partners = spouseOf.get(child.id)
      if (!partners) continue
      for (const other of b.childMids) {
        if (partners.has(other.id)) return true
      }
    }
    return false
  }

  // Separate overlapping / spouse-confusable brackets onto different Y lanes.
  // Near bars (classic) and brackets onto a married couple (bridge) both need
  // this — otherwise Harry→Inger and Anna→Örjan share one altitude and read
  // as a single sibling bar under Harry+Linnea.
  const sortedGroups = [...groups].sort(
    (a, b) => a.barX1 - b.barX1 || a.barX2 - b.barX2,
  )

  const sameAltitude = (a: ParentGroupGeom, b: ParentGroupGeom) =>
    Math.abs(a.barY - b.barY) < 1

  const linked = (a: ParentGroupGeom, b: ParentGroupGeom) => {
    if (!sameAltitude(a, b)) return false
    if (b.barX1 <= a.barX2 + BAR_NEAR_GAP) return true
    return groupsShareSpouseChildren(a, b)
  }

  // Connected components (not only consecutive neighbours) so a third
  // bracket between two in-law sides can't block spouse detection.
  const componentOf = sortedGroups.map((_, i) => i)
  const find = (i: number): number =>
    componentOf[i] === i ? i : (componentOf[i] = find(componentOf[i]!))
  const unite = (i: number, j: number) => {
    const ri = find(i)
    const rj = find(j)
    if (ri !== rj) componentOf[rj] = ri
  }
  for (let i = 0; i < sortedGroups.length; i++) {
    for (let j = i + 1; j < sortedGroups.length; j++) {
      if (linked(sortedGroups[i]!, sortedGroups[j]!)) unite(i, j)
    }
  }

  const components = new Map<number, number[]>()
  for (let i = 0; i < sortedGroups.length; i++) {
    const root = find(i)
    const list = components.get(root) ?? []
    list.push(i)
    components.set(root, list)
  }

  for (const indices of components.values()) {
    if (indices.length < 2) continue
    const members = indices.map((i) => sortedGroups[i]!)
    const spouseSplit = members.some((a, ai) =>
      members.some((b, bi) => ai < bi && groupsShareSpouseChildren(a, b)),
    )
    const nudge = spouseSplit ? SPOUSE_BAR_NUDGE : BAR_NUDGE
    // Keep left-to-right order when assigning lanes.
    members.sort((a, b) => a.barX1 - b.barX1 || a.barX2 - b.barX2)
    const midIndex = (members.length - 1) / 2
    for (let i = 0; i < members.length; i++) {
      const g = members[i]!
      const offset = (i - midIndex) * nudge
      const parentBottom = Math.max(...g.parentMids.map((p) => p.bottom))
      const childTop = Math.min(...g.childMids.map((c) => c.top))
      const nextJoin = g.joinY + offset * 0.5
      const nextBar = g.barY + offset
      // Keep bracket inside the parent→child gap
      g.joinY = Math.min(
        Math.max(nextJoin, parentBottom + 4),
        childTop - 12,
      )
      g.barY = Math.min(
        Math.max(nextBar, g.joinY + 6),
        childTop - 4,
      )
    }
  }

  for (const g of groups) {
    const childIds = g.childMids.map((c) => c.id)
    const bloodLink = { childIds, parentIds: g.parentIds }

    for (const p of g.parentMids) {
      connectors.push({
        x1: p.cx,
        y1: p.bottom,
        x2: p.cx,
        y2: g.joinY,
        kind: 'blood',
        bloodLink,
      })
    }
    if (g.parentMids.length > 1) {
      const xs = g.parentMids.map((p) => p.cx)
      connectors.push({
        x1: Math.min(...xs),
        y1: g.joinY,
        x2: Math.max(...xs),
        y2: g.joinY,
        kind: 'blood',
        bloodLink,
      })
    }

    if (Math.abs(g.childCenter - g.joinX) > 1) {
      connectors.push({
        x1: g.joinX,
        y1: g.joinY,
        x2: g.childCenter,
        y2: g.joinY,
        kind: 'blood',
        bloodLink,
      })
    }
    connectors.push({
      x1: g.childCenter,
      y1: g.joinY,
      x2: g.childCenter,
      y2: g.barY,
      kind: 'blood',
      bloodLink,
    })

    if (g.childMids.length > 1) {
      connectors.push({
        x1: g.childMin,
        y1: g.barY,
        x2: g.childMax,
        y2: g.barY,
        kind: 'blood',
        bloodLink,
      })
    }

    for (const child of g.childMids) {
      connectors.push({
        x1: child.cx,
        y1: g.barY,
        x2: child.cx,
        y2: child.top,
        kind: 'blood',
        bloodLink,
      })
    }
  }

  const width = Math.max(
    padding * 2 + nodeWidth,
    ...people.map((p) => p.x + nodeWidth + padding),
  )
  const height = Math.max(
    padding * 2 + nodeHeight,
    ...people.map((p) => p.y + nodeHeight + padding),
  )

  return { people, connectors, width, height }
}
