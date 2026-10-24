import type { Direction, GridCell } from '@tastic/grid'

import { TURF_EFFECT_TICKS, TURF_PICKUP_EDGE_MARGIN, TURF_PICKUP_FAIR_SLACK, TURF_PICKUP_MIN_DISTANCE, TURF_PICKUP_SPREAD } from '../constants'
import { applyTurfActivation, applyTurfTurn, countGround, createTurfState, finishTurfOnTime, groundShare, startTurf, tickTurf, TURF_HOME_RADIUS, turfStepsFor } from '../engine'
import { DEFAULT_TURF_RULES, type TurfEffects, type TurfPowerup, type TurfRules, type TurfSeat, type TurfState } from '../types'

const HOME: TurfRules = { crash: 'home', ownTrailDeadly: true, powerups: [] }

interface Start {
  head: GridCell
  direction: Direction
}

// A playing round on a small board, each rider on a square of its own ground (radius 0: just its own
// starting cell).
function setup(p1: Start, p2: Start, { cols = 20, rows = 20, radius = 0 } = {}): TurfState {
  return startTurf(createTurfState({ grid: { cols, rows }, layout: 'faceToFace', homeRadius: radius, starts: { 1: p1, 2: p2 } }))
}

// Replaces everyone's ground with exactly these cells.
function withGround(state: TurfState, ground: Partial<Record<TurfSeat, GridCell[]>>): TurfState {
  const owner = new Uint8Array(state.grid.cols * state.grid.rows)
  for (const seat of [1, 2] as const) for (const c of ground[seat] ?? []) owner[c.y * state.grid.cols + c.x] = seat
  return { ...state, owner, ground: countGround(owner) }
}

// Runs `ticks` ticks, applying `turns[i]` just before tick i (counting from 0).
function run(state: TurfState, ticks: number, turns: Record<number, Partial<Record<TurfSeat, Direction>>> = {}, rules: TurfRules = DEFAULT_TURF_RULES): TurfState {
  let s = state
  for (let i = 0; i < ticks; i++) {
    for (const seat of [1, 2] as const) {
      const d = turns[i]?.[seat]
      if (d) s = applyTurfTurn(s, seat, d)
    }
    s = tickTurf(s, rules)
  }
  return s
}

const ownerAt = (s: TurfState, x: number, y: number) => s.owner[y * s.grid.cols + x]
const rect = (x0: number, y0: number, x1: number, y1: number): GridCell[] => {
  const out: GridCell[] = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ x, y })
  return out
}

// Player 1 from (5, 10), home x 4-6 / y 9-11: up two past its ground, right two, down three, then left
// back onto its ground at (6, 10). Its trail closes off (6, 8).
const LOOP = { 3: { 1: 'right' }, 5: { 1: 'down' }, 8: { 1: 'left' } } as const
const LOOP_TRAIL: [number, number][] = [
  [5, 8],
  [5, 7],
  [6, 7],
  [7, 7],
  [7, 8],
  [7, 9],
  [7, 10]
]
// Player 2 riding down a far column, out of the way for the first dozen ticks.
const FAR: Start = { head: { x: 15, y: 2 }, direction: 'down' }

describe('createTurfState', () => {
  it('starts each rider facing the other on a square of its own ground', () => {
    const s = createTurfState({ grid: { cols: 30, rows: 60 }, layout: 'faceToFace' })
    const side = TURF_HOME_RADIUS * 2 + 1
    expect(s.phase).toBe('onboarding')
    expect(s.players[1].direction).toBe('up')
    expect(s.players[2].direction).toBe('down')
    expect(s.players[1].head.y).toBeGreaterThan(s.players[2].head.y)
    expect(s.ground).toEqual({ 1: side * side, 2: side * side })
    expect(ownerAt(s, s.players[1].head.x, s.players[1].head.y)).toBe(1)
    expect(ownerAt(s, s.players[2].head.x, s.players[2].head.y)).toBe(2)
  })

  it('keeps the starting square on the board', () => {
    const s = createTurfState({ grid: { cols: 10, rows: 10 }, layout: 'faceToFace', starts: { 1: { head: { x: 0, y: 9 }, direction: 'up' }, 2: { head: { x: 9, y: 0 }, direction: 'down' } } })
    const side = TURF_HOME_RADIUS + 1
    expect(s.ground).toEqual({ 1: side * side, 2: side * side })
  })
})

