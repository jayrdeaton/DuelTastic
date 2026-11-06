import { computeGridSize, type Direction, type GridCell } from '@tastic/grid'

import { distanceField } from '@/shared/distanceField'
import { GRID_CELL_PX, scaleMsForCellPx } from '@/shared/match/constants'
import type { GridSizeTier } from '@/shared/match/types'

import { TAG_EFFECT_MS, TAG_IT_SPEED, TAG_MIN_PILLARS, TAG_PILLAR_SIZE_PX, TAG_POWERUPS, TAG_REACH_PX, TAG_SPEED_INTERVAL_MS, TAG_TAIL_CELLS, TAG_UNIT_PX } from '../constants'
import { applyTagActivation, applyTagTurn, cellIndex, createTagState, finishTagOnTime, freezeLeft, measuresFor, pillarsFor, startTag, tickTag, touching } from '../engine'
import type { TagArena, TagPowerup, TagSeat, TagState } from '../types'

interface Start {
  head: GridCell
  direction: Direction
}

// Most of these play on Tag's old 22pt cells at its old 115ms normal pace, where its measures come
// out as they always were (13 ticks of freeze, 8 of daze, a reach of a cell straight across), so the
// rules read in whole cells and ticks. The ones about the grid size play on the shared cells.
const OLD = { cellPx: TAG_UNIT_PX, intervalMs: 115 }
const M = measuresFor(OLD.cellPx, OLD.intervalMs)

const TIERS: GridSizeTier[] = ['small', 'medium', 'large']
// The round's pace on a tier's cells at the normal speed, as the play screen sets it.
const intervalFor = (tier: GridSizeTier) => scaleMsForCellPx(TAG_SPEED_INTERVAL_MS.normal, GRID_CELL_PX[tier])

