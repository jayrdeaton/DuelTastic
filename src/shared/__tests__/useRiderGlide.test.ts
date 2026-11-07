import type { GridCell } from '@tastic/grid'

import { advanceGlide, type Glide, GLIDE_LAG_MS, glideCellsBehind, glideStops, queueGlide, restingGlide } from '@/shared/match/useRiderGlide'

// 10px cells, so cell (x, y)'s center is (10x + 5, 10y + 5), and 100ms a cell.
const CELL = 10
const MS = 100
const center = (x: number, y: number) => ({ x: x * CELL + 5, y: y * CELL + 5 })
const at = (cell: GridCell) => restingGlide(center(cell.x, cell.y).x, center(cell.x, cell.y).y, CELL / MS)

// Queues the step from `last` to the end of `path`, as the hook does when the head moves.
function step(glide: Glide, last: GridCell, path: GridCell[], msPerCell = MS, flightMs: number | null = null): Glide {
  const { stops, stepMs } = glideStops(last, path, CELL, msPerCell, flightMs)
  return queueGlide(glide, stops, stepMs, CELL / msPerCell)
}

describe('glideStops', () => {
  it('rides to each cell the rider rode through, at its pace', () => {
    expect(
      glideStops(
        { x: 2, y: 2 },
        [
          { x: 2, y: 2 },
          { x: 2, y: 1 },
          { x: 3, y: 1 }
        ],
        CELL,
        MS
      )
    ).toEqual({
      stops: [
        { ...center(2, 1), kind: 'ride', ms: MS },
        { ...center(3, 1), kind: 'ride', ms: MS }
      ],
      stepMs: 2 * MS
    })
  })

  it('takes a two-cell straight move (Dash) from only the head', () => {
    expect(glideStops({ x: 2, y: 2 }, [{ x: 2, y: 0 }], CELL, MS)).toEqual({ stops: [{ ...center(2, 0), kind: 'ride', ms: 2 * MS }], stepMs: 2 * MS })
  })

  it('rides on from the last time the rider was on its last head’s cell', () => {
    // Tag's riders can turn straight back, so a cell can be in the tail twice.
    expect(
      glideStops(
        { x: 2, y: 2 },
        [
          { x: 2, y: 3 },
          { x: 2, y: 2 },
          { x: 2, y: 3 }
        ],
        CELL,
        MS
      ).stops
    ).toEqual([{ ...center(2, 3), kind: 'ride', ms: MS }])
  })

  it('jumps through a gate, or flies when it’s handed a flight (a Turf rider sent home)', () => {
    expect(glideStops({ x: 2, y: 2 }, [{ x: 15, y: 9 }], CELL, MS)).toEqual({ stops: [{ ...center(15, 9), kind: 'jump', ms: 0 }], stepMs: 0 })
    expect(glideStops({ x: 2, y: 2 }, [{ x: 15, y: 9 }], CELL, MS, 900).stops).toEqual([{ ...center(15, 9), kind: 'fly', ms: 900 }])
  })
})

// A rider riding straight up at `msPerCell` from the bottom of a tall board, its steps landing on
// frames `frameMs` apart the way the round loops step them, each queued after the frame it lands on
// (React renders, then the hook's effect runs), so the head first moves for it on the next frame.
// The distance the head moved each frame, and how far behind its steps it was drawn.
function rideStraight(msPerCell: number, frameMs: number, frames: number) {
  let last = { x: 0, y: 2000 }
  let glide = at(last)
  let due = 0
  const moved: number[] = []
  const behindMs: number[] = []
  for (let f = 0; f < frames; f++) {
    const before = glide
    glide = advanceGlide(glide, frameMs)
    moved.push(Math.hypot(glide.x - before.x, glide.y - before.y))
    behindMs.push((glide.y - center(last.x, last.y).y) / (CELL / msPerCell))
    due += frameMs
    while (due >= msPerCell) {
      due -= msPerCell
      const next = { x: 0, y: last.y - 1 }
      glide = step(glide, last, [last, next], msPerCell)
      last = next
    }
  }
  return { moved, behindMs }
}

