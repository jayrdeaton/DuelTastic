import type { Direction, GridCell } from '@tastic/grid'

import { applyTurfTurn, countGround, createTurfState, finishTurfOnTime, groundShare, startTurf, tickTurf, TURF_HOME_RADIUS } from '../engine'
import { DEFAULT_TURF_RULES, type TurfRules, type TurfSeat, type TurfState } from '../types'

const HOME: TurfRules = { crash: 'home', ownTrailDeadly: true }

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
    const s = run(setup({ head: { x: 5, y: 15 }, direction: 'up' }, FAR), 6, { 3: { 1: 'right' }, 4: { 1: 'down' }, 5: { 1: 'left' } }, { crash: 'out', ownTrailDeadly: false })
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
