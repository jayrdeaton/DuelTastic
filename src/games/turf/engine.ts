import { type Direction, type GridCell, type GridSize, isInBounds, isOppositeDirection, stepCell } from '@tastic/grid'

// Shared with LightCycles: each rider starts at the middle of their own half, facing the other. Moves
// to shared/ when this repo takes the pack layout.
import { startingStateFor } from '@/shared/match/grid'
import { activateEffect, cellsOnTick, expireEffects, isShielded, newPickup, NO_EFFECTS, pickupCell, takePickup } from '@/shared/powerups'

import { claimedCells } from './capture'
import { TURF_EFFECT_TICKS, TURF_POWERUP_EFFECTS, TURF_SOD_RADIUS } from './constants'
import { DEFAULT_TURF_RULES, type TurfEvents, type TurfLayout, type TurfOutcome, type TurfPlayer, type TurfRules, type TurfSeat, type TurfState } from './types'

const SEATS: readonly TurfSeat[] = [1, 2]

// Half the side of each rider's starting square, in cells: 3 gives a 7 x 7 square.
export const TURF_HOME_RADIUS = 3

const NO_EVENTS = (): TurfEvents => ({ captured: { 1: 0, 2: 0 }, crashed: [], sentHome: [], collected: [] })

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
    return { head, direction, pendingDirection: null, trail: [], leftFrom: null, alive: true, crashCell: null, held: null, effects: NO_EFFECTS() }
  }
  const players = { 1: player(1), 2: player(2) }
  return { phase: 'onboarding', grid, owner, ground: countGround(owner), players, pickups: [], outcome: null, tick: 0, events: NO_EVENTS() }
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

const sameCell = (a: GridCell, b: GridCell) => a.x === b.x && a.y === b.y

