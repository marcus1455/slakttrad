import type { FamilyStore } from '../types'
import { useConfirm } from '../lib/confirm'
import {
  setParentChildRelationType,
  setSpouseRelationType,
  unlinkParent,
  unlinkSpouse,
  type ParentChildRelType,
  type SpouseRelType,
} from '../lib/relations'
import './RelationPanel.css'

export type SelectedEdge =
  | { kind: 'spouse'; aId: string; bId: string }
  | { kind: 'blood'; childIds: string[]; parentIds: string[] }

type Props = {
  store: FamilyStore
  edge: SelectedEdge
  readOnly?: boolean
  onChange: (next: FamilyStore) => void
  onClose: () => void
  onCenter: (id: string) => void
  onAddSharedChild?: (aId: string, bId: string) => void
}

export function RelationPanel({
  store,
  edge,
  readOnly = false,
  onChange,
  onClose,
  onCenter,
  onAddSharedChild,
}: Props) {
  const confirm = useConfirm()

  if (edge.kind === 'spouse') {
    const a = store.profiles[edge.aId]
    const b = store.profiles[edge.bId]
    const aNode = store.nodes.find((n) => n.id === edge.aId)
    const rel = aNode?.spouses.find((s) => s.id === edge.bId)
    const spouseType: SpouseRelType =
      rel?.type === 'divorced' ? 'divorced' : 'married'
    const aName = a?.name ?? 'Person'
    const bName = b?.name ?? 'Person'

    return (
      <aside className="relation-panel">
        <header className="relation-panel__header">
          <div>
            <p className="relation-panel__eyebrow">Relation</p>
            <h2>Partnerband</h2>
            <p className="relation-panel__lead">
              <button
                type="button"
                className="relation-panel__name-link"
                onClick={() => onCenter(edge.aId)}
              >
                {aName}
              </button>
              {' och '}
              <button
                type="button"
                className="relation-panel__name-link"
                onClick={() => onCenter(edge.bId)}
              >
                {bName}
              </button>
            </p>
          </div>
          <button
            type="button"
            className="relation-panel__close"
            aria-label="Stäng"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="relation-panel__body">
          {!readOnly ? (
            <>
              <label>
                Typ
                <select
                  value={spouseType}
                  onChange={(e) =>
                    onChange(
                      setSpouseRelationType(
                        store,
                        edge.aId,
                        edge.bId,
                        e.target.value as SpouseRelType,
                      ),
                    )
                  }
                >
                  <option value="married">Gift / partner</option>
                  <option value="divorced">Frånskild</option>
                </select>
              </label>

              <button
                type="button"
                className="relation-panel__primary"
                onClick={() => onAddSharedChild?.(edge.aId, edge.bId)}
              >
                Lägg till gemensamt barn
              </button>

              <button
                type="button"
                className="relation-panel__danger"
                onClick={() => {
                  void (async () => {
                    const ok = await confirm({
                      title: 'Koppla loss partners?',
                      message: `${aName} och ${bName} kopplas loss. Barnen behålls i trädet.`,
                      confirmLabel: 'Koppla loss',
                      danger: true,
                    })
                    if (!ok) return
                    onChange(unlinkSpouse(store, edge.aId, edge.bId))
                    onClose()
                  })()
                }}
              >
                Koppla loss partners
              </button>
            </>
          ) : null}
        </div>
      </aside>
    )
  }

  const { childIds, parentIds } = edge
  const pairs = childIds.flatMap((childId) => {
    const childNode = store.nodes.find((n) => n.id === childId)
    return parentIds
      .filter((parentId) => childNode?.parents.some((p) => p.id === parentId))
      .map((parentId) => {
        const rel = childNode?.parents.find((p) => p.id === parentId)
        return {
          childId,
          parentId,
          type: (rel?.type === 'adopted'
            ? 'adopted'
            : rel?.type === 'half'
              ? 'half'
              : 'blood') as ParentChildRelType,
        }
      })
  })

  return (
    <aside className="relation-panel">
      <header className="relation-panel__header">
        <div>
          <p className="relation-panel__eyebrow">Relation</p>
          <h2>Familjeband</h2>
          <p className="relation-panel__lead">
            {parentIds.length} förälder{parentIds.length === 1 ? '' : 'ar'} ·{' '}
            {childIds.length} barn
          </p>
        </div>
        <button
          type="button"
          className="relation-panel__close"
          aria-label="Stäng"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="relation-panel__body">
        {pairs.length === 0 ? (
          <p className="relation-panel__empty">Inga aktiva band kvar.</p>
        ) : (
          pairs.map(({ childId, parentId, type }) => {
            const childName = store.profiles[childId]?.name ?? 'Barn'
            const parentName = store.profiles[parentId]?.name ?? 'Förälder'
            return (
              <div key={`${childId}-${parentId}`} className="relation-panel__pair">
                <div className="relation-panel__pair-text">
                  <strong>
                    <button
                      type="button"
                      className="relation-panel__name-link"
                      onClick={() => onCenter(childId)}
                    >
                      {childName}
                    </button>
                    <span aria-hidden> ← </span>
                    <button
                      type="button"
                      className="relation-panel__name-link"
                      onClick={() => onCenter(parentId)}
                    >
                      {parentName}
                    </button>
                  </strong>
                </div>
                {!readOnly ? (
                  <div className="relation-panel__pair-controls">
                    <label>
                      Band
                      <select
                        value={type}
                        onChange={(e) =>
                          onChange(
                            setParentChildRelationType(
                              store,
                              childId,
                              parentId,
                              e.target.value as ParentChildRelType,
                            ),
                          )
                        }
                      >
                        <option value="blood">Blod</option>
                        <option value="adopted">Adoptiv</option>
                        <option value="half">Halv</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="relation-panel__danger-sm"
                      onClick={() => {
                        void (async () => {
                          const ok = await confirm({
                            title: 'Koppla loss familjeband?',
                            message: `${childName} kopplas loss från ${parentName}.`,
                            confirmLabel: 'Koppla loss',
                            danger: true,
                          })
                          if (!ok) return
                          const next = unlinkParent(store, childId, parentId)
                          onChange(next)
                          const remaining = childIds.some((cid) => {
                            const node = next.nodes.find((n) => n.id === cid)
                            return parentIds.some((pid) =>
                              node?.parents.some((p) => p.id === pid),
                            )
                          })
                          if (!remaining) onClose()
                        })()
                      }}
                    >
                      Koppla loss
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
