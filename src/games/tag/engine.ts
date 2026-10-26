import { cellKey, type Direction, type GridCell, type GridSize, isInBounds, stepCell } from '@tastic/grid'

import { buildArenaObstacles, buildArenaPortals, buildArenaTunnels } from '@/games/lightcycles/utils/arenas'
// Shared with LightCycles and Turf: each rider starts at the middle of its own half, facing the
// other. Moves to shared/ when this repo takes the pack layout.
import { startingStateFor } from '@/shared/match/grid'
import { activateEffect, expireEffects, isFrozen, isShielded, newPickup, NO_EFFECTS, pickupCell, speedMultiplier, takePickup } from '@/shared/powerups'

import { TAG_EFFECT_TICKS, TAG_FREEZE_TICKS, TAG_IT_SPEED, TAG_PILLAR_MARGIN, TAG_PILLAR_SIZE, TAG_PILLAR_SPACING, TAG_POWERUP_EFFECTS, TAG_TAIL_CELLS } from './constants'
import type { TagArena, TagEvents, TagLayout, TagOutcome, TagPillar, TagPlayer, TagPowerup, TagRule, TagSeat, TagState, TagTunnel } from './types'

const SEATS: readonly TagSeat[] = [1, 2]

const NO_EVENTS = (): TagEvents => ({ tagged: null, blocked: [], collected: [] })

export const otherSeat = (seat: TagSeat): TagSeat => (seat === 1 ? 2 : 1)

export function cellIndex(cell: GridCell, grid: GridSize): number {
  return cell.y * grid.cols + cell.x
}

// Whether a rider can ride into this cell: on the board and not blocked by arena geometry.
export function isOpen(state: Pick<TagState, 'grid' | 'blocked'>, cell: GridCell): boolean {
  return isInBounds(cell, state.grid) && !state.blocked[cellIndex(cell, state.grid)]
}

// Two riders touch when they're within a cell of each other, diagonally included: their heads are
// drawn wider than a cell, so that's when they visibly meet.
export function touching(a: GridCell, b: GridCell): boolean {
  return Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1
}

// How much of It's freeze is left before the next tick, 1 just tagged to 0 free to move.
export function freezeLeft(state: TagState): number {
  return Math.max(0, state.frozenThrough - state.tick) / TAG_FREEZE_TICKS
}

// Where pillars go along one side of the board: evenly spaced, centered, and mirrored end to end so
// each rider's half is the same. On a side whose length can't center a pillar exactly, the middle
// one is a cell wider.
function lattice(length: number): { at: number; size: number }[] {
  const count = Math.floor((length - 2 * TAG_PILLAR_MARGIN - TAG_PILLAR_SIZE) / TAG_PILLAR_SPACING) + 1
  if (count < 1) return []
  const start = Math.floor((length - ((count - 1) * TAG_PILLAR_SPACING + TAG_PILLAR_SIZE)) / 2)
  const out: { at: number; size: number }[] = []
  for (let i = 0; i < Math.floor(count / 2); i++) out.push({ at: start + i * TAG_PILLAR_SPACING, size: TAG_PILLAR_SIZE })
  if (count % 2 === 1) {
    const size = (length - TAG_PILLAR_SIZE) % 2 === 0 ? TAG_PILLAR_SIZE : TAG_PILLAR_SIZE + 1
    out.push({ at: (length - size) / 2, size })
  }
  for (let i = Math.floor(count / 2) - 1; i >= 0; i--) out.push({ at: length - TAG_PILLAR_SIZE - out[i].at, size: TAG_PILLAR_SIZE })
  return out
}

// Pillars on a lattice centered on the board (see lattice), leaving out any that would sit on or
// right next to a rider's starting cell. Each stands alone with open cells all round, so every open
// cell can reach every other.
export function pillarsFor(grid: GridSize, avoid: readonly GridCell[]): TagPillar[] {
  const pillars: TagPillar[] = []
  for (const row of lattice(grid.rows)) {
    for (const col of lattice(grid.cols)) {
      const p = { x: col.at, y: row.at, width: col.size, height: row.size }
      if (avoid.every((c) => c.x < p.x - 1 || c.x > p.x + p.width || c.y < p.y - 1 || c.y > p.y + p.height)) pillars.push(p)
    }
  }
  return pillars
}

