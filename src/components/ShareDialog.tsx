import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { useConfirm } from '../lib/confirm'
import {
  inviteTreeCollaborator,
  listTreeCollaborators,
  removeTreeCollaborator,
  rotateShareToken,
  setTreeCollaboratorRole,
  type CollaboratorRole,
  type TreeCollaborator,
  type InviteMeta,
} from '../lib/storage'
import { useFocusTrap } from '../lib/useFocusTrap'
import type { TreeMeta } from '../types'
import {
  avatarUrlFromUser,
  displayNameFromUser,
  initialsFromName,
} from '../lib/userDisplay'
import './ShareDialog.css'

type Props = {
  url: string
  treeId: string
  treeSlug: string
  treeName?: string
  /** True when the signed-in user may invite/remove collaborators. */
  canInvite: boolean
  onRotated: (meta: TreeMeta) => void
  onClose: () => void
}

const ROLE_LABELS: Record<CollaboratorRole, string> = {
  editor: 'Kan redigera',
  viewer: 'Kan visa',
}

function LinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      width="16"
      height="16"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
      />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      width="18"
      height="18"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"
      />
    </svg>
  )
}

function AccessAvatar({
  name,
  imageUrl,
}: {
  name: string
  imageUrl?: string | null
}) {
  const [broken, setBroken] = useState(false)
  if (imageUrl && !broken) {
    return (
      <img
        className="share-dialog__avatar"
        src={imageUrl}
        alt=""
        width={32}
        height={32}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    )
  }
  return (
    <span className="share-dialog__avatar share-dialog__avatar--initials" aria-hidden>
      {initialsFromName(name)}
    </span>
  )
}

