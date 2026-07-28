import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { personLifeLabel } from '../lib/personLife'
import type { PersonProfile } from '../types'
import type { QuickAddKind } from './QuickAddDialog'
import './PersonCard.css'

type CardNode = {
  id: string
  gender: string
}

export type LinkHandleKind = QuickAddKind

type Props = {
  node: CardNode
  profile?: PersonProfile
  relationLabel?: string | null
  isSelected: boolean
  isFocus: boolean
  isDropTarget?: boolean
  canAddParent: boolean
  readOnly?: boolean
  style?: CSSProperties
  onSelect: (id: string) => void
  onQuickAdd: (id: string, kind: QuickAddKind) => void
  /** Start drag-to-link from a relation handle. */
  onLinkDragStart?: (
    personId: string,
    kind: LinkHandleKind,
    clientX: number,
    clientY: number,
  ) => void
}

function ParentIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden>
      <circle cx="8" cy="4.2" r="2.1" fill="currentColor" />
      <path
        fill="currentColor"
        d="M4.4 12.8c.25-2 1.7-3.1 3.6-3.1s3.35 1.1 3.6 3.1H4.4Z"
      />
      <path
        d="M8 13.4V15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

function ChildIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden>
      <circle cx="8" cy="5.2" r="2.1" fill="currentColor" />
      <path
        fill="currentColor"
        d="M4.2 13.2c.3-2.2 1.8-3.4 3.8-3.4s3.5 1.2 3.8 3.4H4.2Z"
      />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden>
      <path
        fill="currentColor"
        d="M8 13.4s-5.2-3.2-5.2-6.2A2.9 2.9 0 0 1 8 5.4a2.9 2.9 0 0 1 5.2 1.8c0 3-5.2 6.2-5.2 6.2Z"
      />
    </svg>
  )
}

export function PersonCard({
  node,
  profile,
  relationLabel,
  isSelected,
  isFocus,
  isDropTarget = false,
  canAddParent,
  readOnly = false,
  style,
  onSelect,
  onQuickAdd,
  onLinkDragStart,
}: Props) {
  const gender = profile?.gender ?? String(node.gender)
  const name = profile?.name ?? node.id
  const nickname = profile?.nickname?.trim()
  const life = personLifeLabel(profile)
  const deceased =
    Boolean(profile?.deathYear?.trim()) || Boolean(profile?.deathDate?.trim())
  const title = nickname ? `${name} (${nickname})` : name

  const startHandle = (
    e: ReactPointerEvent<HTMLButtonElement>,
    kind: LinkHandleKind,
  ) => {
    e.stopPropagation()
    e.preventDefault()
    if (readOnly) return
    onLinkDragStart?.(node.id, kind, e.clientX, e.clientY)
  }

  return (
    <div
      className={[
        'person-card-slot',
        isSelected ? 'person-card-slot--selected' : '',
        !readOnly ? 'person-card-slot--editable' : '',
        isDropTarget ? 'person-card-slot--drop-target' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      data-person-id={node.id}
    >
      <div
        className={[
          'person-card',
          `person-card--${gender}`,
          isSelected ? 'person-card--selected' : '',
          isFocus ? 'person-card--focus' : '',
          deceased ? 'person-card--deceased' : '',
          isDropTarget ? 'person-card--drop-target' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <button
          type="button"
          className="person-card__main"
          onClick={() => onSelect(node.id)}
          title={title}
        >
          {profile?.photoUrl ? (
            <img className="person-card__photo" src={profile.photoUrl} alt="" />
          ) : null}
          <span className="person-card__body">
            <span className="person-card__name">{name}</span>
            {nickname ? (
              <span className="person-card__nickname">{nickname}</span>
            ) : null}
            {relationLabel ? (
              <span className="person-card__relation">{relationLabel}</span>
            ) : null}
            {life ? <span className="person-card__meta">{life}</span> : null}
          </span>
        </button>
      </div>

      {!readOnly ? (
        <>
          {canAddParent ? (
            <button
              type="button"
              className="person-card__dot person-card__dot--parent"
              title="Dra till person eller klicka för ny förälder"
              aria-label={`Lägg till eller koppla förälder till ${name}`}
              onPointerDown={(e) => startHandle(e, 'parent')}
              onClick={(e) => {
                e.stopPropagation()
                // Click without drag is handled by App via drag end; keep fallback
                if (!onLinkDragStart) onQuickAdd(node.id, 'parent')
              }}
            >
              <ParentIcon />
            </button>
          ) : null}
          <button
            type="button"
            className="person-card__dot person-card__dot--child"
            title="Dra till person eller klicka för nytt barn"
            aria-label={`Lägg till eller koppla barn till ${name}`}
            onPointerDown={(e) => startHandle(e, 'child')}
            onClick={(e) => {
              e.stopPropagation()
              if (!onLinkDragStart) onQuickAdd(node.id, 'child')
            }}
          >
            <ChildIcon />
          </button>
          <button
            type="button"
            className="person-card__dot person-card__dot--partner"
            title="Dra till person eller klicka för ny partner"
            aria-label={`Lägg till eller koppla partner till ${name}`}
            onPointerDown={(e) => startHandle(e, 'partner')}
            onClick={(e) => {
              e.stopPropagation()
              if (!onLinkDragStart) onQuickAdd(node.id, 'partner')
            }}
          >
            <HeartIcon />
          </button>
        </>
      ) : null}
    </div>
  )
}
