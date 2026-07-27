import type { PersonProfile } from '../types'

export function parseYear(value: string | undefined): number | null {
  if (!value?.trim()) return null
  const match = value.trim().match(/^(\d{4})/)
  if (!match) return null
  const year = Number(match[1])
  if (!Number.isFinite(year) || year < 1000 || year > 3000) return null
  return year
}

/**
 * Parent must be born strictly before child when both years are known.
 * Throws a Swedish Error suitable for form UI.
 */
export function assertParentBornBeforeChild(
  parentBirthYear: string | undefined,
  childBirthYear: string | undefined,
): void {
  const parentYear = parseYear(parentBirthYear)
  const childYear = parseYear(childBirthYear)
  if (parentYear == null || childYear == null) return
  if (parentYear >= childYear) {
    throw new Error(
      `En förälder måste vara född före sitt barn (${parentYear} är inte före ${childYear}).`,
    )
  }
}

/** Card/list label: age if living, year span if deceased. */
export function personLifeLabel(
  profile: Pick<PersonProfile, 'birthYear' | 'deathYear'> | undefined,
  now = new Date(),
): string | null {
  if (!profile) return null
  const birth = parseYear(profile.birthYear)
  const death = parseYear(profile.deathYear)

  if (birth != null && death != null) {
    return `${birth}–${death}`
  }

  if (birth != null && !profile.deathYear?.trim()) {
    const age = now.getFullYear() - birth
    if (age < 0 || age > 130) return String(birth)
    return `${age} år`
  }

  if (death != null) return `† ${death}`
  return null
}