export function ShareDialog({
  url,
  treeId,
  treeSlug,
  treeName,
  canInvite,
  onRotated,
  onClose,
}: Props) {
  const { user } = useAuth()
  const confirm = useConfirm()
  const cardRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteOk, setInviteOk] = useState<string | null>(null)
  const [rotateBusy, setRotateBusy] = useState(false)
  const [rotateOk, setRotateOk] = useState<string | null>(null)
  const [collaborators, setCollaborators] = useState<TreeCollaborator[]>([])
  const [collabLoading, setCollabLoading] = useState(false)

  const ownerName = user ? displayNameFromUser(user) : 'Ägare'
  const ownerAvatar = user ? avatarUrlFromUser(user) : null
  const title = treeName?.trim() ? `Dela ${treeName.trim()}` : 'Dela träd'
  const canSubmitInvite = inviteEmail.trim().length > 0 && !inviteBusy

  const refreshCollaborators = useCallback(async () => {
    if (!canInvite || !user) {
      setCollaborators([])
      return
    }
    setCollabLoading(true)
    try {
      setCollaborators(await listTreeCollaborators(treeId))
    } catch {
      // Owner may not have loaded yet; ignore soft failures in dialog.
    } finally {
      setCollabLoading(false)
    }
  }, [canInvite, treeId, user])

  useEffect(() => {
    void refreshCollaborators()
  }, [refreshCollaborators])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useFocusTrap(true, cardRef)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Kunde inte kopiera länken')
    }
  }

  const invite = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmitInvite) return
    setInviteBusy(true)
    setInviteOk(null)
    setError(null)
    try {
      const inviteMeta: InviteMeta = {
        inviteeName: inviteEmail.split('@')[0],
        treeName,
        inviterName: user ? displayNameFromUser(user) : undefined,
      }
      const row = await inviteTreeCollaborator(treeId, inviteEmail, 'editor', inviteMeta)
      setInviteEmail('')
      setInviteOk(`${row.email} kan redigera trädet efter inloggning med samma e-post.`)
      await refreshCollaborators()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte bjuda in')
    } finally {
      setInviteBusy(false)
    }
  }

  const changeRole = async (id: string, role: CollaboratorRole) => {
    setError(null)
    try {
      await setTreeCollaboratorRole(id, role)
      await refreshCollaborators()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ändra roll')
    }
  }

  const remove = async (id: string) => {
    setError(null)
    try {
      await removeTreeCollaborator(id)
      await refreshCollaborators()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ta bort')
    }
  }

  const revokeLink = async () => {
    const ok = await confirm({
      title: 'Återkalla delningslänk?',
      message:
        'En ny länk skapas. Den gamla länken slutar fungera för alla som har den.',
      confirmLabel: 'Återkalla',
      danger: true,
    })
    if (!ok) return
    setRotateBusy(true)
    setRotateOk(null)
    setError(null)
    try {
      const next = await rotateShareToken(treeSlug)
      onRotated(next)
      setRotateOk('Ny länk skapad — gamla länken fungerar inte längre.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte återkalla länken')
    } finally {
      setRotateBusy(false)
    }
  }

  return (
    <div className="share-dialog" role="dialog" aria-modal="true" aria-label="Dela träd">
      <div className="share-dialog__card" ref={cardRef}>
        <header className="share-dialog__header">
          <h3 className="share-dialog__title">{title}</h3>
          <div className="share-dialog__header-actions">
            <button
              type="button"
              className="share-dialog__copy"
              onClick={() => void copy()}
            >
              <LinkIcon />
              <span>{copied ? 'Kopierad' : 'Kopiera länk'}</span>
            </button>
            <button
              type="button"
              className="share-dialog__close"
              aria-label="Stäng"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        {canInvite ? (
          <form className="share-dialog__invite" onSubmit={(e) => void invite(e)}>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Lägg till e-postadress för att bjuda in"
              autoComplete="email"
              aria-label="E-post"
            />
            <button type="submit" disabled={!canSubmitInvite}>
              {inviteBusy ? 'Bjuder in…' : 'Bjud in'}
            </button>
          </form>
        ) : user ? null : (
          <p className="share-dialog__lead">
            Logga in som ägare för att bjuda in personer till trädet.
          </p>
        )}

        {inviteOk ? <p className="share-dialog__ok">{inviteOk}</p> : null}

        <section className="share-dialog__access" aria-labelledby="share-access-heading">
          <h4 id="share-access-heading">Vem har åtkomst</h4>

          <ul className="share-dialog__access-list">
            <li className="share-dialog__access-row">
              <div className="share-dialog__access-who">
                <span className="share-dialog__avatar share-dialog__avatar--globe" aria-hidden>
                  <GlobeIcon />
                </span>
                <div className="share-dialog__access-text">
                  <span className="share-dialog__access-name">Alla med länk</span>
                  <span className="share-dialog__access-meta">Kan visa trädet</span>
                </div>
              </div>
              <div className="share-dialog__access-actions">
                <span className="share-dialog__role-label">Kan visa</span>
                <button
                  type="button"
                  className="share-dialog__revoke"
                  disabled={rotateBusy}
                  onClick={() => void revokeLink()}
                >
                  {rotateBusy ? 'Återkallar…' : 'Återkalla länk'}
                </button>
              </div>
            </li>

            {user ? (
              <li className="share-dialog__access-row">
                <div className="share-dialog__access-who">
                  <AccessAvatar name={ownerName} imageUrl={ownerAvatar} />
                  <div className="share-dialog__access-text">
                    <span className="share-dialog__access-name">
                      {ownerName} <em>(du)</em>
                    </span>
                    <span className="share-dialog__access-meta">{user.email}</span>
                  </div>
                </div>
                <span className="share-dialog__role-label">Ägare</span>
              </li>
            ) : null}

            {collabLoading && collaborators.length === 0 ? (
              <li className="share-dialog__access-row share-dialog__access-row--muted">
                <span className="share-dialog__access-meta">Laddar inbjudna…</span>
              </li>
            ) : null}

            {collaborators.map((c) => (
              <li key={c.id} className="share-dialog__access-row">
                <div className="share-dialog__access-who">
                  <AccessAvatar name={c.email} />
                  <div className="share-dialog__access-text">
                    <span className="share-dialog__access-name">{c.email}</span>
                    {!c.userId ? (
                      <span className="share-dialog__access-meta">Väntar på konto</span>
                    ) : null}
                  </div>
                </div>
                <div className="share-dialog__access-actions">
                  <select
                    aria-label={`Roll för ${c.email}`}
                    className="share-dialog__role-select"
                    value={c.role}
                    onChange={(e) =>
                      void changeRole(c.id, e.target.value as CollaboratorRole)
                    }
                  >
                    <option value="editor">{ROLE_LABELS.editor}</option>
                    <option value="viewer">{ROLE_LABELS.viewer}</option>
                  </select>
                  <button
                    type="button"
                    className="share-dialog__remove"
                    onClick={() => void remove(c.id)}
                  >
                    Ta bort
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {rotateOk ? <p className="share-dialog__ok">{rotateOk}</p> : null}
        </section>

        {error ? <p className="share-dialog__error">{error}</p> : null}
      </div>
      <button
        type="button"
        className="share-dialog__backdrop"
        aria-label="Stäng"
        onClick={onClose}
      />
    </div>
  )
}
