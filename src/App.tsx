import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BloodEdge } from './components/BloodEdge'
import { ExportMenu } from './components/ExportMenu'
import { FamilyMemoryPanel } from './components/FamilyMemoryPanel'
import { HistoryDialog } from './components/HistoryDialog'
import { AuthMenu } from './components/AuthMenu'
import { ToastStack, type ToastItem, type ToastTone } from './components/ToastStack'
import { LoadingScreen } from './components/LoadingScreen'
import { PersonCard } from './components/PersonCard'
import { PersonList } from './components/PersonList'
import { PersonPanel } from './components/PersonPanel'
import {
  RelationPanel,
  type SelectedEdge,
} from './components/RelationPanel'
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
  persistCheckpoints,
  withLoadedCheckpoints,
} from './lib/checkpoints'
import {
  emptyHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type StoreHistory,
} from './lib/history'
import { layoutTree, type LayoutMode } from './lib/layout'
import { personLifeLabel, formatPlace } from './lib/personLife'
import { relationToFocus } from './lib/relationship'
import {
  linkParentChild,
  linkSpouse,
  soleSpouseId,
  updateProfile,
} from './lib/relations'
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
import { markTreeOpened } from './lib/recentTrees'
import { nearIds, nodesForView, type TreeView } from './lib/treeView'

import type { FamilyStore, TreeMeta } from './types'
import './App.css'
import './print.css'

const NODE_WIDTH = 216
const NODE_HEIGHT = 108
const TREE_NAME_CACHE_KEY = 'slakttrad-tree-names'
const COACH_DISMISS_KEY = 'slakttrad-coach-dismissed'
const LINK_DRAG_THRESHOLD = 6

