import { describe, expect, it } from 'vitest'
import {
  colorFromKey,
  cursorsFromPeers,
  peersFromPresenceState,
  resolvePresenceRole,
  treeChannelName,
} from './treePresence'

describe('treePresence helpers', () => {
  it('builds a stable channel name', () => {
    expect(treeChannelName('abc')).toBe('tree:abc')
  })

  it('resolves roles for owner, collaborator, viewer and guest', () => {
    expect(
      resolvePresenceRole({
        userId: 'u1',
        ownerId: 'u1',
        mayEdit: true,
        isViewMode: false,
      }),
    ).toBe('owner')
    expect(
      resolvePresenceRole({
        userId: 'u2',
        ownerId: 'u1',
        mayEdit: true,
        isViewMode: false,
      }),
    ).toBe('collaborator')
    expect(
      resolvePresenceRole({
        userId: 'u2',
        ownerId: 'u1',
        mayEdit: false,
        isViewMode: false,
      }),
    ).toBe('viewer')
    expect(
      resolvePresenceRole({
        userId: null,
        ownerId: 'u1',
        mayEdit: false,
        isViewMode: true,
      }),
    ).toBe('guest')
  })

  it('filters out self from presence peers', () => {
    const peers = peersFromPresenceState(
      {
        'user:a': [
          {
            key: 'user:a',
            name: 'Anna',
            color: '#111',
            role: 'owner',
          },
        ],
        'user:b': [
          {
            key: 'user:b',
            name: 'Bo',
            color: '#222',
            role: 'collaborator',
          },
        ],
      },
      'user:a',
    )
    expect(peers).toHaveLength(1)
    expect(peers[0]!.key).toBe('user:b')
  })

  it('derives a css color from a key', () => {
    expect(colorFromKey('guest:1')).toMatch(/^hsl\(/)
  })

  it('builds remote cursors from peer presence', () => {
    const cursors = cursorsFromPeers([
      {
        key: 'a',
        name: 'Anna',
        color: '#111',
        role: 'viewer',
        cursorX: 10,
        cursorY: 20,
        cursorVisible: true,
      },
      {
        key: 'b',
        name: 'Bo',
        color: '#222',
        role: 'guest',
        cursorVisible: false,
      },
    ])
    expect(cursors).toEqual([
      {
        key: 'a',
        x: 10,
        y: 20,
        visible: true,
        name: 'Anna',
        color: '#111',
      },
    ])
  })
})
