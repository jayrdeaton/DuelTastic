import { type Direction, type GridCell, type GridSize, isInBounds, stepCell } from '@tastic/grid'

import { buildArenaObstacles, buildArenaPortals, buildArenaTunnels } from '@/shared/match/arenas'
import { GRID_CELL_PX } from '@/shared/match/constants'
// Shared with LightCycles and Turf: each rider starts at the middle of its own half, facing the
// other. Moves to shared/ when this repo takes the pack layout.
import { startingStateFor } from '@/shared/match/grid'
import { activateEffect, expireEffects, isFrozen, isShielded, newPickup, NO_EFFECTS, pickupCell, speedMultiplier, takePickup } from '@/shared/powerups'

import { TAG_DAZE_MS, TAG_EFFECT_MS, TAG_FREEZE_MS, TAG_IT_SPEED, TAG_MIN_PILLARS, TAG_PILLAR_MARGIN_PX, TAG_PILLAR_MARGIN_TIGHT_PX, TAG_PILLAR_SIZE_PX, TAG_PILLAR_SPACING_PX, TAG_PILLAR_SPACING_TIGHT_PX, TAG_POWERUP_EFFECTS, TAG_POWERUPS, TAG_REACH_PX, TAG_SPEED_INTERVAL_MS, TAG_TAIL_CELLS, TAG_UNIT_PX } from './constants'
import type { TagArena, TagEvents, TagLayout, TagMeasures, TagOutcome, TagPillar, TagPlayer, TagPowerup, TagRule, TagSeat, TagState, TagTunnel } from './types'

const SEATS: readonly TagSeat[] = [1, 2]

const NO_EVENTS = (): TagEvents => ({ tagged: null, dazed: [], collected: [] })

export const otherSeat = (seat: TagSeat): TagSeat => (seat === 1 ? 2 : 1)

export function cellIndex(cell: GridCell, grid: GridSize): number {
  return cell.y * grid.cols + cell.x
}

// Whether a rider can ride into this cell: on the board and not blocked by arena geometry.
export function isOpen(state: Pick<TagState, 'grid' | 'blocked'>, cell: GridCell): boolean {
  return isInBounds(cell, state.grid) && !state.blocked[cellIndex(cell, state.grid)]
}

// The cell a rider stepping `direction` from `cell` lands on: through a gate, the gate at its other end.
export function nextCell(state: Pick<TagState, 'portals'>, cell: GridCell, direction: Direction): GridCell {
  const stepped = stepCell(cell, direction)
  for (const { a, b } of state.portals) {
    if (a.x === stepped.x && a.y === stepped.y) return b
    if (b.x === stepped.x && b.y === stepped.y) return a
  }
  return stepped
}

// Whether a rider stands dazed on tick `tick` (see TagPlayer.dazedThrough).
export const isDazed = (player: TagPlayer, tick: number) => tick <= player.dazedThrough

// Two riders touch when It's head center is within reach (TagMeasures.reach, in cells) of the other
// rider's: inside It's glow.
export function touching(a: GridCell, b: GridCell, reach: number): boolean {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= reach * reach
}

// Tag's distances and times for a round on `cellPx` cells ticking every `intervalMs` (see TagMeasures).
export function measuresFor(cellPx: number, intervalMs: number): TagMeasures {
  const ticks = (ms: number) => Math.max(1, Math.round(ms / intervalMs))
  return {
    unit: TAG_UNIT_PX / cellPx,
    reach: TAG_REACH_PX / cellPx,
    freezeTicks: ticks(TAG_FREEZE_MS),
    dazeTicks: ticks(TAG_DAZE_MS),
    effectTicks: Object.fromEntries(TAG_POWERUPS.map((p) => [p, ticks(TAG_EFFECT_MS[p])])) as Record<TagPowerup, number>
  }
}

// How much of It's freeze is left, 1 just tagged to 0 free to move.
export function freezeLeft(state: TagState): number {
  return Math.min(1, Math.max(0, state.frozenThrough - state.tick - state.sinceTick) / state.measures.freezeTicks)
}

// Where pillars `size` cells square go along one side of the board: evenly spaced, centered, and
// mirrored end to end so each rider's half is the same. On a side whose length can't center a pillar
// exactly, the middle one is a cell wider.
function lattice(length: number, margin: number, spacing: number, size: number): { at: number; size: number }[] {
  const count = Math.floor((length - 2 * margin - size) / spacing) + 1
  if (count < 1) return []
  const start = Math.floor((length - ((count - 1) * spacing + size)) / 2)
  const out: { at: number; size: number }[] = []
  for (let i = 0; i < Math.floor(count / 2); i++) out.push({ at: start + i * spacing, size })
  if (count % 2 === 1) {
    const middle = (length - size) % 2 === 0 ? size : size + 1
    out.push({ at: (length - middle) / 2, size: middle })
  }
  for (let i = Math.floor(count / 2) - 1; i >= 0; i--) out.push({ at: length - size - out[i].at, size })
  return out
}

