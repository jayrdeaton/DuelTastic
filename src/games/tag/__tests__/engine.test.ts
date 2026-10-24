import type { Direction, GridCell } from '@tastic/grid'

import { TAG_EFFECT_TICKS, TAG_FREEZE_TICKS, TAG_IT_SPEED, TAG_TAIL_CELLS } from '../constants'
import { applyTagActivation, applyTagTurn, createTagState, finishTagOnTime, freezeLeft, pillarsFor, startTag, tickTag, touching } from '../engine'
import type { TagArena, TagPowerup, TagSeat, TagState } from '../types'

interface Start {
  head: GridCell
  direction: Direction
}

// A playing round on an open board unless asked for pillars, seat 2 It unless told otherwise.
function setup(p1: Start, p2: Start, { cols = 20, rows = 20, it = 2 as TagSeat, arena = 'open' as TagArena } = {}): TagState {
  return startTag(createTagState({ grid: { cols, rows }, layout: 'faceToFace', arena, it, starts: { 1: p1, 2: p2 } }))
}

// Runs `ticks` ticks, applying `turns[i]` just before tick i (counting from 0).
function run(state: TagState, ticks: number, turns: Record<number, Partial<Record<TagSeat, Direction>>> = {}): TagState {
  let s = state
  for (let i = 0; i < ticks; i++) {
    for (const seat of [1, 2] as const) {
      const d = turns[i]?.[seat]
      if (d) s = applyTagTurn(s, seat, d)
    }
    s = tickTag(s)
  }
  return s
}

// Seat 2, It, parked in a far corner riding into the edge, out of everyone's way.
const PARKED: Start = { head: { x: 19, y: 0 }, direction: 'up' }

describe('createTagState', () => {
  it('starts the riders apart, with the given seat It', () => {
    const s = createTagState({ grid: { cols: 17, rows: 38 }, layout: 'faceToFace', it: 1 })
    expect(s.phase).toBe('onboarding')
    expect(s.it).toBe(1)
    expect(s.players[1].head.y).toBeGreaterThan(s.players[2].head.y)
    expect(touching(s.players[1].head, s.players[2].head)).toBe(false)
  })

  it('lays pillars evenly, away from both starting cells', () => {
    const s = createTagState({ grid: { cols: 17, rows: 38 }, layout: 'faceToFace' })
    expect(s.pillars.length).toBeGreaterThan(4)
    for (const seat of [1, 2] as const) {
      const { x, y } = s.players[seat].head
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) expect(s.blocked[(y + dy) * 17 + x + dx]).toBe(0)
    }
    expect(s.blocked.reduce((n, b) => n + b, 0)).toBe(s.pillars.reduce((n, p) => n + p.width * p.height, 0))
  })

  it('mirrors the pillars end to end, whatever the board’s size', () => {
    for (const [cols, rows] of [
      [24, 30],
      [17, 38],
      [45, 36],
      [20, 31]
    ]) {
      const pillars = pillarsFor({ cols, rows }, [])
      const key = (x: number, y: number) => `${x},${y}`
      const cells = new Set<string>()
      for (const p of pillars) for (let y = p.y; y < p.y + p.height; y++) for (let x = p.x; x < p.x + p.width; x++) cells.add(key(x, y))
      expect(cells.size).toBeGreaterThan(0)
      for (const c of cells) {
        const [x, y] = c.split(',').map(Number)
        expect(cells.has(key(cols - 1 - x, rows - 1 - y))).toBe(true)
      }
    }
  })

  it('has no pillars on an open board', () => {
    expect(createTagState({ grid: { cols: 17, rows: 38 }, layout: 'faceToFace', arena: 'open' }).pillars).toEqual([])
  })
})

