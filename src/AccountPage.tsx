import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import {
  avatarUrlFromUser,
  displayNameFromUser,
  initialsFromName,
} from './lib/userDisplay'
import { LoadingScreen } from './components/LoadingScreen'
import { removePersonPhoto, uploadAccountAvatar } from './lib/photos'
import { supabase } from './lib/supabase'
import type { Gender } from './types'
import './AccountPage.css'
const THEME_KEY = 'slakttrad.theme'
type ThemeMode = 'light' | 'dark'

function LightThemeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
      />
    </svg>
  )
}

function DarkThemeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
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

function AccountAvatar({
  name,
  imageUrl,
  uploading = false,
  onPick,
}: {
  name: string
  imageUrl: string | null
  uploading?: boolean
  onPick?: (file: File | undefined) => void
}) {
  const [broken, setBroken] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const content =
    imageUrl && !broken ? (
      <img
        className="account-page__avatar"
        src={imageUrl}
        alt=""
        width={96}
        height={96}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    ) : (
      <span className="account-page__avatar account-page__avatar--initials" aria-hidden>
        {initialsFromName(name)}
      </span>
    )

  if (!onPick) return content

  const label = uploading ? 'Laddar upp…' : 'Byt bild'

  return (
    <button
      type="button"
      className="account-page__avatar-button"
      onClick={() => fileRef.current?.click()}
      aria-label={label}
      title={label}
      disabled={uploading}
    >
      {content}
      <span className="account-page__avatar-overlay">{label}</span>
      <input
        ref={fileRef}
        className="account-page__avatar-input"
        type="file"
        accept="image/*"
        onChange={(e) => {
          onPick(e.target.files?.[0])
          e.currentTarget.value = ''
        }}
      />
    </button>
  )
}

function starterGenderFromUserMeta(meta: Record<string, unknown> | undefined): Gender {
  return meta?.starter_gender === 'male' ? 'male' : 'female'
}

/** Account settings only — tree picker lives on the dashboard (`/`). */
export function AccountPage() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [pageError, setPageError] = useState<string | null>(null)
  const [profileName, setProfileName] = useState('')
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('')
  const [profileGender, setProfileGender] = useState<Gender>('female')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileStatus, setProfileStatus] = useState<string | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light'
    const raw = localStorage.getItem(THEME_KEY)
    if (raw === 'light' || raw === 'dark') return raw
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  })

  const applyTheme = (mode: ThemeMode) => {
    document.documentElement.dataset.theme = mode
    localStorage.setItem(THEME_KEY, mode)
    setThemeMode(mode)
  }

  useEffect(() => {
    if (!user) return
    setProfileName(displayNameFromUser(user))
    setProfileAvatarUrl(avatarUrlFromUser(user) ?? '')
    setProfileGender(starterGenderFromUserMeta(user.user_metadata))
  }, [user])

  if (loading) {
    return <LoadingScreen title="Konto" message="Laddar" />
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (location.pathname.endsWith('/trad')) {
    return <Navigate to="/" replace />
  }

  const name = displayNameFromUser(user)
  const avatarUrl = profileAvatarUrl || avatarUrlFromUser(user)

  const onSaveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setProfileBusy(true)
    setProfileStatus(null)
    setPageError(null)
    try {
      const fullName = profileName.trim()
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName || undefined,
          starter_gender: profileGender,
        },
      })
      if (error) throw error
      setProfileStatus('Profilen sparades.')
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Kunde inte spara kontot')
    } finally {
      setProfileBusy(false)
    }
  }

  const onPickAvatar = async (file: File | undefined) => {
    if (!user || !file) return
    setProfileBusy(true)
    setProfileStatus(null)
    setPageError(null)
    try {
      const nextUrl = await uploadAccountAvatar(user.id, file)
      const previousUrl = profileAvatarUrl.trim()
      const { error } = await supabase.auth.updateUser({
        data: {
          avatar_url: nextUrl,
        },
      })
      if (error) throw error
      if (previousUrl) {
        void removePersonPhoto(previousUrl)
      }
      setProfileAvatarUrl(nextUrl)
      setProfileStatus('Profilbilden sparades.')
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Kunde inte ladda upp bilden')
    } finally {
      setProfileBusy(false)
    }
  }

  return (
    <div className="account-page">
      <header className="account-page__top">
        <p className="account-page__brand">Släktträd</p>
        <Link to="/" className="account-page__back">
          Mina träd
        </Link>
      </header>

      <main className="account-page__main">
        <h1 className="account-page__page-title">Konto</h1>
        <p className="account-page__page-lead">
          Uppgifter som syns i appen och när du skapar nya träd.
        </p>

        {pageError ? <p className="account-page__error">{pageError}</p> : null}
        {profileStatus ? <p className="account-page__ok">{profileStatus}</p> : null}

        <div className="account-page__layout">
          <aside className="account-page__aside">
            <AccountAvatar
              name={name}
              imageUrl={avatarUrl}
              uploading={profileBusy}
              onPick={(file) => void onPickAvatar(file)}
            />
            <div className="account-page__aside-text">
              <h2>{name}</h2>
              <p>{user.email}</p>
            </div>
            <button
              type="button"
              className="account-page__signout"
              onClick={async () => {
                await signOut()
                navigate('/')
              }}
            >
              Logga ut
            </button>
          </aside>

          <section className="account-page__settings">
            <h2>Profil</h2>
            <form
              className="account-page__settings-form"
              onSubmit={(e) => void onSaveProfile(e)}
            >
              <label>
                Namn
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Ditt namn"
                  autoComplete="name"
                />
              </label>
              <label>
                Kön
                <select
                  value={profileGender}
                  onChange={(e) => setProfileGender(e.target.value as Gender)}
                >
                  <option value="female">Kvinna</option>
                  <option value="male">Man</option>
                </select>
              </label>
              <div className="account-page__settings-actions">
                <button
                  type="submit"
                  className="account-page__new"
                  disabled={profileBusy}
                >
                  {profileBusy ? 'Sparar…' : 'Spara profil'}
                </button>
              </div>
            </form>

            <div className="account-page__theme">
              <h3>Utseende</h3>
              <p>Välj om appen ska visas i ljust eller mörkt läge.</p>
              <div className="account-page__theme-actions">
                <button
                  type="button"
                  className={themeMode === 'light' ? 'account-page__theme-btn is-active' : 'account-page__theme-btn'}
                  onClick={() => applyTheme('light')}
                >
                  <LightThemeIcon />
                  Ljust
                </button>
                <button
                  type="button"
                  className={themeMode === 'dark' ? 'account-page__theme-btn is-active' : 'account-page__theme-btn'}
                  onClick={() => applyTheme('dark')}
                >
                  <DarkThemeIcon />
                  Mörkt
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
