/** Clip a center-to-center segment so it only runs between the two card borders. */
export function clipSegmentToCardBorders(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const acx = ax + aw / 2
  const acy = ay + ah / 2
  const bcx = bx + bw / 2
  const bcy = by + bh / 2
  const dx = bcx - acx
  const dy = bcy - acy
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return null

  const exit = (cx: number, cy: number, w: number, h: number, towardX: number, towardY: number) => {
    const hx = w / 2
    const hy = h / 2
    const tx = towardX - cx
    const ty = towardY - cy
    // Ray from center to target; find first hit on rectangle edge
    let t = Infinity
    if (Math.abs(tx) > 0.01) {
      const txEdge = tx > 0 ? hx / tx : -hx / tx
      if (txEdge > 0) t = Math.min(t, txEdge)
    }
    if (Math.abs(ty) > 0.01) {
      const tyEdge = ty > 0 ? hy / ty : -hy / ty
      if (tyEdge > 0) t = Math.min(t, tyEdge)
    }
    if (!Number.isFinite(t)) return { x: cx, y: cy }
    // Pull slightly outside so stroke sits clear of the border
    const inset = 0.92
    return { x: cx + tx * t * inset, y: cy + ty * t * inset }
  }

  const from = exit(acx, acy, aw, ah, bcx, bcy)
  const to = exit(bcx, bcy, bw, bh, acx, acy)
  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
}
