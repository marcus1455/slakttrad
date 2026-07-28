import type { FamilyStore, PersonProfile } from '../types'
import type { Node } from 'relatives-tree/lib/types'

/** Parse and validate a family tree JSON export into a FamilyStore. */
export function importFamilyJson(text: string): FamilyStore {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Ogiltig JSON')
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('JSON måste vara ett objekt')
  }

  const data = raw as Record<string, unknown>

  if (typeof data.rootId !== 'string' || !data.rootId.trim()) {
    throw new Error('Saknar giltigt rootId')
  }
  const rootId = data.rootId

  if (
    !data.profiles ||
    typeof data.profiles !== 'object' ||
    Array.isArray(data.profiles)
  ) {
    throw new Error('profiles måste vara ett objekt')
  }
  const profiles = data.profiles as Record<string, PersonProfile>

  if (!Array.isArray(data.nodes)) {
    throw new Error('nodes måste vara en array')
  }
  const nodes = data.nodes as Node[]

  const inProfiles = rootId in profiles
  const inNodes = nodes.some(
    (n) => n && typeof n === 'object' && (n as { id?: string }).id === rootId,
  )
  if (!inProfiles && !inNodes) {
    throw new Error('rootId finns inte i profiles eller nodes')
  }

  return { rootId, profiles, nodes }
}
