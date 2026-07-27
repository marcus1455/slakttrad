import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  avatarUrlFromUser,
  displayNameFromUser,
  initialsFromName,
} from '../lib/userDisplay'
import './AuthMenu.css'

function UserIcon() {
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
        d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  )
}

function UserAvatar({
  name,
  imageUrl,
  size = 22,
}: {
  name: string
  imageUrl: string | null
  size?: number
}) {
  const [broken, setBroken] = useState(false)
  if (imageUrl && !broken) {
    return (
      <img
        className="auth-menu__avatar"
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        onError={() => setBroken(true)}
      />
    )
  }
  return (
    <span
      className="auth-menu__avatar auth-menu__avatar--initials"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initialsFromName(name)}
    </span>
  )
}

type AuthMode = 'password' | 'register' | 'magic'

type Props = {
  /** Show text label next to the icon (e.g. on the login gate). */
  showLabel?: boolean
  /** Override avatar (e.g. photo from the linked person in the open tree). */
  avatarUrl?: string | null
}

/** Header control: login / register, or account menu. */
export function AuthMenu({ showLabel = false, avatarUrl: avatarOverride }: Props) {
  const {
    user,
    loading,
    signInWithPassword,
    signUpWithPassword,
    signInWithEmail,
    signOut,
  } = useAuth()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AuthMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (loading) return null

  if (user) {
    const name = displayNameFromUser(user)
    const avatarUrl = avatarOverride || avatarUrlFromUser(user)
    return (
      <div className="auth-menu">
        <button
          type="button"
          className="app__tool auth-menu__account"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title={user.email ?? name}
          aria-label={`Konto: ${name}`}
        >
          <UserAvatar name={name} imageUrl={avatarUrl} />
          <span className="auth-menu__name">{name}</span>
        </button>
        {open ? (
          <div className="auth-menu__panel" role="menu">
            <div className="auth-menu__profile">
              <UserAvatar name={name} imageUrl={avatarUrl} size={40} />
              <div>
                <p className="auth-menu__profile-name">{name}</p>
                <p className="auth-menu__email">{user.email}</p>
              </div>
            </div>
            <Link
              to="/konto"
              className="auth-menu__action"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Se mina träd
            </Link>
            <Link
              to="/"
              className="auth-menu__action"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              + Nytt träd
            </Link>
            <button
              type="button"
              className="auth-menu__action auth-menu__action--muted"
              role="menuitem"
              onClick={async () => {
                await signOut()
                setOpen(false)
              }}
            >
              Logga ut
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  const triggerClass = showLabel
    ? 'app__tool'
    : 'app__tool app__tool--icon app__tool--quiet'

  const title =
    mode === 'register' ? 'Skapa konto' : mode === 'magic' ? 'Magisk länk' : 'Logga in'
  const hint =
    mode === 'register'
      ? 'Fyll i e-post och lösenord för att skapa ett konto.'
      : mode === 'magic'
        ? 'Vi skickar en inloggningslänk till din inkorg.'
        : 'Logga in med e-post och lösenord.'

  const submitLabel =
    status === 'sending'
      ? mode === 'register'
        ? 'Skapar…'
        : mode === 'magic'
          ? 'Skickar…'
          : 'Loggar in…'
      : mode === 'register'
        ? 'Skapa konto'
        : mode === 'magic'
          ? 'Skicka länk'
          : 'Logga in'

  return (
    <div className="auth-menu">
      <button
        type="button"
        className={triggerClass}
        onClick={() => {
          setOpen((v) => !v)
          setStatus('idle')
          setError(null)
        }}
        title="Logga in"
        aria-label="Logga in"
        aria-expanded={open}
      >
        <UserIcon />
        {showLabel ? <span>Logga in</span> : null}
      </button>
      {open ? (
        <form
          className="auth-menu__panel"
          onSubmit={async (e: FormEvent) => {
            e.preventDefault()
            setStatus('sending')
            setError(null)
            try {
              sessionStorage.setItem(
                'auth_next',
                `${window.location.pathname}${window.location.search}`,
              )
              if (mode === 'register') {
                if (password.length < 6) {
                  throw new Error('Lösenordet måste vara minst 6 tecken')
                }
                if (password !== passwordConfirm) {
                  throw new Error('Lösenorden matchar inte')
                }
                const signedIn = await signUpWithPassword(email, password)
                if (signedIn) {
                  setOpen(false)
                  setPassword('')
                  setPasswordConfirm('')
                  setStatus('idle')
                } else {
                  setStatus('sent')
                }
              } else if (mode === 'password') {
                await signInWithPassword(email, password)
                setOpen(false)
                setPassword('')
                setStatus('idle')
              } else {
                await signInWithEmail(email)
                setStatus('sent')
              }
            } catch (err) {
              setStatus('error')
              setError(err instanceof Error ? err.message : 'Kunde inte logga in')
            }
          }}
        >
          <p className="auth-menu__title">{title}</p>
          <p className="auth-menu__hint">{hint}</p>
          <label>
            E-post
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="namn@exempel.se"
              autoComplete="email"
            />
          </label>
          {mode === 'password' || mode === 'register' ? (
            <label>
              Lösenord
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minst 6 tecken"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
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
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="Skriv lösenordet igen"
                autoComplete="new-password"
              />
            </label>
          ) : null}
          {status === 'sent' ? (
            <p className="auth-menu__ok">
              {mode === 'register'
                ? 'Konto skapat — kolla din inkorg och bekräfta e-posten.'
                : 'Kolla din inkorg och klicka på länken.'}
            </p>
          ) : null}
          {error ? <p className="auth-menu__error">{error}</p> : null}
          <button type="submit" disabled={status === 'sending' || status === 'sent'}>
            {submitLabel}
          </button>
          {mode === 'password' ? (
            <>
              <button
                type="button"
                className="auth-menu__switch"
                onClick={() => {
                  setMode('register')
                  setStatus('idle')
                  setError(null)
                  setPasswordConfirm('')
                }}
              >
                Har du inget konto? Klicka här
              </button>
              <button
                type="button"
                className="auth-menu__switch"
                onClick={() => {
                  setMode('magic')
                  setStatus('idle')
                  setError(null)
                }}
              >
                Använd magisk länk istället
              </button>
            </>
          ) : (
            <button
              type="button"
              className="auth-menu__switch"
              onClick={() => {
                setMode('password')
                setStatus('idle')
                setError(null)
                setPasswordConfirm('')
              }}
            >
              Har du redan konto? Logga in
            </button>
          )}
        </form>
      ) : null}
    </div>
  )
}
