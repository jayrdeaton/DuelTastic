import { ALL_DIRECTIONS, cellKey, type GridCell, type GridSize, isInBounds, stepCell, wrapCell } from '@tastic/grid'

import type { Axis, Direction, Overpass } from '@/games/trap/types'
import { countReachableCells, distanceToNearestTarget } from '@/games/trap/utils/floodFill'
import { axisOf, isOnOverpass, stepKey } from '@/games/trap/utils/overpass'

describe('countReachableCells', () => {
  it('counts every cell in a fully open grid', () => {
    const grid = { cols: 3, rows: 3 }
    expect(countReachableCells({ x: 1, y: 1 }, grid, new Set())).toBe(9)
  })

  it('returns 0 when the start cell is itself occupied', () => {
    const grid = { cols: 3, rows: 3 }
    expect(countReachableCells({ x: 1, y: 1 }, grid, new Set(['1,1']))).toBe(0)
  })

  it('returns 0 when the start cell is out of bounds', () => {
    const grid = { cols: 3, rows: 3 }
    expect(countReachableCells({ x: -1, y: 0 }, grid, new Set())).toBe(0)
  })

  it('does not cross occupied cells - a full-width wall splits the grid in two', () => {
    const grid = { cols: 5, rows: 5 }
    const occupied = new Set(['2,0', '2,1', '2,2', '2,3', '2,4'])
    expect(countReachableCells({ x: 0, y: 0 }, grid, occupied)).toBe(10)
    expect(countReachableCells({ x: 4, y: 0 }, grid, occupied)).toBe(10)
  })

  it('counts a sealed pocket smaller than the full grid', () => {
    const grid = { cols: 5, rows: 5 }
    const occupied = new Set(['2,0', '2,1', '0,2', '1,2'])
    expect(countReachableCells({ x: 0, y: 0 }, grid, occupied)).toBe(4)
  })

  it('stops early once maxCount is reached, without exploring the whole grid', () => {
    const grid = { cols: 20, rows: 20 } // 400 cells, fully open
    expect(countReachableCells({ x: 10, y: 10 }, grid, new Set())).toBe(400)

    const capped = countReachableCells({ x: 10, y: 10 }, grid, new Set(), 50)
    expect(capped).toBeGreaterThanOrEqual(50)
    expect(capped).toBeLessThan(400)
  })

  it('is unaffected by maxCount when the reachable area is already smaller than the cap', () => {
    const grid = { cols: 5, rows: 5 }
    const occupied = new Set(['2,0', '2,1', '0,2', '1,2'])
    expect(countReachableCells({ x: 0, y: 0 }, grid, occupied, 300)).toBe(4)
  })

  it('treats a portal as a 1-step edge to its paired exit, combining two otherwise-disconnected pockets', () => {
    // Same full-width wall as the "does not cross occupied cells" test above, splitting a 5x5 grid
    // into two 10-cell pockets - a portal links a cell in each, so the two are really one 20-cell
    // region. Both portal cells themselves end up counted, not just one: each has other free
    // neighbors on its OWN side (e.g. (3,1)/(3,3)/(4,2) around the exit (3,2)), and a later BFS
    // step from any of those back toward its own portal cell redirects across to the OTHER member -
    // so each side eventually "discovers" the far cell via its own neighbors' redirects, same as a
    // real two-way wormhole would.
    const grid = { cols: 5, rows: 5 }
    const occupied = new Set(['2,0', '2,1', '2,2', '2,3', '2,4'])
    const portals = new Map([
      ['1,2', { x: 3, y: 2 }],
      ['3,2', { x: 1, y: 2 }]
    ])
    expect(countReachableCells({ x: 0, y: 0 }, grid, occupied, Infinity, portals)).toBe(20)
  })

  it('crosses a trail on the Overpass’s other level, and counts each level of a crossing cell once', () => {
    // Column 2 is a crossing, and a trail runs down it on the up-and-down level: a wall to anything
    // going up or down, nothing to a search going across. 10 cells each side plus column 2 across.
    const grid = { cols: 5, rows: 5 }
    const overpass = { left: 2, top: 0, right: 2, bottom: 4, over: 'h' as const }
    const trailDown = new Set(['2,0|v', '2,1|v', '2,2|v', '2,3|v', '2,4|v'])
    expect(countReachableCells({ x: 0, y: 0 }, grid, trailDown, Infinity, new Map(), false, overpass)).toBe(25)
    // The same trail anywhere else is a wall.
    expect(countReachableCells({ x: 0, y: 0 }, grid, new Set(['2,0', '2,1', '2,2', '2,3', '2,4']))).toBe(10)
  })

  it('only goes straight on from a crossing cell, the way it was reached', () => {
    // (1,1) is a crossing with both ways across blocked: reached going across it's a dead end, but
    // reached going up or down it opens onto the rest of the board.
    const grid = { cols: 3, rows: 3 }
    const overpass = { left: 1, top: 1, right: 1, bottom: 1, over: 'h' as const }
    const occupied = new Set(['0,1', '2,1'])
    expect(countReachableCells({ x: 1, y: 1 }, grid, occupied, Infinity, new Map(), false, overpass, 'h')).toBe(1)
    expect(countReachableCells({ x: 1, y: 1 }, grid, occupied, Infinity, new Map(), false, overpass, 'v')).toBe(7)
  })

  it('crosses the grid edge via wrapCell when wrapEdges is on, reconnecting a pocket an ordinary bounds check would leave sealed', () => {
    // A single wall cell at x=2 splits a 5-wide strip: without wrap, (0,0) can only reach x=1 (the
    // west edge is a real boundary) - a 2-cell pocket. With wrap, stepping off x=-1 re-enters at
    // x=4 and the search continues around from there, reaching every cell except the wall itself.
    const grid = { cols: 5, rows: 1 }
    const occupied = new Set(['2,0'])
    expect(countReachableCells({ x: 0, y: 0 }, grid, occupied)).toBe(2)
    expect(countReachableCells({ x: 0, y: 0 }, grid, occupied, Infinity, new Map(), true)).toBe(4)
  })
})