describe('moving', () => {
  it('rides a cell a tick and keeps a short tail', () => {
    const s = run(setup({ head: { x: 5, y: 18 }, direction: 'up' }, PARKED), 8)
    expect(s.players[1].head).toEqual({ x: 5, y: 10 })
    expect(s.players[1].recent).toHaveLength(TAG_TAIL_CELLS)
    expect(s.players[1].recent[TAG_TAIL_CELLS - 1]).toEqual({ x: 5, y: 10 })
  })

  it('can turn straight back', () => {
    const s = run(setup({ head: { x: 5, y: 10 }, direction: 'up' }, PARKED), 2, { 1: { 1: 'down' } })
    expect(s.players[1].head).toEqual({ x: 5, y: 10 })
    expect(s.players[1].direction).toBe('down')
  })

  it('stops at the edge until turned', () => {
    let s = run(setup({ head: { x: 5, y: 1 }, direction: 'up' }, PARKED), 3)
    expect(s.players[1].head).toEqual({ x: 5, y: 0 })
    expect(s.events.blocked).toContain(1)
    s = run(s, 2, { 0: { 1: 'right' } })
    expect(s.players[1].head).toEqual({ x: 7, y: 0 })
  })

  it('stops at a pillar', () => {
    // Rider 1 rides up the first pillar's column, from three cells below it.
    const pillar = createTagState({ grid: { cols: 20, rows: 20 }, layout: 'faceToFace', starts: { 1: PARKED, 2: PARKED } }).pillars[0]
    const s0 = setup({ head: { x: pillar.x, y: pillar.y + pillar.height + 3 }, direction: 'up' }, PARKED, { arena: 'pillars' })
    expect(s0.pillars).toContainEqual(pillar)
    const s = run(s0, 5)
    expect(s.players[1].head).toEqual({ x: pillar.x, y: pillar.y + pillar.height })
    expect(s.events.blocked).toContain(1)
  })

  it('holds a turn into a pillar until the way opens, riding on meanwhile', () => {
    const s0 = setup({ head: { x: 0, y: 0 }, direction: 'right' }, { head: { x: 19, y: 19 }, direction: 'down' }, { arena: 'pillars' })
    const pillar = s0.pillars[0]
    // Ride right along the row under the first pillar, asking to turn up while it's still overhead.
    const row = pillar.y + pillar.height
    let s: TagState = { ...s0, players: { ...s0.players, 1: { ...s0.players[1], head: { x: pillar.x, y: row } } } }
    s = applyTagTurn(s, 1, 'up')
    s = run(s, 1)
    // Still under the pillar: the turn waits, and it rides on.
    expect(s.players[1].head).toEqual({ x: pillar.x + 1, y: row })
    expect(s.players[1].pendingDirection).toBe('up')
    s = run(s, 2)
    // Past it: turned and going up.
    expect(s.players[1].head).toEqual({ x: pillar.x + pillar.width, y: row - 1 })
    expect(s.players[1].direction).toBe('up')
  })

  it('lets It ride a little faster', () => {
    const s = run(setup({ head: { x: 2, y: 40 }, direction: 'up' }, { head: { x: 18, y: 40 }, direction: 'up' }, { rows: 60 }), 18)
    expect(40 - s.players[1].head.y).toBe(18)
    expect(40 - s.players[2].head.y).toBe(Math.floor(18 * TAG_IT_SPEED))
  })

  it('ignores turns before the round starts', () => {
    const s = createTagState({ grid: { cols: 20, rows: 20 }, layout: 'faceToFace' })
    expect(applyTagTurn(s, 1, 'left')).toBe(s)
    expect(tickTag(s)).toBe(s)
  })
})

