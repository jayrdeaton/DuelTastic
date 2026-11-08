import { axisOf, isOnOverpass, overpassFootprint, stepKey, trailKeys } from '@/games/trap/utils/overpass'

// The Overpass's two levels in one cell: riding across is one, riding up or down the other.
describe('the Overpass helpers', () => {
  const OVERPASS = { left: 3, top: 3, right: 5, bottom: 5, over: 'h' as const }

  it('sorts directions into across and up-and-down', () => {
    expect(axisOf('left')).toBe('h')
    expect(axisOf('right')).toBe('h')
    expect(axisOf('up')).toBe('v')
    expect(axisOf('down')).toBe('v')
  })

  it('keys a crossing cell by level and every other cell plainly', () => {
    expect(isOnOverpass({ x: 3, y: 5 }, OVERPASS)).toBe(true)
    expect(isOnOverpass({ x: 6, y: 5 }, OVERPASS)).toBe(false)
    expect(isOnOverpass({ x: 4, y: 4 }, null)).toBe(false)
    expect(stepKey({ x: 4, y: 4 }, 'h', OVERPASS)).toBe('4,4|h')
    expect(stepKey({ x: 4, y: 4 }, 'v', OVERPASS)).toBe('4,4|v')
    expect(stepKey({ x: 2, y: 4 }, 'h', OVERPASS)).toBe('2,4')
    expect(stepKey({ x: 4, y: 4 }, 'h', null)).toBe('4,4')
  })

  it('keys a trail’s crossing cells by the way it ran through them', () => {
    const across = [
      { x: 2, y: 4 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 6, y: 4 }
    ]
    expect(trailKeys(across, OVERPASS)).toEqual(['2,4', '3,4|h', '4,4|h', '5,4|h', '6,4'])
    const down = [
      { x: 4, y: 2 },
      { x: 4, y: 3 },
      { x: 4, y: 4 }
    ]
    expect(trailKeys(down, OVERPASS)).toEqual(['4,2', '4,3|v', '4,4|v'])
  })

  it('keys a trail trimmed down to start on the crossing by the way it ran out', () => {
    expect(
      trailKeys(
        [
          { x: 4, y: 4 },
          { x: 5, y: 4 },
          { x: 6, y: 4 }
        ],
        OVERPASS
      )
    ).toEqual(['4,4|h', '5,4|h', '6,4'])
  })

  it('reaches a ring round the crossing for the powerup box’s footprint', () => {
    const footprint = overpassFootprint(OVERPASS, 1)
    expect(footprint.size).toBe(25)
    expect(footprint.has('2,2')).toBe(true)
    expect(footprint.has('6,6')).toBe(true)
    expect(footprint.has('7,4')).toBe(false)
    expect(overpassFootprint(null, 1).size).toBe(0)
  })
})
