import { activateEffect, addEffect, cellsOnTick, compensatesForReverse, type Effects, expireEffects, isFrozen, isShielded, isSlowed, newPickup, NO_EFFECTS, type Pickup, PICKUP_EDGE_MARGIN, PICKUP_FAIR_SLACK, PICKUP_MIN_DISTANCE, pickupCell, pickupFootprint, pickupRadiusPx, speedMultiplier, takePickup, ticksFor, ticksLeft } from '../powerups'

const grid = { cols: 30, rows: 30 }
const steps = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

describe('effects', () => {
  it('sets the pace: frozen, doubled or usual, until the effect runs out', () => {
    const boosted = addEffect(NO_EFFECTS(), 'boost', 5)
    expect(speedMultiplier(boosted, 5)).toBe(2)
    expect(speedMultiplier(boosted, 6)).toBe(1)
    expect(speedMultiplier(addEffect(NO_EFFECTS(), 'rush', 5), 3)).toBe(2)
    expect(isFrozen(addEffect(NO_EFFECTS(), 'freeze', 5), 3)).toBe(true)
    expect(speedMultiplier(NO_EFFECTS(), 3)).toBe(1)
    const muddy = addEffect(NO_EFFECTS(), 'slow', 5)
    expect(speedMultiplier(muddy, 3)).toBe(0.5)
    expect(isSlowed(muddy, 3)).toBe(true)
    expect(isFrozen(muddy, 3)).toBe(false)
  })

  it('moves a whole-cell rider every other tick while slowed, twice a tick while boosted', () => {
    const cells = (effects: Effects) => [1, 2, 3, 4, 5, 6].map((t) => cellsOnTick(effects, t))
    expect(cells(addEffect(NO_EFFECTS(), 'slow', 100))).toEqual([0, 1, 0, 1, 0, 1])
    expect(cells(addEffect(NO_EFFECTS(), 'boost', 100))).toEqual([2, 2, 2, 2, 2, 2])
    expect(cells(addEffect(NO_EFFECTS(), 'freeze', 100))).toEqual([0, 0, 0, 0, 0, 0])
    expect(cells(NO_EFFECTS())).toEqual([1, 1, 1, 1, 1, 1])
  })

  it('lets a speed effect replace another, and keeps the other sorts apart', () => {
    let e: Effects = addEffect(NO_EFFECTS(), 'freeze', 10)
    e = addEffect(e, 'boost', 8)
    expect(e.speed).toEqual({ kind: 'boost', expiresAtTick: 8 })
    e = addEffect(addEffect(e, 'reverse', 4), 'shield', 6)
    expect(e.reverse).toEqual({ expiresAtTick: 4 })
    expect(isShielded(e, 6)).toBe(true)
    expect(ticksLeft(e.shield, 2)).toBe(4)
  })

  it('drops what ran out at the end of a tick', () => {
    const e = addEffect(addEffect(NO_EFFECTS(), 'boost', 5), 'reverse', 7)
    expect(expireEffects(e, 4)).toEqual(e)
    expect(expireEffects(e, 5)).toEqual({ ...e, speed: null })
  })

  it('lands a boost or shield on its holder and the rest on the other rider, emptying the slot', () => {
    const players = { 1: { held: 'x' as string | null, effects: NO_EFFECTS() }, 2: { held: 'y' as string | null, effects: NO_EFFECTS() } }
    const boosted = activateEffect(players, 1, 'boost', 9)
    expect(boosted[1]).toEqual({ held: null, effects: { ...NO_EFFECTS(), speed: { kind: 'boost', expiresAtTick: 9 } } })
    expect(boosted[2]).toBe(players[2])
    const frozen = activateEffect(players, 1, 'freeze', 9)
    expect(frozen[1]).toEqual({ held: null, effects: NO_EFFECTS() })
    expect(frozen[2].effects.speed?.kind).toBe('freeze')
    expect(frozen[2].held).toBe('y')
  })
})