function latticePillars(grid: GridSize, avoid: readonly GridCell[], margin: number, spacing: number, size: number, clearance: number): TagPillar[] {
  const pillars: TagPillar[] = []
  for (const row of lattice(grid.rows, margin, spacing, size)) {
    for (const col of lattice(grid.cols, margin, spacing, size)) {
      const p = { x: col.at, y: row.at, width: col.size, height: row.size }
      if (avoid.every((c) => c.x < p.x - clearance || c.x >= p.x + p.width + clearance || c.y < p.y - clearance || c.y >= p.y + p.height + clearance)) pillars.push(p)
    }
  }
  return pillars
}

// Pillars on a lattice centered on the board (see lattice), sized and spaced in px (TAG_PILLAR_*_PX)
// for `cellPx` cells, leaving out any within a unit (TAG_UNIT_PX) of a rider's starting cell. Each
// stands alone with open cells all round, so every open cell can reach every other. A board that
// leaves fewer than TAG_MIN_PILLARS gets the tighter lattice: a narrow board had 0 or 1 pillars, an
// open board under the Pillars name.
export function pillarsFor(grid: GridSize, avoid: readonly GridCell[], cellPx: number = GRID_CELL_PX.medium): TagPillar[] {
  const cells = (px: number) => Math.max(1, Math.round(px / cellPx))
  const size = cells(TAG_PILLAR_SIZE_PX)
  const clearance = cells(TAG_UNIT_PX)
  const pillars = latticePillars(grid, avoid, cells(TAG_PILLAR_MARGIN_PX), cells(TAG_PILLAR_SPACING_PX), size, clearance)
  if (pillars.length >= TAG_MIN_PILLARS) return pillars
  const tight = latticePillars(grid, avoid, cells(TAG_PILLAR_MARGIN_TIGHT_PX), cells(TAG_PILLAR_SPACING_TIGHT_PX), size, clearance)
  return tight.length > pillars.length ? tight : pillars
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
  // The board's cell size in px and the milliseconds per cell, for TagMeasures: by default the shared
  // medium grid size at the normal speed.
  cellPx?: number
  intervalMs?: number
}

export function createTagState({ grid, layout, p1OnRight = false, arena = 'pillars', it = 2, starts = {}, cellPx = GRID_CELL_PX.medium, intervalMs = TAG_SPEED_INTERVAL_MS.normal }: CreateTagStateParams): TagState {
  const start = (seat: TagSeat) => starts[seat] ?? startingStateFor(seat, grid, layout, p1OnRight)
  const pillarBlocks = arena === 'pillars' ? pillarsFor(grid, [start(1).head, start(2).head], cellPx) : []
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
    return { head, direction, pendingDirection: null, recent: [head], stride: 0, held: null, effects: NO_EFFECTS(), dazedThrough: 0, stuck: false }
  }
  return { phase: 'onboarding', grid, pillars, portals, tunnels, blocked, players: { 1: player(1), 2: player(2) }, pickups: [], it, frozenThrough: 0, itTicks: { 1: 0, 2: 0 }, tags: 0, outcome: null, tick: 0, sinceTick: 0, events: NO_EVENTS(), measures: measuresFor(cellPx, intervalMs) }
}

export function startTag(state: TagState): TagState {
  return state.phase === 'onboarding' ? { ...state, phase: 'playing' } : state
}

// Queues a turn. With no trail behind it, a rider can turn straight back. A turn into a wall or a
// pillar waits: the rider keeps going until the way opens, then takes it (as in Pac-Man), so a turn
// pressed a moment early still lands. A turn queued while dazed is taken once the daze is over.
export function applyTagTurn(state: TagState, seat: TagSeat, direction: Direction): TagState {
  if (state.phase !== 'playing') return state
  const p = state.players[seat]
  if (direction === (p.pendingDirection ?? p.direction)) return state
  return { ...state, players: { ...state.players, [seat]: { ...p, pendingDirection: direction === p.direction ? null : direction } } }
}

// One step for a rider: its queued turn if that way is open, else straight on if that is (keeping the
// turn queued), else nowhere.
function step(state: TagState, p: TagPlayer): TagPlayer | null {
  const turn = p.pendingDirection
  if (turn) {
    const next = nextCell(state, p.head, turn)
    if (isOpen(state, next)) return { ...p, head: next, direction: turn, pendingDirection: null, recent: [...p.recent, next].slice(-TAG_TAIL_CELLS), stuck: false }
  }
  const next = nextCell(state, p.head, p.direction)
  return isOpen(state, next) ? { ...p, head: next, recent: [...p.recent, next].slice(-TAG_TAIL_CELLS), stuck: false } : null
}

// Within this of a whole tick (or a whole cell) counts as whole, so parts that add up to one don't
// fall short on rounding.
const EPSILON = 1e-6

