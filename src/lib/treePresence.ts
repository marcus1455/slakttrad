/** Ephemeral tree presence helpers (Supabase Realtime Presence + Broadcast). */

export type PresenceRole = 'owner' | 'collaborator' | 'editor' | 'viewer' | 'guest'

export type PresencePeer = {
  key: string
  name: string
  color: string
  role: PresenceRole
  userId?: string
  avatarUrl?: string | null
}

export type CursorPayload = {
  key: string
  x: number
  y: number
  visible: boolean
}

export type RemoteCursor = CursorPayload & {
  name: string
  color: string
}

const GUEST_SESSION_KEY = 'slakttrad-presence-key'

const ROLE_LABELS: Record<PresenceRole, string> = {
  owner: 'Ägare',
  collaborator: 'Medarbetare',
  editor: 'Redigerar',
  viewer: 'Tittar',
  guest: 'Gäst',
}

export function presenceRoleLabel(role: PresenceRole): string {
  return ROLE_LABELS[role]
}

/** Stable presence key: auth user id, or a sessionStorage guest id. */
export function getPresenceKey(userId?: string | null): string {
  if (userId) return `user:${userId}`
  try {
    const existing = sessionStorage.getItem(GUEST_SESSION_KEY)
    if (existing) return existing
    const next = `guest:${crypto.randomUUID()}`
    sessionStorage.setItem(GUEST_SESSION_KEY, next)
    return next
  } catch {
    return `guest:${crypto.randomUUID()}`
  }
}

export function colorFromKey(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  const hue = hash % 360
  const sat = 48 + (hash % 20)
  const light = 38 + (hash % 14)
  return `hsl(${hue} ${sat}% ${light}%)`
}

export function resolvePresenceRole(opts: {
  userId?: string | null
  ownerId?: string | null
  mayEdit: boolean
  isViewMode: boolean
}): PresenceRole {
  if (!opts.userId) return 'guest'
  if (opts.isViewMode || !opts.mayEdit) return 'viewer'
  if (opts.ownerId && opts.userId === opts.ownerId) return 'owner'
  if (opts.ownerId) return 'collaborator'
  return 'editor'
}

export function treeChannelName(treeId: string): string {
  return `tree:${treeId}`
}

/** Flatten Realtime presence sync state into unique peers (one per key). */
export function peersFromPresenceState(
  state: Record<string, PresencePeer[]>,
  selfKey: string,
): PresencePeer[] {
  const byKey = new Map<string, PresencePeer>()
  for (const metas of Object.values(state)) {
    for (const meta of metas) {
      if (!meta?.key || meta.key === selfKey) continue
      byKey.set(meta.key, {
        key: meta.key,
        name: meta.name || 'Okänd',
        color: meta.color || colorFromKey(meta.key),
        role: meta.role ?? 'guest',
        userId: meta.userId,
        avatarUrl: meta.avatarUrl ?? null,
      })
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'sv'))
}