describe('moving', () => {
  it('lays no trail on its own ground and starts one on leaving it', () => {
    let s = setup({ head: { x: 5, y: 10 }, direction: 'up' }, FAR, { radius: 1 })
    s = run(s, 1)
    expect(s.players[1].head).toEqual({ x: 5, y: 9 })
    expect(s.players[1].trail).toEqual([])
    s = run(s, 1)
    expect(s.players[1].trail).toEqual([{ x: 5, y: 8 }])
    expect(s.players[1].leftFrom).toEqual({ x: 5, y: 9 })
  })

  it("can't turn straight back", () => {
    const s = setup({ head: { x: 5, y: 10 }, direction: 'up' }, FAR)
    expect(applyTurfTurn(s, 1, 'down')).toBe(s)
    expect(applyTurfTurn(s, 1, 'left').players[1].pendingDirection).toBe('left')
  })

  it('ignores turns before the round starts', () => {
    const s = createTurfState({ grid: { cols: 20, rows: 20 }, layout: 'faceToFace' })
    expect(applyTurfTurn(s, 1, 'left')).toBe(s)
    expect(tickTurf(s)).toBe(s)
  })
})

describe('capturing', () => {
  it('claims the trail and what it encloses on getting home', () => {
    const s = run(setup({ head: { x: 5, y: 10 }, direction: 'up' }, FAR, { radius: 1 }), 9, LOOP)
    expect(s.phase).toBe('playing')
    expect(s.players[1].trail).toEqual([])
    for (const [x, y] of LOOP_TRAIL) expect(ownerAt(s, x, y)).toBe(1)
    expect(ownerAt(s, 6, 8)).toBe(1)
    expect(s.ground[1]).toBe(9 + LOOP_TRAIL.length + 1)
    expect(s.events.captured).toEqual({ 1: LOOP_TRAIL.length + 1, 2: 0 })
  })

  it("takes the other rider's ground", () => {
    let s = setup({ head: { x: 5, y: 10 }, direction: 'up' }, { head: { x: 8, y: 8 }, direction: 'right' })
    s = withGround(s, { 1: rect(4, 9, 6, 11), 2: rect(7, 7, 9, 9) })
    s = run(s, 9, LOOP)
    expect(s.phase).toBe('playing')
    // The loop ran over (7, 7) to (7, 9), three of player 2's cells.
    expect(s.ground).toEqual({ 1: 9 + LOOP_TRAIL.length + 1, 2: 9 - 3 })
  })

  it('suffocates a rider whose ground is all taken', () => {
    let s = setup({ head: { x: 5, y: 10 }, direction: 'up' }, FAR)
    s = withGround(s, { 1: rect(4, 9, 6, 11), 2: [{ x: 6, y: 8 }] })
    s = run(s, 9, LOOP)
    expect(s.phase).toBe('roundOver')
    expect(s.outcome).toEqual({ type: 'win', winner: 1, reason: 'suffocation' })
    expect(s.ground[2]).toBe(0)
    expect(s.players[2].alive).toBe(false)
  })

  it('lets the tighter loop keep the cells when two claims overlap on one tick', () => {
    // Player 1's ground is a U open at the top; it closes the top with a trail along row 10 while
    // player 2 makes a small loop inside the U. Both get home on tick 7.
    let s = setup({ head: { x: 12, y: 10 }, direction: 'right' }, { head: { x: 15, y: 14 }, direction: 'up' }, { cols: 30, rows: 30 })
    const u = [...rect(12, 10, 12, 18), ...rect(19, 10, 19, 18), ...rect(13, 18, 18, 18)]
    s = withGround(s, { 1: u, 2: rect(14, 13, 16, 15) })
    s = run(s, 7, { 2: { 2: 'right' }, 4: { 2: 'down' }, 6: { 2: 'left' } })
    expect(s.phase).toBe('playing')
    expect(s.events.captured[1]).toBeGreaterThan(0)
    expect(s.events.captured[2]).toBe(5)
    // Player 2's loop is its own; the rest of the U's inside, player 2's old square included, is
    // player 1's.
    for (const [x, y] of [
      [15, 12],
      [16, 12],
      [17, 12],
      [17, 13],
      [17, 14]
    ]) {
      expect(ownerAt(s, x, y)).toBe(2)
    }
    expect(ownerAt(s, 14, 14)).toBe(1)
    expect(ownerAt(s, 13, 11)).toBe(1)
    expect(s.ground[2]).toBe(5)
  })
})

