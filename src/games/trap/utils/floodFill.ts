import { ALL_DIRECTIONS, cellKey, isInBounds, stepCell, wrapCell } from '@tastic/grid'

import { Axis, Direction, GridCell, GridSize, Overpass } from '@/games/trap/types'

import { axisOf, isOnOverpass, stepKey } from './overpass'

const ALONG: Record<Axis, Direction[]> = { h: ['left', 'right'], v: ['up', 'down'] }

// Where a search can go from a cell it reached going along `axis`: anywhere, or straight on along
// that axis on the Overpass's crossing, where nobody turns.
function directionsFrom(cell: GridCell, axis: Axis, overpass: Overpass | null): readonly Direction[] {
  return isOnOverpass(cell, overpass) ? ALONG[axis] : ALL_DIRECTIONS
}

// 4-directional BFS from `start`, counting cells reachable without crossing `occupied` or the
// grid edge - the "how much room is left to survive in" heuristic cpuAi.ts scores each candidate
// turn by. Index-walked queue (not Array#shift, which is O(n) per call and would make this
// O(cells²)) since this runs fresh for every candidate direction, every tick.
//
// `maxCount` stops the fill early once the queue reaches that many cells, bounding worst-case
// cost at O(maxCount) regardless of grid size - see CPU_FLOOD_FILL_CAP's own comment for why an
// exact count past that point is never actually needed. Defaults to unbounded for direct/test use.
// `portals` defaults to empty so every existing call site/test (predating portals) stays byte-
// identical - a neighbor landing on a portal cell is redirected to its paired exit before the
// visited/bounds/occupied checks run, the same "let + reassign before any check" shape tickGame's
// own movement resolution uses, so a portal reads to this search as a normal 1-step edge to
// wherever it actually leads, not a boundary (see gameEngine.ts's tickGame for why treating it as
// blocked instead would misjudge reachable space near one). `wrapEdges` defaults to false so every
// existing call site/test (predating wrap) stays byte-identical - when true, a neighbor that steps
// off the grid re-enters from the opposite edge (see grid.ts's wrapCell) instead of being treated as
// a boundary, mirroring gameEngine.ts's own tickGame. Applied before the portal check, same order
// tickGame uses, though it's moot in practice: a portal is never placed on an edge cell (see
// arenas.ts), so a raw off-grid `next` can never also be a portal entrance.
//
// On the Overpass (`overpass`, default none) a crossing cell counts once on each level: the search
// keys it by the level it got there on (utils/overpass.ts's stepKey, the same keys `occupied` holds
// its trails under) and only goes straight on from it, as a rider must. `startAxis` is the level
// `start` itself was reached on, for a start on the crossing.
export function countReachableCells(start: GridCell, grid: GridSize, occupied: ReadonlySet<string>, maxCount: number = Infinity, portals: ReadonlyMap<string, GridCell> = new Map(), wrapEdges: boolean = false, overpass: Overpass | null = null, startAxis: Axis = 'v'): number {
  const startKey = stepKey(start, startAxis, overpass)
  if (!isInBounds(start, grid) || occupied.has(startKey)) return 0

  const visited = new Set<string>([startKey])
  const queue: { cell: GridCell; axis: Axis }[] = [{ cell: start, axis: startAxis }]

  let head = 0
  while (head < queue.length && queue.length < maxCount) {
    const { cell, axis } = queue[head]
    head++
    for (const direction of directionsFrom(cell, axis, overpass)) {
      let next = stepCell(cell, direction)
      if (wrapEdges && !isInBounds(next, grid)) next = wrapCell(next, grid)
      if (portals.has(cellKey(next))) next = portals.get(cellKey(next))!
      const nextAxis = axisOf(direction)
      const key = stepKey(next, nextAxis, overpass)
      if (visited.has(key) || !isInBounds(next, grid) || occupied.has(key)) continue
      visited.add(key)
      queue.push({ cell: next, axis: nextAxis })
    }
  }

  return queue.length
}

// Same 4-directional BFS shape as countReachableCells above, but stops early and returns the
// step-distance to the first cell in `targets` it reaches, or null if none is reachable within
// `maxCount` - used by cpuAi.ts to bias pickup-seeking without a second, differently-shaped search.
// `portals` follows the identical redirect-before-checks shape countReachableCells above uses,
// `wrapEdges` its identical wrap-before-portal-check shape, and `overpass`/`startAxis` its levels.
// A target is a cell (a powerup box, never on the crossing).
export function distanceToNearestTarget(start: GridCell, grid: GridSize, occupied: ReadonlySet<string>, targets: ReadonlySet<string>, maxCount: number = Infinity, portals: ReadonlyMap<string, GridCell> = new Map(), wrapEdges: boolean = false, overpass: Overpass | null = null, startAxis: Axis = 'v'): number | null {
  const startKey = stepKey(start, startAxis, overpass)
  if (!isInBounds(start, grid) || occupied.has(startKey)) return null
  if (targets.has(cellKey(start))) return 0

  const visited = new Set<string>([startKey])
  const queue: { cell: GridCell; axis: Axis; dist: number }[] = [{ cell: start, axis: startAxis, dist: 0 }]

  let head = 0
  while (head < queue.length && queue.length < maxCount) {
    const { cell, axis, dist } = queue[head]
    head++
    for (const direction of directionsFrom(cell, axis, overpass)) {
      let next = stepCell(cell, direction)
      if (wrapEdges && !isInBounds(next, grid)) next = wrapCell(next, grid)
      if (portals.has(cellKey(next))) next = portals.get(cellKey(next))!
      const nextAxis = axisOf(direction)
      const key = stepKey(next, nextAxis, overpass)
      if (visited.has(key) || !isInBounds(next, grid) || occupied.has(key)) continue
      if (targets.has(cellKey(next))) return dist + 1
      visited.add(key)
      queue.push({ cell: next, axis: nextAxis, dist: dist + 1 })
    }
  }

  return null
}
