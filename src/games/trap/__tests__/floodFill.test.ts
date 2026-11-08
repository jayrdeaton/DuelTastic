import { countReachableCells, distanceToNearestTarget } from '@/games/trap/utils/floodFill'

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