describe('tagging', () => {
  // It (seat 2) riding down column 5 at seat 1, who rides up it.
  const headOn = () => setup({ head: { x: 5, y: 15 }, direction: 'up' }, { head: { x: 5, y: 5 }, direction: 'down' })

  it('passes It on when It touches the other rider', () => {
    let s = headOn()
    let ticks = 0
    while (s.it === 2 && ticks < 20) {
      s = tickTag(s)
      ticks++
    }
    expect(s.it).toBe(1)
    expect(s.tags).toBe(1)
    expect(s.events.tagged).toBe(1)
    expect(touching(s.players[1].head, s.players[2].head)).toBe(true)
  })

  it('counts a diagonal touch', () => {
    // Seat 1 held in the corner by the edge; It rides up the next column over.
    let s = tickTag(setup({ head: { x: 0, y: 0 }, direction: 'up' }, { head: { x: 1, y: 3 }, direction: 'up' }))
    expect(s.players[2].head).toEqual({ x: 1, y: 2 })
    expect(s.it).toBe(2)
    s = tickTag(s)
    expect(s.players[2].head).toEqual({ x: 1, y: 1 })
    expect(s.it).toBe(1)
  })

  it('freezes the new It while the old one gets away, with no tag-back', () => {
    let s = headOn()
    while (s.it === 2) s = tickTag(s)
    const frozenAt = s.players[1].head
    s = run(s, TAG_FREEZE_TICKS, Object.fromEntries([[0, { 2: 'left' as const }]]))
    // Seat 1 hasn't moved; seat 2 got away and wasn't tagged back even while they touched.
    expect(s.players[1].head).toEqual(frozenAt)
    expect(s.it).toBe(1)
    expect(s.players[2].head.x).toBeLessThan(5)
  })

  it('counts the freeze down for the board', () => {
    let s = headOn()
    expect(freezeLeft(s)).toBe(0)
    while (s.it === 2) s = tickTag(s)
    expect(freezeLeft(s)).toBe(1)
    s = run(s, TAG_FREEZE_TICKS - 1)
    expect(freezeLeft(s)).toBeCloseTo(1 / TAG_FREEZE_TICKS)
    s = run(s, 1)
    expect(freezeLeft(s)).toBe(0)
  })

  it('tags back once the freeze is over', () => {
    let s = headOn()
    while (s.it === 2) s = tickTag(s)
    // Seat 2 stays put against... nothing: hold it in place by riding into the edge from a cell away.
    s = { ...s, players: { ...s.players, 2: { ...s.players[2], head: { x: s.players[1].head.x + 1, y: 0 }, direction: 'up' } } }
    s = { ...s, players: { ...s.players, 1: { ...s.players[1], head: { x: s.players[2].head.x - 1, y: 1 }, direction: 'up' } } }
    s = run(s, TAG_FREEZE_TICKS)
    expect(s.it).toBe(1)
    s = run(s, 1)
    expect(s.it).toBe(2)
  })

  it('counts each seat’s ticks as It', () => {
    let s = headOn()
    while (s.it === 2) s = tickTag(s)
    // The tick of the tag counts for the new It.
    expect(s.itTicks[1]).toBe(1)
    const asIt = s.itTicks[2]
    s = run(s, 3)
    expect(s.itTicks).toEqual({ 1: 4, 2: asIt })
  })
})

describe('the clock', () => {
  const s = setup({ head: { x: 5, y: 15 }, direction: 'up' }, PARKED)

  it('Hot Potato: whoever’s It loses', () => {
    expect(finishTagOnTime(s, 'hotPotato').outcome).toEqual({ type: 'win', winner: 1 })
    expect(finishTagOnTime({ ...s, it: 1 }, 'hotPotato').outcome).toEqual({ type: 'win', winner: 2 })
  })

  it('Least Time It: less time as It wins, the same is a draw', () => {
    expect(finishTagOnTime({ ...s, itTicks: { 1: 40, 2: 30 } }, 'leastIt').outcome).toEqual({ type: 'win', winner: 2 })
    expect(finishTagOnTime({ ...s, itTicks: { 1: 30, 2: 30 } }, 'leastIt').outcome).toEqual({ type: 'draw' })
  })

  it('leaves a round that is already over alone', () => {
    const over = finishTagOnTime(s, 'hotPotato')
    expect(finishTagOnTime(over, 'leastIt')).toBe(over)
    expect(tickTag(over)).toBe(over)
  })
})

// Gives a seat a powerup and uses it straight away.
const use = (state: TagState, seat: TagSeat, held: TagPowerup) => applyTagActivation({ ...state, players: { ...state.players, [seat]: { ...state.players[seat], held } } }, seat)
const ON: TagPowerup[] = ['dash', 'freeze']

describe('pickups', () => {
  it('turn up between the riders with powerups on, clear of pillars, and none with them off', () => {
    const s0 = setup({ head: { x: 8, y: 30 }, direction: 'up' }, { head: { x: 8, y: 5 }, direction: 'down' }, { cols: 17, rows: 38, arena: 'pillars' })
    for (const r of [0, 0.5, 0.99]) {
      const s = tickTag(s0, ON, () => r)
      expect(s.pickups).toHaveLength(1)
      const { cell } = s.pickups[0]
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) expect(s.blocked[(cell.y + dy) * 17 + cell.x + dx]).toBe(0)
    }
    expect(tickTag(s0).pickups).toEqual([])
  })

  it('is picked up from the next cell over, and another turns up', () => {
    let s = setup({ head: { x: 5, y: 15 }, direction: 'up' }, PARKED)
    s = { ...s, pickups: [{ id: 'test', type: 'freeze', cell: { x: 6, y: 12 } }] }
    s = tickTag(
      tickTag(s, ON, () => 0),
      ON,
      () => 0
    )
    expect(s.players[1].held).toBe('freeze')
    expect(s.events.collected).toEqual([1])
    expect(s.pickups).toHaveLength(1)
    expect(s.pickups[0].id).not.toBe('test')
  })
})

