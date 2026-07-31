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
import './TreeSettingsDialog.css'

type Props = {
  treeId: string
  treeSlug: string
  treeName: string
  shareUrl: string | null
  canManage: boolean
  onRotated: (meta: TreeMeta) => void
  onClose: () => void
}

const ROLE_LABELS: Record<CollaboratorRole, string> = {
  editor: 'Kan redigera',
  viewer: 'Endast visning',
}

export function TreeSettingsDialog({
  treeId,
  treeSlug,
  treeName,
  shareUrl,
  canManage,
  onRotated,
  onClose,
}: Props) {
  const { user } = useAuth()
  const confirm = useConfirm()
  const cardRef = useRef<HTMLDivElement>(null)
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
    if (!canManage || !user) {
      setCollaborators([])
      return
    }
    setCollabLoading(true)
    try {
      setCollaborators(await listTreeCollaborators(treeId))
    } catch {
      // Soft-fail while owner/session settles
    } finally {
      setCollabLoading(false)
    }
  }, [canManage, treeId, user])

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

  const remove = async (id: string, email: string) => {
    const ok = await confirm({
      title: 'Ta bort person?',
      message: `${email} förlorar tillgång till trädet.`,
      confirmLabel: 'Ta bort',
      danger: true,
    })
    if (!ok) return
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
    <div
      className="tree-settings"
      role="dialog"
      aria-modal="true"
      aria-label="Trädinställningar"
    >
      <div className="tree-settings__card" ref={cardRef}>
        <header className="tree-settings__header">
          <div>
            <p>Inställningar</p>
            <h3>{treeName}</h3>
          </div>
          <button
            type="button"
            className="tree-settings__close"
            aria-label="Stäng"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {canManage ? (
          <section className="tree-settings__section">
            <h4>Medlemmar</h4>
            <p className="tree-settings__lead">
              Personer som kan öppna och redigera trädet efter inloggning.
            </p>

            <form className="tree-settings__invite" onSubmit={(e) => void invite(e)}>
              <label className="tree-settings__field">
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
              <label className="tree-settings__field">
                Roll
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as CollaboratorRole)}
                >
                  <option value="editor">{ROLE_LABELS.editor}</option>
                  <option value="viewer">{ROLE_LABELS.viewer}</option>
                </select>
              </label>
              <button
                type="submit"
                className="tree-settings__invite-submit"
                disabled={inviteBusy}
              >
                {inviteBusy ? 'Bjuder in…' : 'Bjud in'}
              </button>
            </form>

            {inviteOk ? <p className="tree-settings__ok">{inviteOk}</p> : null}

            {collabLoading && collaborators.length === 0 ? (
              <p className="tree-settings__lead">Laddar medlemmar…</p>
            ) : null}

            {collaborators.length > 0 ? (
              <ul className="tree-settings__collab-list">
                {collaborators.map((c) => (
                  <li key={c.id}>
                    <div className="tree-settings__collab-main">
                      <span>
                        {c.email}
                        {!c.userId ? (
                          <em className="tree-settings__pending"> · väntar på konto</em>
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
                    <button type="button" onClick={() => void remove(c.id, c.email)}>
                      Ta bort
                    </button>
                  </li>
                ))}
              </ul>
            ) : !collabLoading ? (
              <p className="tree-settings__lead">Inga inbjudna ännu.</p>
            ) : null}
          </section>
        ) : (
          <p className="tree-settings__lead">
            Bara ägaren kan hantera medlemmar för det här trädet.
          </p>
        )}

        {canManage && shareUrl ? (
          <section className="tree-settings__section">
            <h4>Visa-länk</h4>
            <p className="tree-settings__lead">
              Alla med länken kan se trädet. Återkalla om den spridits för brett.
            </p>
            <button
              type="button"
              className="tree-settings__quiet"
              disabled={rotateBusy}
              onClick={() => void revokeLink()}
            >
              {rotateBusy ? 'Återkallar…' : 'Återkalla delningslänk'}
            </button>
            {rotateOk ? <p className="tree-settings__ok">{rotateOk}</p> : null}
          </section>
        ) : null}

        {error ? <p className="tree-settings__error">{error}</p> : null}
      </div>
      <button
        type="button"
        className="tree-settings__backdrop"
        aria-label="Stäng"
        onClick={onClose}
      />
    </div>
  )
}