// Plays part of the tick under way (the one after state.tick) for both riders: each one's stride
// grows by its speed over that part, and it steps whenever its stride makes a whole cell. A rider
// covers a cell a tick, It a little more (TAG_IT_SPEED), twice that under Dash, half under Mud, none
// under Freeze, a newly tagged It none until its freeze is over, and a dazed rider none until its
// daze is. A step into the edge or a pillar is a bump: the rider is dazed for its daze ticks and its
// steps for the rest of the tick are lost, and it isn't dazed again until it has moved. Whenever It
// (not frozen either way, nor dazed) is touching the other rider (not Safe), at the start or after
// any step, the other rider is It: frozen for its freeze ticks while the old It gets away. Passing
// within a cell of a box picks it up, as in every game.
function ride(state: TagState, part: number, events: TagEvents): TagState {
  const tick = state.tick + 1
  const { reach, freezeTicks, dazeTicks } = state.measures
  const players: Record<TagSeat, TagPlayer> = { 1: state.players[1], 2: state.players[2] }
  let { it, frozenThrough, tags, pickups } = state
  const tagIfTouching = () => {
    const runner = otherSeat(it)
    if (tick > frozenThrough && !isFrozen(players[it].effects, tick) && !isDazed(players[it], tick) && !isShielded(players[runner].effects, tick) && touching(players[1].head, players[2].head, reach)) {
      it = otherSeat(it)
      frozenThrough = tick + freezeTicks
      tags++
      events.tagged = it
      players[it] = { ...players[it], stride: 0 }
    }
  }

  const steps: Record<TagSeat, number> = { 1: 0, 2: 0 }
  for (const seat of SEATS) {
    if ((seat === it && tick <= frozenThrough) || isDazed(players[seat], tick)) continue
    // In hundredths of a cell.
    const stride = players[seat].stride + (seat === it ? Math.round(TAG_IT_SPEED * 100) : 100) * speedMultiplier(players[seat].effects, tick) * part
    steps[seat] = Math.floor((stride + EPSILON) / 100)
    players[seat] = { ...players[seat], stride: Math.max(0, stride - steps[seat] * 100) }
  }

  tagIfTouching()
  for (let i = 0; i < Math.max(steps[1], steps[2]); i++) {
    for (const seat of SEATS) {
      // A rider tagged or dazed this tick stands still from then on.
      if (i >= steps[seat] || (seat === it && tick <= frozenThrough) || isDazed(players[seat], tick)) continue
      const moved = step(state, players[seat])
      if (!moved) {
        if (!players[seat].stuck) {
          players[seat] = { ...players[seat], stuck: true, stride: 0, dazedThrough: tick + dazeTicks }
          events.dazed.push(seat)
        }
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
  return { ...state, players, pickups, it, frozenThrough, tags, sinceTick: state.sinceTick + part }
}

// Finishes the tick under way: with powerups on a new box turns up once the last one's taken,
// effects run out, and whoever's It is charged the tick.
function endTick(state: TagState, powerups: readonly TagPowerup[], random: () => number): TagState {
  const tick = state.tick + 1
  const players: Record<TagSeat, TagPlayer> = { 1: state.players[1], 2: state.players[2] }
  let { pickups } = state
  if (powerups.length > 0 && pickups.length === 0) {
    // Its footprint clear of pillars, so it can be reached from every side.
    const cell = pickupCell({ grid: state.grid, heads: [players[1].head, players[2].head], blocked: (i) => state.blocked[i] === 1 }, random)
    if (cell) pickups = [newPickup(tick, cell, powerups, random)]
  }
  for (const seat of SEATS) players[seat] = { ...players[seat], effects: expireEffects(players[seat].effects, tick) }
  const itTicks = { ...state.itTicks, [state.it]: state.itTicks[state.it] + 1 }
  return { ...state, tick, sinceTick: 0, players, pickups, itTicks }
}

// Plays dt ticks (one by default) for both riders. The round screen plays a little each frame, so
// each rider steps on its own clock: It, being faster, steps more often rather than now and then
// two cells at once, which drew as a lurch forward every few cells.
export function tickTag(state: TagState, powerups: readonly TagPowerup[] = [], random: () => number = Math.random, dt = 1): TagState {
  if (state.phase !== 'playing') return state
  const events = NO_EVENTS()
  let s = state
  let left = dt
  // Each pass either uses up what's left or reaches the end of the tick (sinceTick never stops
  // within EPSILON of it), so this ends after a pass or two a tick.
  while (left > 0) {
    const part = Math.min(left, 1 - s.sinceTick)
    s = ride(s, part, events)
    left -= part
    if (s.sinceTick > 1 - EPSILON) s = endTick(s, powerups, random)
  }
  return { ...s, events }
}

// Uses the rider's held powerup, for a tap, their powerup key or the CPU: Dash and Safe on the rider,
// Freeze and Tangle on the other one (a speed effect replaces whatever speed effect its target
// already had). Safe only works for the rider being chased; It keeps holding it.
export function applyTagActivation(state: TagState, seat: TagSeat): TagState {
  if (state.phase !== 'playing') return state
  const { held } = state.players[seat]
  if (!held || (held === 'safe' && state.it === seat)) return state
  return { ...state, players: activateEffect(state.players, seat, TAG_POWERUP_EFFECTS[held], state.tick + state.measures.effectTicks[held]) }
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
