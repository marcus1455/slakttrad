import { useEffect, useRef, useState, useCallback, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useAuth } from '../lib/auth'
import { useConfirm } from '../lib/confirm'
import { inviteTreeCollaborator } from '../lib/storage'
import { supabase } from '../lib/supabase'
import type { FamilyStore, Gender, CivilStatus, LifeEvent, LifeEventType } from '../types'
import { removePersonPhoto, uploadPersonPhoto } from '../lib/photos'
import { personLifeLabel, yearStringFrom } from '../lib/personLife'
import {
  addChild,
  addParent,
  addPartner,
  parentChildTypeLabel,
  removePerson,
  setParentChildRelationType,
  setSpouseRelationType,
  soleSpouseId,
  spouseTypeLabel,
  unlinkParent,
  unlinkSpouse,
  updateProfile,
  type ParentChildRelType,
  type SpouseRelType,
} from '../lib/relations'
import { PlaceInput } from './PlaceInput'
import './PersonPanel.css'

type Props = {
  store: FamilyStore
  selectedId: string
  treeSlug: string
  treeId?: string
  readOnly?: boolean
  canInvitePerson?: boolean
  relationLabel?: string | null
  onChange: (next: FamilyStore) => void
  onClose: () => void
  onCenter: (id: string) => void
  onSetFocus: (id: string) => void
  /** False for collaborators — shared tree centrum is owner-only. */
  canSetTreeFocus?: boolean
  onPersonCreated?: (id: string) => void
  onPersonDeleted?: (next: FamilyStore, removedId: string) => void
}

type Mode = 'edit' | 'partner' | 'child' | 'parent'
type PanelTab = 'profile' | 'life' | 'contact' | 'links'

const PANEL_TABS: { id: PanelTab; label: string }[] = [
  { id: 'profile', label: 'Översikt' },
  { id: 'life', label: 'Liv' },
  { id: 'contact', label: 'Kontakt' },
  { id: 'links', label: 'Band' },
]

const emptyForm = {
  name: '',
  nickname: '',
  birthYear: '',
  occupation: '',
  gender: 'female' as Gender,
  spouseType: 'married' as SpouseRelType,
  linkType: 'blood' as ParentChildRelType,
}

const EVENT_TYPES: { value: LifeEventType; label: string }[] = [
  { value: 'marriage', label: 'Giftermål' },
  { value: 'divorce', label: 'Skilsmässa' },
  { value: 'education', label: 'Utbildning' },
  { value: 'career', label: 'Karriär' },
  { value: 'move', label: 'Flytt' },
  { value: 'other', label: 'Övrigt' },
]

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function patch(
  store: FamilyStore,
  id: string,
  onChange: (next: FamilyStore) => void,
  fields: Parameters<typeof updateProfile>[2],
) {
  onChange(updateProfile(store, id, fields))
}

function tryPatch(
  store: FamilyStore,
  id: string,
  onChange: (next: FamilyStore) => void,
  fields: Parameters<typeof updateProfile>[2],
  onError: (message: string) => void,
) {
  try {
    onChange(updateProfile(store, id, fields))
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Kunde inte spara')
  }
}

function newEventId() {
  return crypto.randomUUID().slice(0, 8)
}

