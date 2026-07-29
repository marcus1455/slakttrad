import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import {
  createNewFamily,
  deleteFamilyTree,
  listMyTrees,
  setTreeCoverUrl,
  type TreeSummary,
} from './lib/storage'
import {
  avatarUrlFromUser,
  displayNameFromUser,
  initialsFromName,
} from './lib/userDisplay'
import { LoadingScreen } from './components/LoadingScreen'
import { TreePreview } from './components/TreePreview'
import { removePersonPhoto, uploadTreeCover } from './lib/photos'
import { sortTreesByRecent } from './lib/recentTrees'
import './DashboardPage.css'

function formatUpdated(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function TreeTileMenu({
  tree,
  coverBusy,
  onSetCover,
  onRemoveCover,
  onDelete,
}: {
  tree: TreeSummary
  coverBusy: boolean
  onSetCover: () => void
  onRemoveCover: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const canEditCover = tree.role === 'owner' || tree.role === 'editor'

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!canEditCover && tree.role !== 'owner') return null

  return (
    <div className="dashboard__menu" ref={rootRef}>
      <button
        type="button"
        className="dashboard__menu-toggle"
        aria-label={`Åtgärder för ${tree.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={coverBusy}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <span aria-hidden>⋯</span>
      </button>
      {open ? (
        <div className="dashboard__menu-panel" role="menu">
          {canEditCover ? (
            <button
              type="button"
              role="menuitem"
              disabled={coverBusy}
              onClick={() => {
                setOpen(false)
                onSetCover()
              }}
            >
              {tree.coverUrl ? 'Byt omslagsbild' : 'Sätt omslagsbild'}
            </button>
          ) : null}
          {canEditCover && tree.coverUrl ? (
            <button
              type="button"
              role="menuitem"
              disabled={coverBusy}
              onClick={() => {
                setOpen(false)
                onRemoveCover()
              }}
            >
              Ta bort omslagsbild
            </button>
          ) : null}
          {tree.role === 'owner' ? (
            <button
              type="button"
              role="menuitem"
              className="dashboard__menu-danger"
              onClick={() => {
                setOpen(false)
                onDelete()
              }}
            >
              Ta bort träd
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Logged-in home: pick a family tree. */
export function DashboardPage() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const [trees, setTrees] = useState<TreeSummary[]>([])
  const [pageError, setPageError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [coverBusyId, setCoverBusyId] = useState<string | null>(null)
  const [loadingTrees, setLoadingTrees] = useState(true)
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const coverTargetRef = useRef<TreeSummary | null>(null)

  useEffect(() => {
    document.title = 'Släktträd'
  }, [])

  const refresh = useCallback(async () => {
    try {
      const list = await listMyTrees()
      setTrees(sortTreesByRecent(list))
      setPageError(null)
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Kunde inte hämta träd')
    } finally {
      setLoadingTrees(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    void refresh()
  }, [user, refresh])

  if (loading) {
    return <LoadingScreen title="Släktträd" message="Laddar" />
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  const name = displayNameFromUser(user)
  const avatarUrl = avatarUrlFromUser(user)
  const firstName = name.split(/\s+/)[0] || name

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

  const pickCover = (tree: TreeSummary) => {
    coverTargetRef.current = tree
    coverInputRef.current?.click()
  }

  const onCoverFile = async (file: File | undefined) => {
    const tree = coverTargetRef.current
    coverTargetRef.current = null
    if (!tree || !file) return
    setCoverBusyId(tree.id)
    setPageError(null)
    try {
      const nextUrl = await uploadTreeCover(tree.slug, file)
      const previous = tree.coverUrl?.trim()
      await setTreeCoverUrl(tree.id, nextUrl)
      if (previous) void removePersonPhoto(previous)
      setTrees((prev) =>
        prev.map((t) => (t.id === tree.id ? { ...t, coverUrl: nextUrl } : t)),
      )
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Kunde inte spara omslagsbild')
    } finally {
      setCoverBusyId(null)
    }
  }

  const onRemoveCover = async (tree: TreeSummary) => {
    setCoverBusyId(tree.id)
    setPageError(null)
    try {
      const previous = tree.coverUrl?.trim()
      await setTreeCoverUrl(tree.id, null)
      if (previous) void removePersonPhoto(previous)
      setTrees((prev) =>
        prev.map((t) => (t.id === tree.id ? { ...t, coverUrl: null } : t)),
      )
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Kunde inte ta bort omslaget')
    } finally {
      setCoverBusyId(null)
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard__glow" aria-hidden />
      <input
        ref={coverInputRef}
        className="dashboard__file"
        type="file"
        accept="image/*"
        onChange={(e) => {
          void onCoverFile(e.target.files?.[0])
          e.currentTarget.value = ''
        }}
      />
      <header className="dashboard__top">
        <p className="dashboard__brand">Släktträd</p>
        <div className="dashboard__top-actions">
          <Link to="/konto" className="dashboard__link">
            Konto
          </Link>
          <button
            type="button"
            className="dashboard__link"
            onClick={async () => {
              await signOut()
              navigate('/')
            }}
          >
            Logga ut
          </button>
        </div>
      </header>

      <main className="dashboard__main">
        <section className="dashboard__hero">
          <div className="dashboard__who">
            {avatarUrl ? (
              <img
                className="dashboard__avatar"
                src={avatarUrl}
                alt=""
                width={56}
                height={56}
              />
            ) : (
              <span className="dashboard__avatar dashboard__avatar--initials" aria-hidden>
                {initialsFromName(name)}
              </span>
            )}
            <div>
              <h1 className="dashboard__title">Hej {firstName}</h1>
              <p className="dashboard__lead">Öppna ett träd eller skapa ett nytt.</p>
            </div>
          </div>
          <button
            type="button"
            className="dashboard__new"
            disabled={creating}
            onClick={() => void onCreate()}
          >
            {creating ? 'Skapar…' : '+ Nytt träd'}
          </button>
        </section>

        {pageError ? <p className="dashboard__error">{pageError}</p> : null}

        <section className="dashboard__trees" aria-labelledby="dashboard-trees-heading">
          <h2 id="dashboard-trees-heading" className="dashboard__heading">
            Mina träd
          </h2>

          {loadingTrees ? (
            <p className="dashboard__empty">Hämtar träd…</p>
          ) : trees.length === 0 ? (
            <div className="dashboard__empty-panel">
              <p className="dashboard__empty">
                Du har inga träd ännu. Skapa ditt första — eller öppna ett delat träd via länk.
              </p>
              <button
                type="button"
                className="dashboard__new"
                disabled={creating}
                onClick={() => void onCreate()}
              >
                {creating ? 'Skapar…' : '+ Skapa träd'}
              </button>
            </div>
          ) : (
            <ul className="dashboard__grid">
              {trees.map((tree, index) => {
                const confirming = confirmId === tree.id
                const updated = formatUpdated(tree.updatedAt)
                return (
                  <li
                    key={tree.id}
                    className="dashboard__tile"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <Link
                      to={`/trad/${tree.slug}`}
                      className="dashboard__tile-hit"
                      aria-label={`Öppna ${tree.name}`}
                    >
                      <div className="dashboard__preview">
                        {tree.coverUrl ? (
                          <img
                            className="dashboard__cover"
                            src={tree.coverUrl}
                            alt=""
                          />
                        ) : (
                          <TreePreview
                            slug={tree.slug}
                            previewGenders={tree.previewGenders}
                          />
                        )}
                      </div>
                      <div className="dashboard__tile-body">
                        <span className="dashboard__tree-name">{tree.name}</span>
                        <span className="dashboard__tree-meta">
                          {tree.role === 'owner'
                            ? 'Ägare'
                            : tree.role === 'viewer'
                              ? 'Endast visning'
                              : 'Kan redigera'}
                          {tree.personCount > 0
                            ? ` · ${tree.personCount} personer`
                            : null}
                          {updated ? ` · ${updated}` : null}
                        </span>
                      </div>
                    </Link>

                    {!confirming ? (
                      <TreeTileMenu
                        tree={tree}
                        coverBusy={coverBusyId === tree.id}
                        onSetCover={() => pickCover(tree)}
                        onRemoveCover={() => void onRemoveCover(tree)}
                        onDelete={() => setConfirmId(tree.id)}
                      />
                    ) : null}

                    {confirming ? (
                      <div className="dashboard__confirm">
                        <p>Ta bort trädet för gott?</p>
                        <div className="dashboard__confirm-actions">
                          <button
                            type="button"
                            className="dashboard__danger"
                            disabled={busyId === tree.id}
                            onClick={() => void onDelete(tree)}
                          >
                            {busyId === tree.id ? 'Tar bort…' : 'Ja, ta bort'}
                          </button>
                          <button
                            type="button"
                            className="dashboard__ghost"
                            disabled={busyId === tree.id}
                            onClick={() => setConfirmId(null)}
                          >
                            Avbryt
                          </button>
                        </div>
                      </div>
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
