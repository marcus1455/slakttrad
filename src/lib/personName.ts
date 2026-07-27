import type { PersonProfile } from '../types'

/** Pull "Anna-lisa" out of "Anna Elisabeth (Anna-lisa) Davidsson". */
export function splitNameAndNickname(raw: string): {
  name: string
  nickname?: string
} {
  const trimmed = raw.trim()
  const match = trimmed.match(/^(.*?)\s*\(([^)]+)\)\s*(.*)$/)
  if (!match) return { name: trimmed }

  const nickname = match[2]!.trim()
  const name = [match[1], match[3]]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!nickname || !name) return { name: trimmed }
  return { name, nickname }
}

/** One-time cleanup: move parenthetical nicknames into `nickname`. */
export function normalizeProfileNicknames(
  profiles: Record<string, PersonProfile>,
): Record<string, PersonProfile> {
  let changed = false
  const next: Record<string, PersonProfile> = {}

  for (const [id, profile] of Object.entries(profiles)) {
    if (profile.nickname?.trim()) {
      next[id] = profile
      continue
    }
    const split = splitNameAndNickname(profile.name)
    if (!split.nickname || split.name === profile.name) {
      next[id] = profile
      continue
    }
    changed = true
    next[id] = {
      ...profile,
      name: split.name,
      nickname: split.nickname,
    }
  }

  return changed ? next : profiles
}

export function nicknameOf(profile: PersonProfile | undefined): string {
  return profile?.nickname?.trim() ?? ''
}
