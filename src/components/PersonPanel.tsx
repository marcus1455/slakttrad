import { useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { inviteTreeCollaborator } from '../lib/storage'
import type { FamilyStore, Gender } from '../types'
import { removePersonPhoto, uploadPersonPhoto } from '../lib/photos'
import { personLifeLabel } from '../lib/personLife'
import {
  addChild,
  addParent,
  addPartner,
  removePerson,
  unlinkParent,
  unlinkSpouse,
  updateProfile,
} from '../lib/relations'
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
  onPersonCreated?: (id: string) => void
  onPersonDeleted?: (next: FamilyStore, removedId: string) => void
}

type Mode = 'edit' | 'partner' | 'child' | 'parent'

const emptyForm = {
  name: '',
  nickname: '',
  birthYear: '',
  occupation: '',
  gender: 'female' as Gender,
}

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
  onPersonCreated,
  onPersonDeleted,
}: Props) {
  const { user } = useAuth()
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
      if (mode === 'partner') next = addPartner(store, selectedId, form)
      if (mode === 'child') next = addChild(store, selectedId, form)
      if (mode === 'parent') next = addParent(store, selectedId, form)
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

  const onRemove = () => {
    if (
      !confirm(
        `Ta bort ${profile.name} från trädet? Relationen till andra personer tas bort.`,
      )
    ) {
      return
    }
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
  const isDeceased = Boolean(profile.deathYear?.trim())
  // Contact is for living people; empty fields only while editing.
  const showEmail =
    !isDeceased && (Boolean(profile.email?.trim()) || !readOnly)
  const showPhone =
    !isDeceased && (Boolean(profile.phone?.trim()) || !readOnly)
  const normalizedEmail = profile.email?.trim().toLowerCase() ?? ''
  const hasValidEmail = isValidEmail(normalizedEmail)
  const canInviteThisPerson =
    !readOnly && canInvitePerson && !!treeId && hasValidEmail
  const isCurrentUsersProfile =
    hasValidEmail && normalizedEmail === user?.email?.trim().toLowerCase()

  const onInvitePerson = async () => {
    if (!treeId || !hasValidEmail) return
    setInviteBusy(true)
    setInviteOk(null)
    setError(null)
    try {
      await inviteTreeCollaborator(treeId, normalizedEmail, 'editor')
      setInviteOk(
        `Inbjudan skickad till ${normalizedEmail}. När personen loggar in med samma e-post kopplas kontot hit.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte bjuda in personen')
    } finally {
      setInviteBusy(false)
    }
  }

  return (
    <aside className="person-panel">
      <header className="person-panel__header">
        <div>
          <p className="person-panel__eyebrow">{readOnly ? 'Visningsläge' : 'Person'}</p>
          <h2>{profile.name}</h2>
          {profile.nickname?.trim() ? (
            <p className="person-panel__nickname">
              Smeknamn: {profile.nickname.trim()}
            </p>
          ) : null}
          {relationLabel ? (
            <p className="person-panel__relation">{relationLabel}</p>
          ) : null}
          {life ? <p className="person-panel__years">{life}</p> : null}
        </div>
        <button type="button" className="person-panel__close" onClick={onClose}>
          Stäng
        </button>
      </header>

      {mode === 'edit' || readOnly ? (
        <div className="person-panel__form">
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
                <span>{profile.name.slice(0, 1)}</span>
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

          <div className="person-panel__row">
            <label>
              Födelseår
              <input
                value={profile.birthYear ?? ''}
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
          </div>

          <label>
            Födelseort
            <input
              value={profile.birthPlace ?? ''}
              placeholder="Stad, land…"
              readOnly={readOnly}
              onChange={(e) =>
                !readOnly &&
                patch(store, selectedId, onChange, { birthPlace: e.target.value })
              }
            />
          </label>

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

          {isCurrentUsersProfile ? (
            <p className="person-panel__claim-note">Kopplad till det inloggade kontot.</p>
          ) : null}

          {canInviteThisPerson ? (
            <div className="person-panel__invite">
              <button type="button" disabled={inviteBusy} onClick={() => void onInvitePerson()}>
                {inviteBusy ? 'Bjuder in…' : 'Bjud in denna person'}
              </button>
              <p>
                Personen bjuds in med e-posten ovan och kopplas till den här profilen efter
                inloggning.
              </p>
            </div>
          ) : null}

          {inviteOk ? <p className="person-panel__ok">{inviteOk}</p> : null}

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

          <label>
            Anteckningar
            <textarea
              rows={4}
              value={profile.notes ?? ''}
              placeholder={readOnly ? '' : 'Berättelser, minnen, källor…'}
              readOnly={readOnly}
              onChange={(e) =>
                !readOnly &&
                patch(store, selectedId, onChange, { notes: e.target.value })
              }
            />
          </label>

          {error ? <p className="person-panel__error">{error}</p> : null}

          <div className="person-panel__actions">
            <button type="button" className="ghost" onClick={() => onCenter(selectedId)}>
              Visa i trädet
            </button>
            {!readOnly ? (
              <button
                type="button"
                disabled={store.rootId === selectedId}
                onClick={() => onSetFocus(selectedId)}
              >
                {store.rootId === selectedId ? 'Är centrum' : 'Gör till centrum'}
              </button>
            ) : null}
          </div>

          {!readOnly ? (
            <div className="person-panel__links">
              <p>Familjeband</p>
              {node.parents.length === 0 &&
              node.spouses.length === 0 &&
              node.children.length === 0 ? (
                <span className="person-panel__link-empty">Inga band ännu</span>
              ) : null}
              {node.parents.map((parent) => (
                <div key={parent.id} className="person-panel__link-row">
                  <button type="button" className="text" onClick={() => onCenter(parent.id)}>
                    Förälder: {store.profiles[parent.id]?.name ?? parent.id}
                  </button>
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
              ))}
              {node.spouses.map((spouse) => (
                <div key={spouse.id} className="person-panel__link-row">
                  <button type="button" className="text" onClick={() => onCenter(spouse.id)}>
                    Partner: {store.profiles[spouse.id]?.name ?? spouse.id}
                  </button>
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
              ))}
              {node.children.map((child) => (
                <div key={child.id} className="person-panel__link-row">
                  <button type="button" className="text" onClick={() => onCenter(child.id)}>
                    Barn: {store.profiles[child.id]?.name ?? child.id}
                  </button>
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
              ))}
            </div>
          ) : null}

          {!readOnly ? (
            <div className="person-panel__add">
              <p>Lägg till relation</p>
              <div className="person-panel__add-row">
                <button
                  type="button"
                  disabled={node.spouses.length > 0}
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