describe('pickups', () => {
  it('is picked up from its own cell or any next to it', () => {
    const pickups: Pickup<'dash'>[] = [{ id: 'a', type: 'dash', cell: { x: 5, y: 5 } }]
    expect(takePickup(pickups, { x: 6, y: 4 })).toEqual({ taken: pickups[0], rest: [] })
    expect(takePickup(pickups, { x: 7, y: 5 })).toBeNull()
  })

  it('is drawn about as wide as its footprint, within 9 to 26px', () => {
    expect(pickupRadiusPx(8)).toBeCloseTo(14.4)
    expect(pickupRadiusPx(14)).toBeCloseTo(25.2)
    expect(pickupRadiusPx(3)).toBe(9)
    expect(pickupRadiusPx(22)).toBe(26)
  })

  it('has a footprint of the cells round it, on the board', () => {
    expect(pickupFootprint({ x: 5, y: 5 }, grid)).toHaveLength(9)
    expect(pickupFootprint({ x: 0, y: 0 }, grid)).toEqual([0, 1, 30, 31])
  })

  it('turns up as far from one head as the other, away from both and off the edge', () => {
    const heads = [
      { x: 4, y: 25 },
      { x: 20, y: 3 }
    ] as const
    for (const r of [0, 0.3, 0.7, 0.99]) {
      const cell = pickupCell({ grid, heads, blocked: () => false }, () => r)!
      expect(Math.abs(steps(cell, heads[0]) - steps(cell, heads[1]))).toBeLessThanOrEqual(PICKUP_FAIR_SLACK)
      for (const h of heads) expect(Math.max(Math.abs(h.x - cell.x), Math.abs(h.y - cell.y))).toBeGreaterThanOrEqual(PICKUP_MIN_DISTANCE)
      expect(Math.min(cell.x, cell.y, grid.cols - 1 - cell.x, grid.rows - 1 - cell.y)).toBeGreaterThanOrEqual(PICKUP_EDGE_MARGIN)
    }
  })

  it('keeps its footprint clear of blocked cells, and takes a preferred cell when one fits', () => {
    const heads = [
      { x: 15, y: 25 },
      { x: 15, y: 5 }
    ] as const
    // Block the left half; prefer the far right columns.
    const blocked = (i: number) => i % grid.cols < 15
    const preferred = (i: number) => i % grid.cols >= 25
    for (const r of [0, 0.5, 0.99]) {
      const cell = pickupCell({ grid, heads, blocked, preferred }, () => r)!
      expect(cell.x).toBeGreaterThanOrEqual(25)
    }
    expect(pickupCell({ grid, heads, blocked: () => true }, () => 0)).toBeNull()
  })

  it('names a new box by its tick and cell, with one of the round’s powerups', () => {
    expect(newPickup(7, { x: 3, y: 4 }, ['dash', 'frost'] as const, () => 0.6)).toEqual({ id: 'pu-7-3-4', type: 'frost', cell: { x: 3, y: 4 } })
  })
})

describe('the CPU’s sums', () => {
  it('counts a rider’s ticks at its real pace', () => {
    expect(ticksFor(10, NO_EFFECTS(), 0)).toBe(10)
    expect(ticksFor(-1, NO_EFFECTS(), 0)).toBe(-1)
    expect(ticksFor(10, addEffect(NO_EFFECTS(), 'boost', 20), 0)).toBe(5)
    // Three ticks of boost cover six cells, then four more at the usual pace.
    expect(ticksFor(10, addEffect(NO_EFFECTS(), 'rush', 3), 0)).toBe(7)
    expect(ticksFor(10, addEffect(NO_EFFECTS(), 'freeze', 4), 0)).toBe(14)
    // Ten ticks of Mud cover five cells; three cells take six of them.
    expect(ticksFor(3, addEffect(NO_EFFECTS(), 'slow', 10), 0)).toBe(6)
    expect(ticksFor(8, addEffect(NO_EFFECTS(), 'slow', 10), 0)).toBe(13)
  })

  it('makes up for reversed steering always on hard, never on easy, sometimes on normal', () => {
    const roll = jest.fn(() => 0.5)
    expect(compensatesForReverse('hard', roll)).toBe(true)
    expect(compensatesForReverse('easy', roll)).toBe(false)
    expect(roll).not.toHaveBeenCalled()
    expect(compensatesForReverse('normal', () => 0.5)).toBe(true)
    expect(compensatesForReverse('normal', () => 0.7)).toBe(false)
  })
})