describe('advanceGlide', () => {
  // Trap at 8px cells on a desktop, on a phone, Turf, and Tag's It, at 60Hz and 120Hz.
  describe.each([
    [67, 1000 / 60],
    [42, 1000 / 60],
    [90, 1000 / 60],
    [115 / 1.15, 1000 / 60],
    [67, 1000 / 120],
    [42, 1000 / 120]
  ])('a rider at %dms a cell, on %dms frames', (msPerCell, frameMs) => {
    // After the first second, while its pace settles.
    const { moved, behindMs } = rideStraight(msPerCell, frameMs, Math.round(4000 / frameMs))
    const settled = moved.slice(Math.round(1000 / frameMs))
    const even = (CELL * frameMs) / msPerCell

    it('moves the same distance every frame, within a few percent, never standing still', () => {
      for (const d of settled) {
        expect(d).toBeGreaterThan(even * 0.95)
        expect(d).toBeLessThan(even * 1.05)
      }
    })

    it('stays about GLIDE_LAG_MS behind its steps', () => {
      // Measured from the cell it last stepped to, so up to a step further at the moment one lands.
      for (const ms of behindMs.slice(Math.round(1000 / frameMs))) {
        expect(ms).toBeGreaterThan(0)
        expect(ms).toBeLessThan(msPerCell + GLIDE_LAG_MS + frameMs + 5)
      }
    })
  })

  it('goes round a corner rather than across it', () => {
    let glide = step(at({ x: 2, y: 2 }), { x: 2, y: 2 }, [
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 3, y: 1 }
    ])
    for (let f = 0; f < 30; f++) {
      glide = advanceGlide(glide, 10)
      // Always on the column up to the corner or the row after it.
      expect(glide.x === center(2, 2).x || glide.y === center(2, 1).y).toBe(true)
    }
    expect(glide).toMatchObject(center(3, 1))
  })

  it('jumps through a gate at once, then rides on', () => {
    let glide = step(at({ x: 2, y: 2 }), { x: 2, y: 2 }, [
      { x: 2, y: 2 },
      { x: 15, y: 9 },
      { x: 15, y: 8 }
    ])
    glide = advanceGlide(glide, 10)
    expect(glide.x).toBe(center(15, 9).x)
    expect(glide.y).toBeLessThan(center(15, 9).y)
  })

  it('flies a rider sent home in its own time, easing out and back in, then stops', () => {
    let glide = step(at({ x: 2, y: 2 }), { x: 2, y: 2 }, [{ x: 2, y: 30 }], MS, 400)
    glide = advanceGlide(glide, 100)
    // A quarter of the way through the time, well short of a quarter of the way.
    expect(glide.y - center(2, 2).y).toBeLessThan((center(2, 30).y - center(2, 2).y) / 4)
    glide = advanceGlide(advanceGlide(glide, 100), 0)
    expect(glide.y).toBeCloseTo((center(2, 2).y + center(2, 30).y) / 2)
    glide = advanceGlide(advanceGlide(glide, 100), 100)
    expect(glide).toMatchObject({ ...center(2, 30), stops: [] })
  })

  it('skips ahead after a stalled frame rather than racing to catch up', () => {
    let last = { x: 0, y: 100 }
    let glide = at(last)
    // Five steps land during one long frame.
    for (let i = 0; i < 5; i++) {
      const next = { x: 0, y: last.y - 1 }
      glide = step(glide, last, [last, next])
      last = next
    }
    glide = advanceGlide(glide, 16)
    const behind = (glide.y - center(last.x, last.y).y) / (CELL / MS)
    expect(behind).toBeLessThanOrEqual(MS + GLIDE_LAG_MS)
    // Never further back than a board drawing its trail's front live allows for.
    expect(behind / MS).toBeLessThan(glideCellsBehind(MS))
  })

  it('rides on to its last cell and stays there when its steps stop', () => {
    let glide = step(at({ x: 2, y: 2 }), { x: 2, y: 2 }, [
      { x: 2, y: 2 },
      { x: 2, y: 1 }
    ])
    for (let f = 0; f < 50; f++) glide = advanceGlide(glide, 16)
    expect(glide).toMatchObject({ ...center(2, 1), stops: [] })
  })
})
