import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { DashboardPage } from './DashboardPage'
import { LoadingScreen } from './components/LoadingScreen'
import { useAuth } from './lib/auth'
import './WelcomeGate.css'

type AuthMode = 'login' | 'register' | 'forgot'

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

/** `/` — welcome when signed out, dashboard (pick a tree) when signed in. */
export function NewTreeRedirect() {
  const {
    user,
    loading,
    signInWithPassword,
    signUpWithPassword,
    signInWithEmail,
    signInWithGoogle,
    resetPassword,
  } = useAuth()
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

  const title =
    mode === 'register'
      ? 'Skapa konto'
      : mode === 'forgot'
        ? 'Återställ lösenord'
        : 'Välkommen tillbaka'

  const lead =
    mode === 'register'
      ? 'Skapa ett konto för att spara träd i molnet och bjuda in familjen.'
      : mode === 'forgot'
        ? 'Ange din e-post så skickar vi en länk för att välja nytt lösenord.'
        : 'Logga in för att se dina träd — eller skissa vidare utan konto.'

  const submitLabel =
    status === 'sending'
      ? mode === 'register'
        ? 'Skapar konto…'
        : mode === 'forgot'
          ? 'Skickar…'
          : 'Loggar in…'
      : mode === 'register'
        ? 'Skapa konto'
        : mode === 'forgot'
          ? 'Skicka återställningslänk'
          : 'Logga in'

  const sentMessage =
    mode === 'register'
      ? 'Konto skapat — kolla din inkorg och bekräfta e-posten.'
      : mode === 'forgot'
        ? 'Kolla din inkorg för länken till att välja nytt lösenord.'
        : 'Kolla din inkorg för länken vi skickade.'

  return (
    <div className="welcome-gate">
      <div className="welcome-gate__glow" aria-hidden />
      <div className="welcome-gate__panel">
        <p className="welcome-gate__brand">Släktträd</p>
        <h1 className="welcome-gate__title">{title}</h1>
        <p className="welcome-gate__lead">{lead}</p>

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
              } else if (mode === 'forgot') {
                await resetPassword(email)
                setStatus('sent')
                return
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
          {mode === 'login' || mode === 'register' ? (
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
          ) : null}
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
            <p className="welcome-gate__ok">{sentMessage}</p>
          ) : null}
          {formError ? <p className="welcome-gate__error">{formError}</p> : null}

          <button
            type="submit"
            className="welcome-gate__submit"
            disabled={status === 'sending' || status === 'sent'}
          >
            {submitLabel}
          </button>

          {mode !== 'forgot' ? (
            <>
              <div className="welcome-gate__divider">
                <span>eller</span>
              </div>
              <button
                type="button"
                className="welcome-gate__oauth"
                disabled={status === 'sending'}
                onClick={async () => {
                  setStatus('sending')
                  setFormError(null)
                  try {
                    sessionStorage.setItem('auth_next', '/')
                    await signInWithGoogle()
                  } catch (err) {
                    setStatus('error')
                    setFormError(
                      err instanceof Error
                        ? err.message
                        : 'Kunde inte logga in med Google',
                    )
                  }
                }}
              >
                <GoogleIcon />
                <span>
                  {mode === 'register' ? 'Skapa konto med Google' : 'Logga in med Google'}
                </span>
              </button>
            </>
          ) : null}

          {mode === 'login' ? (
            <>
              {email.trim() ? (
                <button
                  type="button"
                  className="welcome-gate__magic"
                  disabled={status === 'sending'}
                  onClick={async () => {
                    setStatus('sending')
                    setFormError(null)
                    try {
                      sessionStorage.setItem('auth_next', '/')
                      await signInWithEmail(email)
                      setStatus('sent')
                    } catch (err) {
                      setStatus('error')
                      setFormError(
                        err instanceof Error
                          ? err.message
                          : 'Kunde inte skicka magisk länk',
                      )
                    }
                  }}
                >
                  Skicka magisk länk
                </button>
              ) : null}
              <button
                type="button"
                className="welcome-gate__magic"
                disabled={status === 'sending'}
                onClick={() => {
                  setMode('forgot')
                  setStatus('idle')
                  setFormError(null)
                  setPassword('')
                }}
              >
                Glömt lösenord?
              </button>
            </>
          ) : null}
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
              Tillbaka till inloggning
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