export interface CreateTagStateParams {
  grid: GridSize
  layout: TagLayout
  p1OnRight?: boolean
  arena?: TagArena
  // Who starts the round as It.
  it?: TagSeat
  // Where each rider starts and which way it's heading, instead of the layout's default.
  starts?: Partial<Record<TagSeat, { head: GridCell; direction: Direction }>>
}

export function createTagState({ grid, layout, p1OnRight = false, arena = 'pillars', it = 2, starts = {} }: CreateTagStateParams): TagState {
  const start = (seat: TagSeat) => starts[seat] ?? startingStateFor(seat, grid, layout, p1OnRight)
  const pillarBlocks = arena === 'pillars' ? pillarsFor(grid, [start(1).head, start(2).head]) : []
  const obstacles =
    arena === 'pillars'
      ? pillarBlocks.flatMap((p) => {
          const cells: GridCell[] = []
          for (let y = p.y; y < p.y + p.height; y++) for (let x = p.x; x < p.x + p.width; x++) cells.push({ x, y })
          return cells
        })
      : buildArenaObstacles(arena, grid, layout, p1OnRight)
  const pillars = arena === 'pillars' ? pillarBlocks : obstacles.map((cell) => ({ x: cell.x, y: cell.y, width: 1, height: 1 }))
  const portals = buildArenaPortals(arena, grid, layout, p1OnRight)
  const tunnels: TagTunnel[] = buildArenaTunnels(arena, grid, layout, p1OnRight)
  const blocked = new Uint8Array(grid.cols * grid.rows)
  for (const cell of obstacles) {
    blocked[cell.y * grid.cols + cell.x] = 1
  }
  const player = (seat: TagSeat): TagPlayer => {
    const { head, direction } = start(seat)
    return { head, direction, pendingDirection: null, recent: [head], stride: 0, held: null, effects: NO_EFFECTS() }
  }
  return { phase: 'onboarding', grid, pillars, portals, tunnels, blocked, players: { 1: player(1), 2: player(2) }, pickups: [], it, frozenThrough: 0, itTicks: { 1: 0, 2: 0 }, tags: 0, outcome: null, tick: 0, events: NO_EVENTS() }
}

export function startTag(state: TagState): TagState {
  return state.phase === 'onboarding' ? { ...state, phase: 'playing' } : state
}

// Queues a turn. With no trail behind it, a rider can turn straight back. A turn into a wall or a
// pillar waits: the rider keeps going until the way opens, then takes it (as in Pac-Man), so a turn
// pressed a moment early still lands.
export function applyTagTurn(state: TagState, seat: TagSeat, direction: Direction): TagState {
  if (state.phase !== 'playing') return state
  const p = state.players[seat]
  if (direction === (p.pendingDirection ?? p.direction)) return state
  return { ...state, players: { ...state.players, [seat]: { ...p, pendingDirection: direction === p.direction ? null : direction } } }
}

// One step for a rider: its queued turn if that way is open, else straight on if that is (keeping the
// turn queued), else nowhere.
function step(state: TagState, p: TagPlayer, portals: ReadonlyMap<string, GridCell>): TagPlayer | null {
  const turn = p.pendingDirection
  if (turn) {
    const stepped = stepCell(p.head, turn)
    const next = portals.get(cellKey(stepped)) ?? stepped
    if (isOpen(state, next)) return { ...p, head: next, direction: turn, pendingDirection: null, recent: [...p.recent, next].slice(-TAG_TAIL_CELLS) }
  }
  const stepped = stepCell(p.head, p.direction)
  const next = portals.get(cellKey(stepped)) ?? stepped
  return isOpen(state, next) ? { ...p, head: next, recent: [...p.recent, next].slice(-TAG_TAIL_CELLS) } : null
}

