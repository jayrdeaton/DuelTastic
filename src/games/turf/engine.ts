import { type Direction, type GridCell, type GridSize, isInBounds, isOppositeDirection, stepCell } from '@tastic/grid'

// Shared with LightCycles: each rider starts at the middle of their own half, facing the other. Moves
// to shared/ when this repo takes the pack layout.
import { startingStateFor } from '@/utils/grid'

import { claimedCells } from './capture'
import { DEFAULT_TURF_RULES, type TurfLayout, type TurfOutcome, type TurfPlayer, type TurfRules, type TurfSeat, type TurfState } from './types'

const SEATS: readonly TurfSeat[] = [1, 2]

// Half the side of each rider's starting square, in cells: 3 gives a 7 x 7 square.
export const TURF_HOME_RADIUS = 3

const NO_EVENTS = (): TurfState['events'] => ({ captured: { 1: 0, 2: 0 }, crashed: [], sentHome: [] })

const other = (seat: TurfSeat): TurfSeat => (seat === 1 ? 2 : 1)

export function cellIndex(cell: GridCell, grid: GridSize): number {
  return cell.y * grid.cols + cell.x
}

export function countGround(owner: Uint8Array): Record<TurfSeat, number> {
  const ground = { 1: 0, 2: 0 }
  for (let i = 0; i < owner.length; i++) {
    if (owner[i] === 1) ground[1]++
    else if (owner[i] === 2) ground[2]++
  }
  return ground
}

// A seat's share of the whole board, 0 to 1.
export function groundShare(state: TurfState, seat: TurfSeat): number {
  return state.ground[seat] / (state.grid.cols * state.grid.rows)
}

export interface CreateTurfStateParams {
  grid: GridSize
  layout: TurfLayout
  p1OnRight?: boolean
  homeRadius?: number
  // Where each rider starts and which way it's heading, instead of the layout's default. Its starting
  // square is centered on that cell either way.
  starts?: Partial<Record<TurfSeat, { head: GridCell; direction: Direction }>>
}

export function createTurfState({ grid, layout, p1OnRight = false, homeRadius = TURF_HOME_RADIUS, starts = {} }: CreateTurfStateParams): TurfState {
  const owner = new Uint8Array(grid.cols * grid.rows)
  const player = (seat: TurfSeat): TurfPlayer => {
    const { head, direction } = starts[seat] ?? startingStateFor(seat, grid, layout, p1OnRight)
    for (let y = Math.max(0, head.y - homeRadius); y <= Math.min(grid.rows - 1, head.y + homeRadius); y++) {
      for (let x = Math.max(0, head.x - homeRadius); x <= Math.min(grid.cols - 1, head.x + homeRadius); x++) owner[y * grid.cols + x] = seat
    }
    return { head, direction, pendingDirection: null, trail: [], leftFrom: null, alive: true, crashCell: null }
  }
  const players = { 1: player(1), 2: player(2) }
  return { phase: 'onboarding', grid, owner, ground: countGround(owner), players, outcome: null, tick: 0, events: NO_EVENTS() }
}

export function startTurf(state: TurfState): TurfState {
  return state.phase === 'onboarding' ? { ...state, phase: 'playing' } : state
}

// Queues a turn for the next tick. A rider can't turn straight back on itself, the same as in
// LightCycles, and the check is against the way it's actually moving, so two quick turns between ticks
// can't add up to a reversal.
export function applyTurfTurn(state: TurfState, seat: TurfSeat, direction: Direction): TurfState {
  if (state.phase !== 'playing') return state
  const p = state.players[seat]
  if (!p.alive || direction === p.direction || isOppositeDirection(direction, p.direction) || p.pendingDirection === direction) return state
  return { ...state, players: { ...state.players, [seat]: { ...p, pendingDirection: direction } } }
}

