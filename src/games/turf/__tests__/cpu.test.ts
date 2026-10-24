import { type Direction, type GridCell, isInBounds, stepCell } from '@tastic/grid'
import { applyControlInversion } from '@tastic/input'

import { type Effects, NO_EFFECTS } from '../../shared/powerups'
import { TURF_POWERUPS } from '../constants'
import { applyTurfCpu, chooseTurfCpuMove, shouldTurfCpuActivate, type TurfCpuDifficulty, type TurfCpuPlan } from '../cpu'
import { applyTurfActivation, applyTurfTurn, countGround, createTurfState, startTurf, tickTurf } from '../engine'
import type { TurfPlayer, TurfRules, TurfSeat, TurfState } from '../types'

const HOME: TurfRules = { crash: 'home', ownTrailDeadly: true, powerups: [] }

// A small seeded random, so every run of these tests plays the same games.
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rect = (x0: number, y0: number, x1: number, y1: number): GridCell[] => {
  const out: GridCell[] = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ x, y })
  return out
}

function board(cols: number, rows: number, ground: Record<TurfSeat, GridCell[]>, players: Record<TurfSeat, Partial<TurfPlayer> & { head: GridCell; direction: Direction }>): TurfState {
  let s = startTurf(createTurfState({ grid: { cols, rows }, layout: 'faceToFace', homeRadius: 0, starts: { 1: players[1], 2: players[2] } }))
  const owner = new Uint8Array(cols * rows)
  for (const seat of [1, 2] as const) for (const c of ground[seat]) owner[c.y * cols + c.x] = seat
  s = { ...s, owner, ground: countGround(owner), players: { 1: { ...s.players[1], ...players[1] }, 2: { ...s.players[2], ...players[2] } } }
  return s
}

const column = (x: number, fromY: number, toY: number): GridCell[] => {
  const out: GridCell[] = []
  for (let y = fromY; fromY <= toY ? y <= toY : y >= toY; y += fromY <= toY ? 1 : -1) out.push({ x, y })
  return out
}

describe('chooseTurfCpuMove', () => {
  it('turns before the board’s edge', () => {
    const s = board(20, 20, { 1: rect(3, 0, 7, 4), 2: [{ x: 15, y: 15 }] }, { 1: { head: { x: 5, y: 0 }, direction: 'up' }, 2: { head: { x: 15, y: 15 }, direction: 'down' } })
    const { direction } = chooseTurfCpuMove(s, 1, 'hard', null, HOME, seeded(1))
    expect(['left', 'right']).toContain(direction)
  })

  it('turns away from its own trail', () => {
    // Out from (10, 15), up, left, down and back right to (9, 13): its trail is straight ahead and on
    // its left, so down is the only way.
    const trail = [...column(10, 14, 12), { x: 9, y: 12 }, { x: 8, y: 12 }, { x: 8, y: 13 }, { x: 9, y: 13 }]
    const s = board(20, 20, { 1: rect(9, 15, 11, 17), 2: [{ x: 18, y: 0 }] }, { 1: { head: { x: 9, y: 13 }, direction: 'right', trail, leftFrom: { x: 10, y: 15 } }, 2: { head: { x: 18, y: 0 }, direction: 'left' } })
    expect(chooseTurfCpuMove(s, 1, 'hard', null, HOME, seeded(1)).direction).toBe('down')
  })

  const outOnALoop = (opponent: GridCell) => board(20, 20, { 1: rect(4, 15, 6, 17), 2: rect(16, 0, 18, 2) }, { 1: { head: { x: 5, y: 10 }, direction: 'up', trail: column(5, 14, 10), leftFrom: { x: 5, y: 15 } }, 2: { head: opponent, direction: 'right' } })
  const keepGoingUp: TurfCpuPlan = { out: 'up', depth: 10, side: 'right', width: 5, aggressive: false, started: true }

  it('keeps riding its loop while it’s safe', () => {
    const { direction } = chooseTurfCpuMove(outOnALoop({ x: 17, y: 1 }), 1, 'hard', keepGoingUp, HOME, seeded(1))
    expect(direction).toBe('up')
  })

  it('heads home once the other rider could reach its trail first', () => {
    // Two steps from the trail, while home is six away.
    const { direction } = chooseTurfCpuMove(outOnALoop({ x: 3, y: 12 }), 1, 'normal', keepGoingUp, HOME, seeded(1))
    expect(['left', 'right']).toContain(direction)
  })

  it('goes for the other rider’s trail when it can cut it first', () => {
    const s = board(40, 20, { 1: rect(2, 15, 8, 19), 2: rect(30, 0, 34, 4) }, { 1: { head: { x: 5, y: 16 }, direction: 'right' }, 2: { head: { x: 5, y: 12 }, direction: 'left', trail: column(12, 12, 12).concat(rect(5, 12, 11, 12).reverse()), leftFrom: { x: 30, y: 4 } } })
    const { direction } = chooseTurfCpuMove(s, 1, 'hard', null, HOME, seeded(1))
    expect(direction).toBe('up')
  })
})

