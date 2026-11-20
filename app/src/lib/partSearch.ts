import type { PartView } from './types'

// Datalist suggestion boxes render a fixed, capped list of <option>s --
// the browser only filters *within* whatever's rendered, it can't reach
// into the rest of the catalog. So the rendered candidates must already
// match what's been typed, not just be "the first N parts" (which broke
// down hard once the active catalog grew past a couple hundred rows).
export function searchParts(list: PartView[], query: string, limit = 60): PartView[] {
  const q = query.trim().toLowerCase()
  if (!q) return list.slice(0, limit)
  const tokens = q.split(/[\s,()-]+/).filter(Boolean)
  const matches = list.filter((p) => {
    const hay = `${p.sku} ${p.name} ${p.category ?? ''}`.toLowerCase()
    return tokens.every((t) => hay.includes(t))
  })
  return matches.slice(0, limit)
}
