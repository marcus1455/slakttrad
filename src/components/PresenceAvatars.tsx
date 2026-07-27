import { useState } from 'react'
import {
  presenceRoleLabel,
  type PresencePeer,
} from '../lib/treePresence'
import { initialsFromName } from '../lib/userDisplay'
import './PresenceAvatars.css'

type Props = {
  peers: PresencePeer[]
  /** Max avatars before collapsing into +N. */
  maxVisible?: number
}

function PeerAvatar({ peer, size = 28 }: { peer: PresencePeer; size?: number }) {
  const [broken, setBroken] = useState(false)
  const title = `${peer.name} · ${presenceRoleLabel(peer.role)}`

  if (peer.avatarUrl && !broken) {
    return (
      <img
        className="presence-avatars__face"
        src={peer.avatarUrl}
        alt=""
        width={size}
        height={size}
        title={title}
        style={{ borderColor: peer.color }}
        onError={() => setBroken(true)}
      />
    )
  }

  return (
    <span
      className="presence-avatars__face presence-avatars__face--initials"
      title={title}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: peer.color,
        borderColor: peer.color,
      }}
      aria-hidden
    >
      {initialsFromName(peer.name)}
    </span>
  )
}

export function PresenceAvatars({ peers, maxVisible = 5 }: Props) {
  if (!peers.length) return null

  const visible = peers.slice(0, maxVisible)
  const overflow = peers.length - visible.length

  return (
    <div
      className="presence-avatars"
      role="group"
      aria-label={`${peers.length} ${peers.length === 1 ? 'annan' : 'andra'} inne i trädet`}
    >
      <ul className="presence-avatars__stack">
        {visible.map((peer) => (
          <li key={peer.key}>
            <PeerAvatar peer={peer} />
            <span className="visually-hidden">
              {peer.name}, {presenceRoleLabel(peer.role)}
            </span>
          </li>
        ))}
        {overflow > 0 ? (
          <li>
            <span
              className="presence-avatars__face presence-avatars__face--more"
              title={peers
                .slice(maxVisible)
                .map((p) => `${p.name} · ${presenceRoleLabel(p.role)}`)
                .join('\n')}
            >
              +{overflow}
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  )
}
