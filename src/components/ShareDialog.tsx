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
import { displayNameFromUser } from '../lib/userDisplay'
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
  viewer: 'Endast visning',
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
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>('editor')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteOk, setInviteOk] = useState<string | null>(null)
  const [rotateBusy, setRotateBusy] = useState(false)
  const [rotateOk, setRotateOk] = useState<string | null>(null)
  const [collaborators, setCollaborators] = useState<TreeCollaborator[]>([])
  const [collabLoading, setCollabLoading] = useState(false)

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
    setInviteBusy(true)
    setInviteOk(null)
    setError(null)
    try {
      const inviteMeta: InviteMeta = {
        inviteeName: inviteEmail.split('@')[0],
        treeName,
        inviterName: user ? displayNameFromUser(user) : undefined,
      }
      const row = await inviteTreeCollaborator(treeId, inviteEmail, inviteRole, inviteMeta)
      setInviteEmail('')
      setInviteOk(
        inviteRole === 'editor'
          ? `${row.email} kan redigera trädet efter inloggning med samma e-post.`
          : `${row.email} kan titta på trädet efter inloggning med samma e-post.`,
      )
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
          <div>
            <p>Dela</p>
            <h3>Trädåtkomst</h3>
          </div>
          <button
            type="button"
            className="share-dialog__close"
            aria-label="Stäng"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <section className="share-dialog__section">
          <h4>Visa-länk</h4>
          <p className="share-dialog__lead">
            Alla med länken kan se trädet, men inte ändra något.
          </p>

          <label className="share-dialog__field">
            Länk
            <div className="share-dialog__url-row">
              <input type="text" readOnly value={url} onFocus={(e) => e.target.select()} />
              <button type="button" onClick={() => void copy()}>
                {copied ? 'Kopierad' : 'Kopiera'}
              </button>
            </div>
          </label>

          <button
            type="button"
            className="share-dialog__quiet"
            disabled={rotateBusy}
            onClick={() => void revokeLink()}
          >
            {rotateBusy ? 'Återkallar…' : 'Återkalla länk'}
          </button>
          {rotateOk ? <p className="share-dialog__ok">{rotateOk}</p> : null}
        </section>

        {canInvite ? (
          <section className="share-dialog__section">
            <h4>Bjud in</h4>
            <p className="share-dialog__lead">
              Lägg till e-post — personen loggar in och får tillgång till hela trädet.
            </p>

            <form className="share-dialog__invite" onSubmit={(e) => void invite(e)}>
              <label className="share-dialog__field">
                E-post
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="namn@exempel.se"
                  autoComplete="email"
                />
              </label>

              <label className="share-dialog__field">
                Roll
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as CollaboratorRole)}
                >
                  <option value="editor">{ROLE_LABELS.editor}</option>
                  <option value="viewer">{ROLE_LABELS.viewer}</option>
                </select>
              </label>

              <button type="submit" className="share-dialog__invite-submit" disabled={inviteBusy}>
                {inviteBusy ? 'Bjuder in…' : 'Bjud in'}
              </button>
            </form>

            {inviteOk ? <p className="share-dialog__ok">{inviteOk}</p> : null}

            {collabLoading && collaborators.length === 0 ? (
              <p className="share-dialog__lead">Laddar inbjudna…</p>
            ) : null}

            {collaborators.length > 0 ? (
              <ul className="share-dialog__collab-list">
                {collaborators.map((c) => (
                  <li key={c.id}>
                    <div className="share-dialog__collab-main">
                      <span>
                        {c.email}
                        {!c.userId ? (
                          <em className="share-dialog__pending"> · väntar på konto</em>
                        ) : null}
                      </span>
                      <select
                        aria-label={`Roll för ${c.email}`}
                        value={c.role}
                        onChange={(e) =>
                          void changeRole(c.id, e.target.value as CollaboratorRole)
                        }
                      >
                        <option value="editor">{ROLE_LABELS.editor}</option>
                        <option value="viewer">{ROLE_LABELS.viewer}</option>
                      </select>
                    </div>
                    <button type="button" onClick={() => void remove(c.id)}>
                      Ta bort
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : user ? null : (
          <p className="share-dialog__lead">
            Logga in som ägare för att bjuda in personer till trädet.
          </p>
        )}

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
