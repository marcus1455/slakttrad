import type { Node, RelType } from 'relatives-tree/lib/types'
import type { FamilyStore, Gender, LifeEvent, PersonProfile } from '../types'

const blood = 'blood' as RelType
const married = 'married' as RelType
const divorced = 'divorced' as RelType
const adopted = 'adopted' as RelType

function escapeGedcom(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim()
}

function formatGedcomPlace(
  place: string | undefined,
  country: string | undefined,
): string {
  return [place?.trim(), country?.trim()].filter(Boolean).join(', ')
}

function yearFrom(value: string | undefined): string {
  if (!value?.trim()) return ''
  const m = value.trim().match(/\d{4}/)
  return m?.[0] ?? escapeGedcom(value)
}

function genderToSex(gender: Gender): 'M' | 'F' {
  return gender === 'male' ? 'M' : 'F'
}

function sexToGender(sex: string | undefined): Gender {
  return sex?.toUpperCase() === 'M' ? 'male' : 'female'
}

/** Export a FamilyStore to a minimal GEDCOM 5.5.1 subset. */
export function exportGedcom(store: FamilyStore, treeName: string): string {
  const lines: string[] = [
    '0 HEAD',
    '1 SOUR Slakttrad',
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
    `1 NOTE ${escapeGedcom(treeName)}`,
  ]

  const idMap = new Map<string, string>()
  let n = 1
  for (const id of Object.keys(store.profiles)) {
    idMap.set(id, `@I${n++}@`)
  }

  // Families: unique parent pairs (and single parents) with shared children
  type FamKey = string
  const families = new Map<
    FamKey,
    { husb?: string; wife?: string; children: string[]; married?: boolean; divorced?: boolean }
  >()

  for (const node of store.nodes) {
    const parents = node.parents
    if (parents.length === 0) continue
    const pids = parents.map((p) => p.id).sort()
    const key = pids.join('+')
    let fam = families.get(key)
    if (!fam) {
      fam = { children: [] }
      for (const pid of pids) {
        const g = store.profiles[pid]?.gender
        if (g === 'male' && !fam.husb) fam.husb = pid
        else if (g === 'female' && !fam.wife) fam.wife = pid
        else if (!fam.husb) fam.husb = pid
        else fam.wife = pid
      }
      if (pids.length === 2) {
        const a = store.nodes.find((x) => x.id === pids[0])
        const rel = a?.spouses.find((s) => s.id === pids[1])
        if (rel?.type === divorced) fam.divorced = true
        else if (rel) fam.married = true
      }
      families.set(key, fam)
    }
    fam.children.push(node.id)
  }

  // Also create families for spouse pairs without children
  for (const node of store.nodes) {
    for (const spouse of node.spouses) {
      if (node.id > spouse.id) continue
      const key = [node.id, spouse.id].sort().join('+')
      if (families.has(key)) continue
      const fam: {
        husb?: string
        wife?: string
        children: string[]
        married?: boolean
        divorced?: boolean
      } = { children: [] }
      const g0 = store.profiles[node.id]?.gender
      if (g0 === 'male') {
        fam.husb = node.id
        fam.wife = spouse.id
      } else {
        fam.wife = node.id
        fam.husb = spouse.id
      }
      if (spouse.type === divorced) fam.divorced = true
      else fam.married = true
      families.set(key, fam)
    }
  }

  const famIds = new Map<FamKey, string>()
  let f = 1
  for (const key of families.keys()) {
    famIds.set(key, `@F${f++}@`)
  }

  const famAsChild = new Map<string, string>()
  const famAsSpouse = new Map<string, string[]>()
  for (const [key, fam] of families) {
    const fid = famIds.get(key)!
    for (const cid of fam.children) famAsChild.set(cid, fid)
    for (const pid of [fam.husb, fam.wife]) {
      if (!pid) continue
      const list = famAsSpouse.get(pid) ?? []
      list.push(fid)
      famAsSpouse.set(pid, list)
    }
  }

  for (const profile of Object.values(store.profiles)) {
    const xref = idMap.get(profile.id)!
    lines.push(`0 ${xref} INDI`)
    lines.push(`1 NAME ${escapeGedcom(profile.name)}`)
    if (profile.nickname?.trim()) {
      lines.push(`2 NICK ${escapeGedcom(profile.nickname)}`)
    }
    if (profile.maidenName?.trim()) {
      lines.push(`1 NAME ${escapeGedcom(profile.maidenName)}`)
      lines.push('2 TYPE maiden')
    }
    if (profile.alsoKnownAs?.trim()) {
      lines.push(`1 NAME ${escapeGedcom(profile.alsoKnownAs)}`)
      lines.push('2 TYPE aka')
    }
    lines.push(`1 SEX ${genderToSex(profile.gender)}`)
    const birthDate = profile.birthDate?.trim() || profile.birthYear?.trim()
    const birthPlace = formatGedcomPlace(profile.birthPlace, profile.birthCountry)
    if (birthDate || birthPlace) {
      lines.push('1 BIRT')
      if (birthDate) lines.push(`2 DATE ${escapeGedcom(birthDate)}`)
      if (birthPlace) lines.push(`2 PLAC ${escapeGedcom(birthPlace)}`)
    }
    const deathDate = profile.deathDate?.trim() || profile.deathYear?.trim()
    const deathPlace = formatGedcomPlace(profile.deathPlace, profile.deathCountry)
    if (deathDate || deathPlace) {
      lines.push('1 DEAT')
      if (deathDate) lines.push(`2 DATE ${escapeGedcom(deathDate)}`)
      if (deathPlace) lines.push(`2 PLAC ${escapeGedcom(deathPlace)}`)
    }
    const residence = formatGedcomPlace(
      profile.residencePlace,
      profile.residenceCountry,
    )
    if (residence) {
      lines.push('1 RESI')
      lines.push(`2 PLAC ${escapeGedcom(residence)}`)
    }
    if (profile.occupation?.trim()) {
      lines.push(`1 OCCU ${escapeGedcom(profile.occupation)}`)
    }
    if (profile.religion?.trim()) {
      lines.push(`1 RELI ${escapeGedcom(profile.religion)}`)
    }
    if (profile.civilStatus?.trim()) {
      const statusLabel: Record<string, string> = {
        single: 'Ogift',
        married: 'Gift',
        divorced: 'Frånskild',
        widowed: 'Änka/änkling',
      }
      lines.push(
        `1 NOTE Civilstånd: ${statusLabel[profile.civilStatus] ?? profile.civilStatus}`,
      )
    }
    if (profile.email?.trim()) {
      lines.push(`1 EMAIL ${escapeGedcom(profile.email)}`)
    }
    if (profile.phone?.trim()) {
      lines.push(`1 PHON ${escapeGedcom(profile.phone)}`)
    }
    if (profile.sources?.trim()) {
      lines.push(`1 SOUR ${escapeGedcom(profile.sources)}`)
    }
    if (profile.notes?.trim()) {
      lines.push(`1 NOTE ${escapeGedcom(profile.notes)}`)
    }
    for (const ev of profile.events ?? []) {
      const tag =
        ev.type === 'marriage'
          ? 'MARR'
          : ev.type === 'divorce'
            ? 'DIV'
            : ev.type === 'education'
              ? 'EDUC'
              : ev.type === 'move'
                ? 'RESI'
                : 'EVEN'
      lines.push(`1 ${tag}`)
      if (ev.title?.trim()) lines.push(`2 TYPE ${escapeGedcom(ev.title)}`)
      if (ev.date?.trim()) lines.push(`2 DATE ${escapeGedcom(ev.date)}`)
      if (ev.place?.trim()) lines.push(`2 PLAC ${escapeGedcom(ev.place)}`)
      if (ev.notes?.trim()) lines.push(`2 NOTE ${escapeGedcom(ev.notes)}`)
    }
    const childOf = famAsChild.get(profile.id)
    if (childOf) lines.push(`1 FAMC ${childOf}`)
    for (const fid of famAsSpouse.get(profile.id) ?? []) {
      lines.push(`1 FAMS ${fid}`)
    }
  }

  for (const [key, fam] of families) {
    const fid = famIds.get(key)!
    lines.push(`0 ${fid} FAM`)
    if (fam.husb) lines.push(`1 HUSB ${idMap.get(fam.husb)}`)
    if (fam.wife) lines.push(`1 WIFE ${idMap.get(fam.wife)}`)
    for (const cid of fam.children) {
      lines.push(`1 CHIL ${idMap.get(cid)}`)
    }
    if (fam.divorced) lines.push('1 DIV Y')
    else if (fam.married) lines.push('1 MARR')
  }

  lines.push('0 TRLR')
  return lines.join('\n') + '\n'
}

