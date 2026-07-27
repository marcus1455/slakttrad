import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
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
import './AccountPage.css'

function AccountAvatar({
  name,
  imageUrl,
}: {
  name: string
  imageUrl: string | null
}) {
  const [broken, setBroken] = useState(false)
  if (imageUrl && !broken) {
    return (
      <img
        className="account-page__avatar"
        src={imageUrl}
        alt=""
        width={56}
        height={56}
        onError={() => setBroken(true)}
      />
    )
  }
  return (
    <span className="account-page__avatar account-page__avatar--initials" aria-hidden>
      {initialsFromName(name)}
    </span>
  )
}

/** Account hub: profile, my trees, create and delete. */
export function AccountPage() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const [trees, setTrees] = useState<TreeSummary[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setTrees(await listMyTrees())
      setListError(null)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Kunde inte hämta träd')
    }
  }, [])

  useEffect(() => {
    if (!user) return
    void refresh()
  }, [user, refresh])

  if (loading) {
    return <LoadingScreen title="Konto" message="Laddar" />
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  const name = displayNameFromUser(user)
  const avatarUrl = avatarUrlFromUser(user)

  const onCreate = async () => {
    setCreating(true)
    setListError(null)
    try {
      const loaded = await createNewFamily()
      navigate(`/trad/${loaded.meta.slug}`)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Kunde inte skapa träd')
      setCreating(false)
    }
  }

  const onDelete = async (tree: TreeSummary) => {
    setBusyId(tree.id)
    setListError(null)
    try {
      await deleteFamilyTree(tree.id)
      setConfirmId(null)
      await refresh()
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Kunde inte ta bort trädet')
    } finally {
      setBusyId(null)
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
          <AccountAvatar name={name} imageUrl={avatarUrl} />
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

          {listError ? <p className="account-page__error">{listError}</p> : null}

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
                          {tree.role === 'owner' ? 'Ägare' : 'Medarbetare'} · /trad/
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
      </main>
    </div>
  )
}
