import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthMenu } from './components/AuthMenu'
import { LoadingScreen } from './components/LoadingScreen'
import { PersonCard } from './components/PersonCard'
import { PersonList } from './components/PersonList'
import { PersonPanel } from './components/PersonPanel'
import {
  PinchZoomPan,
  type CenterRequest,
  type FitRequest,
} from './components/PinchZoomPan'
import { PresenceAvatars } from './components/PresenceAvatars'
import {
  QuickAddDialog,
  type QuickAddKind,
} from './components/QuickAddDialog'
import { RemoteCursors } from './components/RemoteCursors'
import { SaveGuestDialog } from './components/SaveGuestDialog'
import { SearchBar } from './components/SearchBar'
import { ShareDialog } from './components/ShareDialog'
import { SpouseEdge } from './components/SpouseEdge'
import { TreeTitle } from './components/TreeTitle'
import { TreeViewMenu } from './components/TreeViewMenu'
import { useTreePresence } from './hooks/useTreePresence'
import { useAuth } from './lib/auth'
import {
  emptyHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type StoreHistory,
} from './lib/history'
import { layoutFullTree } from './lib/fullTreeLayout'
import { personLifeLabel } from './lib/personLife'
import { relationToFocus } from './lib/relationship'
import {
  createFamilyFromStore,
  loadFamilyByShareToken,
  loadFamilyBySlug,
  saveFamily,
  shareUrlForToken,
} from './lib/storage'
import {
  clearGuestTree,
  GUEST_TREE_ID,
  loadOrCreateGuestTree,
  saveGuestTree,
} from './lib/guestTree'
import { supabase } from './lib/supabase'
import { avatarUrlForUserInTree, personProfileForUser } from './lib/userDisplay'
import { nodesForView, type TreeView } from './lib/treeView'
import type { FamilyStore, TreeMeta } from './types'
import './App.css'
import './print.css'

const NODE_WIDTH = 216
const NODE_HEIGHT = 108

function firstName(fullName: string | undefined, fallback: string) {
  if (!fullName?.trim()) return fallback
  return fullName.trim().split(/\s+/)[0] ?? fallback
}

export type TreeAppProps = {
  mode: 'edit' | 'view' | 'guest'
  slug?: string
  shareToken?: string
}