function readCoachDismissed(): boolean {
  try {
    return localStorage.getItem(COACH_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function sameEdge(a: SelectedEdge | null, b: SelectedEdge | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false
  if (a.kind === 'spouse' && b.kind === 'spouse') {
    return (
      (a.aId === b.aId && a.bId === b.bId) ||
      (a.aId === b.bId && a.bId === b.aId)
    )
  }
  if (a.kind === 'blood' && b.kind === 'blood') {
    return (
      a.childIds.length === b.childIds.length &&
      a.childIds.every((id) => b.childIds.includes(id)) &&
      a.parentIds.length === b.parentIds.length &&
      a.parentIds.every((id) => b.parentIds.includes(id))
    )
  }
  return false
}

function edgeKey(edge: SelectedEdge): string {
  if (edge.kind === 'spouse') {
    return `s:${[edge.aId, edge.bId].sort().join('+')}`
  }
  const parents = [...edge.parentIds].sort().join(',')
  const children = [...edge.childIds].sort().join(',')
  return `b:${parents}>${children}`
}

type LinkDrag = {
  fromId: string
  kind: QuickAddKind
  originX: number
  originY: number
  currentX: number
  currentY: number
  hoverId: string | null
  moved: boolean
}

function handleWorldPoint(
  person: { x: number; y: number },
  kind: QuickAddKind,
) {
  if (kind === 'parent') {
    return { x: person.x + NODE_WIDTH / 2, y: person.y + 4 }
  }
  if (kind === 'child') {
    return { x: person.x + NODE_WIDTH / 2, y: person.y + NODE_HEIGHT - 4 }
  }
  return { x: person.x + NODE_WIDTH - 4, y: person.y + NODE_HEIGHT / 2 }
}

function personIdFromPoint(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY)
  const host = el?.closest('[data-person-id]') as HTMLElement | null
  return host?.dataset.personId ?? null
}

function firstName(fullName: string | undefined, fallback: string) {
  if (!fullName?.trim()) return fallback
  return fullName.trim().split(/\s+/)[0] ?? fallback
}

function readTreeNameCache(slug: string | undefined): string | null {
  if (!slug) return null
  try {
    const raw = sessionStorage.getItem(TREE_NAME_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, string>
    const value = parsed[slug]
    return typeof value === 'string' && value.trim() ? value : null
  } catch {
    return null
  }
}

function writeTreeNameCache(slug: string, name: string) {
  try {
    const raw = sessionStorage.getItem(TREE_NAME_CACHE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    parsed[slug] = name
    sessionStorage.setItem(TREE_NAME_CACHE_KEY, JSON.stringify(parsed))
  } catch {
    // Ignore storage failures; the loading screen can fall back to a generic title.
  }
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
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<SelectedEdge | null>(null)
  const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null)
  const edgeHoverClearRef = useRef<number | null>(null)
  const [linkDrag, setLinkDrag] = useState<LinkDrag | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [treeView, setTreeView] = useState<TreeView>({ type: 'all' })
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    try {
      const raw = localStorage.getItem('slakttrad.layoutMode')
      if (raw === 'pedigree' || raw === 'fan' || raw === 'full') return raw
    } catch {
      /* ignore */
    }
    return 'full'
  })
  const [coachDismissed, setCoachDismissed] = useState(readCoachDismissed)
  const linkDragRef = useRef<LinkDrag | null>(null)
  linkDragRef.current = linkDrag

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const setEdgeHover = useCallback((edge: SelectedEdge | null) => {
    if (edgeHoverClearRef.current != null) {
      window.clearTimeout(edgeHoverClearRef.current)
      edgeHoverClearRef.current = null
    }
    if (edge) {
      setHoveredEdge(edge)
      return
    }
    // Debounce clear so moving between segments of the same link doesn't flicker.
    edgeHoverClearRef.current = window.setTimeout(() => {
      setHoveredEdge(null)
      edgeHoverClearRef.current = null
    }, 50)
  }, [])

  const showToast = useCallback((message: string, tone: ToastTone = 'error') => {
    const id = crypto.randomUUID().slice(0, 10)
    setToasts((prev) => [...prev.slice(-4), { id, message, tone }])
  }, [])
  const [history, setHistory] = useState<StoreHistory>(emptyHistory)
  const skipNextSave = useRef(true)
  const didInitialFit = useRef(false)
  const savedFlashTimer = useRef<number | null>(null)
  const claimingGuest = useRef(false)
  const storeRef = useRef(store)
  const historyRef = useRef(history)
  storeRef.current = store
  historyRef.current = history

  const isTreeOwner =
    isGuestMode || !meta?.ownerId || (!!user && meta.ownerId === user.id)

  const linkedPerson = useMemo(() => {
    if (!user || !store) return null
    return personProfileForUser(user, store.profiles)
  }, [user, store])

  /** Session focus for filters/layout — never mutates shared rootId for collaborators. */
  const viewFocusId = linkedPerson && !isTreeOwner ? linkedPerson.id : (store?.rootId ?? '')
  const lockNearFilter = Boolean(linkedPerson && !isTreeOwner)

  const focusId = viewFocusId
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
    const umeta = user.user_metadata ?? {}
    if (umeta.avatar_url === person.photoUrl) return
    void supabase.auth.updateUser({
      data: {
        avatar_url: person.photoUrl,
        full_name: person.name || umeta.full_name,
      },
    })
  }, [user, store])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('slakttrad.theme')
      const mode = raw === 'dark' || raw === 'light' ? raw : null
      if (mode) document.documentElement.dataset.theme = mode
    } catch {
      /* ignore */
    }
  }, [])

  // Collaborators: auto-claim matching person by email, then lock to their near branch.
  const autoClaimedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!user || !store || !meta || isGuestMode || isViewMode) return
    if (isTreeOwner) return
    if (autoClaimedRef.current === meta.id) return

    const existing = personProfileForUser(user, store.profiles)
    if (existing) {
      autoClaimedRef.current = meta.id
      setTreeView({ type: 'near' })
      return
    }

    const email = user.email?.trim().toLowerCase()
    if (!email) return

    const match = Object.values(store.profiles).find((p) => {
      const profileEmail = p.email?.trim().toLowerCase()
      const invited = p.invitedEmail?.trim().toLowerCase()
      if (profileEmail !== email && invited !== email) return false
      if (p.claimedByUserId && p.claimedByUserId !== user.id) return false
      return true
    })
    if (!match) return

    autoClaimedRef.current = meta.id
    let next = store
    for (const p of Object.values(store.profiles)) {
      if (p.claimedByUserId === user.id && p.id !== match.id) {
        next = updateProfile(next, p.id, { claimedByUserId: '' })
      }
    }
    next = updateProfile(next, match.id, {
      claimedByUserId: user.id,
      email: user.email ?? match.email,
    })
    // Avoid treating this as a user edit that needs history; persist via normal save.
    skipNextSave.current = false
    setStore(next)
    storeRef.current = next
    setTreeView({ type: 'near' })
    void supabase.auth.updateUser({
      data: {
        linked_person_id: match.id,
        full_name: match.name,
      },
    })
  }, [user, store, meta, isGuestMode, isViewMode, isTreeOwner])

  // Keep locked collaborators on near even if something tries to switch view.
  useEffect(() => {
    if (!lockNearFilter) return
    if (treeView.type !== 'near') setTreeView({ type: 'near' })
  }, [lockNearFilter, treeView.type])

  const treeLayout = useMemo(() => {
    if (!store || !focusId) return null
    const nodes = nodesForView(store, treeView, focusId)
    return layoutTree(nodes, {
      mode: layoutMode,
      rootId: focusId,
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
    })
  }, [store?.nodes, store?.profiles, store?.rootId, focusId, treeView, layoutMode])

  // Fit canvas when the active view changes (or first layout after load)
  const viewKey =
    `${layoutMode}:` +
    (treeView.type === 'surname' ? `surname:${treeView.surname}` : treeView.type)
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

  const showCoach = useMemo(() => {
    if (readOnly || coachDismissed || !store) return false
    if (store.nodes.length !== 1) return false
    const node = store.nodes[0]
    if (!node) return false
    return (
      node.parents.length === 0 &&
      node.spouses.length === 0 &&
      node.children.length === 0
    )
  }, [readOnly, coachDismissed, store])

  const dismissCoach = useCallback(() => {
    setCoachDismissed(true)
    try {
      localStorage.setItem(COACH_DISMISS_KEY, '1')
    } catch {
      // Ignore storage failures; dismiss still applies for this session.
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    didInitialFit.current = false
    setStatus('loading')
    setStore(null)
    setMeta(null)
    setHistory(emptyHistory())
    setListOpen(false)
    setQuickAdd(null)
    setSelectedEdge(null)
    setLinkDrag(null)
    setTreeView({ type: 'all' })
    autoClaimedRef.current = null

    if (isGuestMode) {
      const guest = loadOrCreateGuestTree()
      if (!cancelled) {
        skipNextSave.current = true
        setStore(withLoadedCheckpoints(guest.store, GUEST_TREE_ID))
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
        setStore(withLoadedCheckpoints(loaded.store, loaded.meta.id))
        setMeta(loaded.meta)
        setSelectedId(null)
        setStatus('ready')
        setError(null)
        writeTreeNameCache(loaded.meta.slug, loaded.meta.name)
        if (!shareToken) markTreeOpened(loaded.meta.slug)
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
        if (store.checkpoints) {
          persistCheckpoints(meta.id, store.checkpoints)
        }
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
            showToast(err instanceof Error ? err.message : 'Kunde inte spara')
            setStatus('ready')
          }
        }
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [store, meta, readOnly, isGuestMode, showToast])

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
      setStatus('ready')
      showToast(err instanceof Error ? err.message : 'Kunde inte spara trädet')
      // Allow a manual retry from the save dialog.
      window.setTimeout(() => {
        claimingGuest.current = false
      }, 800)
    }
  }, [isGuestMode, user, meta, navigate, showToast])

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

  const finishLinkDrag = useCallback(
    (drag: LinkDrag, clientX: number, clientY: number) => {
      setLinkDrag(null)
      linkDragRef.current = null
      if (readOnly || !storeRef.current) return

      const targetId =
        drag.hoverId && drag.hoverId !== drag.fromId
          ? drag.hoverId
          : personIdFromPoint(clientX, clientY)

      if (targetId && targetId !== drag.fromId) {
        try {
          let next = storeRef.current
          if (drag.kind === 'partner') {
            next = linkSpouse(next, drag.fromId, targetId)
          } else if (drag.kind === 'child') {
            next = linkParentChild(next, drag.fromId, targetId)
          } else {
            next = linkParentChild(next, targetId, drag.fromId)
          }
          onChange(next)
          setSelectedId(targetId)
          setSelectedEdge(null)
          return
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Kunde inte koppla')
          return
        }
      }

      if (!drag.moved) {
        setSelectedId(drag.fromId)
        const coParentId =
          drag.kind === 'child' ? soleSpouseId(storeRef.current!, drag.fromId) : undefined
        setQuickAdd({ personId: drag.fromId, kind: drag.kind, coParentId })
      }
    },
    [onChange, readOnly, showToast],
  )

  const onLinkDragStart = useCallback(
    (personId: string, kind: QuickAddKind, _clientX: number, _clientY: number) => {
      if (readOnly || !treeLayout) return
      const person = treeLayout.people.find((p) => p.id === personId)
      if (!person) return
      const origin = handleWorldPoint(person, kind)
      const start: LinkDrag = {
        fromId: personId,
        kind,
        originX: origin.x,
        originY: origin.y,
        currentX: origin.x,
        currentY: origin.y,
        hoverId: null,
        moved: false,
      }
      linkDragRef.current = start
      setLinkDrag(start)
      setSelectedEdge(null)
      setSelectedId(personId)

      const onMove = (e: PointerEvent) => {
        const current = linkDragRef.current
        if (!current) return
        const el = document.querySelector('.family-tree') as HTMLElement | null
        const viewport = el?.closest('.pan-zoom') as HTMLElement | null
        if (!viewport) return
        const rect = viewport.getBoundingClientRect()
        const worldLayer = viewport.querySelector(
          '.pan-zoom__canvas',
        ) as HTMLElement | null
        let scale = 1
        let ox = 0
        let oy = 0
        if (worldLayer) {
          const t = getComputedStyle(worldLayer).transform
          if (t && t !== 'none') {
            const m = new DOMMatrixReadOnly(t)
            scale = m.a || 1
            ox = m.e
            oy = m.f
          }
        }
        const wx = (e.clientX - rect.left - ox) / scale
        const wy = (e.clientY - rect.top - oy) / scale
        const dx = wx - current.originX
        const dy = wy - current.originY
        const moved =
          current.moved || Math.hypot(dx, dy) * scale >= LINK_DRAG_THRESHOLD
        const hoverRaw = personIdFromPoint(e.clientX, e.clientY)
        const hoverId =
          hoverRaw && hoverRaw !== current.fromId ? hoverRaw : null
        const next = { ...current, currentX: wx, currentY: wy, hoverId, moved }
        linkDragRef.current = next
        setLinkDrag(next)
      }

      const onUp = (e: PointerEvent) => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        const current = linkDragRef.current
        if (!current) return
        finishLinkDrag(current, e.clientX, e.clientY)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [finishLinkDrag, readOnly, treeLayout],
  )

  const onSetFocus = useCallback(
    (id: string) => {
      // Only the tree owner may change the shared saved centrum (rootId).
      if (readOnly || !isTreeOwner || !storeRef.current) return
      const nextHistory = pushHistory(historyRef.current, storeRef.current)
      const next = { ...storeRef.current, rootId: id }
      historyRef.current = nextHistory
      storeRef.current = next
      setHistory(nextHistory)
      setStore(next)
    },
    [readOnly, isTreeOwner],
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
        if (lockNearFilter) {
          setSelectedId(id)
          showToast('Personen syns inte i din gren av trädet')
          return
        }
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
    [store, treeLayout, treeView.type, lockNearFilter, showToast],
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

  const onChangeView = useCallback(
    (next: TreeView) => {
      if (lockNearFilter && next.type !== 'near') return
      setTreeView(next)
    },
    [lockNearFilter],
  )
  const onChangeLayoutMode = useCallback((mode: LayoutMode) => {
    setLayoutMode(mode)
    try {
      localStorage.setItem('slakttrad.layoutMode', mode)
    } catch {
      /* ignore */
    }
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
        if (historyOpen) {
          setHistoryOpen(false)
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
        if (selectedEdge) {
          setSelectedEdge(null)
          return
        }
        if (selectedId) {
          setSelectedId(null)
        }
        return
      }

      if (typing) return

      const modalOpen =
        Boolean(quickAdd) || shareOpen || listOpen || historyOpen || saveGuestOpen

      if (
        !modalOpen &&
        selectedId &&
        treeLayout &&
        (e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown')
      ) {
        e.preventDefault()
        const dirX =
          e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
        const dirY = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
        const current = treeLayout.people.find((p) => p.id === selectedId)
        if (!current) return
        const cx = current.x + NODE_WIDTH / 2
        const cy = current.y + NODE_HEIGHT / 2
        let bestId: string | null = null
        let bestDist = Infinity
        for (const person of treeLayout.people) {
          if (person.id === selectedId) continue
          const px = person.x + NODE_WIDTH / 2
          const py = person.y + NODE_HEIGHT / 2
          const dx = px - cx
          const dy = py - cy
          const dot = dx * dirX + dy * dirY
          if (dot <= 0) continue
          const len = Math.hypot(dx, dy)
          if (len < 1e-6) continue
          // Within ~60° of the arrow direction
          if (dot / len < 0.5) continue
          if (len < bestDist) {
            bestDist = len
            bestId = person.id
          }
        }
        if (!bestId) return
        const next = treeLayout.people.find((p) => p.id === bestId)
        if (!next) return
        setSelectedId(bestId)
        setCenterRequest({
          x: next.x + NODE_WIDTH / 2,
          y: next.y + NODE_HEIGHT / 2,
          key: Date.now(),
        })
        return
      }

      if (readOnly) return

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
  }, [
    quickAdd,
    listOpen,
    shareOpen,
    saveGuestOpen,
    historyOpen,
    selectedEdge,
    selectedId,
    readOnly,
    onUndo,
    onRedo,
    treeLayout,
  ])

  const selectedRelation = useMemo(() => {
    if (!store || !selectedId || !focusId) return null
    return relationToFocus(store, selectedId, focusId)
  }, [store, selectedId, focusId])

  const hoveredRelationIds = useMemo(() => {
    if (!store || !hoveredPersonId) return null
    const ids = nearIds(store, hoveredPersonId)
    return ids.size ? ids : null
  }, [store, hoveredPersonId])

  const headerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const update = () => {
      document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const viewScopeHint =
    treeView.type === 'near'
      ? lockNearFilter
        ? `Filter: Din gren kring ${firstName(store?.profiles[focusId]?.name, 'dig')}`
        : `Filter: Nära centrum (${firstName(store?.profiles[focusId]?.name, 'centrum')})`
      : treeView.type === 'surname'
        ? `Filter: Efternamn ${treeView.surname}`
        : null

  const statusHint = (() => {
    if (isViewMode) return null
    if (isGuestMode) {
      if (status === 'saving') return 'Sparar…'
      if (justSaved) return 'Sparat lokalt'
      return null
    }
    if (readOnly) return 'Logga in för att redigera'
    if (status === 'saving') return 'Sparar…'
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
    const loadingTitle =
      (isGuestMode ? meta?.name : readTreeNameCache(slug)) || 'Släktträd'
    return (
      <LoadingScreen
        title={loadingTitle}
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
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <header className="app__header" ref={headerRef}>
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
              writeTreeNameCache(meta.slug, name)
              document.title = `Släktträd · ${name}`
            }}
          />
        </div>
        <div className="app__header-actions">
          <div className="app__header-context">
            <PresenceAvatars peers={peers} self={presenceSelf} />
            {statusHint ? (
              <p
                className={[
                  'app__hint',
                  status === 'saving' || justSaved ? 'app__hint--save' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {statusHint}
              </p>
            ) : null}
            {viewScopeHint ? <p className="app__hint app__hint--branch">{viewScopeHint}</p> : null}
          </div>
          <SearchBar store={store} onSelect={onCenter} />
          <button type="button" className="app__tool app__tool--list-label" onClick={() => setListOpen(true)}>
            Öppna personlista
          </button>
          <button
            type="button"
            className="app__tool app__tool--icon app__tool--list-icon"
            onClick={() => setListOpen(true)}
            title="Öppna personlista"
            aria-label="Öppna personlista"
          >
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
              <path fill="currentColor" d="M3 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Z"/>
            </svg>
          </button>
          <span className="app__header-desktop-only">
            <TreeViewMenu
              store={store}
              view={treeView}
              onChange={onChangeView}
              layoutMode={layoutMode}
              onChangeLayoutMode={onChangeLayoutMode}
              lockNearFilter={lockNearFilter}
            />
          </span>
          {!readOnly ? (
            <>
              <button
                type="button"
                className="app__tool app__tool--icon app__tool--quiet app__header-desktop-only"
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
                className="app__tool app__tool--icon app__tool--quiet app__header-desktop-only"
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
          <span className="app__header-desktop-only">
            <ExportMenu
              store={store}
              treeName={meta.name}
              layout={treeLayout}
              nodeWidth={NODE_WIDTH}
              nodeHeight={NODE_HEIGHT}
              readOnly={readOnly}
              onImport={(next) => onChange(next)}
              onOpenHistory={() => setHistoryOpen(true)}
            />
          </span>
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
          minimapInsetRight={selectedId || selectedEdge ? 380 : 0}
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
            if (quickAdd || shareOpen || listOpen || historyOpen || linkDrag) return
            setSelectedId(null)
            setSelectedEdge(null)
            setHoveredEdge(null)
            setHoveredPersonId(null)
          }}
        >
          {treeLayout ? (
            <div
              className={[
                'family-tree',
                linkDrag ? 'family-tree--linking' : '',
                hoveredRelationIds ? 'family-tree--hovering-person' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ width: treeLayout.width, height: treeLayout.height }}
            >
              {treeLayout.connectors.map((line, index) => {
                if (line.kind === 'spouse' && line.spouseIds && !readOnly) {
                  const [aId, bId] = line.spouseIds
                  const aName = store.profiles[aId]?.name ?? 'partner'
                  const bName = store.profiles[bId]?.name ?? 'partner'
                  const edge: SelectedEdge = { kind: 'spouse', aId, bId }
                  const key = edgeKey(edge)
                  const relatedToHover =
                    !!hoveredRelationIds &&
                    hoveredRelationIds.has(aId) &&
                    hoveredRelationIds.has(bId)
                  const active =
                    sameEdge(selectedEdge, edge) ||
                    sameEdge(hoveredEdge, edge) ||
                    relatedToHover
                  return (
                    <SpouseEdge
                      key={`c-${index}`}
                      line={line}
                      label={`${aName} och ${bName}`}
                      edgeKey={key}
                      active={active}
                      muted={!!hoveredRelationIds && !relatedToHover}
                      onSelect={() => {
                        setSelectedId(null)
                        setSelectedEdge(edge)
                      }}
                      onHoverChange={(hovered) =>
                        setEdgeHover(hovered ? edge : null)
                      }
                    />
                  )
                }
                if (line.kind === 'blood' && line.bloodLink && !readOnly) {
                  const { childIds, parentIds } = line.bloodLink
                  const edge: SelectedEdge = {
                    kind: 'blood',
                    childIds,
                    parentIds,
                  }
                  const key = edgeKey(edge)
                  const relatedToHover =
                    !!hoveredRelationIds &&
                    parentIds.some((id) => hoveredRelationIds.has(id)) &&
                    childIds.some((id) => hoveredRelationIds.has(id))
                  const active =
                    sameEdge(selectedEdge, edge) ||
                    sameEdge(hoveredEdge, edge) ||
                    relatedToHover
                  const labelChild =
                    childIds.length === 1
                      ? (store.profiles[childIds[0]!]?.name ?? 'barn')
                      : `${childIds.length} barn`
                  return (
                    <BloodEdge
                      key={`c-${index}`}
                      line={line}
                      childName={labelChild}
                      edgeKey={key}
                      active={active}
                      muted={!!hoveredRelationIds && !relatedToHover}
                      onSelect={() => {
                        setSelectedId(null)
                        setSelectedEdge(edge)
                      }}
                      onHoverChange={(hovered) =>
                        setEdgeHover(hovered ? edge : null)
                      }
                    />
                  )
                }
                return (
                  <i
                    key={`c-${index}`}
                    className={[
                      `family-tree__connector family-tree__connector--${line.kind}`,
                      hoveredRelationIds ? 'family-tree__connector--muted' : '',
                    ].join(' ')}
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
                    isMuted={!!hoveredRelationIds && !hoveredRelationIds.has(person.id)}
                    isDropTarget={linkDrag?.hoverId === person.id}
                    readOnly={readOnly}
                    canAddParent={(graphNode?.parents.length ?? 0) < 2}
                    onSelect={(id) => {
                      setSelectedEdge(null)
                      setSelectedId(id)
                    }}
                    onQuickAdd={(id, kind) => {
                      if (readOnly) return
                      setSelectedEdge(null)
                      setSelectedId(id)
                      const coParentId =
                        kind === 'child' ? soleSpouseId(store, id) : undefined
                      setQuickAdd({ personId: id, kind, coParentId })
                    }}
                    onLinkDragStart={onLinkDragStart}
                    onHoverChange={setHoveredPersonId}
                    style={{
                      width: NODE_WIDTH,
                      height: NODE_HEIGHT,
                      transform: `translate(${person.x}px, ${person.y}px)`,
                    }}
                  />
                )
              })}
              {linkDrag?.moved ? (
                <svg
                  className="family-tree__link-drag"
                  width={treeLayout.width}
                  height={treeLayout.height}
                  aria-hidden
                >
                  <line
                    x1={linkDrag.originX}
                    y1={linkDrag.originY}
                    x2={linkDrag.currentX}
                    y2={linkDrag.currentY}
                    className={[
                      'family-tree__link-drag-line',
                      `family-tree__link-drag-line--${linkDrag.kind}`,
                      linkDrag.hoverId
                        ? 'family-tree__link-drag-line--valid'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                  <circle
                    cx={linkDrag.currentX}
                    cy={linkDrag.currentY}
                    r={5}
                    className={[
                      'family-tree__link-drag-tip',
                      `family-tree__link-drag-tip--${linkDrag.kind}`,
                    ].join(' ')}
                  />
                </svg>
              ) : null}
              <RemoteCursors cursors={remoteCursors} />
            </div>
          ) : null}
        </PinchZoomPan>
        {selectedId ? (
          <FamilyMemoryPanel
            store={store}
            selectedId={selectedId}
            focusId={focusId}
            onCenter={onCenter}
          />
        ) : null}

        {showCoach ? (
          <aside className="app__coach" role="status">
            <h2 className="app__coach-title">Kom igång</h2>
            <p className="app__coach-body">
              Lägg till partner, förälder eller barn via ikonerna på personkortet — eller
              dra från handtaget till en annan person.
            </p>
            <button type="button" className="app__tool" onClick={dismissCoach}>
              Jag förstår
            </button>
          </aside>
        ) : null}

        {selectedId && !listOpen ? (
          <PersonPanel
            store={store}
            selectedId={selectedId}
            treeSlug={meta.slug}
            treeId={meta.id}
            readOnly={readOnly}
            canInvitePerson={
              !!user &&
              !readOnly &&
              (meta.ownerId == null || meta.ownerId === user.id)
            }
            relationLabel={selectedRelation}
            onChange={onChange}
            onClose={() => setSelectedId(null)}
            onCenter={onCenter}
            onSetFocus={onSetFocus}
            canSetTreeFocus={isTreeOwner}
            onPersonCreated={revealCreatedPerson}
            onPersonDeleted={() => {
              setSelectedId(null)
            }}
          />
        ) : null}

        {selectedEdge && !listOpen && !selectedId ? (
          <RelationPanel
            store={store}
            edge={selectedEdge}
            readOnly={readOnly}
            onChange={onChange}
            onClose={() => setSelectedEdge(null)}
            onCenter={(id) => {
              setSelectedEdge(null)
              onCenter(id)
            }}
            onAddSharedChild={(aId, bId) => {
              setSelectedEdge(null)
              setSelectedId(aId)
              setQuickAdd({
                personId: aId,
                kind: 'child',
                coParentId: bId,
              })
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
            treeSlug={meta.slug}
            treeName={meta.name}
            canInvite={
              !!user &&
              (meta.ownerId == null || meta.ownerId === user.id)
            }
            onRotated={(next) => setMeta(next)}
            onClose={() => setShareOpen(false)}
          />
        ) : null}

        {!readOnly && historyOpen ? (
          <HistoryDialog
            store={store}
            onChange={onChange}
            onClose={() => setHistoryOpen(false)}
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
              <div className="print-sheet__identity">
                <span className="print-sheet__name">
                  {person.name}
                  {person.nickname?.trim() ? ` (${person.nickname.trim()})` : ''}
                  {person.maidenName?.trim()
                    ? ` f. ${person.maidenName.trim()}`
                    : ''}
                </span>
                {person.occupation?.trim() ? (
                  <span className="print-sheet__occ">{person.occupation.trim()}</span>
                ) : null}
                {person.religion?.trim() ? (
                  <span className="print-sheet__occ">{person.religion.trim()}</span>
                ) : null}
                {formatPlace(person.birthPlace, person.birthCountry) ||
                formatPlace(person.deathPlace, person.deathCountry) ||
                formatPlace(person.residencePlace, person.residenceCountry) ? (
                  <span className="print-sheet__place">
                    {[
                      formatPlace(person.birthPlace, person.birthCountry)
                        ? `Född: ${formatPlace(person.birthPlace, person.birthCountry)}`
                        : null,
                      formatPlace(person.deathPlace, person.deathCountry)
                        ? `Död: ${formatPlace(person.deathPlace, person.deathCountry)}`
                        : null,
                      formatPlace(person.residencePlace, person.residenceCountry)
                        ? `Bor: ${formatPlace(person.residencePlace, person.residenceCountry)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                ) : null}
                {person.sources?.trim() ? (
                  <span className="print-sheet__events">
                    Källa: {person.sources.trim()}
                  </span>
                ) : null}
                {(person.events ?? []).length > 0 ? (
                  <span className="print-sheet__events">
                    {(person.events ?? [])
                      .map((ev) =>
                        [ev.title || ev.type, ev.date, ev.place]
                          .filter(Boolean)
                          .join(' '),
                      )
                      .join(' · ')}
                  </span>
                ) : null}
              </div>
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
