import { type Direction, type GridCell, isInBounds, stepCell } from '@tastic/grid'

import { applyTurfCpu, chooseTurfCpuMove, type TurfCpuDifficulty, type TurfCpuPlan } from '../cpu'
import { applyTurfTurn, countGround, createTurfState, startTurf, tickTurf } from '../engine'
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