type ParsedIndi = {
  xref: string
  name: string
  nickname?: string
  maidenName?: string
  alsoKnownAs?: string
  sex?: string
  birthYear?: string
  birthDate?: string
  birthPlace?: string
  deathYear?: string
  deathDate?: string
  deathPlace?: string
  residencePlace?: string
  occupation?: string
  religion?: string
  sources?: string
  email?: string
  phone?: string
  notes?: string
  events: LifeEvent[]
  famc?: string
  fams: string[]
}

type ParsedFam = {
  xref: string
  husb?: string
  wife?: string
  children: string[]
  divorced?: boolean
}

function parseGedcomLines(text: string): { indis: ParsedIndi[]; fams: ParsedFam[] } {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)

  const indis: ParsedIndi[] = []
  const fams: ParsedFam[] = []
  let curIndi: ParsedIndi | null = null
  let curFam: ParsedFam | null = null
  let curEvent: LifeEvent | null = null
  let curTag: 'BIRT' | 'DEAT' | 'EVEN' | null = null

  const flushEvent = () => {
    if (curIndi && curEvent) {
      curIndi.events.push(curEvent)
    }
    curEvent = null
  }

  for (const raw of lines) {
    const m = raw.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s+(.*))?$/)
    if (!m) continue
    const level = Number(m[1])
    const xref = m[2]
    const tag = m[3]!
    const value = (m[4] ?? '').trim()

    if (level === 0) {
      flushEvent()
      curIndi = null
      curFam = null
      curTag = null
      if (tag === 'INDI' && xref) {
        curIndi = {
          xref,
          name: 'Namnlös',
          events: [],
          fams: [],
        }
        indis.push(curIndi)
      } else if (tag === 'FAM' && xref) {
        curFam = { xref, children: [] }
        fams.push(curFam)
      }
      continue
    }

    if (curIndi) {
      if (level === 1) {
        flushEvent()
        curTag = null
        if (tag === 'NAME') curIndi.name = value.replace(/\//g, '').trim() || 'Namnlös'
        else if (tag === 'SEX') curIndi.sex = value
        else if (tag === 'OCCU') curIndi.occupation = value
        else if (tag === 'RELI') curIndi.religion = value
        else if (tag === 'SOUR') curIndi.sources = value
        else if (tag === 'EMAIL') curIndi.email = value
        else if (tag === 'PHON') curIndi.phone = value
        else if (tag === 'NOTE') {
          curIndi.notes = curIndi.notes ? `${curIndi.notes} ${value}` : value
        }
        else if (tag === 'FAMC') curIndi.famc = value
        else if (tag === 'FAMS') curIndi.fams.push(value)
        else if (tag === 'BIRT') curTag = 'BIRT'
        else if (tag === 'DEAT') curTag = 'DEAT'
        else if (tag === 'RESI') {
          curTag = 'EVEN'
          curEvent = {
            id: crypto.randomUUID().slice(0, 8),
            type: 'move',
            title: 'RESI',
          }
        }
        else if (tag === 'MARR' || tag === 'DIV' || tag === 'EDUC' || tag === 'EVEN') {
          curTag = 'EVEN'
          curEvent = {
            id: crypto.randomUUID().slice(0, 8),
            type:
              tag === 'MARR'
                ? 'marriage'
                : tag === 'DIV'
                  ? 'divorce'
                  : tag === 'EDUC'
                    ? 'education'
                    : 'other',
            title: tag === 'EVEN' ? undefined : tag,
          }
        }
      } else if (level === 2) {
        if (tag === 'NICK') curIndi.nickname = value
        else if (tag === 'TYPE' && value.toLowerCase().includes('maiden')) {
          curIndi.maidenName = curIndi.name
        } else if (tag === 'TYPE' && value.toLowerCase() === 'aka') {
          curIndi.alsoKnownAs = curIndi.name
        }
        else if (curTag === 'BIRT' && tag === 'DATE') {
          curIndi.birthDate = value
          curIndi.birthYear = yearFrom(value)
        }
        else if (curTag === 'BIRT' && tag === 'PLAC') curIndi.birthPlace = value
        else if (curTag === 'DEAT' && tag === 'DATE') {
          curIndi.deathDate = value
          curIndi.deathYear = yearFrom(value)
        }
        else if (curTag === 'DEAT' && tag === 'PLAC') curIndi.deathPlace = value
        else if (curEvent) {
          if (tag === 'DATE') curEvent.date = value
          else if (tag === 'PLAC') {
            curEvent.place = value
            if (curEvent.title === 'RESI') curIndi.residencePlace = value
          }
          else if (tag === 'TYPE') curEvent.title = value
          else if (tag === 'NOTE') curEvent.notes = value
        }
      }
      continue
    }

    if (curFam && level === 1) {
      if (tag === 'HUSB') curFam.husb = value
      else if (tag === 'WIFE') curFam.wife = value
      else if (tag === 'CHIL') curFam.children.push(value)
      else if (tag === 'DIV') curFam.divorced = true
    }
  }
  flushEvent()
  return { indis, fams }
}