describe('crashing (out)', () => {
  it('crashes the other rider when you ride into its trail, and you win', () => {
    // Player 2 rides right along row 10, player 1 up column 5 into its trail.
    const s = run(setup({ head: { x: 5, y: 15 }, direction: 'up' }, { head: { x: 2, y: 10 }, direction: 'right' }), 5)
    expect(s.phase).toBe('roundOver')
    expect(s.outcome).toEqual({ type: 'win', winner: 1, reason: 'crash' })
    expect(s.players[2].alive).toBe(false)
    expect(s.players[1].alive).toBe(true)
  })

  it('crashes you on your own trail', () => {
    const s = run(setup({ head: { x: 5, y: 15 }, direction: 'up' }, FAR), 6, { 3: { 1: 'right' }, 4: { 1: 'down' }, 5: { 1: 'left' } })
    expect(s.outcome).toEqual({ type: 'win', winner: 2, reason: 'crash' })
    expect(s.players[1].crashCell).toEqual({ x: 5, y: 13 })
  })

  it('lets a trail cross itself when your own trail is safe', () => {
    const s = run(setup({ head: { x: 5, y: 15 }, direction: 'up' }, FAR), 6, { 3: { 1: 'right' }, 4: { 1: 'down' }, 5: { 1: 'left' } }, { crash: 'out', ownTrailDeadly: false, powerups: [] })
    expect(s.phase).toBe('playing')
    expect(s.players[1].head).toEqual({ x: 5, y: 13 })
  })

  it('crashes a rider that leaves the board', () => {
    const s = run(setup({ head: { x: 5, y: 2 }, direction: 'up' }, { head: { x: 15, y: 10 }, direction: 'down' }), 3)
    expect(s.outcome).toEqual({ type: 'win', winner: 2, reason: 'crash' })
    expect(s.players[1].crashCell).toEqual({ x: 5, y: -1 })
  })

  it('is a draw when heads meet on nobody’s ground', () => {
    const s = run(setup({ head: { x: 5, y: 14 }, direction: 'up' }, { head: { x: 5, y: 6 }, direction: 'down' }), 4)
    expect(s.outcome).toEqual({ type: 'draw', reason: 'crash' })
  })

  it("gives a head-on to whoever's ground it's on", () => {
    let s = setup({ head: { x: 5, y: 14 }, direction: 'up' }, { head: { x: 5, y: 6 }, direction: 'down' })
    s = withGround(s, { 1: rect(4, 10, 6, 14), 2: [{ x: 5, y: 6 }] })
    s = run(s, 4)
    expect(s.outcome).toEqual({ type: 'win', winner: 1, reason: 'crash' })
  })

  it('crashes both when heads swap cells on the other’s ground', () => {
    const s = run(setup({ head: { x: 5, y: 10 }, direction: 'right' }, { head: { x: 6, y: 10 }, direction: 'left' }), 1)
    expect(s.outcome).toEqual({ type: 'draw', reason: 'crash' })
  })

  it('gives a swap to the rider getting back onto its own ground', () => {
    let s = setup({ head: { x: 5, y: 10 }, direction: 'right' }, { head: { x: 6, y: 10 }, direction: 'left' })
    s = withGround(s, { 1: rect(4, 10, 6, 10), 2: [{ x: 15, y: 15 }] })
    s = run(s, 1)
    expect(s.outcome).toEqual({ type: 'win', winner: 1, reason: 'crash' })
  })
})

