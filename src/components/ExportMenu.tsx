import { useEffect, useRef, useState } from 'react'
import type { FamilyStore } from '../types'
import {
  downloadTextFile,
  exportGedcom,
  importGedcom,
} from '../lib/gedcom'
import { importFamilyJson } from '../lib/familyJson'
import { exportTreePng } from '../lib/exportImage'
import { useConfirm } from '../lib/confirm'
import './ExportMenu.css'

type LayoutLike = {
  width: number
  height: number
  people: { id: string; x: number; y: number; gender: string }[]
  connectors: {
    x1: number
    y1: number
    x2: number
    y2: number
    kind: string
  }[]
}

type Props = {
  store: FamilyStore
  treeName: string
  layout: LayoutLike | null
  nodeWidth: number
  nodeHeight: number
  readOnly?: boolean
  onImport: (next: FamilyStore) => void
  onOpenHistory: () => void
}

export function ExportMenu({
  store,
  treeName,
  layout,
  nodeWidth,
  nodeHeight,
  readOnly = false,
  onImport,
  onOpenHistory,
}: Props) {
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const jsonFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const safeName = treeName.replace(/[^\w\-åäöÅÄÖ ]+/gi, '').trim() || 'slakttrad'

  const onGedcomExport = () => {
    setError(null)
    const text = exportGedcom(store, treeName)
    downloadTextFile(`${safeName}.ged`, text, 'text/plain;charset=utf-8')
    setOpen(false)
  }

  const onJsonExport = () => {
    setError(null)
    downloadTextFile(
      `${safeName}.json`,
      JSON.stringify(
        {
          name: treeName,
          rootId: store.rootId,
          profiles: store.profiles,
          nodes: store.nodes,
        },
        null,
        2,
      ),
      'application/json;charset=utf-8',
    )
    setOpen(false)
  }

  const onPng = async () => {
    if (!layout) {
      setError('Trädet syns inte just nu')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await exportTreePng({
        layout,
        store,
        treeName,
        nodeWidth,
        nodeHeight,
        filename: `${safeName}.png`,
      })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte exportera bild')
    } finally {
      setBusy(false)
    }
  }

  const onPickGedcom = async (file: File | undefined) => {
    if (!file || readOnly) return
    setBusy(true)
    setError(null)
    try {
      const text = await file.text()
      const next = importGedcom(text)
      const count = Object.keys(next.profiles).length
      const ok = await confirm({
        title: 'Importera GEDCOM?',
        message: `${count} personer importeras. Nuvarande träd ersätts.`,
        confirmLabel: 'Importera',
        danger: true,
      })
      if (!ok) return
      onImport(next)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte importera')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onPickJson = async (file: File | undefined) => {
    if (!file || readOnly) return
    setBusy(true)
    setError(null)
    try {
      const text = await file.text()
      const next = importFamilyJson(text)
      const count = Object.keys(next.profiles).length
      const ok = await confirm({
        title: 'Importera JSON?',
        message: `${count} personer importeras. Nuvarande träd ersätts.`,
        confirmLabel: 'Importera',
        danger: true,
      })
      if (!ok) return
      onImport(next)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte importera')
    } finally {
      setBusy(false)
      if (jsonFileRef.current) jsonFileRef.current.value = ''
    }
  }

  return (
    <div className="export-menu" ref={rootRef}>
      <button
        type="button"
        className="app__tool app__tool--icon app__tool--quiet"
        title="Exportera / importera"
        aria-label="Exportera"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
          <path
            fill="currentColor"
            d="M10 2.2a.9.9 0 0 1 .9.9v7.1l2.1-2.1a.9.9 0 1 1 1.3 1.3l-3.7 3.7a.9.9 0 0 1-1.3 0L5.6 9.4a.9.9 0 1 1 1.3-1.3l2.1 2.1V3.1a.9.9 0 0 1 1-.9ZM3.5 13.2a.9.9 0 0 1 .9.9v1.2c0 .4.3.7.7.7h9.8c.4 0 .7-.3.7-.7v-1.2a.9.9 0 1 1 1.8 0v1.2A2.5 2.5 0 0 1 14.9 18H5.1A2.5 2.5 0 0 1 2.6 15.3v-1.2a.9.9 0 0 1 .9-.9Z"
          />
        </svg>
      </button>
      {open ? (
        <div className="export-menu__panel" role="menu">
          <button type="button" role="menuitem" onClick={() => window.print()}>
            Skriv ut / PDF…
          </button>
          <button type="button" role="menuitem" disabled={busy || !layout} onClick={() => void onPng()}>
            {busy ? 'Skapar bild…' : 'Ladda ner bild (PNG)'}
          </button>
          <button type="button" role="menuitem" onClick={onGedcomExport}>
            Exportera GEDCOM
          </button>
          <button type="button" role="menuitem" onClick={onJsonExport}>
            Exportera JSON
          </button>
          {!readOnly ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onOpenHistory()
                }}
              >
                Återställningspunkter…
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                Importera GEDCOM…
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => jsonFileRef.current?.click()}
              >
                Importera JSON…
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".ged,.gedcom,text/plain"
                hidden
                onChange={(e) => void onPickGedcom(e.target.files?.[0])}
              />
              <input
                ref={jsonFileRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => void onPickJson(e.target.files?.[0])}
              />
            </>
          ) : null}
          {error ? <p className="export-menu__error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