const effects = (patch: Partial<Effects>): Effects => ({ ...NO_EFFECTS(), ...patch })
const LONG = 1000

describe('the CPU with powerups', () => {
  // Out on a loop up column 5, seven steps from home by way of the next column.
  const outOnALoop = (opponent: Partial<TurfPlayer> & { head: GridCell; direction: Direction }, me: Partial<TurfPlayer> = {}) => board(20, 20, { 1: rect(4, 15, 6, 17), 2: rect(16, 0, 18, 2) }, { 1: { head: { x: 5, y: 10 }, direction: 'up', trail: column(5, 14, 10), leftFrom: { x: 5, y: 15 }, ...me }, 2: opponent })
  const keepGoingUp: TurfCpuPlan = { out: 'up', depth: 10, side: 'right', width: 5, aggressive: false, started: true }

  it('heads home sooner when the other rider is sped up', () => {
    // Ten steps from its trail: far enough at their normal speed, not at double.
    const far = { head: { x: 15, y: 12 }, direction: 'left' as const }
    expect(chooseTurfCpuMove(outOnALoop(far), 1, 'normal', keepGoingUp, HOME, seeded(1)).direction).toBe('up')
    const gusted = outOnALoop({ ...far, effects: effects({ speed: { kind: 'rush', expiresAtTick: LONG } }) })
    expect(chooseTurfCpuMove(gusted, 1, 'normal', keepGoingUp, HOME, seeded(1)).direction).not.toBe('up')
  })

  it('looks two cells ahead while it covers two a tick', () => {
    const nearTheTop = (speed: Effects['speed']) => board(20, 20, { 1: rect(4, 8, 6, 10), 2: [{ x: 18, y: 18 }] }, { 1: { head: { x: 5, y: 1 }, direction: 'up', trail: column(5, 7, 1), leftFrom: { x: 5, y: 8 }, effects: effects({ speed }) }, 2: { head: { x: 18, y: 18 }, direction: 'left' } })
    expect(chooseTurfCpuMove(nearTheTop(null), 1, 'hard', keepGoingUp, HOME, seeded(1)).direction).toBe('up')
    expect(['left', 'right']).toContain(chooseTurfCpuMove(nearTheTop({ kind: 'boost', expiresAtTick: LONG }), 1, 'hard', keepGoingUp, HOME, seeded(1)).direction)
  })

  it('uses a Fence when its trail could be cut before it gets home, at every level', () => {
    const s = outOnALoop({ head: { x: 3, y: 12 }, direction: 'right' }, { held: 'fence' })
    for (const level of ['easy', 'normal', 'hard'] as const) expect(shouldTurfCpuActivate(s, 1, level, HOME, () => 0.99)).toBe(true)
    expect(shouldTurfCpuActivate(outOnALoop({ head: { x: 17, y: 1 }, direction: 'right' }, { held: 'fence' }), 1, 'hard', HOME, () => 0.99)).toBe(false)
  })

  it('freezes the other rider when it can reach their trail in time, then goes to cut it', () => {
    const notAttacking: TurfCpuPlan = { out: 'right', depth: 6, side: 'up', width: 4, aggressive: false, started: false }
    let s = board(40, 20, { 1: rect(2, 15, 8, 19), 2: rect(30, 0, 34, 4) }, { 1: { head: { x: 5, y: 16 }, direction: 'right', held: 'frost' }, 2: { head: { x: 5, y: 12 }, direction: 'left', trail: column(12, 12, 12).concat(rect(5, 12, 11, 12).reverse()), leftFrom: { x: 30, y: 4 } } })
    expect(chooseTurfCpuMove(s, 1, 'normal', notAttacking, HOME, seeded(1)).direction).toBe('right')
    expect(shouldTurfCpuActivate(s, 1, 'normal', HOME, () => 0.99)).toBe(true)
    s = applyTurfActivation(s, 1)
    expect(chooseTurfCpuMove(s, 1, 'normal', notAttacking, HOME, seeded(1)).direction).toBe('up')
  })

  it('saves Tangle for a rider who’s out', () => {
    const home = board(20, 20, { 1: rect(4, 15, 6, 17), 2: rect(16, 0, 18, 2) }, { 1: { head: { x: 5, y: 16 }, direction: 'up', held: 'tangle' }, 2: { head: { x: 17, y: 1 }, direction: 'left' } })
    expect(shouldTurfCpuActivate(home, 1, 'hard', HOME, () => 0.99)).toBe(false)
    const out = outOnALoop({ head: { x: 12, y: 3 }, direction: 'left', trail: rect(12, 3, 15, 3).reverse(), leftFrom: { x: 16, y: 3 } }, { held: 'tangle' })
    expect(shouldTurfCpuActivate(out, 1, 'hard', HOME, () => 0.99)).toBe(true)
  })

  it('rides out for a pickup in reach (normal and hard, not easy)', () => {
    const plan: TurfCpuPlan = { out: 'up', depth: 6, side: 'left', width: 4, aggressive: false, started: false }
    let s = board(30, 30, { 1: rect(10, 10, 14, 14), 2: [{ x: 28, y: 28 }] }, { 1: { head: { x: 12, y: 12 }, direction: 'up' }, 2: { head: { x: 28, y: 28 }, direction: 'left' } })
    s = { ...s, pickups: [{ id: 'p', type: 'dash', cell: { x: 22, y: 12 } }] }
    expect(chooseTurfCpuMove(s, 1, 'normal', plan, HOME, seeded(3)).direction).toBe('right')
    expect(chooseTurfCpuMove(s, 1, 'easy', plan, HOME, seeded(3)).direction).toBe('up')
  })

  it('steers the wrong way under Tangle unless it makes up for it (hard always does, easy never)', () => {
    const tangled = board(20, 20, { 1: rect(3, 0, 7, 4), 2: [{ x: 15, y: 15 }] }, { 1: { head: { x: 5, y: 0 }, direction: 'up', effects: effects({ reverse: { expiresAtTick: LONG } }) }, 2: { head: { x: 15, y: 15 }, direction: 'down' } })
    for (const level of ['easy', 'hard'] as const) {
      const wanted = chooseTurfCpuMove(tangled, 1, level, null, HOME, seeded(5)).direction
      const queued = applyTurfCpu(tangled, 1, level, null, HOME, seeded(5)).state.players[1].pendingDirection
      expect(queued).toBe(level === 'hard' ? wanted : applyControlInversion(wanted, true))
    }
  })
})

