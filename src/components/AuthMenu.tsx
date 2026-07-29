import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  avatarUrlFromUser,
  displayNameFromUser,
  initialsFromName,
} from '../lib/userDisplay'
import './AuthMenu.css'
const THEME_KEY = 'slakttrad.theme'
type ThemeMode = 'light' | 'dark'

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

function SettingsIcon() {
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
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  )
}

function TreesIcon() {
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
        d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
      />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M10.2 2.5a.8.8 0 0 1 .8-.8h3.2a1.8 1.8 0 0 1 1.8 1.8v13a1.8 1.8 0 0 1-1.8 1.8H11a.8.8 0 1 1 0-1.6h3.2a.2.2 0 0 0 .2-.2v-13a.2.2 0 0 0-.2-.2H11a.8.8 0 0 1-.8-.8ZM9.73 5.53a.75.75 0 0 1 1.06 0l3.44 3.44a.75.75 0 0 1 0 1.06l-3.44 3.44a.75.75 0 1 1-1.06-1.06l2.16-2.16H4.75a.75.75 0 0 1 0-1.5h7.14L9.73 6.59a.75.75 0 0 1 0-1.06Z"
      />
    </svg>
  )
}

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  return mode === 'dark' ? (
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
        d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
      />
    </svg>
  ) : (
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
        d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
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
    signInWithGoogle,
    signOut,
  } = useAuth()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AuthMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light'
    const raw = localStorage.getItem(THEME_KEY)
    if (raw === 'light' || raw === 'dark') return raw
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  })
  const rootRef = useRef<HTMLDivElement | null>(null)

  const applyTheme = (mode: ThemeMode) => {
    document.documentElement.dataset.theme = mode
    localStorage.setItem(THEME_KEY, mode)
    setThemeMode(mode)
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (loading) return null

  if (user) {
    const name = displayNameFromUser(user)
    const avatarUrl = avatarOverride || avatarUrlFromUser(user)
    return (
      <div className="auth-menu" ref={rootRef}>
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
              className="auth-menu__nav"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <SettingsIcon />
              <span>Kontoinställningar</span>
            </Link>
            <Link
              to="/"
              className="auth-menu__nav"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <TreesIcon />
              <span>Mina träd</span>
            </Link>
            <button
              type="button"
              className="auth-menu__action"
              role="menuitem"
              onClick={() => applyTheme(themeMode === 'dark' ? 'light' : 'dark')}
            >
              <ThemeIcon mode={themeMode} />
              <span>{themeMode === 'dark' ? 'Ljust läge' : 'Mörkt läge'}</span>
            </button>
            <button
              type="button"
              className="auth-menu__action auth-menu__action--muted auth-menu__action--logout"
              role="menuitem"
              onClick={async () => {
                await signOut()
                setOpen(false)
              }}
            >
              <LogoutIcon />
              <span>Logga ut</span>
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
    <div className="auth-menu" ref={rootRef}>
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
          <div className="auth-menu__divider"><span>eller</span></div>
          <button
            type="button"
            className="auth-menu__oauth"
            onClick={async () => {
              setStatus('sending')
              setError(null)
              try {
                await signInWithGoogle()
              } catch (err) {
                setStatus('error')
                setError(err instanceof Error ? err.message : 'Kunde inte logga in med Google')
              }
            }}
            disabled={status === 'sending'}
          >
            <GoogleIcon />
            <span>Fortsätt med Google</span>
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
