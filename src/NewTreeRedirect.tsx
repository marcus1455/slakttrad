import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { DashboardPage } from './DashboardPage'
import { LoadingScreen } from './components/LoadingScreen'
import { useAuth } from './lib/auth'
import './WelcomeGate.css'

type AuthMode = 'login' | 'register'

/** `/` — welcome when signed out, dashboard (pick a tree) when signed in. */
export function NewTreeRedirect() {
  const { user, loading, signInWithPassword, signUpWithPassword } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [formError, setFormError] = useState<string | null>(null)

  if (loading) {
    return <LoadingScreen title="Släktträd" message="Laddar" />
  }

  if (user) {
    return <DashboardPage />
  }

  const submitLabel =
    status === 'sending'
      ? mode === 'register'
        ? 'Skapar konto…'
        : 'Loggar in…'
      : mode === 'register'
        ? 'Skapa konto'
        : 'Logga in'

  return (
    <div className="welcome-gate">
      <div className="welcome-gate__glow" aria-hidden />
      <div className="welcome-gate__panel">
        <p className="welcome-gate__brand">Släktträd</p>
        <h1 className="welcome-gate__title">
          {mode === 'register' ? 'Skapa konto' : 'Välkommen tillbaka'}
        </h1>
        <p className="welcome-gate__lead">
          {mode === 'register'
            ? 'Skapa ett konto för att spara träd i molnet och bjuda in familjen.'
            : 'Logga in för att se dina träd — eller skissa vidare utan konto.'}
        </p>

        <form
          className="welcome-gate__form"
          onSubmit={async (e: FormEvent) => {
            e.preventDefault()
            setStatus('sending')
            setFormError(null)
            try {
              sessionStorage.setItem('auth_next', '/')
              if (mode === 'register') {
                if (password.length < 6) {
                  throw new Error('Lösenordet måste vara minst 6 tecken')
                }
                if (password !== passwordConfirm) {
                  throw new Error('Lösenorden matchar inte')
                }
                const signedIn = await signUpWithPassword(email, password)
                if (!signedIn) {
                  setStatus('sent')
                  return
                }
              } else {
                await signInWithPassword(email, password)
              }
              setStatus('idle')
            } catch (err) {
              setStatus('error')
              setFormError(
                err instanceof Error ? err.message : 'Kunde inte logga in',
              )
            }
          }}
        >
          <label>
            E-post
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="namn@exempel.se"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Lösenord
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              placeholder="Minst 6 tecken"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {mode === 'register' ? (
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
          ) : null}

          {status === 'sent' ? (
            <p className="welcome-gate__ok">
              Konto skapat — kolla din inkorg och bekräfta e-posten.
            </p>
          ) : null}
          {formError ? <p className="welcome-gate__error">{formError}</p> : null}

          <button
            type="submit"
            className="welcome-gate__submit"
            disabled={status === 'sending' || status === 'sent'}
          >
            {submitLabel}
          </button>
        </form>

        <div className="welcome-gate__footer">
          {mode === 'login' ? (
            <button
              type="button"
              className="welcome-gate__link"
              onClick={() => {
                setMode('register')
                setStatus('idle')
                setFormError(null)
                setPasswordConfirm('')
              }}
            >
              Skapa konto
            </button>
          ) : (
            <button
              type="button"
              className="welcome-gate__link"
              onClick={() => {
                setMode('login')
                setStatus('idle')
                setFormError(null)
                setPasswordConfirm('')
              }}
            >
              Har du redan konto? Logga in
            </button>
          )}
          <span className="welcome-gate__dot" aria-hidden>
            ·
          </span>
          <Link className="welcome-gate__link" to="/gast">
            Börja skissa utan konto
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Unknown routes → home (welcome or account). */
export function FallbackToNew() {
  return <Navigate to="/" replace />
}
