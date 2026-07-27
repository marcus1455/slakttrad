import type { CSSProperties } from 'react'
import { personLifeLabel } from '../lib/personLife'
import type { PersonProfile } from '../types'
import type { QuickAddKind } from './QuickAddDialog'
import './PersonCard.css'

type CardNode = {
  id: string
  gender: string
}

type Props = {
  node: CardNode
  profile?: PersonProfile
  relationLabel?: string | null
  isSelected: boolean
  isFocus: boolean
  canAddPartner: boolean
  canAddParent: boolean
  readOnly?: boolean
  style?: CSSProperties
  onSelect: (id: string) => void
  onQuickAdd: (id: string, kind: QuickAddKind) => void
}

export function PersonCard({
  node,
  profile,
  relationLabel,
  isSelected,
  isFocus,
  canAddPartner,
  canAddParent,
  readOnly = false,
  style,
  onSelect,
  onQuickAdd,
}: Props) {
  const gender = profile?.gender ?? String(node.gender)
  const name = profile?.name ?? node.id
  const nickname = profile?.nickname?.trim()
  const life = personLifeLabel(profile)
  const deceased = Boolean(profile?.deathYear?.trim())
  const title = nickname ? `${name} (${nickname})` : name

  return (
    <div
      className={[
        'person-card-slot',
        isSelected ? 'person-card-slot--selected' : '',
        !readOnly ? 'person-card-slot--editable' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      <div
        className={[
          'person-card',
          `person-card--${gender}`,
          isSelected ? 'person-card--selected' : '',
          isFocus ? 'person-card--focus' : '',
          deceased ? 'person-card--deceased' : '',
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
          ) : (
            <span className="person-card__avatar" aria-hidden>
              {name.trim().charAt(0) || '?'}
            </span>
          )}
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
              title="Lägg till förälder"
              aria-label={`Lägg till förälder till ${name}`}
              onClick={(e) => {
                e.stopPropagation()
                onQuickAdd(node.id, 'parent')
              }}
            >
              <span aria-hidden>+</span>
            </button>
          ) : null}
          <button
            type="button"
            className="person-card__dot person-card__dot--child"
            title="Lägg till barn"
            aria-label={`Lägg till barn till ${name}`}
            onClick={(e) => {
              e.stopPropagation()
              onQuickAdd(node.id, 'child')
            }}
          >
            <span aria-hidden>+</span>
          </button>
          {canAddPartner ? (
            <button
              type="button"
              className="person-card__dot person-card__dot--partner"
              title="Lägg till partner"
              aria-label={`Lägg till partner till ${name}`}
              onClick={(e) => {
                e.stopPropagation()
                onQuickAdd(node.id, 'partner')
              }}
            >
              <span aria-hidden>+</span>
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
