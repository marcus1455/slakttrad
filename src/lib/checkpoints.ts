import type { FamilyStore, TreeCheckpoint } from '../types'

const MAX_CHECKPOINTS = 20

function snapshotGraph(store: FamilyStore): Pick<
  TreeCheckpoint,
  'rootId' | 'profiles' | 'nodes'
> {
  return {
    rootId: store.rootId,
    profiles: structuredClone(store.profiles),
    nodes: structuredClone(store.nodes),
  }
}

function storageKey(treeId: string) {
  return `slakttrad-checkpoints:${treeId}`
}

export function loadCheckpoints(treeId: string): TreeCheckpoint[] {
  try {
    const raw = localStorage.getItem(storageKey(treeId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as TreeCheckpoint[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function persistCheckpoints(treeId: string, checkpoints: TreeCheckpoint[]) {
  try {
    localStorage.setItem(
      storageKey(treeId),
      JSON.stringify(checkpoints.slice(-MAX_CHECKPOINTS)),
    )
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function withLoadedCheckpoints(store: FamilyStore, treeId: string): FamilyStore {
  // Prefer cloud/store checkpoints; fall back to localStorage (legacy / offline).
  if (store.checkpoints && store.checkpoints.length > 0) {
    persistCheckpoints(treeId, store.checkpoints)
    return store
  }
  const fromDisk = loadCheckpoints(treeId)
  if (fromDisk.length === 0) return store
  return {
    ...store,
    checkpoints: fromDisk,
  }
}

export function createCheckpoint(
  store: FamilyStore,
  label: string,
): FamilyStore {
  const trimmed = label.trim() || `Återställning ${new Date().toLocaleString('sv-SE')}`
  const point: TreeCheckpoint = {
    id: crypto.randomUUID().slice(0, 10),
    label: trimmed,
    createdAt: new Date().toISOString(),
    ...snapshotGraph(store),
  }
  const checkpoints = [...(store.checkpoints ?? []), point].slice(-MAX_CHECKPOINTS)
  return { ...store, checkpoints }
}

export function restoreCheckpoint(
  store: FamilyStore,
  checkpointId: string,
): FamilyStore {
  const point = store.checkpoints?.find((c) => c.id === checkpointId)
  if (!point) throw new Error('Återställningspunkten finns inte')
  return {
    rootId: point.rootId,
    profiles: structuredClone(point.profiles),
    nodes: structuredClone(point.nodes),
    checkpoints: store.checkpoints,
  }
}

export function deleteCheckpoint(
  store: FamilyStore,
  checkpointId: string,
): FamilyStore {
  return {
    ...store,
    checkpoints: (store.checkpoints ?? []).filter((c) => c.id !== checkpointId),
  }
}
