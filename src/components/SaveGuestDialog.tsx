import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import './SaveGuestDialog.css'

type Props = {
  treeName: string
  onClose: () => void
  /** Called after the user is signed in and ready to promote the tree. */
  onSignedIn: () => void
}

type Mode = 'register' | 'login' | 'magic'

export function SaveGuestDialog({ treeName, onClose, onSignedIn }: Props) {
  const { signInWithPassword, signUpWithPassword, signInWithEmail } = useAuth()
  const [mode, setMode] = useState<Mode>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

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

  const title =
    mode === 'login' ? 'Logga in och spara' : mode === 'magic' ? 'Spara via e-postlänk' : 'Spara med konto'

  const submitLabel =
    status === 'sending'
      ? mode === 'magic'
        ? 'Skickar…'
        : mode === 'login'
          ? 'Loggar in…'
          : 'Sparar…'
      : mode === 'magic'
        ? 'Skicka länk'
        : mode === 'login'
          ? 'Logga in och spara'
          : 'Skapa konto och spara'

  return (
    <div className="save-guest" role="dialog" aria-modal="true" aria-label={title}>
      <form
        className="save-guest__card"
        onSubmit={async (e: FormEvent) => {
          e.preventDefault()
          setStatus('sending')
          setError(null)
          try {
            sessionStorage.setItem('auth_next', '/gast')
            if (mode === 'register') {
              if (password.length < 6) {
                throw new Error('Lösenordet måste vara minst 6 tecken')
              }
              if (password !== passwordConfirm) {
                throw new Error('Lösenorden matchar inte')
              }
              const signedIn = await signUpWithPassword(email, password)
              if (signedIn) {
                onSignedIn()
              } else {
                setStatus('sent')
              }
            } else if (mode === 'login') {
              await signInWithPassword(email, password)
              onSignedIn()
            } else {
              await signInWithEmail(email)
              setStatus('sent')
            }
          } catch (err) {
            setStatus('error')
            setError(err instanceof Error ? err.message : 'Kunde inte spara')
          }
        }}
      >
        <header>
          <p>Gästläge</p>
          <h3>{title}</h3>
          <p className="save-guest__lead">
            Ange e-post för att spara <strong>{treeName}</strong> i molnet. Annars
            ligger det kvar bara i den här webbläsarsessionen.
          </p>
        </header>

        {status === 'sent' ? (
          <p className="save-guest__sent">
            Kolla din inkorg och öppna länken. När du är inloggad sparas trädet
            automatiskt på ditt konto.
          </p>
        ) : (
          <>
            <label>
              E-post
              <input
                type="email"
                autoFocus
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {mode !== 'magic' ? (
              <label>
                Lösenord
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            ) : null}
            {mode === 'register' ? (
              <label>
                Upprepa lösenord
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                />
              </label>
            ) : null}
          </>
        )}

        {error ? <p className="save-guest__error">{error}</p> : null}

        {status !== 'sent' ? (
          <div className="save-guest__actions">
            <button type="button" className="ghost" onClick={onClose}>
              Stanna som gäst
            </button>
            <button type="submit" disabled={status === 'sending'}>
              {submitLabel}
            </button>
          </div>
        ) : (
          <div className="save-guest__actions">
            <button type="button" className="ghost" onClick={onClose}>
              Stäng
            </button>
          </div>
        )}

        {status !== 'sent' ? (
          <p className="save-guest__switch">
            {mode === 'register' ? (
              <>
                Har du redan konto?{' '}
                <button type="button" onClick={() => setMode('login')}>
                  Logga in
                </button>
              </>
            ) : mode === 'login' ? (
              <>
                Inget konto?{' '}
                <button type="button" onClick={() => setMode('register')}>
                  Skapa konto
                </button>
                {' · '}
                <button type="button" onClick={() => setMode('magic')}>
                  Magisk länk
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setMode('login')}>
                  Lösenord i stället
                </button>
              </>
            )}
          </p>
        ) : null}
      </form>
      <button
        type="button"
        className="save-guest__backdrop"
        aria-label="Stäng"
        onClick={onClose}
      />
    </div>
  )
}