describe('applyTurfCpu', () => {
  it('does nothing before the round starts', () => {
    const s = createTurfState({ grid: { cols: 20, rows: 20 }, layout: 'faceToFace' })
    expect(applyTurfCpu(s, 2, 'hard', null).state).toBe(s)
  })
})

// The CPU against a rider that only ever circles its own strip across the top of the board.
function playAgainstAStill(difficulty: TurfCpuDifficulty, seed: number, ticks: number) {
  const random = seeded(seed)
  const cols = 40
  const rows = 60
  let s = startTurf(createTurfState({ grid: { cols, rows }, layout: 'faceToFace' }))
  const strip = rect(0, 0, cols - 1, 7)
  const owner = s.owner.slice()
  for (const c of strip) owner[c.y * cols + c.x] = 2
  s = { ...s, owner, ground: countGround(owner), players: { ...s.players, 2: { ...s.players[2], head: { x: 20, y: 4 }, direction: 'right' } } }
  const startGround = s.ground[1]
  let plan: TurfCpuPlan | null = null
  let selfCrashes = 0
  for (let i = 0; i < ticks && s.phase === 'playing'; i++) {
    const circling = s.players[2]
    const stays = (d: Direction) => {
      const n = stepCell(circling.head, d)
      return isInBounds(n, s.grid) && s.owner[n.y * cols + n.x] === 2
    }
    const turn = ([circling.direction, 'down', 'up', 'left', 'right'] as Direction[]).find(stays)
    if (turn) s = applyTurfTurn(s, 2, turn)
    const cpu = applyTurfCpu(s, 1, difficulty, plan, HOME, random)
    plan = cpu.plan
    const before = s.players[1]
    s = tickTurf(cpu.state, HOME)
    if (s.events.crashed.includes(1)) {
      const at = s.players[1].crashCell!
      if (!isInBounds(at, s.grid) || before.trail.some((c) => c.x === at.x && c.y === at.y)) selfCrashes++
    }
  }
  return { selfCrashes, startGround, ground: s.ground[1] }
}