describe('powerups', () => {
  it('does nothing with nothing held', () => {
    const s = setup({ head: { x: 5, y: 15 }, direction: 'up' }, PARKED)
    expect(applyTagActivation(s, 1)).toBe(s)
  })

  it('Dash doubles a rider’s pace, It’s included', () => {
    const s = run(use(use(setup({ head: { x: 2, y: 40 }, direction: 'up' }, { head: { x: 18, y: 40 }, direction: 'up' }, { rows: 60 }), 1, 'dash'), 2, 'dash'), 10)
    expect(40 - s.players[1].head.y).toBe(20)
    expect(40 - s.players[2].head.y).toBe(Math.floor(10 * 2 * TAG_IT_SPEED))
  })

  it('Freeze holds the other rider still, and a frozen It can’t tag', () => {
    // Seat 1 freezes It, then rides up the next column past it.
    let s = use(setup({ head: { x: 5, y: 12 }, direction: 'up' }, { head: { x: 6, y: 8 }, direction: 'down' }), 1, 'freeze')
    s = run(s, 4)
    expect(s.players[2].head).toEqual({ x: 6, y: 8 })
    expect(s.players[1].head).toEqual({ x: 5, y: 8 })
    expect(s.it).toBe(2)
    s = run(s, TAG_EFFECT_TICKS.freeze)
    expect(s.players[1].head.y).toBeLessThan(8)
  })

  it('Mud halves a rider’s pace, It’s included, and a slowed It can still tag', () => {
    const s = run(use(use(setup({ head: { x: 2, y: 40 }, direction: 'up' }, { head: { x: 18, y: 40 }, direction: 'up' }, { rows: 60 }), 2, 'mud'), 1, 'mud'), 10)
    expect(40 - s.players[1].head.y).toBe(5)
    expect(40 - s.players[2].head.y).toBe(Math.floor((10 * TAG_IT_SPEED) / 2))
    // It, slowed, riding down onto the runner parked against the bottom edge.
    let t = use(setup({ head: { x: 5, y: 19 }, direction: 'down' }, { head: { x: 5, y: 15 }, direction: 'down' }), 1, 'mud')
    t = run(t, 8)
    expect(t.it).toBe(1)
  })

  it('Safe keeps the runner from being tagged until it runs out', () => {
    // It parked against the edge right beside the runner, who's parked against it too.
    let s = use(setup({ head: { x: 5, y: 0 }, direction: 'up' }, { head: { x: 6, y: 0 }, direction: 'up' }), 1, 'safe')
    s = run(s, TAG_EFFECT_TICKS.safe)
    expect(s.it).toBe(2)
    s = run(s, 1)
    expect(s.it).toBe(1)
  })

  it('Safe does nothing for It, which keeps holding it', () => {
    const s0 = setup({ head: { x: 5, y: 15 }, direction: 'up' }, PARKED)
    const s = use(s0, 2, 'safe')
    expect(s.players[2].held).toBe('safe')
    expect(s.players[2].effects.shield).toBeNull()
  })

  it('Tangle lands on the other rider for its run', () => {
    let s = use(setup({ head: { x: 5, y: 15 }, direction: 'up' }, PARKED), 1, 'tangle')
    expect(s.players[2].effects.reverse).toEqual({ expiresAtTick: TAG_EFFECT_TICKS.tangle })
    expect(s.players[1].held).toBeNull()
    s = run(s, TAG_EFFECT_TICKS.tangle)
    expect(s.players[2].effects.reverse).toBeNull()
  })

  it('lets Dash thaw a frozen rider', () => {
    let s = use(setup({ head: { x: 5, y: 15 }, direction: 'up' }, PARKED), 2, 'freeze')
    expect(s.players[1].effects.speed?.kind).toBe('freeze')
    s = use(s, 1, 'dash')
    expect(s.players[1].effects.speed?.kind).toBe('boost')
  })
})
