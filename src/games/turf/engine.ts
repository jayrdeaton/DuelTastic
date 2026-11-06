import { cellKey, type Direction, type GridCell, type GridSize, isInBounds, isOppositeDirection, stepCell } from '@tastic/grid'

// Shared with LightCycles: each rider starts at the middle of their own half, facing the other. Moves
// to shared/ when this repo takes the pack layout.
import { buildArenaObstacles, buildArenaPortals } from '@/shared/match/arenas'
import { startingStateFor } from '@/shared/match/grid'
import { activateEffect, cellsOnTick, expireEffects, isShielded, newPickup, NO_EFFECTS, pickupCell, takePickup } from '@/shared/powerups'

import { claimedCells } from './capture'
import { TURF_EFFECT_TICKS, TURF_FLIGHT_TICKS, TURF_POWERUP_EFFECTS, TURF_SOD_RADIUS } from './constants'
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
  arena?: TurfRules['arena']
  homeRadius?: number
  // Where each rider starts and which way it's heading, instead of the layout's default. Its starting
  // square is centered on that cell either way.
  starts?: Partial<Record<TurfSeat, { head: GridCell; direction: Direction }>>
}

export function createTurfState({ grid, layout, p1OnRight = false, arena = 'open', homeRadius = TURF_HOME_RADIUS, starts = {} }: CreateTurfStateParams): TurfState {
  const obstacles = buildArenaObstacles(arena, grid, layout, p1OnRight)
  const portals = buildArenaPortals(arena, grid, layout, p1OnRight)
  const blocked = new Uint8Array(grid.cols * grid.rows)
  for (const cell of obstacles) blocked[cellIndex(cell, grid)] = 1
  const owner = new Uint8Array(grid.cols * grid.rows)
  const player = (seat: TurfSeat): TurfPlayer => {
    const { head, direction } = starts[seat] ?? startingStateFor(seat, grid, layout, p1OnRight)
    for (let y = Math.max(0, head.y - homeRadius); y <= Math.min(grid.rows - 1, head.y + homeRadius); y++) {
      for (let x = Math.max(0, head.x - homeRadius); x <= Math.min(grid.cols - 1, head.x + homeRadius); x++) {
        const i = y * grid.cols + x
        if (!blocked[i]) owner[i] = seat
      }
    }
    return { head, direction, pendingDirection: null, trail: [], leftFrom: null, alive: true, crashCell: null, held: null, effects: NO_EFFECTS(), flight: null }
  }
  const players = { 1: player(1), 2: player(2) }
  return { phase: 'onboarding', grid, obstacles, portals, blocked, owner, ground: countGround(owner), players, pickups: [], outcome: null, tick: 0, events: NO_EVENTS() }
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

// Whether a rider flying home stands still on tick `tick` (see TurfFlight).
export const isFlying = (p: TurfPlayer, tick: number) => p.flight !== null && tick <= p.flight.landsAtTick

// Ticks a rider still has to stand still after tick `tick` before it lands home; 0 when it isn't flying.
export const flightTicksLeft = (p: TurfPlayer, tick: number) => (p.flight ? Math.max(0, p.flight.landsAtTick - tick) : 0)

const SIDES: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
]

