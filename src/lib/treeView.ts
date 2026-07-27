import type { Node } from 'relatives-tree/lib/types'
import type { FamilyStore } from '../types'

export type TreeView =
  | { type: 'all' }
  | { type: 'near' }
  | { type: 'surname'; surname: string }

export function lastNameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  return parts[parts.length - 1] ?? ''
}

export function viewLabel(view: TreeView): string {
  if (view.type === 'all') return 'Hela trädet'
  if (view.type === 'near') return 'Nära centrum'
  return view.surname
}

export function listSurnames(store: FamilyStore): string[] {
  const counts = new Map<string, number>()
  for (const profile of Object.values(store.profiles)) {
    const surname = lastNameOf(profile.name)
    if (!surname) continue
    counts.set(surname, (counts.get(surname) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv'))
    .map(([surname]) => surname)
}

function nearIds(store: FamilyStore, focusId: string): Set<string> {
  const nodes = new Map(store.nodes.map((n) => [n.id, n]))
  const focus = nodes.get(focusId)
  const ids = new Set<string>()
  if (!focus) return ids

  const add = (id: string | undefined) => {
    if (id && nodes.has(id)) ids.add(id)
  }

  add(focusId)
  for (const s of focus.spouses) add(s.id)
  for (const p of focus.parents) add(p.id)
  for (const c of focus.children) add(c.id)
  for (const s of focus.siblings) add(s.id)

  for (const parentRel of focus.parents) {
    const parent = nodes.get(parentRel.id)
    if (!parent) continue
    for (const s of parent.spouses) add(s.id)
    for (const gp of parent.parents) add(gp.id)
    for (const sib of parent.children) add(sib.id) // aunts/uncles
  }

  // Spouses of included siblings / aunts
  for (const id of [...ids]) {
    const node = nodes.get(id)
    if (!node) continue
    for (const s of node.spouses) add(s.id)
  }

  return ids
}

function surnameIds(store: FamilyStore, surname: string): Set<string> {
  const wanted = surname.toLocaleLowerCase('sv')
  const nodes = new Map(store.nodes.map((n) => [n.id, n]))
  const ids = new Set<string>()

  for (const profile of Object.values(store.profiles)) {
    if (lastNameOf(profile.name).toLocaleLowerCase('sv') === wanted) {
      ids.add(profile.id)
    }
  }

  // Keep partners visible so couples don't break apart
  for (const id of [...ids]) {
    const node = nodes.get(id)
    if (!node) continue
    for (const s of node.spouses) {
      if (nodes.has(s.id)) ids.add(s.id)
    }
  }

  return ids
}

/** Nodes to render for the active view (relations to outsiders are ignored by layout). */
export function nodesForView(store: FamilyStore, view: TreeView): Node[] {
  if (view.type === 'all') return [...store.nodes]

  const keep =
    view.type === 'near'
      ? nearIds(store, store.rootId)
      : surnameIds(store, view.surname)

  if (keep.size === 0) return [...store.nodes]
  return store.nodes.filter((n) => keep.has(n.id))
}