describe('crashing (home)', () => {
  it('sends the rider back to where it left its ground, without its trail', () => {
    const s = run(setup({ head: { x: 5, y: 15 }, direction: 'up' }, FAR), 6, { 3: { 1: 'right' }, 4: { 1: 'down' }, 5: { 1: 'left' } }, HOME)
    expect(s.phase).toBe('playing')
    expect(s.players[1].head).toEqual({ x: 5, y: 15 })
    expect(s.players[1].trail).toEqual([])
    expect(s.players[1].alive).toBe(true)
    expect(s.players[1].crashCell).toEqual({ x: 5, y: 13 })
    expect(s.events.sentHome).toEqual([1])
  })

  it('sends both home from a head-on on nobody’s ground', () => {
    const s = run(setup({ head: { x: 5, y: 14 }, direction: 'up' }, { head: { x: 5, y: 6 }, direction: 'down' }), 4, {}, HOME)
    expect(s.phase).toBe('playing')
    expect(s.players[1].head).toEqual({ x: 5, y: 14 })
    expect(s.players[2].head).toEqual({ x: 5, y: 6 })
    expect(s.events.sentHome).toEqual([1, 2])
  })

  it('turns a rider sent home to stay on its ground', () => {
    let s = setup({ head: { x: 5, y: 2 }, direction: 'up' }, { head: { x: 15, y: 10 }, direction: 'down' })
    s = withGround(s, { 1: rect(4, 0, 6, 2), 2: [{ x: 15, y: 10 }] })
    // From (5, 2) up to the edge: off the board on tick 3, back to (5, 0), the last cell of its ground.
    s = run(s, 3, {}, HOME)
    expect(s.players[1].head).toEqual({ x: 5, y: 0 })
    expect(s.players[1].direction).not.toBe('up')
  })

  it('uses the nearest cell it owns once the cell it left from is taken', () => {
    let s = setup({ head: { x: 5, y: 15 }, direction: 'up' }, FAR, { radius: 0 })
    s = withGround(s, {
      1: [
        { x: 5, y: 15 },
        { x: 2, y: 13 }
      ],
      2: [{ x: 15, y: 2 }]
    })
    s = run(s, 3, {}, HOME)
    // Take (5, 15) away from it, then run it into its own trail.
    s = withGround(s, {
      1: [{ x: 2, y: 13 }],
      2: [
        { x: 15, y: 2 },
        { x: 5, y: 15 }
      ]
    })
    s = run(s, 3, { 0: { 1: 'right' }, 1: { 1: 'down' }, 2: { 1: 'left' } }, HOME)
    expect(s.players[1].head).toEqual({ x: 2, y: 13 })
  })
})

describe('the clock', () => {
  it('gives the round to more ground', () => {
    let s = setup({ head: { x: 5, y: 10 }, direction: 'up' }, FAR)
    s = withGround(s, { 1: rect(0, 0, 2, 2), 2: [{ x: 15, y: 2 }] })
    expect(finishTurfOnTime(s).outcome).toEqual({ type: 'win', winner: 1, reason: 'time' })
  })

  it('is a draw on the same ground', () => {
    const s = setup({ head: { x: 5, y: 10 }, direction: 'up' }, FAR)
    expect(finishTurfOnTime(s).outcome).toEqual({ type: 'draw', reason: 'time' })
  })

  it('leaves a round that is already over alone', () => {
    const over = run(setup({ head: { x: 5, y: 2 }, direction: 'up' }, FAR), 3)
    expect(finishTurfOnTime(over)).toBe(over)
  })
})

describe('groundShare', () => {
  it('is the share of the whole board', () => {
    const s = setup({ head: { x: 5, y: 5 }, direction: 'up' }, { head: { x: 8, y: 1 }, direction: 'down' }, { cols: 10, rows: 10, radius: 0 })
    expect(groundShare(s, 1)).toBeCloseTo(0.01)
  })
})

// Gives a seat a powerup to use.
function holding(state: TurfState, seat: TurfSeat, held: TurfPowerup): TurfState {
  return { ...state, players: { ...state.players, [seat]: { ...state.players[seat], held } } }
}

function withEffects(state: TurfState, seat: TurfSeat, effects: Partial<TurfEffects>): TurfState {
  const p = state.players[seat]
  return { ...state, players: { ...state.players, [seat]: { ...p, effects: { ...p.effects, ...effects } } } }
}

// Holds the powerup and uses it straight away.
const use = (state: TurfState, seat: TurfSeat, type: TurfPowerup) => applyTurfActivation(holding(state, seat, type), seat)

const withPickup = (state: TurfState, type: TurfPowerup, cell: GridCell): TurfState => ({ ...state, pickups: [{ id: 'test', type, cell }] })

const POWERUPS_ON: TurfRules = { ...DEFAULT_TURF_RULES, powerups: ['dash', 'frost'] }
const chebyshev = (a: GridCell, b: GridCell) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

