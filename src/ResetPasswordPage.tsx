import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { LoadingScreen } from './components/LoadingScreen'
import { useAuth } from './lib/auth'
import './WelcomeGate.css'

/** After recovery email link — set a new password while signed in. */
export function ResetPasswordPage() {
  const { user, loading, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [formError, setFormError] = useState<string | null>(null)

  if (loading) {
    return <LoadingScreen title="Släktträd" message="Laddar" />
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (status === 'done') {
    return (
      <div className="welcome-gate">
        <div className="welcome-gate__glow" aria-hidden />
        <div className="welcome-gate__panel">
          <p className="welcome-gate__brand">Släktträd</p>
          <h1 className="welcome-gate__title">Lösenordet uppdaterat</h1>
          <p className="welcome-gate__lead">Du kan nu använda ditt nya lösenord.</p>
          <p className="welcome-gate__ok" style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            Klart — gå vidare till dina träd.
          </p>
          <div className="welcome-gate__footer">
            <Link className="welcome-gate__link" to="/">
              Till mina träd
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="welcome-gate">
      <div className="welcome-gate__glow" aria-hidden />
      <div className="welcome-gate__panel">
        <p className="welcome-gate__brand">Släktträd</p>
        <h1 className="welcome-gate__title">Nytt lösenord</h1>
        <p className="welcome-gate__lead">Välj ett nytt lösenord för ditt konto.</p>

        <form
          className="welcome-gate__form"
          onSubmit={async (e: FormEvent) => {
            e.preventDefault()
            setStatus('sending')
            setFormError(null)
            try {
              if (password.length < 6) {
                throw new Error('Lösenordet måste vara minst 6 tecken')
              }
              if (password !== passwordConfirm) {
                throw new Error('Lösenorden matchar inte')
              }
              await updatePassword(password)
              setStatus('done')
            } catch (err) {
              setStatus('error')
              setFormError(
                err instanceof Error ? err.message : 'Kunde inte uppdatera lösenordet',
              )
            }
          }}
        >
          <label>
            Nytt lösenord
            <input
              type="password"
              required
              minLength={6}
              autoFocus
              autoComplete="new-password"
              placeholder="Minst 6 tecken"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Upprepa lösenord
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Skriv lösenordet igen"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
          </label>

          {formError ? <p className="welcome-gate__error">{formError}</p> : null}

          <button
            type="submit"
            className="welcome-gate__submit"
            disabled={status === 'sending'}
          >
            {status === 'sending' ? 'Sparar…' : 'Spara nytt lösenord'}
          </button>
        </form>
      </div>
    </div>
  )
}
