import type { FamilyStore, PersonProfile } from '../types'
import { personLifeLabel } from './personLife'

type LayoutPerson = {
  id: string
  x: number
  y: number
  gender: string
}

type LayoutConnector = {
  x1: number
  y1: number
  x2: number
  y2: number
  kind: string
}

type TreeLayoutLike = {
  width: number
  height: number
  people: LayoutPerson[]
  connectors: LayoutConnector[]
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/** Draw the current tree layout to a PNG and trigger download. */
export async function exportTreePng(options: {
  layout: TreeLayoutLike
  store: FamilyStore
  treeName: string
  nodeWidth: number
  nodeHeight: number
  filename?: string
}): Promise<void> {
  const { layout, store, treeName, nodeWidth, nodeHeight } = options
  const pad = 48
  const titleH = 56
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil((layout.width + pad * 2) * scale)
  canvas.height = Math.ceil((layout.height + pad * 2 + titleH) * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Kunde inte skapa bild')

  ctx.scale(scale, scale)
  ctx.fillStyle = '#f4f7f3'
  ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale)

  ctx.fillStyle = '#1c241c'
  ctx.font = '700 22px Georgia, serif'
  ctx.fillText(treeName, pad, pad + 8)
  ctx.font = '500 13px Figtree, system-ui, sans-serif'
  ctx.fillStyle = '#5d6b5f'
  ctx.fillText(
    `${Object.keys(store.profiles).length} personer`,
    pad,
    pad + 30,
  )

  const ox = pad
  const oy = pad + titleH

  for (const line of layout.connectors) {
    ctx.strokeStyle =
      line.kind === 'spouse' ? 'rgba(47, 93, 80, 0.55)' : 'rgba(28, 36, 28, 0.28)'
    ctx.lineWidth = line.kind === 'spouse' ? 2.5 : 1.5
    ctx.beginPath()
    ctx.moveTo(ox + line.x1, oy + line.y1)
    ctx.lineTo(ox + line.x2, oy + line.y2)
    ctx.stroke()
  }

  for (const person of layout.people) {
    const profile: PersonProfile | undefined = store.profiles[person.id]
    const name = profile?.name ?? person.id
    const life = personLifeLabel(profile)
    const female = (profile?.gender ?? person.gender) === 'female'
    const x = ox + person.x
    const y = oy + person.y

    ctx.fillStyle = '#fff'
    ctx.strokeStyle = female ? 'rgba(140, 72, 90, 0.35)' : 'rgba(47, 93, 80, 0.35)'
    ctx.lineWidth = 1.5
    roundRect(ctx, x, y, nodeWidth, nodeHeight, 14)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#1c241c'
    ctx.font = '700 15px Figtree, system-ui, sans-serif'
    const maxW = nodeWidth - 24
    let display = name
    while (ctx.measureText(display).width > maxW && display.length > 1) {
      display = `${display.slice(0, -2)}…`
    }
    ctx.fillText(display, x + 12, y + 36)

    if (life) {
      ctx.fillStyle = '#5d6b5f'
      ctx.font = '500 12px Figtree, system-ui, sans-serif'
      ctx.fillText(life, x + 12, y + 56)
    }
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) throw new Error('Kunde inte skapa PNG')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download =
    options.filename ??
    `${treeName.replace(/[^\w\-åäöÅÄÖ ]+/gi, '').trim() || 'slakttrad'}.png`
  a.click()
  URL.revokeObjectURL(url)
}