function TreeApp({ mode, slug, shareToken }: TreeAppProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isGuestMode = mode === 'guest'
  const isViewMode = mode === 'view'
  const [mayEdit, setMayEdit] = useState(mode === 'edit' || mode === 'guest')
  const readOnly = isViewMode || !mayEdit
  const [store, setStore] = useState<FamilyStore | null>(null)
  const [meta, setMeta] = useState<TreeMeta | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [centerRequest, setCenterRequest] = useState<CenterRequest | null>(null)
  const [fitRequest, setFitRequest] = useState<FitRequest | null>(null)
  const [quickAdd, setQuickAdd] = useState<{
    personId: string
    kind: QuickAddKind
    /** When set, a new child is linked to both partners on the spouse edge. */
    coParentId?: string
  } | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [saveGuestOpen, setSaveGuestOpen] = useState(false)
  const [treeView, setTreeView] = useState<TreeView>({ type: 'all' })
  const [history, setHistory] = useState<StoreHistory>(emptyHistory)
  const skipNextSave = useRef(true)
  const didInitialFit = useRef(false)
  const savedFlashTimer = useRef<number | null>(null)
  const claimingGuest = useRef(false)
  const storeRef = useRef(store)
  const historyRef = useRef(history)
  storeRef.current = store
  historyRef.current = history

  const focusId = store?.rootId ?? ''
  const focusName = firstName(store?.profiles[focusId]?.name, 'centrum')

  const { peers, remoteCursors, publishCursor, self: presenceSelf } = useTreePresence({
    treeId: isGuestMode ? null : meta?.id,
    user,
    ownerId: meta?.ownerId,
    mayEdit,
    isViewMode: isViewMode || isGuestMode,
    profiles: store?.profiles,
  })

  // Keep auth avatar in sync with the linked person in this tree (header + /konto).
  useEffect(() => {
    if (!user || !store) return
    const person = personProfileForUser(user, store.profiles)
    if (!person?.photoUrl) return
    const meta = user.user_metadata ?? {}
    if (meta.avatar_url === person.photoUrl) return
    void supabase.auth.updateUser({
      data: {
        avatar_url: person.photoUrl,
        full_name: person.name || meta.full_name,
      },
    })
  }, [user, store])

  const treeLayout = useMemo(() => {
    if (!store) return null
    const nodes = nodesForView(store, treeView)
    return layoutFullTree(nodes, {
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
    })
  }, [store?.nodes, store?.profiles, store?.rootId, treeView])

  // Fit canvas when the active view changes (or first layout after load)
  const viewKey = treeView.type === 'surname' ? `surname:${treeView.surname}` : treeView.type
  useEffect(() => {
    if (!treeLayout) return
    didInitialFit.current = true
    setFitRequest({
      width: treeLayout.width,
      height: treeLayout.height,
      key: Date.now(),
    })
  }, [viewKey, treeLayout?.width, treeLayout?.height])

  const printPeople = useMemo(() => {
    if (!store) return []
    return Object.values(store.profiles).sort((a, b) =>
      a.name.localeCompare(b.name, 'sv'),
    )
  }, [store])

  useEffect(() => {
    let cancelled = false
    didInitialFit.current = false
    setStatus('loading')
    setStore(null)
    setMeta(null)
    setHistory(emptyHistory())
    setListOpen(false)
    setQuickAdd(null)
    setTreeView({ type: 'all' })

    if (isGuestMode) {
      const guest = loadOrCreateGuestTree()
      if (!cancelled) {
        skipNextSave.current = true
        setStore(guest.store)
        setMeta({
          id: GUEST_TREE_ID,
          slug: 'gast',
          name: guest.name,
          shareToken: '',
          ownerId: null,
        })
        setSelectedId(null)
        setMayEdit(true)
        setStatus('ready')
        setError(null)
        document.title = `Släktträd · ${guest.name}`
      }
      return () => {
        cancelled = true
      }
    }

    ;(async () => {
      try {
        const loaded = shareToken
          ? await loadFamilyByShareToken(shareToken)
          : await loadFamilyBySlug(slug ?? 'davidsson')
        if (cancelled) return
        skipNextSave.current = true
        setStore(loaded.store)
        setMeta(loaded.meta)
        setSelectedId(null)
        setStatus('ready')
        setError(null)
        document.title = `Släktträd · ${loaded.meta.name}`
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Kunde inte ladda trädet')
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slug, shareToken, isGuestMode])

  useEffect(() => {
    if (isGuestMode) {
      setMayEdit(true)
      return
    }
    if (isViewMode) {
      setMayEdit(false)
      return
    }
    if (!meta?.id) {
      setMayEdit(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.rpc('can_manage_tree', {
        p_tree_id: meta.id,
      })
      if (cancelled) return
      if (error) {
        // Legacy / open trees: allow edit attempts; RLS still gates saves.
        setMayEdit(meta.ownerId == null || meta.ownerId === user?.id)
        return
      }
      setMayEdit(Boolean(data))
    })()
    return () => {
      cancelled = true
    }
  }, [meta?.id, meta?.ownerId, user?.id, isViewMode, isGuestMode])

  useEffect(() => {
    if (!store || !meta || readOnly) return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setStatus('saving')
      setJustSaved(false)
      try {
        if (isGuestMode) {
          saveGuestTree(store, meta.name)
        } else {
          await saveFamily(meta.slug, store, meta.name)
        }
        if (!cancelled) {
          setStatus('ready')
          setJustSaved(true)
          if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current)
          savedFlashTimer.current = window.setTimeout(() => setJustSaved(false), 1800)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Kunde inte spara')
          setStatus('error')
        }
      }
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [store, meta, readOnly, isGuestMode])

  const promoteGuestTree = useCallback(async () => {
    const current = storeRef.current
    const currentMeta = meta
    if (!isGuestMode || !user || !current || !currentMeta || claimingGuest.current) {
      return
    }
    claimingGuest.current = true
    setStatus('saving')
    setError(null)
    try {
      saveGuestTree(current, currentMeta.name)
      const loaded = await createFamilyFromStore(current, currentMeta.name)
      clearGuestTree()
      setSaveGuestOpen(false)
      navigate(`/trad/${loaded.meta.slug}`, { replace: true })
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Kunde inte spara trädet')
      // Allow a manual retry from the save dialog.
      window.setTimeout(() => {
        claimingGuest.current = false
      }, 800)
    }
  }, [isGuestMode, user, meta, navigate])

  // If the guest signs in (dialog, header menu, or magic-link return), claim the tree.
  useEffect(() => {
    if (!isGuestMode || !user || !store || !meta) return
    void promoteGuestTree()
  }, [isGuestMode, user, store, meta, promoteGuestTree])

  useEffect(() => {
    return () => {
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current)
    }
  }, [])

  const onChange = useCallback((next: FamilyStore) => {
    if (readOnly || !storeRef.current) return
    const nextHistory = pushHistory(historyRef.current, storeRef.current)
    historyRef.current = nextHistory
    storeRef.current = next
    setHistory(nextHistory)
    setStore(next)
  }, [readOnly])

  const onSetFocus = useCallback(
    (id: string) => {
      if (readOnly || !storeRef.current) return
      const nextHistory = pushHistory(historyRef.current, storeRef.current)
      const next = { ...storeRef.current, rootId: id }
      historyRef.current = nextHistory
      storeRef.current = next
      setHistory(nextHistory)
      setStore(next)
    },
    [readOnly],
  )

  const onUndo = useCallback(() => {
    if (readOnly || !storeRef.current) return
    const result = undoHistory(historyRef.current, storeRef.current)
    if (!result) return
    historyRef.current = result.history
    storeRef.current = result.store
    setHistory(result.history)
    setStore(result.store)
    setSelectedId((id) =>
      id && !result.store.profiles[id] ? result.store.rootId : id,
    )
  }, [readOnly])

  const onRedo = useCallback(() => {
    if (readOnly || !storeRef.current) return
    const result = redoHistory(historyRef.current, storeRef.current)
    if (!result) return
    historyRef.current = result.history
    storeRef.current = result.store
    setHistory(result.history)
    setStore(result.store)
    setSelectedId((id) =>
      id && !result.store.profiles[id] ? result.store.rootId : id,
    )
  }, [readOnly])

  const pendingRevealId = useRef<string | null>(null)

  const onCenter = useCallback(
    (id: string) => {
      if (!store) return
      const inView = treeLayout?.people.some((p) => p.id === id)
      if (!inView && treeView.type !== 'all') {
        pendingRevealId.current = id
        setTreeView({ type: 'all' })
        setSelectedId(id)
        return
      }
      pendingRevealId.current = null
      const person = treeLayout?.people.find((p) => p.id === id)
      if (!person) {
        setSelectedId(id)
        return
      }
      setCenterRequest({
        x: person.x + NODE_WIDTH / 2,
        y: person.y + NODE_HEIGHT / 2,
        key: Date.now(),
      })
      setSelectedId(id)
    },
    [store, treeLayout, treeView.type],
  )

  useEffect(() => {
    const id = pendingRevealId.current
    if (!id || !treeLayout || treeView.type !== 'all') return
    const person = treeLayout.people.find((p) => p.id === id)
    if (!person) return
    pendingRevealId.current = null
    setCenterRequest({
      x: person.x + NODE_WIDTH / 2,
      y: person.y + NODE_HEIGHT / 2,
      key: Date.now(),
    })
    setSelectedId(id)
  }, [treeLayout, treeView.type])

  const onChangeView = useCallback((next: TreeView) => {
    setTreeView(next)
  }, [])

  const revealCreatedPerson = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable

      if (e.key === 'Escape') {
        if (saveGuestOpen) {
          setSaveGuestOpen(false)
          return
        }
        if (shareOpen) {
          setShareOpen(false)
          return
        }
        if (quickAdd) {
          setQuickAdd(null)
          return
        }
        if (listOpen) {
          setListOpen(false)
          return
        }
        if (selectedId) {
          setSelectedId(null)
        }
        return
      }

      if (readOnly || typing) return

      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        if (e.shiftKey) onRedo()
        else onUndo()
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault()
        onRedo()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [quickAdd, listOpen, shareOpen, saveGuestOpen, selectedId, readOnly, onUndo, onRedo])

  const selectedRelation = useMemo(() => {
    if (!store || !selectedId || !focusId) return null
    return relationToFocus(store, selectedId, focusId)
  }, [store, selectedId, focusId])

  const statusHint = (() => {
    if (isViewMode) return null
    if (isGuestMode) {
      if (status === 'saving') return 'Sparar…'
      if (justSaved) return 'Sparat lokalt'
      if (status === 'error') return error ?? 'Kunde inte spara'
      return null
    }
    if (readOnly) return 'Logga in för att redigera'
    if (status === 'saving') return 'Sparar…'
    if (status === 'error') return error ?? 'Kunde inte spara'
    if (justSaved) return 'Sparat'
    return null
  })()

  if (status === 'loading' || !store || !meta) {
    if (status === 'error') {
      return (
        <div className="app app--state">
          <p>{error}</p>
        </div>
      )
    }
    return (
      <LoadingScreen
        title={slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : 'Släktträd'}
        message="Laddar släktträd"
      />
    )
  }

  if (status === 'error' && !store.nodes.length) {
    return (
      <div className="app app--state">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="app__brand">
            Släktträd
            {isViewMode ? ' · Delad länk' : isGuestMode ? ' · Gäst' : ''}
          </p>
          <TreeTitle
            name={meta.name}
            readOnly={readOnly}
            onRename={(name) => {
              setMeta((prev) => (prev ? { ...prev, name } : prev))
              document.title = `Släktträd · ${name}`
            }}
          />
        </div>
        <div className="app__header-actions">
          <div className="app__header-context">
            <PresenceAvatars peers={peers} self={presenceSelf} />            {statusHint ? (
              <p
                className={[
                  'app__hint',
                  status === 'saving' || justSaved ? 'app__hint--save' : '',
                  status === 'error' ? 'app__hint--error' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {statusHint}
              </p>
            ) : null}
          </div>
          <SearchBar store={store} onSelect={onCenter} />
          <button type="button" className="app__tool" onClick={() => setListOpen(true)}>
            Personer
          </button>
          <TreeViewMenu store={store} view={treeView} onChange={onChangeView} />
          {!readOnly ? (
            <>
              <button
                type="button"
                className="app__tool app__tool--icon app__tool--quiet"
                onClick={onUndo}
                disabled={history.past.length === 0}
                title="Ångra (Ctrl+Z)"
                aria-label="Ångra"
              >
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M7.2 4.3 3.5 8l3.7 3.7a.9.9 0 0 0 1.3-1.3L6.9 8.9H12a3.6 3.6 0 0 1 0 7.2H9.2a.9.9 0 1 0 0 1.8H12a5.4 5.4 0 1 0 0-10.8H6.9l1.6-1.5a.9.9 0 1 0-1.3-1.3Z"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="app__tool app__tool--icon app__tool--quiet"
                onClick={onRedo}
                disabled={history.future.length === 0}
                title="Gör om (Ctrl+Shift+Z)"
                aria-label="Gör om"
              >
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M12.8 4.3a.9.9 0 0 0-1.3 1.3L13.1 7.1H8a5.4 5.4 0 1 0 0 10.8h2.8a.9.9 0 1 0 0-1.8H8a3.6 3.6 0 1 1 0-7.2h5.1l-1.6 1.5a.9.9 0 1 0 1.3 1.3L16.5 8l-3.7-3.7Z"
                  />
                </svg>
              </button>
            </>
          ) : null}
          {isGuestMode ? (
            <button
              type="button"
              className="app__tool app__tool--primary"
              onClick={() => setSaveGuestOpen(true)}
              title="Spara trädet med e-post"
            >
              Spara…
            </button>
          ) : null}
          <button
            type="button"
            className="app__tool app__tool--icon app__tool--quiet"
            onClick={() => window.print()}
            title="Skriv ut"
            aria-label="Skriv ut"
          >
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
                d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z"
              />
            </svg>
          </button>
          {!readOnly && meta.shareToken ? (
            <button
              type="button"
              className="app__tool app__tool--icon"
              title="Dela träd"
              aria-label="Dela träd"
              onClick={() => setShareOpen(true)}
            >
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
                <path
                  fill="currentColor"
                  d="M8.2 11.8a3.2 3.2 0 0 1 0-4.5l1.8-1.8a3.2 3.2 0 1 1 4.5 4.5l-.9.9a.9.9 0 1 1-1.3-1.3l.9-.9a1.4 1.4 0 1 0-2-2L9.4 8.5a1.4 1.4 0 0 0 0 2l.2.2a.9.9 0 1 1-1.3 1.3l-.1-.2Zm3.6-3.6a3.2 3.2 0 0 1 0 4.5l-1.8 1.8a3.2 3.2 0 1 1-4.5-4.5l.9-.9a.9.9 0 1 1 1.3 1.3l-.9.9a1.4 1.4 0 1 0 2 2l1.8-1.8a1.4 1.4 0 0 0 0-2l-.2-.2a.9.9 0 1 1 1.3-1.3l.1.2Z"
                />
              </svg>
            </button>
          ) : null}
          <AuthMenu
            avatarUrl={user ? avatarUrlForUserInTree(user, store.profiles) : null}
          />
        </div>
      </header>

      <main className="app__main">
        <PinchZoomPan
          centerRequest={centerRequest}
          fitRequest={fitRequest}
          onPointerWorldMove={publishCursor}
          minimapInsetRight={selectedId ? 380 : 0}
          minimap={
            treeLayout
              ? {
                  width: treeLayout.width,
                  height: treeLayout.height,
                  nodeWidth: NODE_WIDTH,
                  nodeHeight: NODE_HEIGHT,
                  markers: treeLayout.people.map((p) => ({
                    x: p.x,
                    y: p.y,
                    gender: String(p.gender),
                  })),
                }
              : null
          }
          onBackgroundClick={() => {
            if (quickAdd || shareOpen || listOpen) return
            setSelectedId(null)
          }}
        >
          {treeLayout ? (
            <div
              className="family-tree"
              style={{ width: treeLayout.width, height: treeLayout.height }}
            >
              {treeLayout.connectors.map((line, index) => {
                if (line.kind === 'spouse' && line.spouseIds && !readOnly) {
                  const [aId, bId] = line.spouseIds
                  const aName = store.profiles[aId]?.name ?? 'partner'
                  const bName = store.profiles[bId]?.name ?? 'partner'
                  return (
                    <SpouseEdge
                      key={`c-${index}`}
                      line={line}
                      label={`${aName} och ${bName}`}
                      onAddChild={() => {
                        setSelectedId(aId)
                        setQuickAdd({
                          personId: aId,
                          kind: 'child',
                          coParentId: bId,
                        })
                      }}
                    />
                  )
                }
                return (
                  <i
                    key={`c-${index}`}
                    className={`family-tree__connector family-tree__connector--${line.kind}`}
                    style={{
                      left: Math.min(line.x1, line.x2),
                      top: Math.min(line.y1, line.y2),
                      width: Math.max(
                        Math.abs(line.x2 - line.x1),
                        line.kind === 'spouse' ? 2 : 1.5,
                      ),
                      height: Math.max(
                        Math.abs(line.y2 - line.y1),
                        line.kind === 'spouse' ? 2 : 1.5,
                      ),
                    }}
                  />
                )
              })}
              {treeLayout.people.map((person) => {
                const graphNode = store.nodes.find((n) => n.id === person.id)
                return (
                  <PersonCard
                    key={person.id}
                    node={person}
                    profile={store.profiles[person.id]}
                    relationLabel={relationToFocus(store, person.id, focusId)}
                    isSelected={person.id === selectedId}
                    isFocus={person.id === focusId}
                    readOnly={readOnly}
                    canAddPartner={(graphNode?.spouses.length ?? 0) === 0}
                    canAddParent={(graphNode?.parents.length ?? 0) < 2}
                    onSelect={setSelectedId}
                    onQuickAdd={(id, kind) => {
                      if (readOnly) return
                      setSelectedId(id)
                      setQuickAdd({ personId: id, kind })
                    }}
                    style={{
                      width: NODE_WIDTH,
                      height: NODE_HEIGHT,
                      transform: `translate(${person.x}px, ${person.y}px)`,
                    }}
                  />
                )
              })}
              <RemoteCursors cursors={remoteCursors} />
            </div>
          ) : null}
        </PinchZoomPan>

        {selectedId && !listOpen ? (
          <PersonPanel
            store={store}
            selectedId={selectedId}
            treeSlug={meta.slug}
            readOnly={readOnly}
            relationLabel={selectedRelation}
            onChange={onChange}
            onClose={() => setSelectedId(null)}
            onCenter={onCenter}
            onSetFocus={onSetFocus}
            onPersonCreated={revealCreatedPerson}
            onPersonDeleted={() => {
              setSelectedId(null)
            }}
          />
        ) : null}

        {listOpen ? (
          <PersonList
            store={store}
            focusId={focusId}
            onSelect={onCenter}
            onClose={() => setListOpen(false)}
          />
        ) : null}

        {!readOnly && quickAdd ? (
          <QuickAddDialog
            store={store}
            personId={quickAdd.personId}
            coParentId={quickAdd.coParentId}
            kind={quickAdd.kind}
            onChange={onChange}
            onClose={() => setQuickAdd(null)}
            onCreated={(id) => {
              revealCreatedPerson(id)
              // Defer center until layout includes the new node
              window.setTimeout(() => onCenter(id), 0)
            }}
          />
        ) : null}

        {isGuestMode && saveGuestOpen ? (
          <SaveGuestDialog
            treeName={meta.name}
            onClose={() => setSaveGuestOpen(false)}
            onSignedIn={() => {
              void promoteGuestTree()
            }}
          />
        ) : null}

        {!readOnly && shareOpen && meta.shareToken ? (
          <ShareDialog
            url={shareUrlForToken(meta.shareToken)}
            treeId={meta.id}
            canInvite={
              !!user &&
              (meta.ownerId == null || meta.ownerId === user.id)
            }
            onClose={() => setShareOpen(false)}
          />
        ) : null}
      </main>

      <section className="print-sheet" aria-hidden>
        <h1>{meta.name}</h1>
        <p className="print-sheet__meta">
          Centrum: {store.profiles[focusId]?.name ?? focusName} ·{' '}
          {printPeople.length} personer
        </p>
        <div className="print-sheet__list">
          {printPeople.map((person) => (
            <div key={person.id} className="print-sheet__row">
              <span className="print-sheet__name">
                {person.name}
                {person.nickname?.trim() ? ` (${person.nickname.trim()})` : ''}
              </span>
              <span className="print-sheet__rel">
                {relationToFocus(store, person.id, focusId) ?? ''}
              </span>
              <span className="print-sheet__years">
                {personLifeLabel(person) ?? ''}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default TreeApp