// Where 'home' puts a crashed rider back: the cell they left their ground from if it's still theirs,
// otherwise the nearest cell they own. Null when they own nothing.
function homeCell(owner: Uint8Array, grid: GridSize, seat: TurfSeat, p: TurfPlayer): GridCell | null {
  if (p.leftFrom && owner[cellIndex(p.leftFrom, grid)] === seat) return p.leftFrom
  let best: GridCell | null = null
  let bestDistance = Infinity
  for (let i = 0; i < owner.length; i++) {
    if (owner[i] !== seat) continue
    const cell = { x: i % grid.cols, y: Math.floor(i / grid.cols) }
    const distance = Math.abs(cell.x - p.head.x) + Math.abs(cell.y - p.head.y)
    if (distance < bestDistance) {
      best = cell
      bestDistance = distance
    }
  }
  return best
}

// Back home, the rider keeps its heading if the next cell that way is still its own ground, so it
// doesn't ride straight back out (or into a wall); otherwise it takes the first heading that stays
// home, or any heading that stays on the board.
function homeDirection(owner: Uint8Array, grid: GridSize, seat: TurfSeat, cell: GridCell, current: Direction): Direction {
  const order: Direction[] = [current, 'up', 'right', 'down', 'left']
  const staysHome = order.find((d) => {
    const next = stepCell(cell, d)
    return isInBounds(next, grid) && owner[cellIndex(next, grid)] === seat
  })
  return staysHome ?? order.find((d) => isInBounds(stepCell(cell, d), grid)) ?? current
}

