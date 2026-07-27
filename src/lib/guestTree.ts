import { createBlankFamily } from '../data/blank'
import type { FamilyStore } from '../types'

const GUEST_STORAGE_KEY = 'slakttrad-guest-tree'

export type GuestTreePayload = {
  store: FamilyStore
  name: string
}

/** Stable local-only id so presence/share stay disabled for guests. */
export const GUEST_TREE_ID = 'guest-local'

export function loadOrCreateGuestTree(): GuestTreePayload {
  try {
    const raw = sessionStorage.getItem(GUEST_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as GuestTreePayload
      if (parsed?.store?.rootId && parsed.store.nodes?.length && parsed.store.profiles) {
        return {
          store: parsed.store,
          name: parsed.name?.trim() || 'Mitt släktträd',
        }
      }
    }
  } catch {
    // Corrupt or unavailable storage — start fresh.
  }
  return {
    store: createBlankFamily('Jag'),
    name: 'Mitt släktträd',
  }
}

export function saveGuestTree(store: FamilyStore, name: string): void {
  try {
    const payload: GuestTreePayload = {
      store,
      name: name.trim() || 'Mitt släktträd',
    }
    sessionStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Quota / private mode — editing still works in memory.
  }
}

export function clearGuestTree(): void {
  try {
    sessionStorage.removeItem(GUEST_STORAGE_KEY)
  } catch {
    // ignore
  }
}
