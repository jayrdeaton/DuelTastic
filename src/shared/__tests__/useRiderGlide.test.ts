import { GLIDE_OVERLAP_MS, glideRoute } from '@/shared/match/useRiderGlide'

// 10px cells, so cell (x, y)'s center is (10x + 5, 10y + 5), and 100ms a cell.
const CELL = 10
const MS = 100
const center = (x: number, y: number) => ({ x: x * CELL + 5, y: y * CELL + 5 })

describe('glideRoute', () => {
  it('glides one cell in the rider’s own time, plus the overlap', () => {
    expect(
      glideRoute(
        center(2, 2),
        { x: 2, y: 2 },
        [
          { x: 2, y: 2 },
          { x: 2, y: 1 }
        ],
        CELL,
        MS
      )
    ).toEqual([{ ...center(2, 1), ms: MS + GLIDE_OVERLAP_MS }])
  })

  it('runs on in one leg from a head still short of its cell', () => {
    // Two pixels (a fifth of a cell) below the last head's center, still heading up.
    const legs = glideRoute(
      { x: 25, y: 27 },
      { x: 2, y: 2 },
      [
        { x: 2, y: 2 },
        { x: 2, y: 1 }
      ],
      CELL,
      MS
    )
    expect(legs).toEqual([{ ...center(2, 1), ms: MS + GLIDE_OVERLAP_MS }])
  })

  it('goes round a corner rather than across it, at one speed', () => {
    const legs = glideRoute(
      { x: 25, y: 27 },
      { x: 2, y: 2 },
      [
        { x: 2, y: 2 },
        { x: 3, y: 2 }
      ],
      CELL,
      MS
    )!
    expect(legs.map(({ x, y }) => ({ x, y }))).toEqual([center(2, 2), center(3, 2)])
    const total = MS + GLIDE_OVERLAP_MS
    expect(legs[0].ms).toBeCloseTo((total * 0.2) / 1.2)
    expect(legs[1].ms).toBeCloseTo(total / 1.2)
  })

  it('takes a two-cell straight move (Dash) in one leg, from only the head', () => {
    expect(glideRoute(center(2, 2), { x: 2, y: 2 }, [{ x: 2, y: 0 }], CELL, MS)).toEqual([{ ...center(2, 0), ms: 2 * MS + GLIDE_OVERLAP_MS }])
  })

  it('glides on from the last time the rider was on its last head’s cell', () => {
    // Tag's riders can turn straight back, so a cell can be in the tail twice.
    const legs = glideRoute(
      center(2, 2),
      { x: 2, y: 2 },
      [
        { x: 2, y: 3 },
        { x: 2, y: 2 },
        { x: 2, y: 3 }
      ],
      CELL,
      MS
    )
    expect(legs).toEqual([{ ...center(2, 3), ms: MS + GLIDE_OVERLAP_MS }])
  })

  it('leaves a jump (a gate, a rider sent home) to the caller', () => {
    expect(glideRoute(center(2, 2), { x: 2, y: 2 }, [{ x: 15, y: 9 }], CELL, MS)).toBeNull()
  })

  it('jumps a head held more than a cell behind onto its cell, then glides', () => {
    const legs = glideRoute(
      center(2, 4),
      { x: 2, y: 2 },
      [
        { x: 2, y: 2 },
        { x: 2, y: 1 }
      ],
      CELL,
      MS
    )
    expect(legs).toEqual([
      { ...center(2, 2), ms: 0 },
      { ...center(2, 1), ms: MS + GLIDE_OVERLAP_MS }
    ])
  })
})
