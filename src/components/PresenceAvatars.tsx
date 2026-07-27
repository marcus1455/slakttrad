import { useState } from 'react'
import {
  presencePeerTitle,
  presenceRoleLabel,
  type PresencePeer,
} from '../lib/treePresence'
import { initialsFromName } from '../lib/userDisplay'
import './PresenceAvatars.css'

type Props = {
  peers: PresencePeer[]
  /** Current user — shown in the stack so view/guest mode is visible as a face. */
  self?: PresencePeer | null
  /** Max other avatars before collapsing into +N. */
  maxVisible?: number
}

function PeerAvatar({
  peer,
  isSelf = false,
  size = 28,
}: {
  peer: PresencePeer
  isSelf?: boolean
  size?: number
}) {
  const [broken, setBroken] = useState(false)
  const title = presencePeerTitle(peer, isSelf)

  if (peer.avatarUrl && !broken) {
    return (
      <img
        className={[
          'presence-avatars__face',
          isSelf ? 'presence-avatars__face--self' : '',
        ]
          .filter(Boolean)
          .join(' ')}
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
      className={[
        'presence-avatars__face',
        'presence-avatars__face--initials',
        isSelf ? 'presence-avatars__face--self' : '',
      ]
        .filter(Boolean)
        .join(' ')}
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

export function PresenceAvatars({ peers, self = null, maxVisible = 5 }: Props) {
  if (!self && !peers.length) return null

  const visible = peers.slice(0, maxVisible)
  const overflow = peers.length - visible.length
  const total = peers.length + (self ? 1 : 0)

  return (
    <div
      className="presence-avatars"
      role="group"
      aria-label={`${total} ${total === 1 ? 'person' : 'personer'} inne i trädet`}
    >
      <ul className="presence-avatars__stack">
        {self ? (
          <li key={self.key}>
            <PeerAvatar peer={self} isSelf />
            <span className="visually-hidden">
              {presencePeerTitle(self, true)}
            </span>
          </li>
        ) : null}
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
                .map((p) => presencePeerTitle(p))
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