describe('the CPU over whole games', () => {
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    it(`never crashes itself, and keeps claiming ground (${difficulty})`, () => {
      for (let seed = 1; seed <= 8; seed++) {
        const result = playAgainstAStill(difficulty, seed, 500)
        expect(result.selfCrashes).toBe(0)
        expect(result.ground).toBeGreaterThan(result.startGround * 3)
      }
    })
  }
})

// Two CPUs against each other with every powerup on. Returns the crashes into its own trail or the
// edge that no Tangle forced (a rider cut while frozen crashes on its own head, which is a cut).
function playWithPowerups(levels: Record<TurfSeat, TurfCpuDifficulty>, rules: TurfRules, seed: number, ticks: number) {
  const random = seeded(seed)
  let s = startTurf(createTurfState({ grid: { cols: 48, rows: 100 }, layout: 'faceToFace' }))
  const plans: Record<TurfSeat, TurfCpuPlan | null> = { 1: null, 2: null }
  let selfCrashes = 0
  let used = 0
  for (let i = 0; i < ticks && s.phase === 'playing'; i++) {
    for (const seat of [1, 2] as const) {
      const held = s.players[seat].held
      const cpu = applyTurfCpu(s, seat, levels[seat], plans[seat], rules, random)
      if (held && !cpu.state.players[seat].held) used++
      plans[seat] = cpu.plan
      s = cpu.state
    }
    if (s.phase !== 'playing') break
    const before = s
    s = tickTurf(s, rules, random)
    for (const seat of s.events.crashed) {
      const p = before.players[seat]
      const at = s.players[seat].crashCell!
      const own = p.trail.some((c) => c.x === at.x && c.y === at.y) && !(at.x === p.head.x && at.y === p.head.y)
      if (p.effects.reverse === null && (!isInBounds(at, s.grid) || own)) selfCrashes++
    }
  }
  return { selfCrashes, used }
}

describe('the CPU with every powerup on', () => {
  for (const crash of ['out', 'home'] as const) {
    it(`never crashes itself unless it's tangled, and uses what it picks up (${crash})`, () => {
      const rules: TurfRules = { crash, ownTrailDeadly: true, powerups: TURF_POWERUPS }
      let used = 0
      for (let seed = 1; seed <= 4; seed++) {
        for (const levels of [
          { 1: 'normal', 2: 'hard' },
          { 1: 'easy', 2: 'hard' }
        ] as Record<TurfSeat, TurfCpuDifficulty>[]) {
          const result = playWithPowerups(levels, rules, seed, 800)
          expect(result.selfCrashes).toBe(0)
          used += result.used
        }
      }
      expect(used).toBeGreaterThan(10)
    })
  }
})

describe('the difficulty levels', () => {
  it('lets hard beat easy most of the time', () => {
    let hardWins = 0
    for (let seed = 1; seed <= 12; seed++) {
      const random = seeded(seed)
      let s = startTurf(createTurfState({ grid: { cols: 48, rows: 100 }, layout: 'faceToFace' }))
      let easy: TurfCpuPlan | null = null
      let hard: TurfCpuPlan | null = null
      for (let i = 0; i < 2000 && s.phase === 'playing'; i++) {
        const a = applyTurfCpu(s, 1, 'easy', easy, undefined, random)
        easy = a.plan
        const b = applyTurfCpu(a.state, 2, 'hard', hard, undefined, random)
        hard = b.plan
        s = tickTurf(b.state)
      }
      if (s.outcome?.type === 'win' && s.outcome.winner === 2) hardWins++
    }
    expect(hardWins).toBeGreaterThanOrEqual(9)
  })
})