// Adds claims to the board, the biggest first, so where two overlap the tighter loop keeps the cells.
// Two claims of the same size that overlap leave the shared cells as they were.
function applyClaims(owner: Uint8Array, ground: Record<TurfSeat, number>, captured: Record<TurfSeat, number>, claims: { seat: TurfSeat; cells: number[] }[]) {
  claims.sort((a, b) => b.cells.length - a.cells.length)
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

// One tick for both riders at once, in steps: a rider covers one cell a tick, two under Dash or Gust
// and none while frozen, and each cell is checked in turn, so a fast rider can't skip over a trail or
// a pickup.
//
// - A rider who leaves the board crashes.
// - Two heads meeting, in one cell or by swapping cells: whoever's ground the meeting cell is wins, and
//   on nobody's ground both crash. Riding into a rider who's standing still (frozen, or done with its
//   steps) counts the same, unless it's out on a trail: its head is the end of its trail, so riding
//   into it cuts it.
// - Riding into the other rider's trail crashes them, not you. Riding into your own crashes you, when
//   `ownTrailDeadly`.
// - Fence: nothing but the board's edge crashes its rider.
// - Getting back to your ground claims your trail and everything it encloses (see capture.ts). When
//   both riders get home in the same step, the bigger claim goes first, so where the two overlap the
//   tighter loop keeps the cells (or neither, when they're the same size).
// - Passing within a cell of a pickup picks it up (swapping whatever was held).
// - A rider whose ground is all taken is suffocated and loses.
//
// With the 'out' crash rule a crash ends the round; with 'home' it sends the rider back to its ground
// without its trail, done for the tick, and the round goes on. With powerups on, a new pickup turns
// up once the last one's been taken.
export function tickTurf(state: TurfState, rules: TurfRules = DEFAULT_TURF_RULES, random: () => number = Math.random): TurfState {
  if (state.phase !== 'playing') return state
  const { grid } = state
  const tick = state.tick + 1
  const steps: Record<TurfSeat, number> = { 1: cellsOnTick(state.players[1].effects, tick), 2: cellsOnTick(state.players[2].effects, tick) }
  // Fence: nothing but the edge crashes its rider.
  const fenced: Record<TurfSeat, boolean> = { 1: isShielded(state.players[1].effects, tick), 2: isShielded(state.players[2].effects, tick) }
  // One turn a tick: a rider covers its steps in the direction it starts the tick with. A frozen
  // rider keeps its queued turn for when it thaws.
  const directions: Record<TurfSeat, Direction> = { 1: state.players[1].pendingDirection ?? state.players[1].direction, 2: state.players[2].pendingDirection ?? state.players[2].direction }
  const players: Record<TurfSeat, TurfPlayer> = { 1: { ...state.players[1], crashCell: null }, 2: { ...state.players[2], crashCell: null } }

  // Copied on the first change, so a tick that claims nothing keeps the same board (and the screen
  // doesn't redraw the ground).
  let owner = state.owner
  const writableOwner = () => {
    if (owner === state.owner) owner = owner.slice()
    return owner
  }
  const ownerAt = (cell: GridCell) => owner[cellIndex(cell, grid)]
  const ground = { ...state.ground }
  let pickups = state.pickups
  const events = NO_EVENTS()

  // Each cell's trails, one bit per seat (trails can overlap where a Fence let one rider through).
  const trails = new Uint8Array(grid.cols * grid.rows)
  for (const seat of SEATS) for (const cell of players[seat].trail) trails[cellIndex(cell, grid)] |= seat
  const clearTrail = (seat: TurfSeat) => {
    for (const cell of players[seat].trail) trails[cellIndex(cell, grid)] &= ~seat
  }

  // Sent home this tick: done moving until the next one.
  const done = new Set<TurfSeat>()
  const end = (outcome: TurfOutcome, out: Set<TurfSeat> | TurfSeat[], crashCells: Partial<Record<TurfSeat, GridCell>> = {}): TurfState => {
    const lost = new Set(out)
    const finish = (seat: TurfSeat): TurfPlayer => (lost.has(seat) ? { ...players[seat], alive: false, pendingDirection: null, crashCell: crashCells[seat] ?? players[seat].crashCell } : { ...players[seat], pendingDirection: null })
    return { ...state, phase: 'roundOver', outcome, tick, owner, ground, pickups, players: { 1: finish(1), 2: finish(2) }, events }
  }

  for (let step = 0; step < Math.max(steps[1], steps[2]); step++) {
    const movers = SEATS.filter((seat) => !done.has(seat) && step < steps[seat])
    if (movers.length === 0) break
    const next: Partial<Record<TurfSeat, GridCell>> = {}
    for (const seat of movers) next[seat] = stepCell(players[seat].head, directions[seat])
    const onBoard = (seat: TurfSeat) => next[seat] !== undefined && isInBounds(next[seat], grid)

    const crashed = new Set<TurfSeat>()
    const crash = (seat: TurfSeat) => {
      if (!fenced[seat]) crashed.add(seat)
    }
    // The edge is the one thing a Fence doesn't stop.
    for (const seat of movers) if (!onBoard(seat)) crashed.add(seat)

    if (movers.length === 2 && onBoard(1) && onBoard(2)) {
      const a = next[1]!
      const b = next[2]!
      if (sameCell(a, b)) {
        const holder = ownerAt(a)
        if (holder !== 1) crash(1)
        if (holder !== 2) crash(2)
      } else if (sameCell(a, players[2].head) && sameCell(b, players[1].head)) {
        const home1 = ownerAt(a) === 1
        const home2 = ownerAt(b) === 2
        if (home1 === home2) {
          if (!home1) {
            crash(1)
            crash(2)
          }
        } else crash(home1 ? 2 : 1)
      }
    } else {
      for (const seat of movers) {
        const them = other(seat)
        if (!onBoard(seat) || movers.includes(them) || players[them].trail.length > 0) continue
        if (sameCell(next[seat]!, players[them].head)) {
          const holder = ownerAt(next[seat]!)
          if (holder !== seat) crash(seat)
          if (holder !== them) crash(them)
        }
      }
    }

    for (const seat of movers) {
      if (!onBoard(seat)) continue
      const bits = trails[cellIndex(next[seat]!, grid)]
      if (bits & other(seat)) crash(other(seat))
      if (bits & seat && rules.ownTrailDeadly) crash(seat)
    }

    // A rider cut while standing still crashes where it stands.
    const crashCell = (seat: TurfSeat) => next[seat] ?? players[seat].head
    if (crashed.size > 0 && rules.crash === 'out') {
      events.crashed = [...crashed]
      const outcome: TurfOutcome = crashed.size === 2 ? { type: 'draw', reason: 'crash' } : { type: 'win', winner: crashed.has(1) ? 2 : 1, reason: 'crash' }
      return end(outcome, crashed, { 1: crashCell(1), 2: crashCell(2) })
    }

    // Everyone who didn't crash moves; whoever got back to their ground has a claim to make.
    const claims: { seat: TurfSeat; cells: number[] }[] = []
    for (const seat of movers) {
      if (crashed.has(seat)) continue
      const p = players[seat]
      const cell = next[seat]!
      if (ownerAt(cell) === seat) {
        if (p.trail.length > 0) {
          claims.push({ seat, cells: claimedCells(owner, grid, seat, p.trail) })
          clearTrail(seat)
        }
        players[seat] = { ...p, head: cell, direction: directions[seat], pendingDirection: null, trail: [], leftFrom: null }
      } else {
        trails[cellIndex(cell, grid)] |= seat
        players[seat] = { ...p, head: cell, direction: directions[seat], pendingDirection: null, trail: [...p.trail, cell], leftFrom: p.trail.length === 0 ? p.head : p.leftFrom }
      }
    }
    if (claims.length > 0) applyClaims(writableOwner(), ground, events.captured, claims)

    // Back home after a crash, under the 'home' rule. crashCell keeps where they crashed for the rest
    // of the tick, so the board can mark it.
    for (const seat of crashed) {
      const p = players[seat]
      const cell = homeCell(owner, grid, seat, p)
      events.crashed.push(seat)
      done.add(seat)
      if (!cell) continue
      clearTrail(seat)
      players[seat] = { ...p, head: cell, direction: homeDirection(owner, grid, seat, cell, p.direction), pendingDirection: null, trail: [], leftFrom: null, crashCell: crashCell(seat) }
      events.sentHome.push(seat)
    }

    for (const seat of movers) {
      if (crashed.has(seat)) continue
      const took = takePickup(pickups, players[seat].head)
      if (!took) continue
      players[seat] = { ...players[seat], held: took.taken.type }
      pickups = took.rest
      events.collected.push(seat)
    }

    const suffocated = SEATS.filter((seat) => ground[seat] === 0)
    if (suffocated.length > 0) return end(suffocated.length === 2 ? { type: 'draw', reason: 'suffocation' } : { type: 'win', winner: other(suffocated[0]), reason: 'suffocation' }, suffocated)
  }

  if (rules.powerups.length > 0 && pickups.length === 0) {
    // Never next to a trail, and on nobody's ground when it can, so going for it means leaving home.
    const cell = pickupCell({ grid, heads: [players[1].head, players[2].head], blocked: (i) => trails[i] !== 0, preferred: (i) => owner[i] === 0 }, random)
    if (cell) pickups = [newPickup(tick, cell, rules.powerups, random)]
  }

  for (const seat of SEATS) players[seat] = { ...players[seat], effects: expireEffects(players[seat].effects, tick) }

  return { ...state, tick, owner, ground, pickups, players, events }
}

// Sod: the square around the rider's head becomes theirs. Out on a trail, that brings them home on
// the spot, claiming the trail and what it encloses as if they'd ridden back.
function plantSod(state: TurfState, seat: TurfSeat): TurfState {
  const { grid } = state
  const p = state.players[seat]
  const owner = state.owner.slice()
  const ground = { ...state.ground }
  const captured = { 1: 0, 2: 0 }
  const take = (i: number) => {
    const was = owner[i] as 0 | TurfSeat
    if (was === seat) return
    if (was !== 0) ground[was]--
    owner[i] = seat
    ground[seat]++
    captured[seat]++
  }
  for (let y = Math.max(0, p.head.y - TURF_SOD_RADIUS); y <= Math.min(grid.rows - 1, p.head.y + TURF_SOD_RADIUS); y++) {
    for (let x = Math.max(0, p.head.x - TURF_SOD_RADIUS); x <= Math.min(grid.cols - 1, p.head.x + TURF_SOD_RADIUS); x++) take(y * grid.cols + x)
  }
  let player: TurfPlayer = { ...p, held: null }
  if (p.trail.length > 0) {
    for (const i of claimedCells(owner, grid, seat, p.trail)) take(i)
    player = { ...player, trail: [], leftFrom: null }
  }
  const them = other(seat)
  const events = { ...NO_EVENTS(), captured }
  if (ground[them] === 0) {
    const outcome: TurfOutcome = { type: 'win', winner: seat, reason: 'suffocation' }
    return { ...state, phase: 'roundOver', outcome, owner, ground, players: { ...state.players, [seat]: player, [them]: { ...state.players[them], alive: false, pendingDirection: null } }, events }
  }
  return { ...state, owner, ground, players: { ...state.players, [seat]: player }, events }
}

// Uses the rider's held powerup, for a tap, their powerup key or the CPU. Dash, Fence and Sod are for
// the rider; Frost, Tangle and Gust land on the other one. A speed effect replaces whatever speed
// effect its target already had.
export function applyTurfActivation(state: TurfState, seat: TurfSeat): TurfState {
  if (state.phase !== 'playing') return state
  const p = state.players[seat]
  if (!p.alive || !p.held) return state
  const type = p.held
  if (type === 'sod') return plantSod(state, seat)
  return { ...state, players: activateEffect(state.players, seat, TURF_POWERUP_EFFECTS[type], state.tick + TURF_EFFECT_TICKS[type]) }
}

// Ends a round on the clock: the seat with more ground wins, the same amount is a draw.
export function finishTurfOnTime(state: TurfState): TurfState {
  if (state.phase !== 'playing') return state
  const { 1: a, 2: b } = state.ground
  const outcome: TurfOutcome = a === b ? { type: 'draw', reason: 'time' } : { type: 'win', winner: a > b ? 1 : 2, reason: 'time' }
  return { ...state, phase: 'roundOver', outcome, events: NO_EVENTS() }
}
