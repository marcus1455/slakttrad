import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import {
  avatarUrlForUserInTree,
  displayNameFromUser,
} from '../lib/userDisplay'
import type { PersonProfile } from '../types'
import {
  colorFromKey,
  getPresenceKey,
  peersFromPresenceState,
  resolvePresenceRole,
  treeChannelName,
  type CursorPayload,
  type PresencePeer,
  type RemoteCursor,
} from '../lib/treePresence'

const CURSOR_THROTTLE_MS = 50

type Options = {
  treeId: string | null | undefined
  user: User | null
  ownerId?: string | null
  mayEdit: boolean
  isViewMode: boolean
  profiles?: Record<string, PersonProfile> | null
}

export function useTreePresence({
  treeId,
  user,
  ownerId,
  mayEdit,
  isViewMode,
  profiles,
}: Options) {
  const selfKey = useMemo(() => getPresenceKey(user?.id), [user?.id])
  const [peers, setPeers] = useState<PresencePeer[]>([])
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({})
  const channelRef = useRef<RealtimeChannel | null>(null)
  const peersRef = useRef(peers)
  peersRef.current = peers

  const selfMeta = useMemo((): PresencePeer => {
    const role = resolvePresenceRole({
      userId: user?.id,
      ownerId,
      mayEdit,
      isViewMode,
    })
    const name = user ? displayNameFromUser(user) : 'Gäst'
    const avatarUrl = user ? avatarUrlForUserInTree(user, profiles) : null
    return {
      key: selfKey,
      name,
      color: colorFromKey(selfKey),
      role,
      userId: user?.id,
      avatarUrl,
    }
  }, [selfKey, user, ownerId, mayEdit, isViewMode, profiles])

  const selfMetaRef = useRef(selfMeta)
  selfMetaRef.current = selfMeta

  useEffect(() => {
    if (!treeId) {
      setPeers([])
      setCursors({})
      return
    }

    const channel = supabase.channel(treeChannelName(treeId), {
      config: {
        presence: { key: selfKey },
      },
    })
    channelRef.current = channel

    const applyPresence = () => {
      const state = channel.presenceState<PresencePeer>()
      setPeers(peersFromPresenceState(state, selfKey))
    }

    channel
      .on('presence', { event: 'sync' }, applyPresence)
      .on('presence', { event: 'join' }, applyPresence)
      .on('presence', { event: 'leave' }, ({ key }) => {
        applyPresence()
        if (key) {
          setCursors((prev) => {
            if (!(key in prev)) return prev
            const next = { ...prev }
            delete next[key]
            return next
          })
        }
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        const data = payload as CursorPayload
        if (!data?.key || data.key === selfKey) return
        const peer =
          peersRef.current.find((p) => p.key === data.key) ??
          ({
            key: data.key,
            name: 'Okänd',
            color: colorFromKey(data.key),
            role: 'guest' as const,
          } satisfies PresencePeer)
        setCursors((prev) => {
          if (!data.visible) {
            if (!(data.key in prev)) return prev
            const next = { ...prev }
            delete next[data.key]
            return next
          }
          return {
            ...prev,
            [data.key]: {
              key: data.key,
              x: data.x,
              y: data.y,
              visible: true,
              name: peer.name,
              color: peer.color,
            },
          }
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(selfMetaRef.current)
        }
      })

    return () => {
      channelRef.current = null
      void supabase.removeChannel(channel)
      setPeers([])
      setCursors({})
    }
  }, [treeId, selfKey])

  // Refresh presence metadata when name/role/avatar changes without rejoining.
  useEffect(() => {
    const channel = channelRef.current
    if (!channel || !treeId) return
    void channel.track(selfMeta)
  }, [selfMeta, treeId])

  // Keep cursor labels in sync when presence names arrive after first move.
  useEffect(() => {
    setCursors((prev) => {
      let changed = false
      const next = { ...prev }
      for (const [key, cursor] of Object.entries(next)) {
        const peer = peers.find((p) => p.key === key)
        if (!peer) continue
        if (cursor.name !== peer.name || cursor.color !== peer.color) {
          next[key] = { ...cursor, name: peer.name, color: peer.color }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [peers])

  const lastSent = useRef(0)
  const pending = useRef<CursorPayload | null>(null)
  const flushTimer = useRef<number | null>(null)

  const sendCursor = useCallback((payload: CursorPayload) => {
    const channel = channelRef.current
    if (!channel) return

    const fire = (data: CursorPayload) => {
      lastSent.current = Date.now()
      void channel.send({
        type: 'broadcast',
        event: 'cursor',
        payload: data,
      })
    }

    if (!payload.visible) {
      if (flushTimer.current) {
        window.clearTimeout(flushTimer.current)
        flushTimer.current = null
      }
      pending.current = null
      fire(payload)
      return
    }

    const elapsed = Date.now() - lastSent.current
    if (elapsed >= CURSOR_THROTTLE_MS) {
      fire(payload)
      return
    }

    pending.current = payload
    if (flushTimer.current == null) {
      flushTimer.current = window.setTimeout(() => {
        flushTimer.current = null
        if (pending.current) {
          fire(pending.current)
          pending.current = null
        }
      }, CURSOR_THROTTLE_MS - elapsed)
    }
  }, [])

  const publishCursor = useCallback(
    (world: { x: number; y: number } | null) => {
      if (world == null) {
        sendCursor({ key: selfKey, x: 0, y: 0, visible: false })
        return
      }
      sendCursor({
        key: selfKey,
        x: world.x,
        y: world.y,
        visible: true,
      })
    },
    [selfKey, sendCursor],
  )

  useEffect(() => {
    const hide = () => publishCursor(null)
    const onVisibility = () => {
      if (document.hidden) hide()
    }
    window.addEventListener('blur', hide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', hide)
      document.removeEventListener('visibilitychange', onVisibility)
      if (flushTimer.current) window.clearTimeout(flushTimer.current)
    }
  }, [publishCursor])

  const remoteCursors = useMemo(
    () => Object.values(cursors).filter((c) => c.visible),
    [cursors],
  )

  return {
    peers,
    remoteCursors,
    publishCursor,
    selfKey,
  }
}
