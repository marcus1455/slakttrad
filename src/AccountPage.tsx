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
          </section>
        </div>
      </main>
    </div>
  )
}
