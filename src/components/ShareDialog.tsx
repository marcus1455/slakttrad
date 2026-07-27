import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import {
  inviteTreeCollaborator,
  listTreeCollaborators,
  removeTreeCollaborator,
  type TreeCollaborator,
} from '../lib/storage'
import './ShareDialog.css'

type Props = {
  url: string
  treeId: string
  /** True when the signed-in user may invite/remove collaborators. */
  canInvite: boolean
  onClose: () => void
  onRenew: () => Promise<void>
}

export function ShareDialog({ url, treeId, canInvite, onClose, onRenew }: Props) {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const [confirmRenew, setConfirmRenew] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteOk, setInviteOk] = useState<string | null>(null)
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
        if (confirmRenew) setConfirmRenew(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, confirmRenew])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Kunde inte kopiera länken')
    }
  }

  const renew = async () => {
    setBusy(true)
    setError(null)
    try {
      await onRenew()
      setConfirmRenew(false)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte skapa ny länk')
    } finally {
      setBusy(false)
    }
  }

  const invite = async (e: FormEvent) => {
    e.preventDefault()
    setInviteBusy(true)
    setInviteOk(null)
    setError(null)
    try {
      const row = await inviteTreeCollaborator(treeId, inviteEmail)
      setInviteEmail('')
      setInviteOk(
        `${row.email} kan nu redigera trädet efter inloggning med samma e-post.`,
      )
      await refreshCollaborators()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte bjuda in')
    } finally {
      setInviteBusy(false)
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

  return (
    <div className="share-dialog" role="dialog" aria-modal="true" aria-label="Dela träd">
      <div className="share-dialog__card">
        <header>
          <p>Dela</p>
          <h3>Trädåtkomst</h3>
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

          {confirmRenew ? (
            <div className="share-dialog__renew-box">
              <p>
                Skapa en ny länk? Den gamla slutar fungera direkt — skicka den nya till dem
                som ska kunna se trädet.
              </p>
              <div className="share-dialog__actions">
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={() => setConfirmRenew(false)}
                >
                  Avbryt
                </button>
                <button type="button" disabled={busy} onClick={() => void renew()}>
                  {busy ? 'Skapar…' : 'Skapa ny länk'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="share-dialog__link-renew"
              onClick={() => setConfirmRenew(true)}
            >
              Skapa ny visa-länk
            </button>
          )}
        </section>

        {canInvite ? (
          <section className="share-dialog__section">
            <h4>Bjud in att redigera</h4>
            <p className="share-dialog__lead">
              Lägg till e-post — personen loggar in och kan redigera hela trädet (inte
              bara en person).
            </p>

            <form className="share-dialog__invite" onSubmit={(e) => void invite(e)}>
              <label className="share-dialog__field">
                E-post
                <div className="share-dialog__url-row">
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="namn@exempel.se"
                    autoComplete="email"
                  />
                  <button type="submit" disabled={inviteBusy}>
                    {inviteBusy ? 'Bjuder in…' : 'Bjud in'}
                  </button>
                </div>
              </label>
            </form>

            {inviteOk ? <p className="share-dialog__ok">{inviteOk}</p> : null}

            {collabLoading && collaborators.length === 0 ? (
              <p className="share-dialog__lead">Laddar medarbetare…</p>
            ) : null}

            {collaborators.length > 0 ? (
              <ul className="share-dialog__collab-list">
                {collaborators.map((c) => (
                  <li key={c.id}>
                    <span>
                      {c.email}
                      {!c.userId ? (
                        <em className="share-dialog__pending"> · väntar på konto</em>
                      ) : null}
                    </span>
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
            Logga in som ägare för att bjuda in medarbetare som kan redigera.
          </p>
        )}

        <div className="share-dialog__actions">
          <button type="button" className="ghost" onClick={onClose}>
            Stäng
          </button>
        </div>

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