// Where 'home' puts a crashed rider: the middle of their biggest patch of ground (cells joined side to
// side), so they never land on a sliver the other rider has nearly closed off. The middle is a cell of
// the patch, not its centroid (an L or a ring has its centroid outside it): the cell furthest in from
// the patch's edge (the board's edge, a pillar or anyone else's cell), ties going to the one nearest
// the centroid, then the first row by row. Never a cell in `avoid` (the other rider's head and trail)
// while the patch has another. Null when they own nothing.
export function homeCell(owner: Uint8Array, grid: GridSize, seat: TurfSeat, avoid: ReadonlySet<number> = new Set()): GridCell | null {
  const { cols, rows } = grid
  const onBoard = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows

  // Each of their patches, filled out from its first cell row by row; the biggest kept (the first of
  // two the same size).
  const patchOf = new Int32Array(owner.length).fill(-1)
  let biggest: number[] = []
  for (let start = 0; start < owner.length; start++) {
    if (owner[start] !== seat || patchOf[start] >= 0) continue
    const patch = [start]
    patchOf[start] = start
    for (let k = 0; k < patch.length; k++) {
      const x = patch[k] % cols
      const y = (patch[k] - x) / cols
      for (const [dx, dy] of SIDES) {
        if (!onBoard(x + dx, y + dy)) continue
        const j = (y + dy) * cols + x + dx
        if (owner[j] !== seat || patchOf[j] >= 0) continue
        patchOf[j] = start
        patch.push(j)
      }
    }
    if (patch.length > biggest.length) biggest = patch
  }
  if (biggest.length === 0) return null
  const id = biggest[0]
  const inPatch = (x: number, y: number) => onBoard(x, y) && patchOf[y * cols + x] === id

  // Steps in from the patch's edge: 0 on a cell beside anything that isn't the patch, counting in.
  const depth = new Int32Array(owner.length).fill(-1)
  const queue: number[] = []
  for (const i of biggest) {
    const x = i % cols
    const y = (i - x) / cols
    if (SIDES.some(([dx, dy]) => !inPatch(x + dx, y + dy))) {
      depth[i] = 0
      queue.push(i)
    }
  }
  for (let k = 0; k < queue.length; k++) {
    const x = queue[k] % cols
    const y = (queue[k] - x) / cols
    for (const [dx, dy] of SIDES) {
      if (!inPatch(x + dx, y + dy)) continue
      const j = (y + dy) * cols + x + dx
      if (depth[j] >= 0) continue
      depth[j] = depth[queue[k]] + 1
      queue.push(j)
    }
  }

  let cx = 0
  let cy = 0
  for (const i of biggest) {
    cx += i % cols
    cy += Math.floor(i / cols)
  }
  cx /= biggest.length
  cy /= biggest.length
  const open = biggest.filter((i) => !avoid.has(i))
  let best = -1
  let bestDistance = Infinity
  for (const i of open.length > 0 ? open : biggest) {
    const distance = ((i % cols) - cx) ** 2 + (Math.floor(i / cols) - cy) ** 2
    if (best < 0 || depth[i] > depth[best] || (depth[i] === depth[best] && (distance < bestDistance || (distance === bestDistance && i < best)))) {
      best = i
      bestDistance = distance
    }
  }
  return { x: best % cols, y: Math.floor(best / cols) }
}

// Back home, the rider heads the way with the most of its own ground straight ahead, so it has the
// longest to steer before it rides out, then the way with the most board ahead (away from the edge it
// may have just hit), then the way it was heading.
function homeDirection(owner: Uint8Array, grid: GridSize, seat: TurfSeat, cell: GridCell, current: Direction): Direction {
  const ahead = (d: Direction) => {
    let own = 0
    let room = 0
    let mine = true
    for (let c = stepCell(cell, d); isInBounds(c, grid); c = stepCell(c, d)) {
      room++
      if (mine && owner[cellIndex(c, grid)] === seat) own++
      else mine = false
    }
    return { own, room }
  }
  const order: Direction[] = [current, ...(['up', 'right', 'down', 'left'] as const).filter((d) => d !== current)]
  let best = current
  let bestAhead = ahead(current)
  for (const d of order) {
    const a = ahead(d)
    if (a.own > bestAhead.own || (a.own === bestAhead.own && a.room > bestAhead.room)) {
      best = d
      bestAhead = a
    }
  }
  return best
}

const sameCell = (a: GridCell, b: GridCell) => a.x === b.x && a.y === b.y

function buildPortalLookup(portals: { a: GridCell; b: GridCell }[]): Map<string, GridCell> {
  const lookup = new Map<string, GridCell>()
  for (const portal of portals) {
    lookup.set(cellKey(portal.a), portal.b)
    lookup.set(cellKey(portal.b), portal.a)
  }
  return lookup
}