function newShortId(): string {
  return crypto.randomUUID().slice(0, 8)
}

/** Import GEDCOM into a new FamilyStore. Picks first individual as root. */
export function importGedcom(text: string): FamilyStore {
  const { indis, fams } = parseGedcomLines(text)
  if (indis.length === 0) {
    throw new Error('Ingen person hittades i GEDCOM-filen')
  }

  const xrefToId = new Map<string, string>()
  for (const indi of indis) {
    xrefToId.set(indi.xref, newShortId())
  }

  const profiles: Record<string, PersonProfile> = {}
  const nodeMap = new Map<
    string,
    {
      id: string
      gender: Gender
      parents: { id: string; type: RelType }[]
      children: { id: string; type: RelType }[]
      siblings: { id: string; type: RelType }[]
      spouses: { id: string; type: RelType }[]
    }
  >()

  for (const indi of indis) {
    const id = xrefToId.get(indi.xref)!
    const gender = sexToGender(indi.sex)
    profiles[id] = {
      id,
      name: indi.name,
      gender,
      ...(indi.nickname ? { nickname: indi.nickname } : {}),
      ...(indi.maidenName ? { maidenName: indi.maidenName } : {}),
      ...(indi.alsoKnownAs ? { alsoKnownAs: indi.alsoKnownAs } : {}),
      ...(indi.birthYear ? { birthYear: indi.birthYear } : {}),
      ...(indi.birthDate ? { birthDate: indi.birthDate } : {}),
      ...(indi.birthPlace ? { birthPlace: indi.birthPlace } : {}),
      ...(indi.deathYear ? { deathYear: indi.deathYear } : {}),
      ...(indi.deathDate ? { deathDate: indi.deathDate } : {}),
      ...(indi.deathPlace ? { deathPlace: indi.deathPlace } : {}),
      ...(indi.residencePlace ? { residencePlace: indi.residencePlace } : {}),
      ...(indi.occupation ? { occupation: indi.occupation } : {}),
      ...(indi.religion ? { religion: indi.religion } : {}),
      ...(indi.sources ? { sources: indi.sources } : {}),
      ...(indi.email ? { email: indi.email } : {}),
      ...(indi.phone ? { phone: indi.phone } : {}),
      ...(indi.notes ? { notes: indi.notes } : {}),
      ...(indi.events.length ? { events: indi.events } : {}),
    }
    nodeMap.set(id, {
      id,
      gender,
      parents: [],
      children: [],
      siblings: [],
      spouses: [],
    })
  }

  const ensureRel = (
    list: { id: string; type: RelType }[],
    id: string,
    type: RelType,
  ) => {
    if (list.some((r) => r.id === id)) return
    list.push({ id, type })
  }

  for (const fam of fams) {
    const parentIds = [fam.husb, fam.wife]
      .filter(Boolean)
      .map((x) => xrefToId.get(x!)!)
      .filter(Boolean)
    const spouseType = fam.divorced ? divorced : married

    if (parentIds.length === 2) {
      const [a, b] = parentIds
      const na = nodeMap.get(a!)
      const nb = nodeMap.get(b!)
      if (na && nb) {
        ensureRel(na.spouses, b!, spouseType)
        ensureRel(nb.spouses, a!, spouseType)
      }
    }

    const childIds = fam.children
      .map((x) => xrefToId.get(x)!)
      .filter(Boolean)

    for (const cid of childIds) {
      const child = nodeMap.get(cid)
      if (!child) continue
      for (const pid of parentIds) {
        const parent = nodeMap.get(pid)
        if (!parent) continue
        ensureRel(child.parents, pid, blood)
        ensureRel(parent.children, cid, blood)
      }
    }

    for (const cid of childIds) {
      const child = nodeMap.get(cid)
      if (!child) continue
      child.siblings = childIds
        .filter((sid) => sid !== cid)
        .map((sid) => ({ id: sid, type: blood }))
    }
  }

  const nodes = [...nodeMap.values()] as unknown as Node[]
  const rootId = nodes[0]!.id

  return { rootId, profiles, nodes }
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Keep adopted marker available for relation helpers that import this module. */
export { adopted }