describe('pickups', () => {
  it('turns one up on nobody’s ground, about as far from one head as the other, when powerups are on', () => {
    const steps = (a: GridCell, b: GridCell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
    for (const r of [0, 0.37, 0.99]) {
      const s = tickTurf(setup({ head: { x: 5, y: 15 }, direction: 'up' }, FAR, { radius: 2 }), POWERUPS_ON, () => r)
      expect(s.pickups).toHaveLength(1)
      const { cell, type } = s.pickups[0]
      expect(POWERUPS_ON.powerups).toContain(type)
      expect(ownerAt(s, cell.x, cell.y)).toBe(0)
      for (const seat of [1, 2] as const) expect(chebyshev(cell, s.players[seat].head)).toBeGreaterThanOrEqual(TURF_PICKUP_MIN_DISTANCE)
      expect(Math.abs(steps(cell, s.players[1].head) - steps(cell, s.players[2].head))).toBeLessThanOrEqual(TURF_PICKUP_FAIR_SLACK)
      expect(Math.min(cell.x, cell.y, s.grid.cols - 1 - cell.x, s.grid.rows - 1 - cell.y)).toBeGreaterThanOrEqual(TURF_PICKUP_EDGE_MARGIN)
    }
  })

  it('turns up somewhere between the riders, not anywhere along the line as far from each', () => {
    // Heads 20 apart down the middle column of a wide board: the fair cells run the whole width of
    // row 10, but the pickup stays near the middle.
    for (const r of [0, 0.5, 0.99]) {
      const s = tickTurf(setup({ head: { x: 50, y: 21 }, direction: 'left' }, { head: { x: 50, y: 1 }, direction: 'left' }, { cols: 101, rows: 25 }), POWERUPS_ON, () => r)
      expect(Math.abs(s.pickups[0].cell.x - 49)).toBeLessThanOrEqual(TURF_PICKUP_SPREAD)
    }
  })

  it('never puts one next to a trail', () => {
    // Player 1 lays a trail up column 5, then the only free cells are right of column 7.
    let s = run(setup({ head: { x: 5, y: 19 }, direction: 'up' }, { head: { x: 19, y: 0 }, direction: 'down' }, { cols: 20, rows: 20 }), 10)
    s = withGround(s, { 1: rect(0, 0, 3, 19), 2: rect(8, 0, 19, 19) })
    const spawned = tickTurf(s, POWERUPS_ON, () => 0.5)
    expect(spawned.pickups).toHaveLength(1)
    const { cell } = spawned.pickups[0]
    for (const t of spawned.players[1].trail) expect(chebyshev(cell, t)).toBeGreaterThan(1)
  })

  it('turns none up while powerups are off', () => {
    expect(tickTurf(setup({ head: { x: 5, y: 15 }, direction: 'up' }, FAR)).pickups).toEqual([])
  })

  it('is picked up from the next cell over, and another turns up', () => {
    let s = withPickup(setup({ head: { x: 5, y: 15 }, direction: 'up' }, FAR), 'frost', { x: 6, y: 12 })
    s = tickTurf(s, POWERUPS_ON, () => 0)
    expect(s.players[1].held).toBeNull()
    s = tickTurf(s, POWERUPS_ON, () => 0)
    expect(s.players[1].held).toBe('frost')
    expect(s.events.collected).toEqual([1])
    expect(s.pickups).toHaveLength(1)
    expect(s.pickups[0].id).not.toBe('test')
  })

  it('swaps whatever was held', () => {
    let s = holding(withPickup(setup({ head: { x: 5, y: 15 }, direction: 'up' }, FAR), 'frost', { x: 5, y: 13 }), 1, 'dash')
    s = run(s, 1)
    expect(s.players[1].held).toBe('frost')
  })
})

describe('using a powerup', () => {
  it('does nothing with nothing held, or before the round starts', () => {
    const s = setup({ head: { x: 5, y: 15 }, direction: 'up' }, FAR)
    expect(applyTurfActivation(s, 1)).toBe(s)
    const waiting = holding(createTurfState({ grid: { cols: 20, rows: 20 }, layout: 'faceToFace' }), 1, 'dash')
    expect(applyTurfActivation(waiting, 1)).toBe(waiting)
  })

  it('empties the slot', () => {
    expect(use(setup({ head: { x: 5, y: 15 }, direction: 'up' }, FAR), 1, 'fence').players[1].held).toBeNull()
  })

  it('lets a speed effect replace another: Dash thaws a frozen rider', () => {
    let s = setup({ head: { x: 5, y: 15 }, direction: 'up' }, FAR)
    s = use(s, 2, 'frost')
    expect(s.players[1].effects.speed?.type).toBe('frost')
    s = use(s, 1, 'dash')
    expect(s.players[1].effects.speed?.type).toBe('dash')
  })
})

describe('Dash and Gust', () => {
  it('Dash covers two cells a tick for its run, then one', () => {
    let s = use(setup({ head: { x: 5, y: 75 }, direction: 'up' }, FAR, { rows: 80 }), 1, 'dash')
    s = run(s, TURF_EFFECT_TICKS.dash)
    expect(s.players[1].head).toEqual({ x: 5, y: 75 - 2 * TURF_EFFECT_TICKS.dash })
    expect(s.players[1].effects.speed).toBeNull()
    s = run(s, 1)
    expect(s.players[1].head.y).toBe(75 - 2 * TURF_EFFECT_TICKS.dash - 1)
  })

  it('checks every cell, so a dashing rider can’t skip over a trail', () => {
    // Player 2 lays a trail along row 10; player 1 dashes up column 5 from (5, 11) and would land on
    // (5, 9) if its first cell went unchecked.
    let s = run(setup({ head: { x: 5, y: 17 }, direction: 'up' }, { head: { x: 0, y: 10 }, direction: 'right' }), 6)
    expect(s.players[1].head).toEqual({ x: 5, y: 11 })
    s = run(use(s, 1, 'dash'), 1)
    expect(s.outcome).toEqual({ type: 'win', winner: 1, reason: 'crash' })
  })

  it('Gust forces the other rider to two cells a tick', () => {
    let s = use(setup({ head: { x: 5, y: 75 }, direction: 'up' }, FAR, { rows: 80 }), 1, 'gust')
    s = run(s, TURF_EFFECT_TICKS.gust)
    expect(s.players[2].head).toEqual({ x: 15, y: 2 + 2 * TURF_EFFECT_TICKS.gust })
    expect(s.players[1].head.y).toBe(75 - TURF_EFFECT_TICKS.gust)
  })
})

describe('Frost', () => {
  it('holds the other rider still, keeping its turn for when it thaws', () => {
    let s = use(setup({ head: { x: 5, y: 75 }, direction: 'up' }, FAR, { rows: 80 }), 1, 'frost')
    s = applyTurfTurn(s, 2, 'left')
    s = run(s, TURF_EFFECT_TICKS.frost)
    expect(s.players[2].head).toEqual(FAR.head)
    expect(s.players[2].pendingDirection).toBe('left')
    expect(turfStepsFor(s.players[2].effects, s.tick + 1)).toBe(1)
    s = run(s, 1)
    expect(s.players[2].head).toEqual({ x: 14, y: 2 })
  })

  it('lets you cut a frozen rider out on its trail by riding into it', () => {
    let s = run(setup({ head: { x: 5, y: 7 }, direction: 'right' }, { head: { x: 10, y: 5 }, direction: 'down' }), 2)
    s = run(use(s, 1, 'frost'), 3)
    expect(s.outcome).toEqual({ type: 'win', winner: 1, reason: 'crash' })
    expect(s.players[2].crashCell).toEqual({ x: 10, y: 7 })
  })

  it('still crashes you riding into a frozen rider on its own ground', () => {
    const s = run(use(setup({ head: { x: 5, y: 7 }, direction: 'right' }, { head: { x: 10, y: 7 }, direction: 'down' }, { radius: 0 }), 1, 'frost'), 5)
    expect(s.outcome).toEqual({ type: 'win', winner: 2, reason: 'crash' })
  })
})

describe('Tangle', () => {
  it('lands on the other rider for its run', () => {
    let s = use(setup({ head: { x: 5, y: 75 }, direction: 'up' }, FAR, { rows: 80 }), 1, 'tangle')
    expect(s.players[2].effects.tangle).toEqual({ expiresAtTick: TURF_EFFECT_TICKS.tangle })
    expect(s.players[1].effects.tangle).toBeNull()
    s = run(s, TURF_EFFECT_TICKS.tangle)
    expect(s.players[2].effects.tangle).toBeNull()
  })
})

describe('Fence', () => {
  it('lets you ride over your own trail', () => {
    const s = run(use(setup({ head: { x: 5, y: 15 }, direction: 'up' }, FAR), 1, 'fence'), 6, { 3: { 1: 'right' }, 4: { 1: 'down' }, 5: { 1: 'left' } })
    expect(s.phase).toBe('playing')
    expect(s.players[1].head).toEqual({ x: 5, y: 13 })
  })

  it('keeps your trail from being cut', () => {
    const s = run(use(setup({ head: { x: 5, y: 15 }, direction: 'up' }, { head: { x: 2, y: 10 }, direction: 'right' }), 2, 'fence'), 5)
    expect(s.phase).toBe('playing')
    expect(s.players[2].alive).toBe(true)
    expect(s.players[1].head).toEqual({ x: 5, y: 10 })
  })

  it('never loses a head-on', () => {
    const s = run(use(setup({ head: { x: 5, y: 14 }, direction: 'up' }, { head: { x: 5, y: 6 }, direction: 'down' }), 1, 'fence'), 4)
    expect(s.outcome).toEqual({ type: 'win', winner: 1, reason: 'crash' })
  })

  it('still crashes at the edge', () => {
    const s = run(use(setup({ head: { x: 5, y: 2 }, direction: 'up' }, FAR), 1, 'fence'), 3)
    expect(s.outcome).toEqual({ type: 'win', winner: 2, reason: 'crash' })
  })

  it('runs out', () => {
    let s = use(setup({ head: { x: 5, y: 75 }, direction: 'up' }, FAR, { rows: 80 }), 1, 'fence')
    s = run(s, TURF_EFFECT_TICKS.fence - 1)
    expect(s.players[1].effects.fence).not.toBeNull()
    s = run(s, 1)
    expect(s.players[1].effects.fence).toBeNull()
  })
})

describe('Sod', () => {
  it('claims the square around your head', () => {
    const s = use(setup({ head: { x: 10, y: 10 }, direction: 'up' }, FAR), 1, 'sod')
    expect(s.ground[1]).toBe(25)
    for (const [x, y] of [
      [8, 8],
      [12, 12],
      [8, 12]
    ]) {
      expect(ownerAt(s, x, y)).toBe(1)
    }
    expect(s.events.captured[1]).toBe(24)
  })

  it('brings you home when you’re out, claiming your trail and what it closes off', () => {
    // Up column 5 from a 3 x 3 home, right along row 10, down column 13 and left along row 17: Sod at
    // (8, 17) reaches back to the home square and closes the loop.
    let s = setup({ head: { x: 5, y: 20 }, direction: 'up' }, { head: { x: 25, y: 2 }, direction: 'down' }, { cols: 30, rows: 40, radius: 1 })
    s = run(s, 30, { 10: { 1: 'right' }, 18: { 1: 'down' }, 25: { 1: 'left' } })
    expect(s.players[1].head).toEqual({ x: 8, y: 17 })
    const trail = s.players[1].trail
    s = use(s, 1, 'sod')
    expect(s.players[1].trail).toEqual([])
    expect(s.players[1].leftFrom).toBeNull()
    for (const cell of trail) expect(ownerAt(s, cell.x, cell.y)).toBe(1)
    expect(ownerAt(s, 9, 12)).toBe(1)
    expect(ownerAt(s, 11, 18)).toBe(0)
  })

  it('suffocates a rider whose last ground it covers', () => {
    let s = setup({ head: { x: 5, y: 10 }, direction: 'up' }, FAR)
    s = withGround(s, { 1: [{ x: 5, y: 10 }], 2: [{ x: 6, y: 11 }] })
    s = use(s, 1, 'sod')
    expect(s.outcome).toEqual({ type: 'win', winner: 1, reason: 'suffocation' })
    expect(s.players[2].alive).toBe(false)
  })
})

describe('powerups on the home rule', () => {
  it('holds a rider sent home mid-dash there for the rest of the tick', () => {
    // At the top edge of its home square, dashing up: off the board on the tick's first cell, back to
    // (5, 0) facing along its ground, and not moving on for the second.
    let s = run(setup({ head: { x: 5, y: 1 }, direction: 'up' }, FAR, { radius: 1 }), 1, {}, HOME)
    expect(s.players[1].head).toEqual({ x: 5, y: 0 })
    expect(s.players[1].trail).toEqual([])
    s = withEffects(s, 1, { speed: { type: 'dash', expiresAtTick: s.tick + 5 } })
    s = run(s, 1, {}, HOME)
    expect(s.events.sentHome).toEqual([1])
    expect(s.players[1].crashCell).toEqual({ x: 5, y: -1 })
    expect(s.players[1].head).toEqual({ x: 5, y: 0 })
    expect(s.players[1].direction).toBe('right')
  })
})