export function PersonPanel({
  store,
  selectedId,
  treeSlug,
  treeId,
  readOnly = false,
  canInvitePerson = false,
  relationLabel,
  onChange,
  onClose,
  onCenter,
  onSetFocus,
  canSetTreeFocus = true,
  onPersonCreated,
  onPersonDeleted,
}: Props) {
  const { user } = useAuth()
  const confirm = useConfirm()
  const profile = store.profiles[selectedId]
  const node = store.nodes.find((n) => n.id === selectedId)
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>('edit')
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteOk, setInviteOk] = useState<string | null>(null)
  const [claimBusy, setClaimBusy] = useState(false)
  const [eventDraft, setEventDraft] = useState({
    type: 'other' as LifeEventType,
    date: '',
    place: '',
    title: '',
  })
  const [panelTab, setPanelTab] = useState<PanelTab>('profile')

  useEffect(() => {
    setPanelTab('profile')
  }, [selectedId])

  if (!profile || !node) return null

  const startAdd = (next: Mode, defaultGender: Gender) => {
    setMode(next)
    setError(null)
    setForm({ ...emptyForm, gender: defaultGender })
  }

  const onAdd = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const before = new Set(Object.keys(store.profiles))
      let next = store
      if (mode === 'partner') {
        next = addPartner(store, selectedId, form, { spouseType: form.spouseType })
      }
      if (mode === 'child') {
        const coParentId = soleSpouseId(store, selectedId)
        next = addChild(store, selectedId, form, {
          linkType: form.linkType,
          ...(coParentId ? { coParentId } : {}),
        })
      }
      if (mode === 'parent') {
        next = addParent(store, selectedId, form, { linkType: form.linkType })
      }
      const createdId = Object.keys(next.profiles).find((id) => !before.has(id))
      onChange(next)
      if (createdId) {
        onPersonCreated?.(createdId)
      }
      setMode('edit')
      setForm(emptyForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte lägga till')
    }
  }

  const onPickPhoto = async (file: File | undefined) => {
    if (!file || readOnly) return
    setUploading(true)
    setError(null)
    try {
      const photoUrl = await uploadPersonPhoto(treeSlug, selectedId, file)
      if (profile.photoUrl) {
        void removePersonPhoto(profile.photoUrl)
      }
      patch(store, selectedId, onChange, { photoUrl })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda upp bilden')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onRemovePhoto = async () => {
    if (!profile.photoUrl || readOnly) return
    setUploading(true)
    setError(null)
    try {
      await removePersonPhoto(profile.photoUrl)
      patch(store, selectedId, onChange, { photoUrl: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ta bort bilden')
    } finally {
      setUploading(false)
    }
  }

  const onRemove = async () => {
    const ok = await confirm({
      title: `Ta bort ${profile.name}?`,
      message: 'Personen tas bort från trädet. Relationen till andra personer tas bort.',
      confirmLabel: 'Ta bort',
      danger: true,
    })
    if (!ok) return
    try {
      const next = removePerson(store, selectedId)
      onPersonDeleted?.(next, selectedId)
      onChange(next)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ta bort')
    }
  }

  const life = personLifeLabel(profile)
  const isDeceased =
    Boolean(profile.deathYear?.trim()) || Boolean(profile.deathDate?.trim())
  const showEmail =
    !isDeceased && (Boolean(profile.email?.trim()) || !readOnly)
  const showPhone =
    !isDeceased && (Boolean(profile.phone?.trim()) || !readOnly)
  const normalizedEmail = profile.email?.trim().toLowerCase() ?? ''
  const hasValidEmail = isValidEmail(normalizedEmail)
  const isClaimedByMe = Boolean(user && profile.claimedByUserId === user.id)
  const isClaimedByOther =
    Boolean(profile.claimedByUserId) && profile.claimedByUserId !== user?.id
  const emailMatchesUser =
    hasValidEmail && normalizedEmail === user?.email?.trim().toLowerCase()
  const isCurrentUsersProfile = emailMatchesUser || isClaimedByMe
  const canInviteThisPerson =
    !readOnly && canInvitePerson && !!treeId && hasValidEmail && !isCurrentUsersProfile
  const canClaim =
    !readOnly && !!user && emailMatchesUser && !isClaimedByMe && !isClaimedByOther

  const onInvitePerson = async () => {
    if (!treeId || !hasValidEmail) return
    setInviteBusy(true)
    setInviteOk(null)
    setError(null)
    try {
      await inviteTreeCollaborator(treeId, normalizedEmail, 'editor')
      patch(store, selectedId, onChange, { invitedEmail: normalizedEmail })
      setInviteOk(
        `Inbjudan skickad till ${normalizedEmail}. När personen loggar in kan hen koppla kontot till den här profilen.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte bjuda in personen')
    } finally {
      setInviteBusy(false)
    }
  }

  const onClaimPerson = async () => {
    if (!user) return
    setClaimBusy(true)
    setError(null)
    try {
      // Clear previous claim on another person in this tree
      let next = store
      for (const p of Object.values(store.profiles)) {
        if (p.claimedByUserId === user.id && p.id !== selectedId) {
          next = updateProfile(next, p.id, { claimedByUserId: '' })
        }
      }
      next = updateProfile(next, selectedId, {
        claimedByUserId: user.id,
        email: user.email ?? profile.email,
      })
      onChange(next)
      await supabase.auth.updateUser({
        data: {
          linked_person_id: selectedId,
          full_name: profile.name,
        },
      })
      setInviteOk('Du är nu kopplad till den här personen.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte koppla kontot')
    } finally {
      setClaimBusy(false)
    }
  }

  const events = profile.events ?? []

  const addEvent = () => {
    if (readOnly) return
    const event: LifeEvent = {
      id: newEventId(),
      type: eventDraft.type,
      date: eventDraft.date.trim() || undefined,
      place: eventDraft.place.trim() || undefined,
      title: eventDraft.title.trim() || undefined,
    }
    patch(store, selectedId, onChange, { events: [...events, event] })
    setEventDraft({ type: 'other', date: '', place: '', title: '' })
  }

  const removeEvent = (eventId: string) => {
    patch(store, selectedId, onChange, {
      events: events.filter((e) => e.id !== eventId),
    })
  }

  const eventLabel = (type: LifeEventType) =>
    EVENT_TYPES.find((t) => t.value === type)?.label ?? type

  const panelRef = useRef<HTMLElement>(null)
  const dragStartY = useRef<number>(0)
  const isDragging = useRef<boolean>(false)

  const onHandlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartY.current = e.clientY
    isDragging.current = true
  }, [])

  const onHandlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || !panelRef.current) return
    const dy = e.clientY - dragStartY.current
    if (dy > 0) {
      panelRef.current.style.transform = `translateY(${dy}px)`
      panelRef.current.style.transition = 'none'
    }
  }, [])

  const onHandlePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || !panelRef.current) return
    isDragging.current = false
    const dy = e.clientY - dragStartY.current
    panelRef.current.style.transform = ''
    panelRef.current.style.transition = ''
    if (dy > 100) {
      onClose()
    }
  }, [onClose])

  return (
    <aside className="person-panel" ref={panelRef}>
      <div
        className="person-panel__drag-handle"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        aria-hidden
      />
      <header className="person-panel__header">
        <div>
          <p className="person-panel__eyebrow">{readOnly ? 'Visningsläge' : 'Person'}</p>
          <h2>{profile.name}</h2>
          {profile.nickname?.trim() ? (
            <p className="person-panel__nickname">
              Smeknamn: {profile.nickname.trim()}
            </p>
          ) : null}
          {profile.maidenName?.trim() ? (
            <p className="person-panel__nickname">
              Flicknamn: {profile.maidenName.trim()}
            </p>
          ) : null}
          {relationLabel ? (
            <p className="person-panel__relation">{relationLabel}</p>
          ) : null}
          {life ? <p className="person-panel__years">{life}</p> : null}
        </div>
        <button
          type="button"
          className="person-panel__close"
          aria-label="Stäng"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      {mode === 'edit' || readOnly ? (
        <>
          <div className="person-panel__tabs" role="tablist" aria-label="Personflikar">
            {PANEL_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={panelTab === tab.id}
                className={
                  panelTab === tab.id
                    ? 'person-panel__tab person-panel__tab--active'
                    : 'person-panel__tab'
                }
                onClick={() => setPanelTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="person-panel__form">
            <div
              role="tabpanel"
              hidden={panelTab !== 'profile'}
              className="person-panel__tab-panel"
            >
              <div
                className={[
                  'person-panel__photo',
                  dragOver ? 'person-panel__photo--drag' : '',
                  readOnly ? '' : 'person-panel__photo--droppable',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onDragEnter={(e) => {
                  if (readOnly) return
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOver(true)
                }}
                onDragOver={(e) => {
                  if (readOnly) return
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOver(true)
                }}
                onDragLeave={(e) => {
                  if (readOnly) return
                  e.preventDefault()
                  e.stopPropagation()
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setDragOver(false)
                  }
                }}
                onDrop={(e) => {
                  if (readOnly) return
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOver(false)
                  const file = e.dataTransfer.files?.[0]
                  void onPickPhoto(file)
                }}
              >
                <div className="person-panel__photo-frame">
                  {profile.photoUrl ? (
                    <img src={profile.photoUrl} alt={profile.name} />
                  ) : (
                    <span className="person-panel__photo-empty" aria-hidden>
                      <svg viewBox="0 0 24 24" width="22" height="22">
                        <path
                          fill="currentColor"
                          d="M4 5.5A2.5 2.5 0 0 1 6.5 3h2.1l.7-1.2A1.5 1.5 0 0 1 10.6 1h2.8a1.5 1.5 0 0 1 1.3.8L15.4 3h2.1A2.5 2.5 0 0 1 20 5.5v11A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-11Zm8 10.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0-1.8a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8Z"
                        />
                      </svg>
                    </span>
                  )}
                </div>
                {!readOnly ? (
                  <div className="person-panel__photo-actions">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      hidden
                      onChange={(e) => void onPickPhoto(e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                    >
                      {uploading
                        ? 'Laddar upp…'
                        : dragOver
                          ? 'Släpp bilden här'
                          : profile.photoUrl
                            ? 'Byt bild'
                            : 'Lägg till bild'}
                    </button>
                    <p className="person-panel__photo-hint">
                      Dra in en bild eller klicka för att välja
                    </p>
                    {profile.photoUrl ? (
                      <button
                        type="button"
                        className="ghost"
                        disabled={uploading}
                        onClick={() => void onRemovePhoto()}
                      >
                        Ta bort
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <label>
                Namn
                <input
                  value={profile.name}
                  readOnly={readOnly}
                  onChange={(e) =>
                    !readOnly && patch(store, selectedId, onChange, { name: e.target.value })
                  }
                />
              </label>

              <label>
                Smeknamn
                <input
                  value={profile.nickname ?? ''}
                  placeholder="Tilltalsnamn…"
                  readOnly={readOnly}
                  onChange={(e) =>
                    !readOnly &&
                    patch(store, selectedId, onChange, { nickname: e.target.value })
                  }
                />
              </label>

              <label>
                Flicknamn / tidigare efternamn
                <input
                  value={profile.maidenName ?? ''}
                  placeholder="t.ex. Norden"
                  readOnly={readOnly}
                  onChange={(e) =>
                    !readOnly &&
                    patch(store, selectedId, onChange, { maidenName: e.target.value })
                  }
                />
              </label>

              <label>
                Även känd som
                <input
                  value={profile.alsoKnownAs ?? ''}
                  placeholder="Andra namn…"
                  readOnly={readOnly}
                  onChange={(e) =>
                    !readOnly &&
                    patch(store, selectedId, onChange, { alsoKnownAs: e.target.value })
                  }
                />
              </label>

              <label>
                Kön
                <select
                  value={profile.gender}
                  disabled={readOnly}
                  onChange={(e) =>
                    !readOnly &&
                    patch(store, selectedId, onChange, {
                      gender: e.target.value as Gender,
                    })
                  }
                >
                  <option value="female">Kvinna</option>
                  <option value="male">Man</option>
                </select>
              </label>

              {isCurrentUsersProfile ? (
                <p className="person-panel__claim-note">Kopplad till det inloggade kontot.</p>
              ) : isClaimedByOther ? (
                <p className="person-panel__claim-note">Kopplad till ett annat konto.</p>
              ) : null}

              {canClaim ? (
                <div className="person-panel__invite">
                  <button type="button" disabled={claimBusy} onClick={() => void onClaimPerson()}>
                    {claimBusy ? 'Kopplar…' : 'Det här är jag'}
                  </button>
                  <p>Koppla ditt konto till den här personen i trädet.</p>
                </div>
              ) : null}

              {canInviteThisPerson ? (
                <div className="person-panel__invite">
                  <button type="button" disabled={inviteBusy} onClick={() => void onInvitePerson()}>
                    {inviteBusy ? 'Bjuder in…' : 'Bjud in denna person'}
                  </button>
                  <p>
                    Personen bjuds in med profilens e-post och kan koppla kontot till den här
                    profilen efter inloggning.
                  </p>
                </div>
              ) : null}

              {inviteOk ? <p className="person-panel__ok">{inviteOk}</p> : null}

              <div className="person-panel__actions">
                <button type="button" className="ghost" onClick={() => onCenter(selectedId)}>
                  Visa i trädet
                </button>
                {!readOnly && canSetTreeFocus ? (
                  <button
                    type="button"
                    disabled={store.rootId === selectedId}
                    onClick={() => onSetFocus(selectedId)}
                  >
                    {store.rootId === selectedId ? 'Är centrum' : 'Gör till centrum'}
                  </button>
                ) : null}
              </div>
            </div>

            <div
              role="tabpanel"
              hidden={panelTab !== 'life'}
              className="person-panel__tab-panel"
            >
              <p className="person-panel__section">Födelse &amp; död</p>

              <div className="person-panel__row">
                <label>
                  Födelseår
                  <input
                    value={profile.birthYear ?? ''}
                    placeholder="1923"
                    readOnly={readOnly}
                    onChange={(e) => {
                      if (readOnly) return
                      setError(null)
                      tryPatch(
                        store,
                        selectedId,
                        onChange,
                        { birthYear: e.target.value },
                        setError,
                      )
                    }}
                  />
                </label>
                <label>
                  Födelsedatum
                  <input
                    value={profile.birthDate ?? ''}
                    placeholder="1923-03-14"
                    readOnly={readOnly}
                    onChange={(e) => {
                      if (readOnly) return
                      setError(null)
                      const birthDate = e.target.value
                      const year = yearStringFrom(birthDate)
                      tryPatch(
                        store,
                        selectedId,
                        onChange,
                        {
                          birthDate,
                          ...(year && !profile.birthYear?.trim() ? { birthYear: year } : {}),
                        },
                        setError,
                      )
                    }}
                  />
                </label>
              </div>

              <div className="person-panel__row">
                <label>
                  Dödsår
                  <input
                    value={profile.deathYear ?? ''}
                    placeholder="—"
                    readOnly={readOnly}
                    onChange={(e) =>
                      !readOnly &&
                      patch(store, selectedId, onChange, { deathYear: e.target.value })
                    }
                  />
                </label>
                <label>
                  Dödsdatum
                  <input
                    value={profile.deathDate ?? ''}
                    placeholder="1946-01-20"
                    readOnly={readOnly}
                    onChange={(e) => {
                      if (readOnly) return
                      const deathDate = e.target.value
                      const year = yearStringFrom(deathDate)
                      patch(store, selectedId, onChange, {
                        deathDate,
                        ...(year && !profile.deathYear?.trim() ? { deathYear: year } : {}),
                      })
                    }}
                  />
                </label>
              </div>

              <div className="person-panel__row">
                <PlaceInput
                  label="Födelseort"
                  value={profile.birthPlace ?? ''}
                  placeholder="Stad…"
                  readOnly={readOnly}
                  onChange={(birthPlace) =>
                    !readOnly && patch(store, selectedId, onChange, { birthPlace })
                  }
                />
                <PlaceInput
                  label="Födelse land"
                  value={profile.birthCountry ?? ''}
                  placeholder="Sverige"
                  readOnly={readOnly}
                  onChange={(birthCountry) =>
                    !readOnly && patch(store, selectedId, onChange, { birthCountry })
                  }
                />
              </div>

              {isDeceased ||
              profile.deathPlace ||
              profile.deathCountry ||
              profile.deathDate ||
              !readOnly ? (
                <div className="person-panel__row">
                  <PlaceInput
                    label="Dödsort"
                    value={profile.deathPlace ?? ''}
                    placeholder="Stad…"
                    readOnly={readOnly}
                    onChange={(deathPlace) =>
                      !readOnly && patch(store, selectedId, onChange, { deathPlace })
                    }
                  />
                  <PlaceInput
                    label="Dödsland"
                    value={profile.deathCountry ?? ''}
                    placeholder="Sverige"
                    readOnly={readOnly}
                    onChange={(deathCountry) =>
                      !readOnly && patch(store, selectedId, onChange, { deathCountry })
                    }
                  />
                </div>
              ) : null}

              <p className="person-panel__section">Boende &amp; bakgrund</p>

              <div className="person-panel__row">
                <PlaceInput
                  label="Nuvarande ort"
                  value={profile.residencePlace ?? ''}
                  placeholder="Stad…"
                  readOnly={readOnly}
                  onChange={(residencePlace) =>
                    !readOnly && patch(store, selectedId, onChange, { residencePlace })
                  }
                />
                <PlaceInput
                  label="Nuvarande land"
                  value={profile.residenceCountry ?? ''}
                  placeholder="Sverige"
                  readOnly={readOnly}
                  onChange={(residenceCountry) =>
                    !readOnly &&
                    patch(store, selectedId, onChange, { residenceCountry })
                  }
                />
              </div>

              <label>
                Yrke
                <input
                  value={profile.occupation ?? ''}
                  readOnly={readOnly}
                  onChange={(e) =>
                    !readOnly &&
                    patch(store, selectedId, onChange, { occupation: e.target.value })
                  }
                />
              </label>

              <label>
                Civilstånd
                <select
                  value={profile.civilStatus ?? ''}
                  disabled={readOnly}
                  onChange={(e) =>
                    !readOnly &&
                    patch(store, selectedId, onChange, {
                      civilStatus: e.target.value as CivilStatus,
                    })
                  }
                >
                  <option value="">—</option>
                  <option value="single">Ogift</option>
                  <option value="married">Gift</option>
                  <option value="divorced">Frånskild</option>
                  <option value="widowed">Änka / änkling</option>
                </select>
              </label>

              <label>
                Religion / samfund
                <input
                  value={profile.religion ?? ''}
                  placeholder="t.ex. Svenska kyrkan"
                  readOnly={readOnly}
                  onChange={(e) =>
                    !readOnly &&
                    patch(store, selectedId, onChange, { religion: e.target.value })
                  }
                />
              </label>

              <div className="person-panel__events">
                <p>Livshändelser</p>
                {events.length === 0 ? (
                  <span className="person-panel__link-empty">Inga händelser ännu</span>
                ) : (
                  events.map((ev) => (
                    <div key={ev.id} className="person-panel__event-row">
                      <div>
                        <strong>
                          {eventLabel(ev.type)}
                          {ev.title?.trim() ? ` · ${ev.title.trim()}` : ''}
                        </strong>
                        <span>
                          {[ev.date, ev.place].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </div>
                      {!readOnly ? (
                        <button
                          type="button"
                          className="ghost tiny"
                          onClick={() => removeEvent(ev.id)}
                        >
                          Ta bort
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
                {!readOnly ? (
                  <div className="person-panel__event-form">
                    <select
                      value={eventDraft.type}
                      onChange={(e) =>
                        setEventDraft((d) => ({
                          ...d,
                          type: e.target.value as LifeEventType,
                        }))
                      }
                    >
                      {EVENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="År / datum"
                      value={eventDraft.date}
                      onChange={(e) =>
                        setEventDraft((d) => ({ ...d, date: e.target.value }))
                      }
                    />
                    <PlaceInput
                      label="Plats"
                      placeholder="Plats"
                      value={eventDraft.place}
                      onChange={(place) => setEventDraft((d) => ({ ...d, place }))}
                    />
                    <input
                      placeholder="Rubrik (valfritt)"
                      value={eventDraft.title}
                      onChange={(e) =>
                        setEventDraft((d) => ({ ...d, title: e.target.value }))
                      }
                    />
                    <button type="button" onClick={addEvent}>
                      Lägg till händelse
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div
              role="tabpanel"
              hidden={panelTab !== 'contact'}
              className="person-panel__tab-panel"
            >
              {showEmail ? (
                <label>
                  E-post
                  <input
                    type="email"
                    value={profile.email ?? ''}
                    placeholder="namn@exempel.se"
                    readOnly={readOnly}
                    autoComplete="off"
                    onChange={(e) =>
                      !readOnly &&
                      patch(store, selectedId, onChange, { email: e.target.value })
                    }
                  />
                </label>
              ) : null}

              {showPhone ? (
                <label>
                  Telefon
                  <input
                    type="tel"
                    value={profile.phone ?? ''}
                    placeholder="07X XXX XX XX"
                    readOnly={readOnly}
                    autoComplete="off"
                    onChange={(e) =>
                      !readOnly &&
                      patch(store, selectedId, onChange, { phone: e.target.value })
                    }
                  />
                </label>
              ) : null}

              <label>
                Källor
                <textarea
                  rows={3}
                  value={profile.sources ?? ''}
                  placeholder={
                    readOnly ? '' : 'ArkivDigital, kyrkböcker, muntligt, böcker…'
                  }
                  readOnly={readOnly}
                  onChange={(e) =>
                    !readOnly &&
                    patch(store, selectedId, onChange, { sources: e.target.value })
                  }
                />
              </label>

              <label>
                Anteckningar
                <textarea
                  rows={4}
                  value={profile.notes ?? ''}
                  placeholder={readOnly ? '' : 'Berättelser, minnen…'}
                  readOnly={readOnly}
                  onChange={(e) =>
                    !readOnly &&
                    patch(store, selectedId, onChange, { notes: e.target.value })
                  }
                />
              </label>
            </div>

            <div
              role="tabpanel"
              hidden={panelTab !== 'links'}
              className="person-panel__tab-panel"
            >
              {!readOnly ? (
                <div className="person-panel__links">
                  <p>Familjeband</p>
                  {node.parents.length === 0 &&
                  node.spouses.length === 0 &&
                  node.children.length === 0 ? (
                    <span className="person-panel__link-empty">Inga band ännu</span>
                  ) : null}
                  {node.parents.map((parent) => (
                    <div key={parent.id} className="person-panel__link-row person-panel__link-row--stack">
                      <button type="button" className="text" onClick={() => onCenter(parent.id)}>
                        Förälder ({parentChildTypeLabel(parent.type)}):{' '}
                        {store.profiles[parent.id]?.name ?? parent.id}
                      </button>
                      <div className="person-panel__link-tools">
                        <select
                          aria-label="Relationstyp förälder"
                          value={
                            parent.type === 'adopted'
                              ? 'adopted'
                              : parent.type === 'half'
                                ? 'half'
                                : 'blood'
                          }
                          onChange={(e) =>
                            onChange(
                              setParentChildRelationType(
                                store,
                                selectedId,
                                parent.id,
                                e.target.value as ParentChildRelType,
                              ),
                            )
                          }
                        >
                          <option value="blood">Blod</option>
                          <option value="adopted">Adoptiv</option>
                          <option value="half">Halv</option>
                        </select>
                        <button
                          type="button"
                          className="ghost tiny"
                          onClick={() =>
                            onChange(unlinkParent(store, selectedId, parent.id))
                          }
                        >
                          Koppla loss
                        </button>
                      </div>
                    </div>
                  ))}
                  {node.spouses.map((spouse) => (
                    <div key={spouse.id} className="person-panel__link-row person-panel__link-row--stack">
                      <button type="button" className="text" onClick={() => onCenter(spouse.id)}>
                        {spouseTypeLabel(spouse.type)}: {store.profiles[spouse.id]?.name ?? spouse.id}
                      </button>
                      <div className="person-panel__link-tools">
                        <select
                          aria-label="Relationstyp partner"
                          value={spouse.type === 'divorced' ? 'divorced' : 'married'}
                          onChange={(e) =>
                            onChange(
                              setSpouseRelationType(
                                store,
                                selectedId,
                                spouse.id,
                                e.target.value as SpouseRelType,
                              ),
                            )
                          }
                        >
                          <option value="married">Gift / partner</option>
                          <option value="divorced">Frånskild</option>
                        </select>
                        <button
                          type="button"
                          className="ghost tiny"
                          onClick={() =>
                            onChange(unlinkSpouse(store, selectedId, spouse.id))
                          }
                        >
                          Koppla loss
                        </button>
                      </div>
                    </div>
                  ))}
                  {node.children.map((child) => (
                    <div key={child.id} className="person-panel__link-row person-panel__link-row--stack">
                      <button type="button" className="text" onClick={() => onCenter(child.id)}>
                        Barn ({parentChildTypeLabel(child.type)}):{' '}
                        {store.profiles[child.id]?.name ?? child.id}
                      </button>
                      <div className="person-panel__link-tools">
                        <select
                          aria-label="Relationstyp barn"
                          value={
                            child.type === 'adopted'
                              ? 'adopted'
                              : child.type === 'half'
                                ? 'half'
                                : 'blood'
                          }
                          onChange={(e) =>
                            onChange(
                              setParentChildRelationType(
                                store,
                                child.id,
                                selectedId,
                                e.target.value as ParentChildRelType,
                              ),
                            )
                          }
                        >
                          <option value="blood">Blod</option>
                          <option value="adopted">Adoptiv</option>
                          <option value="half">Halv</option>
                        </select>
                        <button
                          type="button"
                          className="ghost tiny"
                          onClick={() =>
                            onChange(unlinkParent(store, child.id, selectedId))
                          }
                        >
                          Koppla loss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {!readOnly ? (
                <div className="person-panel__add">
                  <p>Lägg till relation</p>
                  <div className="person-panel__add-row">
                    <button
                      type="button"
                      onClick={() =>
                        startAdd('partner', profile.gender === 'male' ? 'female' : 'male')
                      }
                    >
                      Partner
                    </button>
                    <button type="button" onClick={() => startAdd('child', 'female')}>
                      Barn
                    </button>
                    <button
                      type="button"
                      disabled={node.parents.length >= 2}
                      onClick={() => startAdd('parent', 'female')}
                    >
                      Förälder
                    </button>
                  </div>
                </div>
              ) : null}

              {!readOnly ? (
                <div className="person-panel__danger">
                  <button type="button" className="danger" onClick={onRemove}>
                    Ta bort person
                  </button>
                </div>
              ) : null}
            </div>

            {error ? <p className="person-panel__error">{error}</p> : null}
          </div>
        </>
      ) : (
        <form className="person-panel__form" onSubmit={onAdd}>
          <p className="person-panel__mode">
            Ny{' '}
            {mode === 'partner' ? 'partner' : mode === 'child' ? 'barn' : 'förälder'}
          </p>
          <label>
            Namn
            <input
              autoFocus
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label>
            Smeknamn
            <input
              value={form.nickname}
              placeholder="Tilltalsnamn…"
              onChange={(e) =>
                setForm((f) => ({ ...f, nickname: e.target.value }))
              }
            />
          </label>
          <label>
            Födelseår
            <input
              value={form.birthYear}
              onChange={(e) => setForm((f) => ({ ...f, birthYear: e.target.value }))}
            />
          </label>
          <label>
            Yrke
            <input
              value={form.occupation}
              onChange={(e) =>
                setForm((f) => ({ ...f, occupation: e.target.value }))
              }
            />
          </label>
          <label>
            Kön
            <select
              value={form.gender}
              onChange={(e) =>
                setForm((f) => ({ ...f, gender: e.target.value as Gender }))
              }
            >
              <option value="female">Kvinna</option>
              <option value="male">Man</option>
            </select>
          </label>
          {mode === 'partner' ? (
            <label>
              Relation
              <select
                value={form.spouseType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    spouseType: e.target.value as SpouseRelType,
                  }))
                }
              >
                <option value="married">Gift / partner</option>
                <option value="divorced">Frånskild</option>
              </select>
            </label>
          ) : null}
          {mode === 'child' || mode === 'parent' ? (
            <label>
              Band
              <select
                value={form.linkType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    linkType: e.target.value as ParentChildRelType,
                  }))
                }
              >
                <option value="blood">Blodsband</option>
                <option value="adopted">Adoption</option>
                <option value="half">Halvsyskon / halv</option>
              </select>
            </label>
          ) : null}
          {error ? <p className="person-panel__error">{error}</p> : null}
          <div className="person-panel__actions">
            <button type="button" className="ghost" onClick={() => setMode('edit')}>
              Avbryt
            </button>
            <button type="submit">Spara</button>
          </div>
        </form>
      )}
    </aside>
  )
}
