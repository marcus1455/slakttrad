import type { FamilyStore } from '../types'

const MAX_HISTORY = 40

export type StoreHistory = {
  past: FamilyStore[]
  future: FamilyStore[]
}

export const emptyHistory = (): StoreHistory => ({ past: [], future: [] })

export function pushHistory(
  history: StoreHistory,
  current: FamilyStore,
): StoreHistory {
  return {
    past: [...history.past.slice(-(MAX_HISTORY - 1)), structuredClone(current)],
    future: [],
  }
}

export function undoHistory(
  history: StoreHistory,
  current: FamilyStore,
): { history: StoreHistory; store: FamilyStore } | null {
  if (history.past.length === 0) return null
  const previous = history.past[history.past.length - 1]
  return {
    store: previous,
    history: {
      past: history.past.slice(0, -1),
      future: [structuredClone(current), ...history.future].slice(0, MAX_HISTORY),
    },
  }
}

export function redoHistory(
  history: StoreHistory,
  current: FamilyStore,
): { history: StoreHistory; store: FamilyStore } | null {
  if (history.future.length === 0) return null
  const next = history.future[0]
  return {
    store: next,
    history: {
      past: [...history.past, structuredClone(current)].slice(-MAX_HISTORY),
      future: history.future.slice(1),
    },
  }
}
