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
  cursorsFromPeers,
  getPresenceKey,
  peersFromPresenceState,
  resolvePresenceRole,
  treeChannelName,
  type PresencePeer,
} from '../lib/treePresence'

/** Presence track is heavier than broadcast — keep cursor updates gentle. */
const CURSOR_TRACK_MS = 80

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
  const channelRef = useRef<RealtimeChannel | null>(null)
  const subscribedRef = useRef(false)
  const cursorRef = useRef({ x: 0, y: 0, visible: false })
  const trackTimer = useRef<number | null>(null)

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

  const pushTrack = useCallback((immediate = false) => {
    const channel = channelRef.current
    if (!channel || !subscribedRef.current) return

    const fire = () => {
      const cursor = cursorRef.current
      void channel.track({
        ...selfMetaRef.current,
        cursorX: cursor.x,
        cursorY: cursor.y,
        cursorVisible: cursor.visible,
      })
    }

    if (immediate) {
      if (trackTimer.current) {
        window.clearTimeout(trackTimer.current)
        trackTimer.current = null
      }
      fire()
      return
    }

    if (trackTimer.current != null) return
    trackTimer.current = window.setTimeout(() => {
      trackTimer.current = null
      fire()
    }, CURSOR_TRACK_MS)
  }, [])

  useEffect(() => {
    if (!treeId) {
      setPeers([])
      subscribedRef.current = false
      return
    }

    const channel = supabase.channel(treeChannelName(treeId), {
      config: {
        presence: { key: selfKey },
      },
    })
    channelRef.current = channel
    subscribedRef.current = false

    const applyPresence = () => {
      const state = channel.presenceState<PresencePeer>()
      setPeers(peersFromPresenceState(state, selfKey))
    }

    channel
      .on('presence', { event: 'sync' }, applyPresence)
      .on('presence', { event: 'join' }, applyPresence)
      .on('presence', { event: 'leave' }, applyPresence)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          subscribedRef.current = true
          pushTrack(true)
        }
      })

    return () => {
      subscribedRef.current = false
      channelRef.current = null
      if (trackTimer.current) {
        window.clearTimeout(trackTimer.current)
        trackTimer.current = null
      }
      void supabase.removeChannel(channel)
      setPeers([])
    }
  }, [treeId, selfKey, pushTrack])

  // Refresh name/role/avatar without dropping the current cursor.
  useEffect(() => {
    if (!treeId || !subscribedRef.current) return
    pushTrack(true)
  }, [selfMeta, treeId, pushTrack])

  const publishCursor = useCallback(
    (world: { x: number; y: number } | null) => {
      if (world == null) {
        if (!cursorRef.current.visible) return
        cursorRef.current = { x: 0, y: 0, visible: false }
        pushTrack(true)
        return
      }
      cursorRef.current = {
        x: world.x,
        y: world.y,
        visible: true,
      }
      pushTrack(false)
    },
    [pushTrack],
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
    }
  }, [publishCursor])

  const remoteCursors = useMemo(() => cursorsFromPeers(peers), [peers])

  return {
    peers,
    remoteCursors,
    publishCursor,
    selfKey,
    self: selfMeta,
  }
}