describe('distanceToNearestTarget', () => {
  it('finds the nearest target through ordinary open space', () => {
    const grid = { cols: 5, rows: 5 }
    expect(distanceToNearestTarget({ x: 0, y: 0 }, grid, new Set(), new Set(['3,0']))).toBe(3)
  })

  it('returns null when no target is reachable', () => {
    const grid = { cols: 5, rows: 5 }
    const occupied = new Set(['2,0', '2,1', '2,2', '2,3', '2,4'])
    expect(distanceToNearestTarget({ x: 0, y: 0 }, grid, occupied, new Set(['4,0']))).toBeNull()
  })

  it('finds a target only reachable via a portal shortcut', () => {
    // Same wall/portal placement as countReachableCells' own portal test above - (4,0) sits in the
    // right pocket, unreachable from (0,0) at all without the portal (see the null case above).
    const grid = { cols: 5, rows: 5 }
    const occupied = new Set(['2,0', '2,1', '2,2', '2,3', '2,4'])
    const portals = new Map([
      ['1,2', { x: 3, y: 2 }],
      ['3,2', { x: 1, y: 2 }]
    ])
    expect(distanceToNearestTarget({ x: 0, y: 0 }, grid, occupied, new Set(['4,0']), Infinity, portals)).not.toBeNull()
  })

  it('finds a target across a trail on the Overpass’s other level', () => {
    const grid = { cols: 5, rows: 5 }
    const overpass = { left: 2, top: 0, right: 2, bottom: 4, over: 'h' as const }
    const trailDown = new Set(['2,0|v', '2,1|v', '2,2|v', '2,3|v', '2,4|v'])
    expect(distanceToNearestTarget({ x: 0, y: 0 }, grid, trailDown, new Set(['4,0']), Infinity, new Map(), false, overpass)).toBe(4)
    expect(distanceToNearestTarget({ x: 0, y: 0 }, grid, new Set(['2,0', '2,1', '2,2', '2,3', '2,4']), new Set(['4,0']))).toBeNull()
  })

  it('finds a target only reachable by wrapping around the grid edge', () => {
    // Same wall placement as countReachableCells' own wrap test above - (4,0) sits just past the
    // west edge, unreachable from (0,0) at all without wrap (blocked the ordinary way by the wall
    // at x=2 too, so this isn't just "no wall in the way").
    const grid = { cols: 5, rows: 1 }
    const occupied = new Set(['2,0'])
    expect(distanceToNearestTarget({ x: 0, y: 0 }, grid, occupied, new Set(['4,0']))).toBeNull()
    expect(distanceToNearestTarget({ x: 0, y: 0 }, grid, occupied, new Set(['4,0']), Infinity, new Map(), true)).toBe(1)
  })
})

