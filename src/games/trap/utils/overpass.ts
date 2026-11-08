import { cellKey } from '@tastic/grid'

import type { Direction, GridCell } from '@/games/trap/types'
import type { Axis, Overpass } from '@/shared/match/arenas'

// The Overpass arena's crossing (see shared/match/arenas.ts's buildOverpass): two levels in one
// block of cells. A rider going across is on one, a rider going up or down on the other, so a trail
// on one level never blocks the other, and two riders crossing there at once pass over and under
// each other. On its own level a trail blocks as anywhere else, the rider's own included, so each
// lane can be ridden once each way. Nobody turns on it: a turn pressed there waits until the rider
// is off (tickGame), so a trail through it is always straight and its level is the way it runs.
//
// Everything that tells occupied cells apart (tickGame's collision check, buildOccupiedSet, the
// CPU's flood fill) keys a crossing cell by the level it's on, `${cellKey}|h` or `|v`, and every
// other cell by its plain cellKey, so one Set holds both.

export function axisOf(direction: Direction): Axis {
  return direction === 'left' || direction === 'right' ? 'h' : 'v'
}

// The way a rider went from `a` to `b` (a neighbor, or across the board on a wrap).
function axisBetween(a: GridCell, b: GridCell): Axis {
  return a.y === b.y ? 'h' : 'v'
}

export function isOnOverpass(cell: GridCell, overpass: Overpass | null): boolean {
  return overpass !== null && cell.x >= overpass.left && cell.x <= overpass.right && cell.y >= overpass.top && cell.y <= overpass.bottom
}

// The key a step into `cell` going along `axis` is checked and laid under.
export function stepKey(cell: GridCell, axis: Axis, overpass: Overpass | null): string {
  return isOnOverpass(cell, overpass) ? `${cellKey(cell)}|${axis}` : cellKey(cell)
}

// The key each of a trail's cells takes up. A crossing cell's level is the way the trail ran into it,
// or, for a trail's oldest cell (trimmed down to one on the crossing), the way it ran out: the same,
// since nobody turns there.
export function trailKeys(trail: readonly GridCell[], overpass: Overpass | null): string[] {
  return trail.map((cell, i) => {
    if (!isOnOverpass(cell, overpass)) return cellKey(cell)
    const axis = i > 0 ? axisBetween(trail[i - 1], cell) : trail.length > 1 ? axisBetween(cell, trail[1]) : 'v'
    return `${cellKey(cell)}|${axis}`
  })
}

// The crossing's cells and the ring of `margin` cells around it: where a powerup box can't land, so
// none sits on the bridge or hangs over its edge.
export function overpassFootprint(overpass: Overpass | null, margin: number): Set<string> {
  const keys = new Set<string>()
  if (!overpass) return keys
  for (let y = overpass.top - margin; y <= overpass.bottom + margin; y++) {
    for (let x = overpass.left - margin; x <= overpass.right + margin; x++) keys.add(cellKey({ x, y }))
  }
  return keys
}