// Adds claims to the board, the biggest first, so where two overlap the tighter loop keeps the cells.
// Two claims of the same size that overlap leave the shared cells as they were.
function applyClaims(owner: Uint8Array, blocked: Uint8Array, ground: Record<TurfSeat, number>, captured: Record<TurfSeat, number>, claims: { seat: TurfSeat; cells: number[] }[]) {
  claims.sort((a, b) => b.cells.length - a.cells.length)
  let tied: Set<number> | null = null
  if (claims.length === 2 && claims[0].cells.length === claims[1].cells.length) {
    const second = new Set(claims[1].cells)
    tied = new Set(claims[0].cells.filter((i) => second.has(i)))
  }
  for (const { seat, cells } of claims) {
    for (const i of cells) {
      if (blocked[i] === 1) continue
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
//   on nobody's ground both crash. Riding into a rider who's standing still (frozen, flying home, or
//   done with its steps) counts the same, unless it's out on a trail: its head is the end of its
//   trail, so riding into it cuts it.
// - Riding into the other rider's trail crashes them, not you. Riding into your own crashes you, when
//   `ownTrailDeadly`.
// - Fence: nothing but the board's edge crashes its rider.
// - Getting back to your ground claims your trail and everything it encloses (see capture.ts). When
//   both riders get home in the same step, the bigger claim goes first, so where the two overlap the
//   tighter loop keeps the cells (or neither, when they're the same size).
// - Passing within a cell of a pickup picks it up (swapping whatever was held).
// - A rider whose ground is all taken is suffocated and loses.
//
// With the 'out' crash rule a crash ends the round; with 'home' it sends the rider without its trail
// to the middle of its biggest patch of ground (homeCell), where it stands still while it flies there
// (TURF_FLIGHT_TICKS), and the round goes on. With powerups on, a new pickup turns up once the last
// one's been taken.
export function tickTurf(state: TurfState, rules: TurfRules = DEFAULT_TURF_RULES, random: () => number = Math.random): TurfState {
  if (state.phase !== 'playing') return state
  const { grid } = state
  const portalLookup = buildPortalLookup(state.portals)
  const tick = state.tick + 1
  const stepsOf = (p: TurfPlayer) => (isFlying(p, tick) ? 0 : cellsOnTick(p.effects, tick))
  const steps: Record<TurfSeat, number> = { 1: stepsOf(state.players[1]), 2: stepsOf(state.players[2]) }
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
    for (const seat of movers) {
      const stepped = stepCell(players[seat].head, directions[seat])
      next[seat] = portalLookup.get(cellKey(stepped)) ?? stepped
    }
    const onBoard = (seat: TurfSeat) => next[seat] !== undefined && isInBounds(next[seat], grid)

    const crashed = new Set<TurfSeat>()
    const crash = (seat: TurfSeat) => {
      if (!fenced[seat]) crashed.add(seat)
    }
    // The edge is the one thing a Fence doesn't stop.
    for (const seat of movers) if (!onBoard(seat)) crashed.add(seat)
    for (const seat of movers) {
      if (!onBoard(seat)) continue
      const cell = next[seat]!
      if (state.blocked[cellIndex(cell, grid)] === 1) crash(seat)
    }

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
    if (claims.length > 0) applyClaims(writableOwner(), state.blocked, ground, events.captured, claims)

    // Back home after a crash, under the 'home' rule, flying there. crashCell keeps where they crashed
    // for the rest of the tick.
    for (const seat of crashed) {
      const p = players[seat]
      const them = players[other(seat)]
      const avoid = new Set([them.head, ...them.trail].map((c) => cellIndex(c, grid)))
      const cell = homeCell(owner, grid, seat, avoid)
      events.crashed.push(seat)
      done.add(seat)
      if (!cell) continue
      clearTrail(seat)
      const from = crashCell(seat)
      players[seat] = { ...p, head: cell, direction: homeDirection(owner, grid, seat, cell, p.direction), pendingDirection: null, trail: [], leftFrom: null, crashCell: from, flight: { from, startTick: tick, landsAtTick: tick + TURF_FLIGHT_TICKS } }
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
    const cell = pickupCell({ grid, heads: [players[1].head, players[2].head], blocked: (i) => trails[i] !== 0 || state.blocked[i] === 1, preferred: (i) => owner[i] === 0 && state.blocked[i] === 0 }, random)
    if (cell) pickups = [newPickup(tick, cell, rules.powerups, random)]
  }

  for (const seat of SEATS) {
    const { effects, flight } = players[seat]
    players[seat] = { ...players[seat], effects: expireEffects(effects, tick), flight: flight && tick >= flight.landsAtTick ? null : flight }
  }

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
    if (state.blocked[i] === 1) return
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
