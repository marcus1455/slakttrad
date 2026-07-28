const STORAGE_KEY = 'slakttrad.recentTrees'

/** Most-recently-opened tree slugs (newest first). */
export function getRecentTreeSlugs(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((s): s is string => typeof s === 'string')
  } catch {
    return []
  }
}

export function markTreeOpened(slug: string) {
  if (!slug) return
  try {
    const next = [slug, ...getRecentTreeSlugs().filter((s) => s !== slug)].slice(
      0,
      20,
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export function sortTreesByRecent<T extends { slug: string }>(trees: T[]): T[] {
  const order = getRecentTreeSlugs()
  if (!order.length) return trees
  const rank = new Map(order.map((s, i) => [s, i]))
  return [...trees].sort((a, b) => {
    const ra = rank.get(a.slug)
    const rb = rank.get(b.slug)
    if (ra == null && rb == null) return 0
    if (ra == null) return 1
    if (rb == null) return -1
    return ra - rb
  })
}
