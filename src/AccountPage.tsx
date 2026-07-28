import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import {
  createNewFamily,
  deleteFamilyTree,
  listMyTrees,
  type TreeSummary,
} from './lib/storage'
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
        width={56}
        height={56}
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

type AccountSection = 'profil' | 'trad'

function currentSection(pathname: string): AccountSection {
  if (pathname.endsWith('/trad')) return 'trad'
  return 'profil'
}

/** Account hub: profile, my trees, create and delete. */
export function AccountPage() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [trees, setTrees] = useState<TreeSummary[]>([])
  const [pageError, setPageError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [profileName, setProfileName] = useState('')
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('')
  const [starterNickname, setStarterNickname] = useState('')
  const [starterBirthYear, setStarterBirthYear] = useState('')
  const [starterPhone, setStarterPhone] = useState('')
  const [profileGender, setProfileGender] = useState<Gender>('female')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileStatus, setProfileStatus] = useState<string | null>(null)
  const section = useMemo(() => currentSection(location.pathname), [location.pathname])

  const refresh = useCallback(async () => {
    try {
      setTrees(await listMyTrees())
      setPageError(null)
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Kunde inte hämta träd')
    }
  }, [])

  useEffect(() => {
    if (!user) return
    void refresh()
  }, [user, refresh])

  useEffect(() => {
    if (!user) return
    setProfileName(displayNameFromUser(user))
    setProfileAvatarUrl(avatarUrlFromUser(user) ?? '')
    setProfileGender(starterGenderFromUserMeta(user.user_metadata))
    setStarterNickname(
      typeof user.user_metadata?.starter_nickname === 'string'
        ? user.user_metadata.starter_nickname
        : '',
    )
    setStarterBirthYear(
      typeof user.user_metadata?.starter_birth_year === 'string'
        ? user.user_metadata.starter_birth_year
        : '',
    )
    setStarterPhone(
      typeof user.user_metadata?.starter_phone === 'string'
        ? user.user_metadata.starter_phone
        : '',
    )
  }, [user])

  if (loading) {
    return <LoadingScreen title="Konto" message="Laddar" />
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  const name = displayNameFromUser(user)
  const avatarUrl = profileAvatarUrl || avatarUrlFromUser(user)

  const onCreate = async () => {
    setCreating(true)
    setPageError(null)
    try {
      const loaded = await createNewFamily()
      navigate(`/trad/${loaded.meta.slug}`)
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Kunde inte skapa träd')
      setCreating(false)
    }
  }

  const onDelete = async (tree: TreeSummary) => {
    setBusyId(tree.id)
    setPageError(null)
    try {
      await deleteFamilyTree(tree.id)
      setConfirmId(null)
      await refresh()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Kunde inte ta bort trädet')
    } finally {
      setBusyId(null)
    }
  }

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
          starter_nickname: starterNickname.trim() || undefined,
          starter_birth_year: starterBirthYear.trim() || undefined,
          starter_phone: starterPhone.trim() || undefined,
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
        <button
          type="button"
          className="account-page__back"
          onClick={() => {
            if (window.history.length > 1) navigate(-1)
            else navigate('/trad/davidsson')
          }}
        >
          Tillbaka
        </button>
      </header>

      <main className="account-page__main">
        <section className="account-page__profile">
          <AccountAvatar
            name={name}
            imageUrl={avatarUrl}
            uploading={profileBusy}
            onPick={(file) => void onPickAvatar(file)}
          />
          <div>
            <h1>{name}</h1>
            <p>{user.email}</p>
          </div>
          <button
            type="button"
            className="account-page__signout"
            onClick={async () => {
              await signOut()
              navigate('/trad/davidsson')
            }}
          >
            Logga ut
          </button>
        </section>

        <nav className="account-page__tabs" aria-label="Kontosidor">
          <Link
            to="/konto/profil"
            className={section === 'profil' ? 'account-page__tab account-page__tab--active' : 'account-page__tab'}
          >
            Profil
          </Link>
          <Link
            to="/konto/trad"
            className={section === 'trad' ? 'account-page__tab account-page__tab--active' : 'account-page__tab'}
          >
            Mina träd
          </Link>
        </nav>

        {pageError ? <p className="account-page__error">{pageError}</p> : null}
        {profileStatus ? <p className="account-page__ok">{profileStatus}</p> : null}

        {section === 'profil' ? (
          <section className="account-page__settings">
            <div className="account-page__trees-head">
              <h2>Profil</h2>
            </div>
            <form className="account-page__settings-form" onSubmit={(e) => void onSaveProfile(e)}>
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
              <label>
                Tilltalsnamn
                <input
                  type="text"
                  value={starterNickname}
                  onChange={(e) => setStarterNickname(e.target.value)}
                  placeholder="T.ex. Marcus"
                />
              </label>
              <label>
                Födelseår
                <input
                  type="text"
                  inputMode="numeric"
                  value={starterBirthYear}
                  onChange={(e) => setStarterBirthYear(e.target.value)}
                  placeholder="T.ex. 1990"
                />
              </label>
              <label>
                Telefon
                <input
                  type="tel"
                  value={starterPhone}
                  onChange={(e) => setStarterPhone(e.target.value)}
                  placeholder="T.ex. 070-123 45 67"
                  autoComplete="tel"
                />
              </label>
              <div className="account-page__settings-actions">
                <button type="submit" className="account-page__new" disabled={profileBusy}>
                  {profileBusy ? 'Sparar…' : 'Spara profil'}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {section === 'trad' ? (
          <section className="account-page__trees">
            <div className="account-page__trees-head">
              <h2>Mina träd</h2>
              <button
                type="button"
                className="account-page__new"
                disabled={creating}
                onClick={() => void onCreate()}
              >
                {creating ? 'Skapar…' : '+ Nytt träd'}
              </button>
            </div>

            {trees.length === 0 ? (
              <p className="account-page__empty">
                Du har inga träd ännu. Skapa ett nytt eller öppna ett delat träd via länk.
              </p>
            ) : (
              <ul className="account-page__list">
                {trees.map((tree) => {
                  const confirming = confirmId === tree.id
                  return (
                    <li key={tree.id}>
                      <div className="account-page__tree-main">
                        <Link to={`/trad/${tree.slug}`} className="account-page__tree-link">
                          <span className="account-page__tree-name">{tree.name}</span>
                          <span className="account-page__tree-meta">
                            {tree.role === 'owner'
                              ? 'Ägare'
                              : tree.role === 'viewer'
                                ? 'Endast visning'
                                : 'Kan redigera'}{' '}
                            · /trad/
                            {tree.slug}
                          </span>
                        </Link>
                      </div>
                      {tree.role === 'owner' ? (
                        confirming ? (
                          <div className="account-page__confirm">
                            <p>Ta bort för gott?</p>
                            <div className="account-page__confirm-actions">
                              <button
                                type="button"
                                className="account-page__danger"
                                disabled={busyId === tree.id}
                                onClick={() => void onDelete(tree)}
                              >
                                {busyId === tree.id ? 'Tar bort…' : 'Ja, ta bort'}
                              </button>
                              <button
                                type="button"
                                className="account-page__ghost"
                                disabled={busyId === tree.id}
                                onClick={() => setConfirmId(null)}
                              >
                                Avbryt
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="account-page__ghost account-page__delete"
                            onClick={() => setConfirmId(tree.id)}
                          >
                            Ta bort
                          </button>
                        )
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ) : null}
      </main>
    </div>
  )
}
