import type { User } from '@supabase/supabase-js'
import type { PersonProfile } from '../types'

/** Prefer profile name, otherwise the part before @ in the email. */
export function displayNameFromUser(user: User): string {
  const meta = user.user_metadata ?? {}
  const named =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    (typeof meta.display_name === 'string' && meta.display_name.trim())
  if (named) return named

  const local = user.email?.split('@')[0]?.trim()
  if (!local) return 'Konto'
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || '?'
}

export function avatarUrlFromUser(user: User): string | null {
  const meta = user.user_metadata ?? {}
  const url =
    (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
    (typeof meta.picture === 'string' && meta.picture) ||
    null
  return url
}

/** Person id linked to this account (set in app_metadata when claiming a node). */
export function linkedPersonIdFromUser(user: User): string | null {
  const app = user.app_metadata ?? {}
  const id = app.linked_person_id
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

/** Find the tree person that represents this signed-in user. */
export function personProfileForUser(
  user: User,
  profiles: Record<string, PersonProfile>,
): PersonProfile | null {
  const linked = linkedPersonIdFromUser(user)
  if (linked && profiles[linked]) return profiles[linked]!

  const email = user.email?.trim().toLowerCase()
  if (email) {
    const byEmail = Object.values(profiles).find(
      (p) => p.email?.trim().toLowerCase() === email,
    )
    if (byEmail) return byEmail
  }
  return null
}

/** Avatar: linked person photo in the open tree, else auth metadata. */
export function avatarUrlForUserInTree(
  user: User,
  profiles: Record<string, PersonProfile> | null | undefined,
): string | null {
  if (profiles) {
    const person = personProfileForUser(user, profiles)
    if (person?.photoUrl) return person.photoUrl
  }
  return avatarUrlFromUser(user)
}