// A playing round on an open board unless asked for pillars, seat 2 It unless told otherwise.
function setup(p1: Start, p2: Start, { cols = 20, rows = 20, it = 2 as TagSeat, arena = 'open' as TagArena } = {}): TagState {
  return startTag(createTagState({ grid: { cols, rows }, layout: 'faceToFace', arena, it, starts: { 1: p1, 2: p2 }, ...OLD }))
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

// Gives a seat a powerup and uses it straight away.
const use = (state: TagState, seat: TagSeat, held: TagPowerup) => applyTagActivation({ ...state, players: { ...state.players, [seat]: { ...state.players[seat], held } } }, seat)

// Tag moved onto the shared grid size (GRID_CELL_PX) on 2026-11-05 from cells of its own (16, 22 and
// 30pt). Its distances are in px and its times in ms, turned into cells and ticks for the round.
describe('measuresFor', () => {
  it('comes out as Tag always played on its old 22pt cells at 115ms', () => {
    expect(M).toEqual({ unit: 1, reach: TAG_REACH_PX / TAG_UNIT_PX, freezeTicks: 13, dazeTicks: 8, effectTicks: { dash: 22, freeze: 13, mud: 26, safe: 26, tangle: 17 } })
  })

  it.each(TIERS)('keeps the same reach and times on screen on the %s cells', (tier) => {
    const cellPx = GRID_CELL_PX[tier]
    const intervalMs = intervalFor(tier)
    const m = measuresFor(cellPx, intervalMs)
    expect(m.reach * cellPx).toBeCloseTo(TAG_REACH_PX)
    expect(m.unit * cellPx).toBeCloseTo(TAG_UNIT_PX)
    expect(Math.abs(m.freezeTicks * intervalMs - 1500)).toBeLessThanOrEqual(intervalMs / 2)
    expect(Math.abs(m.dazeTicks * intervalMs - 900)).toBeLessThanOrEqual(intervalMs / 2)
    for (const p of TAG_POWERUPS) expect(Math.abs(m.effectTicks[p] * intervalMs - TAG_EFFECT_MS[p])).toBeLessThanOrEqual(intervalMs / 2)
  })
})

describe('createTagState', () => {
  it('starts the riders apart, with the given seat It', () => {
    const s = createTagState({ grid: { cols: 17, rows: 38 }, layout: 'faceToFace', it: 1, ...OLD })
    expect(s.phase).toBe('onboarding')
    expect(s.it).toBe(1)
    expect(s.players[1].head.y).toBeGreaterThan(s.players[2].head.y)
    expect(touching(s.players[1].head, s.players[2].head, M.reach)).toBe(false)
  })

  it('lays pillars evenly, away from both starting cells', () => {
    const s = createTagState({ grid: { cols: 17, rows: 38 }, layout: 'faceToFace', ...OLD })
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
      const pillars = pillarsFor({ cols, rows }, [], OLD.cellPx)
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

  // Pillars on an iPhone SE's and an iPhone 15's board at every grid size: at least TAG_MIN_PILLARS
  // (a narrow board gets the tighter lattice, two columns either side of the riders), about
  // TAG_PILLAR_SIZE_PX across whatever the cell size, clear of both starts, with a way between them.
  const PHONE_BOARDS = [
    [375, 600],
    [393, 720]
  ].flatMap(([width, height]) => TIERS.map((tier) => ({ tier, cellPx: GRID_CELL_PX[tier], ...computeGridSize(width, height, GRID_CELL_PX[tier]) })))

  it.each(PHONE_BOARDS)('lays pillars about TAG_PILLAR_SIZE_PX across on a $cols x $rows board ($tier), clear of both starts', ({ cellPx, cols, rows }) => {
    const grid = { cols, rows }
    const s = createTagState({ grid, layout: 'faceToFace', arena: 'pillars', cellPx })
    expect(s.pillars.length).toBeGreaterThanOrEqual(TAG_MIN_PILLARS)
    for (const p of s.pillars) expect(Math.abs(Math.min(p.width, p.height) * cellPx - TAG_PILLAR_SIZE_PX)).toBeLessThanOrEqual(cellPx)
    for (const seat of [1, 2] as const) {
      const { x, y } = s.players[seat].head
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) expect(s.blocked[(y + dy) * grid.cols + x + dx]).toBe(0)
    }
    expect(distanceField(grid, [cellIndex(s.players[1].head, grid)], s.blocked)[cellIndex(s.players[2].head, grid)]).toBeGreaterThan(0)
  })

  it('keeps the usual lattice where it already lays enough pillars', () => {
    // 17 across: the usual lattice's two columns, 7 apart, not the tighter one's.
    const columns = new Set(createTagState({ grid: { cols: 17, rows: 38 }, layout: 'faceToFace', arena: 'pillars', ...OLD }).pillars.map((p) => p.x))
    expect([...columns].sort((a, b) => a - b)).toEqual([4, 11])
  })

  it('has no pillars on an open board', () => {
    expect(createTagState({ grid: { cols: 17, rows: 38 }, layout: 'faceToFace', arena: 'open' }).pillars).toEqual([])
  })

  // The shared arenas, built as LightCycles and Turf build them now that Tag's cells are theirs, on the
  // boards an iPhone SE and an iPhone 15 give at every grid size, face to face.
  describe.each(['gauntlet', 'portals'] as const)('the %s arena on a phone', (arena) => {
    it.each(PHONE_BOARDS)('is built on a $cols x $rows board ($tier)', ({ cellPx, cols, rows }) => {
      const s = createTagState({ grid: { cols, rows }, layout: 'faceToFace', arena, cellPx })
      expect(s.pillars.length + s.portals.length).toBeGreaterThan(0)
    })

    it.each(PHONE_BOARDS)('leaves a way between the riders on a $cols x $rows board ($tier), clear of both', ({ cellPx, cols, rows }) => {
      const grid = { cols, rows }
      const s = createTagState({ grid, layout: 'faceToFace', arena, cellPx })
      const heads = [s.players[1].head, s.players[2].head]
      expect(distanceField(grid, [cellIndex(heads[0], grid)], s.blocked)[cellIndex(heads[1], grid)]).toBeGreaterThan(0)
      const cells = [...s.pillars, ...s.portals.flatMap((p) => [p.a, p.b])]
      for (const cell of cells) for (const head of heads) expect(Math.max(Math.abs(cell.x - head.x), Math.abs(cell.y - head.y))).toBeGreaterThanOrEqual(2)
    })
  })
})

describe('moving', () => {
  it('rides a cell a tick and keeps the cells for its tail', () => {
    const s = run(setup({ head: { x: 5, y: 38 }, direction: 'up' }, PARKED, { rows: 40 }), 25)
    expect(s.players[1].head).toEqual({ x: 5, y: 13 })
    expect(s.players[1].recent).toHaveLength(TAG_TAIL_CELLS)
    expect(s.players[1].recent[TAG_TAIL_CELLS - 1]).toEqual({ x: 5, y: 13 })
  })

  it('can turn straight back', () => {
    const s = run(setup({ head: { x: 5, y: 10 }, direction: 'up' }, PARKED), 2, { 1: { 1: 'down' } })
    expect(s.players[1].head).toEqual({ x: 5, y: 10 })
    expect(s.players[1].direction).toBe('down')
  })

  it('stops at the edge, dazed, until turned', () => {
    let s = run(setup({ head: { x: 5, y: 1 }, direction: 'up' }, PARKED), 2)
    expect(s.players[1].head).toEqual({ x: 5, y: 0 })
    expect(s.events.dazed).toEqual([1])
    expect(s.players[1].dazedThrough).toBe(2 + M.dazeTicks)
    // A turn pressed while dazed waits for the daze to be over.
    s = run(s, M.dazeTicks, { 0: { 1: 'right' } })
    expect(s.players[1].head).toEqual({ x: 5, y: 0 })
    s = run(s, 2)
    expect(s.players[1].head).toEqual({ x: 7, y: 0 })
  })

  it('stops at a pillar, dazed', () => {
    // Rider 1 rides up the first pillar's column, from three cells below it.
    const pillar = createTagState({ grid: { cols: 20, rows: 20 }, layout: 'faceToFace', starts: { 1: PARKED, 2: PARKED }, ...OLD }).pillars[0]
    const s0 = setup({ head: { x: pillar.x, y: pillar.y + pillar.height + 3 }, direction: 'up' }, PARKED, { arena: 'pillars' })
    expect(s0.pillars).toContainEqual(pillar)
    const s = run(s0, 4)
    expect(s.players[1].head).toEqual({ x: pillar.x, y: pillar.y + pillar.height })
    expect(s.events.dazed).toEqual([1])
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

describe('a bump', () => {
  it('dazes once, not again for riding on into the edge', () => {
    let s = setup({ head: { x: 5, y: 0 }, direction: 'up' }, PARKED)
    const dazes: number[] = []
    for (let i = 0; i < M.dazeTicks * 3; i++) {
      s = tickTag(s)
      if (s.events.dazed.includes(1)) dazes.push(s.tick)
    }
    expect(dazes).toEqual([1])
    expect(s.players[1].stuck).toBe(true)
  })

  it('dazes again once the rider has moved and bumps again', () => {
    let s = run(setup({ head: { x: 5, y: 0 }, direction: 'up' }, PARKED), 1 + M.dazeTicks)
    // Down a cell, then back up into the edge.
    s = run(s, 3, { 0: { 1: 'down' }, 1: { 1: 'up' } })
    expect(s.players[1].head).toEqual({ x: 5, y: 0 })
    expect(s.events.dazed).toEqual([1])
    expect(s.players[1].dazedThrough).toBe(s.tick + M.dazeTicks)
  })

  it('loses the rest of the tick’s steps', () => {
    // Dashing two cells a tick from a cell below the edge: the first reaches it, the second bumps.
    const s = run(use(setup({ head: { x: 5, y: 1 }, direction: 'up' }, PARKED), 1, 'dash'), 1)
    expect(s.players[1].head).toEqual({ x: 5, y: 0 })
    expect(s.events.dazed).toContain(1)
  })

  it('keeps a dazed It from tagging until the daze is over, and a dazed runner can be tagged', () => {
    // It bumps the edge on the first tick as the runner rides up beside it, and the runner bumps it
    // on the third.
    let s = run(setup({ head: { x: 6, y: 2 }, direction: 'up' }, { head: { x: 5, y: 0 }, direction: 'up' }), 3)
    expect(touching(s.players[1].head, s.players[2].head, M.reach)).toBe(true)
    s = run(s, M.dazeTicks - 2)
    expect(s.it).toBe(2)
    expect(s.tags).toBe(0)
    // It's daze (through tick 1 + M.dazeTicks) is over; the runner's (a tick later) isn't.
    s = run(s, 1)
    expect(s.players[1].dazedThrough).toBeGreaterThan(s.tick)
    expect(s.it).toBe(1)
  })

  it('dazes a Safe rider too', () => {
    const s = run(use(setup({ head: { x: 5, y: 1 }, direction: 'up' }, PARKED), 1, 'safe'), 2)
    expect(s.players[1].effects.shield).not.toBeNull()
    expect(s.events.dazed).toEqual([1])
  })
})

describe('a tick played in parts', () => {
  const RACE = () => setup({ head: { x: 2, y: 55 }, direction: 'up' }, { head: { x: 18, y: 55 }, direction: 'up' }, { rows: 60 })

  it('plays the same as a whole tick once the parts add up to one', () => {
    const whole = run(RACE(), 7)
    let parts = RACE()
    for (let i = 0; i < 7 * 3; i++) parts = tickTag(parts, [], Math.random, 1 / 3)
    expect(parts.tick).toBe(whole.tick)
    expect(parts.sinceTick).toBe(0)
    expect(parts.itTicks).toEqual(whole.itTicks)
    for (const seat of [1, 2] as const) {
      expect(parts.players[seat].head).toEqual(whole.players[seat].head)
      expect(parts.players[seat].stride).toBeCloseTo(whole.players[seat].stride)
    }
  })

  it('ends the tick only when its parts reach it', () => {
    const half = tickTag(RACE(), [], Math.random, 0.5)
    expect(half.tick).toBe(0)
    expect(half.sinceTick).toBe(0.5)
    expect(half.itTicks[2]).toBe(0)
    const done = tickTag(half, [], Math.random, 0.5)
    expect(done.tick).toBe(1)
    expect(done.sinceTick).toBe(0)
    expect(done.itTicks[2]).toBe(1)
  })

  // Played a frame at a time, It steps every 1 / TAG_IT_SPEED of a tick rather than a cell a tick
  // with a second cell every few: the jump that drew as a lurch forward.
  it('steps each rider on its own clock, It evenly', () => {
    const part = 0.05
    let s = RACE()
    const stepsAt: Record<TagSeat, number[]> = { 1: [], 2: [] }
    for (let i = 0; i < 400; i++) {
      const before = s
      s = tickTag(s, [], Math.random, part)
      for (const seat of [1, 2] as const) {
        const moved = Math.abs(s.players[seat].head.y - before.players[seat].head.y)
        expect(moved).toBeLessThanOrEqual(1)
        if (moved > 0) stepsAt[seat].push(i)
      }
    }
    const gaps = (at: number[]) => at.slice(1).map((n, i) => n - at[i])
    expect(new Set(gaps(stepsAt[1]))).toEqual(new Set([1 / part]))
    const itGap = 1 / part / TAG_IT_SPEED
    for (const gap of gaps(stepsAt[2])) expect([Math.floor(itGap), Math.ceil(itGap)]).toContain(gap)
  })

  it('keeps a newly tagged It still for its freeze', () => {
    // Seat 2, It, rides into seat 1 standing against the edge.
    let s = setup({ head: { x: 5, y: 0 }, direction: 'up' }, { head: { x: 5, y: 4 }, direction: 'up' })
    while (s.tags === 0) s = tickTag(s, [], Math.random, 0.1)
    const tagged = s.players[1].head
    for (let i = 0; i < (M.freezeTicks - 1) * 10; i++) s = tickTag(applyTagTurn(s, 1, 'down'), [], Math.random, 0.1)
    expect(s.it).toBe(1)
    expect(s.players[1].head).toEqual(tagged)
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
    expect(touching(s.players[1].head, s.players[2].head, M.reach)).toBe(true)
  })

  // Within TAG_REACH_PX, head center to head center, the edge of It's glow, rather than within a cell:
  // the same reach on screen whatever the grid size.
  it('reaches TAG_REACH_PX, straight across or at an angle', () => {
    const { reach } = measuresFor(GRID_CELL_PX.medium, intervalFor('medium'))
    // On 8pt cells, 28pt is three and a half cells.
    expect(touching({ x: 0, y: 0 }, { x: 3, y: 0 }, reach)).toBe(true)
    expect(touching({ x: 0, y: 0 }, { x: 2, y: 2 }, reach)).toBe(true)
    expect(touching({ x: 0, y: 0 }, { x: 4, y: 0 }, reach)).toBe(false)
    expect(touching({ x: 0, y: 0 }, { x: 3, y: 2 }, reach)).toBe(false)
  })

  it('tags from the edge of the reach on the shared cells', () => {
    // Seat 1 held in the corner by the edge; It rides up three columns over, on 8pt cells.
    let s = startTag(createTagState({ grid: { cols: 20, rows: 20 }, layout: 'faceToFace', arena: 'open', it: 2, starts: { 1: { head: { x: 0, y: 0 }, direction: 'up' }, 2: { head: { x: 3, y: 5 }, direction: 'up' } }, cellPx: GRID_CELL_PX.medium, intervalMs: intervalFor('medium') }))
    s = run(s, 3)
    expect(s.players[2].head).toEqual({ x: 3, y: 2 })
    expect(s.it).toBe(2)
    s = run(s, 1)
    expect(s.players[2].head).toEqual({ x: 3, y: 1 })
    expect(s.it).toBe(1)
  })

  it('freezes the new It while the old one gets away, with no tag-back', () => {
    let s = headOn()
    while (s.it === 2) s = tickTag(s)
    const frozenAt = s.players[1].head
    s = run(s, M.freezeTicks, Object.fromEntries([[0, { 2: 'left' as const }]]))
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
    s = run(s, M.freezeTicks - 1)
    expect(freezeLeft(s)).toBeCloseTo(1 / M.freezeTicks)
    s = run(s, 1)
    expect(freezeLeft(s)).toBe(0)
  })

  it('tags back once the freeze is over', () => {
    let s = headOn()
    while (s.it === 2) s = tickTag(s)
    // Both held in place riding into the top edge, side by side.
    s = { ...s, players: { ...s.players, 2: { ...s.players[2], head: { x: s.players[1].head.x + 1, y: 0 }, direction: 'up' } } }
    s = { ...s, players: { ...s.players, 1: { ...s.players[1], head: { x: s.players[2].head.x - 1, y: 0 }, direction: 'up' } } }
    s = run(s, M.freezeTicks)
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
    s = run(s, M.effectTicks.freeze)
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
    s = run(s, M.effectTicks.safe)
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
    expect(s.players[2].effects.reverse).toEqual({ expiresAtTick: M.effectTicks.tangle })
    expect(s.players[1].held).toBeNull()
    s = run(s, M.effectTicks.tangle)
    expect(s.players[2].effects.reverse).toBeNull()
  })

  it('lets Dash thaw a frozen rider', () => {
    let s = use(setup({ head: { x: 5, y: 15 }, direction: 'up' }, PARKED), 2, 'freeze')
    expect(s.players[1].effects.speed?.kind).toBe('freeze')
    s = use(s, 1, 'dash')
    expect(s.players[1].effects.speed?.kind).toBe('boost')
  })
})