// The string-keyed searches both used to be, kept as the reference the index-walked ones have to
// agree with: a key, a Set lookup and a queue entry for every neighbor.
const ALONG: Record<Axis, Direction[]> = { h: ['left', 'right'], v: ['up', 'down'] }
function referenceSearch(start: GridCell, grid: GridSize, occupied: ReadonlySet<string>, targets: ReadonlySet<string> | null, maxCount: number, portals: ReadonlyMap<string, GridCell>, wrapEdges: boolean, overpass: Overpass | null, startAxis: Axis): { count: number; distance: number | null } {
  const startKey = stepKey(start, startAxis, overpass)
  if (!isInBounds(start, grid) || occupied.has(startKey)) return { count: 0, distance: null }
  if (targets?.has(cellKey(start))) return { count: 1, distance: 0 }
  const visited = new Set<string>([startKey])
  const queue: { cell: GridCell; axis: Axis; dist: number }[] = [{ cell: start, axis: startAxis, dist: 0 }]
  let head = 0
  while (head < queue.length && queue.length < maxCount) {
    const { cell, axis, dist } = queue[head]
    head++
    for (const direction of isOnOverpass(cell, overpass) ? ALONG[axis] : ALL_DIRECTIONS) {
      let next = stepCell(cell, direction)
      if (wrapEdges && !isInBounds(next, grid)) next = wrapCell(next, grid)
      if (portals.has(cellKey(next))) next = portals.get(cellKey(next))!
      const nextAxis = axisOf(direction)
      const key = stepKey(next, nextAxis, overpass)
      if (visited.has(key) || !isInBounds(next, grid) || occupied.has(key)) continue
      if (targets?.has(cellKey(next))) return { count: queue.length, distance: dist + 1 }
      visited.add(key)
      queue.push({ cell: next, axis: nextAxis, dist: dist + 1 })
    }
  }
  return { count: queue.length, distance: null }
}

// Small deterministic PRNG so a failure reproduces.
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

describe('the index-walked searches', () => {
  it('agree with the string-keyed reference on random boards', () => {
    const random = seededRandom(7)
    const pick = (n: number) => Math.floor(random() * n)
    for (let trial = 0; trial < 600; trial++) {
      const grid = { cols: 3 + pick(24), rows: 3 + pick(24) }
      const cell = (): GridCell => ({ x: pick(grid.cols), y: pick(grid.rows) })
      // An Overpass on some boards: a crossing a few cells across, keyed by level like a trail on it.
      let overpass: Overpass | null = null
      if (random() < 0.4 && grid.cols > 5 && grid.rows > 5) {
        const left = 1 + pick(grid.cols - 4)
        const top = 1 + pick(grid.rows - 4)
        overpass = { left, top, right: left + 1 + pick(2), bottom: top + 1 + pick(2), over: random() < 0.5 ? 'h' : 'v' }
      }
      const keyFor = (c: GridCell) => stepKey(c, random() < 0.5 ? 'h' : 'v', overpass)
      const occupied = new Set<string>()
      const density = random() * 0.45
      for (let i = 0; i < grid.cols * grid.rows * density; i++) occupied.add(keyFor(cell()))
      // A plain key on the crossing, and one off the board: neither is ever looked up.
      if (overpass) occupied.add(cellKey({ x: overpass.left, y: overpass.top }))
      occupied.add('-1,0')
      const portals = new Map<string, GridCell>()
      if (random() < 0.5) {
        const a = { x: 1 + pick(grid.cols - 2), y: 1 + pick(grid.rows - 2) }
        const b = { x: 1 + pick(grid.cols - 2), y: 1 + pick(grid.rows - 2) }
        if (cellKey(a) !== cellKey(b) && !isOnOverpass(a, overpass) && !isOnOverpass(b, overpass)) {
          portals.set(cellKey(a), b)
          portals.set(cellKey(b), a)
        }
      }
      const targets = new Set<string>()
      for (let i = 0; i < 1 + pick(3); i++) targets.add(cellKey(cell()))
      const start = random() < 0.05 ? { x: -1, y: pick(grid.rows) } : cell()
      const maxCount = random() < 0.4 ? 1 + pick(grid.cols * grid.rows) : Infinity
      const wrapEdges = random() < 0.4
      const startAxis: Axis = random() < 0.5 ? 'h' : 'v'
      expect(countReachableCells(start, grid, occupied, maxCount, portals, wrapEdges, overpass, startAxis)).toBe(referenceSearch(start, grid, occupied, null, maxCount, portals, wrapEdges, overpass, startAxis).count)
      expect(distanceToNearestTarget(start, grid, occupied, targets, maxCount, portals, wrapEdges, overpass, startAxis)).toBe(referenceSearch(start, grid, occupied, targets, maxCount, portals, wrapEdges, overpass, startAxis).distance)
    }
  })
})
