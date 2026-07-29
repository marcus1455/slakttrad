import { useMemo, useState } from 'react'
import { personLifeLabel, parseYear } from '../lib/personLife'
import type { FamilyStore, PersonProfile } from '../types'
import './FamilyMemoryPanel.css'

type Props = {
  store: FamilyStore
  selectedId: string | null
  focusId: string
  onCenter: (id: string) => void
}

type MemoryEvent = {
  key: string
  date: string
  title: string
  detail?: string
}

function firstName(name: string | undefined, fallback = 'Personen') {
  if (!name?.trim()) return fallback
  return name.trim().split(/\s+/)[0] ?? fallback
}

function ageText(profile: PersonProfile | undefined): string | null {
  const life = personLifeLabel(profile)
  if (!life) return null
  return life
}

function collectEvents(profile: PersonProfile | undefined): MemoryEvent[] {
  if (!profile) return []
  const events: MemoryEvent[] = []
  for (const event of profile.events ?? []) {
    events.push({
      key: event.id,
      date: event.date?.trim() || '',
      title: event.title?.trim() || event.type,
      detail: event.place?.trim() || event.notes?.trim() || undefined,
    })
  }
  if (profile.birthYear?.trim() || profile.birthDate?.trim()) {
    events.push({
      key: 'birth',
      date: profile.birthDate?.trim() || profile.birthYear?.trim() || '',
      title: 'Född',
      detail: profile.birthPlace?.trim() || undefined,
    })
  }
  if (profile.deathYear?.trim() || profile.deathDate?.trim()) {
    events.push({
      key: 'death',
      date: profile.deathDate?.trim() || profile.deathYear?.trim() || '',
      title: 'Avliden',
      detail: profile.deathPlace?.trim() || undefined,
    })
  }
  events.sort((a, b) => {
    const ay = parseYear(a.date) ?? 9999
    const by = parseYear(b.date) ?? 9999
    if (ay !== by) return ay - by
    return a.title.localeCompare(b.title, 'sv')
  })
  return events.slice(0, 6)
}

function createStory(
  profile: PersonProfile | undefined,
  relCounts: { parents: number; siblings: number; children: number; spouses: number },
): string {
  const name = firstName(profile?.name)
  const life = ageText(profile)
  const parts: string[] = []
  if (life) parts.push(`${name} är ${life.toLowerCase()}.`)
  if (relCounts.parents > 0) {
    parts.push(`${name} är kopplad till ${relCounts.parents} förälder${relCounts.parents > 1 ? 'ar' : ''}.`)
  }
  if (relCounts.siblings > 0) {
    parts.push(`${relCounts.siblings} syskon finns i grenen.`)
  }
  if (relCounts.spouses > 0) {
    parts.push(`${name} har ${relCounts.spouses} partnerkoppling${relCounts.spouses > 1 ? 'ar' : ''}.`)
  }
  if (relCounts.children > 0) {
    parts.push(`${name} har ${relCounts.children} barn i trädet.`)
  }
  if (parts.length === 0) return `${name} är ännu en ny punkt i familjens berättelse. Lägg till relationer eller händelser för mer kontext.`
  return parts.join(' ')
}

export function FamilyMemoryPanel({ store, selectedId, focusId, onCenter }: Props) {
  const [collapsed, setCollapsed] = useState(true)
  const subjectId = selectedId ?? focusId
  const node = store.nodes.find((n) => n.id === subjectId)
  const profile = store.profiles[subjectId]
  const relativeIds = useMemo(() => {
    if (!node) return [] as string[]
    return [...node.parents, ...node.spouses, ...node.siblings, ...node.children]
      .map((r) => r.id)
      .filter((id, i, arr) => arr.indexOf(id) === i)
      .slice(0, 8)
  }, [node])

  if (!profile || !node) return null

  const events = collectEvents(profile)
  const photoIds = [subjectId, ...relativeIds].filter((id, i, arr) => arr.indexOf(id) === i)
  const photos = photoIds
    .map((id) => store.profiles[id])
    .filter((p): p is PersonProfile => Boolean(p?.photoUrl))
    .slice(0, 6)

  const relCounts = {
    parents: node.parents.length,
    siblings: node.siblings.length,
    children: node.children.length,
    spouses: node.spouses.length,
  }
  const story = createStory(profile, relCounts)

  if (collapsed) {
    return (
      <button
        type="button"
        className="family-memory family-memory--collapsed"
        onClick={() => setCollapsed(false)}
        title="Visa family memory"
      >
        <span className="family-memory__eyebrow">Family memory</span>
        <span className="family-memory__collapsed-title">{firstName(profile.name)}s gren</span>
      </button>
    )
  }

  return (
    <aside className="family-memory" aria-label="Familjeminne">
      <button
        type="button"
        className="family-memory__close"
        onClick={() => setCollapsed(true)}
        aria-label="Fäll ihop family memory"
      >
        ×
      </button>
      <p className="family-memory__eyebrow">Family memory</p>
      <h3>{firstName(profile.name)}s gren</h3>
      <p className="family-memory__story">{story}</p>

      {photos.length > 0 ? (
        <div className="family-memory__photos" aria-label="Bilder i grenen">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              className="family-memory__photo"
              title={p.name}
              onClick={() => onCenter(p.id)}
            >
              <img src={p.photoUrl} alt="" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="family-memory__timeline">
        <p className="family-memory__section-title">Små händelser</p>
        {events.length > 0 ? (
          <ul>
            {events.map((event) => (
              <li key={event.key}>
                <span className="family-memory__event-date">{event.date || '—'}</span>
                <span className="family-memory__event-title">{event.title}</span>
                {event.detail ? <span className="family-memory__event-detail">{event.detail}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="family-memory__empty">Lägg till händelser för att bygga en tidslinje.</p>
        )}
      </div>
    </aside>
  )
}