// One step for both riders at once.
//
// - A rider who leaves the board crashes.
// - Two heads meeting, in one cell or by swapping cells: whoever's ground the meeting cell is wins, and
//   on nobody's ground both crash.
// - Riding into the other rider's trail crashes them, not you. Riding into your own crashes you, when
//   `ownTrailDeadly`.
// - Getting back to your ground claims your trail and everything it encloses (see capture.ts). When
//   both riders get home on the same tick, the bigger claim goes first, so where the two overlap the
//   tighter loop keeps the cells (or neither, when they're the same size).
// - A rider whose ground is all taken is suffocated and loses.
//
// With the 'out' crash rule a crash ends the round; with 'home' it sends the rider back to its ground
// without its trail and the round goes on.
export function tickTurf(state: TurfState, rules: TurfRules = DEFAULT_TURF_RULES): TurfState {
  if (state.phase !== 'playing') return state
  const { grid } = state
  const tick = state.tick + 1
  const players = state.players
  const directions: Record<TurfSeat, Direction> = { 1: players[1].pendingDirection ?? players[1].direction, 2: players[2].pendingDirection ?? players[2].direction }
  const next: Record<TurfSeat, GridCell> = { 1: stepCell(players[1].head, directions[1]), 2: stepCell(players[2].head, directions[2]) }
  const onBoard: Record<TurfSeat, boolean> = { 1: isInBounds(next[1], grid), 2: isInBounds(next[2], grid) }
  const ownerAt = (cell: GridCell) => state.owner[cellIndex(cell, grid)]

  const crashed = new Set<TurfSeat>()
  for (const seat of SEATS) if (!onBoard[seat]) crashed.add(seat)

  if (onBoard[1] && onBoard[2]) {
    const sameCell = next[1].x === next[2].x && next[1].y === next[2].y
    const swapped = next[1].x === players[2].head.x && next[1].y === players[2].head.y && next[2].x === players[1].head.x && next[2].y === players[1].head.y
    if (sameCell) {
      const holder = ownerAt(next[1])
      if (holder !== 1) crashed.add(1)
      if (holder !== 2) crashed.add(2)
    } else if (swapped) {
      const home1 = ownerAt(next[1]) === 1
      const home2 = ownerAt(next[2]) === 2
      if (home1 === home2) {
        if (!home1) {
          crashed.add(1)
          crashed.add(2)
        }
      } else crashed.add(home1 ? 2 : 1)
    }
  }

  const trailHolder = new Map<number, TurfSeat>()
  for (const seat of SEATS) for (const cell of players[seat].trail) trailHolder.set(cellIndex(cell, grid), seat)
  for (const seat of SEATS) {
    if (!onBoard[seat]) continue
    const holder = trailHolder.get(cellIndex(next[seat], grid))
    if (holder === other(seat)) crashed.add(holder)
    else if (holder === seat && rules.ownTrailDeadly) crashed.add(seat)
  }

  if (crashed.size > 0 && rules.crash === 'out') {
    const outcome: TurfOutcome = crashed.size === 2 ? { type: 'draw', reason: 'crash' } : { type: 'win', winner: crashed.has(1) ? 2 : 1, reason: 'crash' }
    const end = (seat: TurfSeat): TurfPlayer => (crashed.has(seat) ? { ...players[seat], alive: false, pendingDirection: null, crashCell: next[seat] } : { ...players[seat], pendingDirection: null })
    return { ...state, phase: 'roundOver', outcome, tick, players: { 1: end(1), 2: end(2) }, events: { ...NO_EVENTS(), crashed: [...crashed] } }
  }

  // Everyone who didn't crash moves; whoever got back to their ground has a claim to make.
  const moved = { ...players }
  const claims: { seat: TurfSeat; cells: number[] }[] = []
  for (const seat of SEATS) {
    if (crashed.has(seat)) continue
    const p = players[seat]
    const cell = next[seat]
    if (ownerAt(cell) === seat) {
      if (p.trail.length > 0) claims.push({ seat, cells: claimedCells(state.owner, grid, seat, p.trail) })
      moved[seat] = { ...p, head: cell, direction: directions[seat], pendingDirection: null, trail: [], leftFrom: null, crashCell: null }
    } else {
      moved[seat] = { ...p, head: cell, direction: directions[seat], pendingDirection: null, trail: [...p.trail, cell], leftFrom: p.trail.length === 0 ? p.head : p.leftFrom, crashCell: null }
    }
  }

  let owner = state.owner
  const ground = { ...state.ground }
  const captured = { 1: 0, 2: 0 }
  if (claims.length > 0) {
    owner = owner.slice()
    claims.sort((a, b) => b.cells.length - a.cells.length)
    // Two claims of the same size that overlap leave the shared cells as they were.
    let tied: Set<number> | null = null
    if (claims.length === 2 && claims[0].cells.length === claims[1].cells.length) {
      const second = new Set(claims[1].cells)
      tied = new Set(claims[0].cells.filter((i) => second.has(i)))
    }
    for (const { seat, cells } of claims) {
      for (const i of cells) {
        if (tied?.has(i)) continue
        const was = owner[i] as 0 | TurfSeat
        if (was === seat) continue
        if (was !== 0) ground[was]--
        owner[i] = seat
        ground[seat]++
        captured[seat]++
      }
    }
  }

  // Back home after a crash, under the 'home' rule.
  const sentHome: TurfSeat[] = []
  for (const seat of crashed) {
    const p = players[seat]
    const cell = homeCell(owner, grid, seat, p)
    if (!cell) continue
    // crashCell keeps where they crashed for this one tick, so the board can mark it.
    moved[seat] = { ...p, head: cell, direction: homeDirection(owner, grid, seat, cell, p.direction), pendingDirection: null, trail: [], leftFrom: null, crashCell: next[seat] }
    sentHome.push(seat)
  }

  const events = { captured, crashed: [...crashed], sentHome }
  const suffocated = SEATS.filter((seat) => ground[seat] === 0)
  if (suffocated.length > 0) {
    const outcome: TurfOutcome = suffocated.length === 2 ? { type: 'draw', reason: 'suffocation' } : { type: 'win', winner: other(suffocated[0]), reason: 'suffocation' }
    const end = (seat: TurfSeat): TurfPlayer => (suffocated.includes(seat) ? { ...moved[seat], alive: false } : moved[seat])
    return { ...state, phase: 'roundOver', outcome, tick, owner, ground, players: { 1: end(1), 2: end(2) }, events }
  }

  return { ...state, tick, owner, ground, players: moved, events }
}

// Ends a round on the clock: the seat with more ground wins, the same amount is a draw.
export function finishTurfOnTime(state: TurfState): TurfState {
  if (state.phase !== 'playing') return state
  const { 1: a, 2: b } = state.ground
  const outcome: TurfOutcome = a === b ? { type: 'draw', reason: 'time' } : { type: 'win', winner: a > b ? 1 : 2, reason: 'time' }
  return { ...state, phase: 'roundOver', outcome, events: NO_EVENTS() }
}