// One tick for both riders. A rider covers a cell a tick, It a little more (TAG_IT_SPEED), twice that
// under Dash, half under Mud, none under Freeze, and a newly tagged It none until its freeze is over. Whenever It
// (not frozen either way) is touching the other rider (not Safe), at the start of the tick or after
// any step, the other rider is It: frozen for TAG_FREEZE_TICKS while the old It gets away. Passing
// within a cell of a box picks it up, and with powerups on a new one turns up once it's taken.
export function tickTag(state: TagState, powerups: readonly TagPowerup[] = [], random: () => number = Math.random): TagState {
  if (state.phase !== 'playing') return state
  const portalLookup = new Map<string, GridCell>()
  for (const portal of state.portals) {
    portalLookup.set(cellKey(portal.a), portal.b)
    portalLookup.set(cellKey(portal.b), portal.a)
  }
  const tick = state.tick + 1
  const players: Record<TagSeat, TagPlayer> = { 1: state.players[1], 2: state.players[2] }
  let { it, frozenThrough, tags, pickups } = state
  const events = NO_EVENTS()
  const tagIfTouching = () => {
    const runner = otherSeat(it)
    if (tick > frozenThrough && !isFrozen(players[it].effects, tick) && !isShielded(players[runner].effects, tick) && touching(players[1].head, players[2].head)) {
      it = otherSeat(it)
      frozenThrough = tick + TAG_FREEZE_TICKS
      tags++
      events.tagged = it
      players[it] = { ...players[it], stride: 0 }
    }
  }

  const steps: Record<TagSeat, number> = { 1: 0, 2: 0 }
  for (const seat of SEATS) {
    if (seat === it && tick <= frozenThrough) continue
    // In hundredths of a cell, so the sums stay exact.
    const stride = players[seat].stride + (seat === it ? Math.round(TAG_IT_SPEED * 100) : 100) * speedMultiplier(players[seat].effects, tick)
    steps[seat] = Math.floor(stride / 100)
    players[seat] = { ...players[seat], stride: stride % 100 }
  }

  tagIfTouching()
  for (let i = 0; i < Math.max(steps[1], steps[2]); i++) {
    for (const seat of SEATS) {
      // A rider tagged this tick stands still from then on.
      if (i >= steps[seat] || (seat === it && tick <= frozenThrough)) continue
      const moved = step(state, players[seat], portalLookup)
      if (!moved) {
        if (!events.blocked.includes(seat)) events.blocked.push(seat)
        continue
      }
      players[seat] = moved
      const took = takePickup(pickups, moved.head)
      if (took) {
        players[seat] = { ...players[seat], held: took.taken.type }
        pickups = took.rest
        events.collected.push(seat)
      }
    }
    tagIfTouching()
  }

  if (powerups.length > 0 && pickups.length === 0) {
    // Its footprint clear of pillars, so it can be reached from every side.
    const cell = pickupCell({ grid: state.grid, heads: [players[1].head, players[2].head], blocked: (i) => state.blocked[i] === 1 }, random)
    if (cell) pickups = [newPickup(tick, cell, powerups, random)]
  }
  for (const seat of SEATS) players[seat] = { ...players[seat], effects: expireEffects(players[seat].effects, tick) }

  const itTicks = { ...state.itTicks, [it]: state.itTicks[it] + 1 }
  return { ...state, tick, players, pickups, it, frozenThrough, tags, itTicks, events }
}

// Uses the rider's held powerup, for a tap, their powerup key or the CPU: Dash and Safe on the rider,
// Freeze and Tangle on the other one (a speed effect replaces whatever speed effect its target
// already had). Safe only works for the rider being chased; It keeps holding it.
export function applyTagActivation(state: TagState, seat: TagSeat): TagState {
  if (state.phase !== 'playing') return state
  const { held } = state.players[seat]
  if (!held || (held === 'safe' && state.it === seat)) return state
  return { ...state, players: activateEffect(state.players, seat, TAG_POWERUP_EFFECTS[held], state.tick + TAG_EFFECT_TICKS[held]) }
}

// Ends a round on the clock. Hot Potato: whoever's It loses. Least Time It: whoever spent less of the
// round as It wins, the same time is a draw.
export function finishTagOnTime(state: TagState, rule: TagRule): TagState {
  if (state.phase !== 'playing') return state
  let outcome: TagOutcome
  if (rule === 'hotPotato') outcome = { type: 'win', winner: otherSeat(state.it) }
  else {
    const { 1: a, 2: b } = state.itTicks
    outcome = a === b ? { type: 'draw' } : { type: 'win', winner: a < b ? 1 : 2 }
  }
  return { ...state, phase: 'roundOver', outcome, events: NO_EVENTS() }
}
