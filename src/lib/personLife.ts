import type { PersonProfile } from '../types'

export function parseYear(value: string | undefined): number | null {
  if (!value?.trim()) return null
  const match = value.trim().match(/(\d{4})/)
  if (!match) return null
  const year = Number(match[1])
  if (!Number.isFinite(year) || year < 1000 || year > 3000) return null
  return year
}

/** Extract a 4-digit year string from a date/year field, if present. */
export function yearStringFrom(value: string | undefined): string {
  const y = parseYear(value)
  return y == null ? '' : String(y)
}

export function effectiveBirthYear(profile: PersonProfile | undefined): string | undefined {
  if (!profile) return undefined
  const fromYear = profile.birthYear?.trim()
  if (fromYear) return fromYear
  const fromDate = yearStringFrom(profile.birthDate)
  return fromDate || undefined
}

export function effectiveDeathYear(profile: PersonProfile | undefined): string | undefined {
  if (!profile) return undefined
  const fromYear = profile.deathYear?.trim()
  if (fromYear) return fromYear
  const fromDate = yearStringFrom(profile.deathDate)
  return fromDate || undefined
}

export function formatPlace(
  place: string | undefined,
  country: string | undefined,
): string {
  return [place?.trim(), country?.trim()].filter(Boolean).join(', ')
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
  profile:
    | Pick<PersonProfile, 'birthYear' | 'deathYear' | 'birthDate' | 'deathDate'>
    | undefined,
  now = new Date(),
): string | null {
  if (!profile) return null
  const birth = parseYear(profile.birthYear) ?? parseYear(profile.birthDate)
  const death = parseYear(profile.deathYear) ?? parseYear(profile.deathDate)
  const hasDeath =
    Boolean(profile.deathYear?.trim()) || Boolean(profile.deathDate?.trim())

  if (birth != null && death != null) {
    return `${birth}–${death}`
  }

  if (birth != null && !hasDeath) {
    const age = now.getFullYear() - birth
    if (age < 0 || age > 130) return String(birth)
    return `${age} år`
  }

  if (death != null) return `† ${death}`
  return null
}
