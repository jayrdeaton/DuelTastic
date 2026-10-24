import { type Direction, type GridCell, type GridSize, isInBounds, isOppositeDirection, stepCell } from '@tastic/grid'
import { applyControlInversion } from '@tastic/input'

import { distanceField } from '../shared/distanceField'
import { compensatesForReverse, isShielded, isSlowed, pickupFootprint, speedMultiplier, ticksFor, ticksLeft } from '../shared/powerups'
import { TURF_EFFECT_TICKS } from './constants'
import { applyTurfActivation, applyTurfTurn, cellIndex } from './engine'
import { DEFAULT_TURF_RULES, type TurfPlayer, type TurfRules, type TurfSeat, type TurfState } from './types'

export type TurfCpuDifficulty = 'easy' | 'normal' | 'hard'

// The loop the CPU is riding: out from its ground `depth` cells, `width` cells to one side, then home
// by the shortest way. Kept between ticks by the caller (it's the only thing the CPU remembers) and
// replaced each time the CPU gets home.
export interface TurfCpuPlan {
  out: Direction
  depth: number
  side: Direction
  width: number
  // Whether this loop goes after the other rider's trail when it can cut it first ('hard' always does).
  aggressive: boolean
  // Set once the CPU has left its ground on this plan, so getting back to it ends the plan.
  started: boolean
}

interface CpuParams {
  // How far out and across a loop goes, a random pick in [min, max], cut short by the board's edge.
  depth: [number, number]
  width: [number, number]
  // How much slack it wants before heading home: it turns for home once the other rider could reach
  // its trail within (steps home + margin). Negative is reckless, positive careful.
  margin: number
  // Chance a loop goes after the other rider's trail.
  attack: number
  // Chance per tick of a random (but safe) turn.
  wobble: number
  // The longest trail it lets itself lay before heading home regardless.
  maxTrail: number
  // How far out of its way it rides for a pickup (0: it only picks them up in passing).
  seekRange: number
  // Whether it waits for the moment each powerup is for. Every level uses one to get out of trouble.
  timesPowerups: boolean
  // Chance per tick it uses what it's holding anyway, so it doesn't sit on it all round.
  useAnyway: number
}

const PARAMS: Record<TurfCpuDifficulty, CpuParams> = {
  easy: { depth: [2, 5], width: [2, 5], margin: -1, attack: 0, wobble: 0.08, maxTrail: 16, seekRange: 0, timesPowerups: false, useAnyway: 0.01 },
  normal: { depth: [4, 9], width: [3, 8], margin: 1, attack: 0.5, wobble: 0.02, maxTrail: 32, seekRange: 24, timesPowerups: true, useAnyway: 0.02 },
  hard: { depth: [5, 14], width: [4, 12], margin: 3, attack: 1, wobble: 0, maxTrail: 48, seekRange: 36, timesPowerups: true, useAnyway: 0.01 }
}

// It uses a powerup to get out of trouble this many ticks before it would turn for home.
const POWERUP_DANGER_SLACK = 2

const LEFT_OF: Record<Direction, Direction> = { up: 'left', left: 'down', down: 'right', right: 'up' }
const RIGHT_OF: Record<Direction, Direction> = { up: 'right', right: 'down', down: 'left', left: 'up' }
const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left']

const other = (seat: TurfSeat): TurfSeat => (seat === 1 ? 2 : 1)

// Steps for a rider at `head`, heading `direction`, to reach the field's sources. Read off its next
// cells rather than its own: a rider out on a loop stands on its own trail, which the field treats as
// blocked.
function stepsFrom(field: Int32Array, grid: GridSize, head: GridCell, direction: Direction): number {
  if (field[cellIndex(head, grid)] === 0) return 0
  let best = -1
  for (const d of [direction, LEFT_OF[direction], RIGHT_OF[direction]]) {
    const next = stepCell(head, d)
    if (!isInBounds(next, grid)) continue
    const steps = field[cellIndex(next, grid)]
    if (steps >= 0 && (best < 0 || steps + 1 < best)) best = steps + 1
  }
  return best
}

function trailMask(grid: GridSize, trail: readonly GridCell[]): Uint8Array {
  const mask = new Uint8Array(grid.cols * grid.rows)
  for (const cell of trail) mask[cellIndex(cell, grid)] = 1
  return mask
}

function groundCells(owner: Uint8Array, seat: TurfSeat): number[] {
  const cells: number[] = []
  for (let i = 0; i < owner.length; i++) if (owner[i] === seat) cells.push(i)
  return cells
}

const randomIn = ([min, max]: [number, number], random: () => number) => min + Math.floor(random() * (max - min + 1))

// Free cells from `from` to the board's edge going `direction`, not counting `from`.
function roomAhead(grid: GridSize, from: GridCell, direction: Direction): number {
  let room = 0
  for (let cell = stepCell(from, direction); isInBounds(cell, grid); cell = stepCell(cell, direction)) room++
  return room
}

// What the CPU reads off the board before deciding anything, in ticks rather than cells, so a rider
// under Dash, Gust or Frost counts at its real speed.
interface Reading {
  me: TurfPlayer
  them: TurfPlayer
  outside: boolean
  myBlocked: Uint8Array
  theirTrail: Uint8Array
  // Steps to its own ground from every cell.
  home: Int32Array
  ticksHome: number
  // Ticks until the other rider could cut its trail (no sooner than its Fence comes down); -1 when it
  // can't, or the CPU is home.
  threat: number
  // A distance field to the other rider's trail, when it can get there before that rider gets home
  // (and before its own trail could be cut), with the other rider's Fence down by then.
  cut: Int32Array | null
  // Ticks to the other rider's trail; -1 when they're home.
  ticksToCut: number
}

function read(state: TurfState, seat: TurfSeat, rules: TurfRules): Reading {
  const { grid, owner, tick } = state
  const at = (cell: GridCell) => cellIndex(cell, grid)
  const me = state.players[seat]
  const them = state.players[other(seat)]
  const outside = me.trail.length > 0
  const myTrail = trailMask(grid, me.trail)
  const theirTrail = trailMask(grid, them.trail)
  const myBlocked = rules.ownTrailDeadly ? myTrail : new Uint8Array(myTrail.length)
  const theirBlocked = rules.ownTrailDeadly ? theirTrail : new Uint8Array(theirTrail.length)
  const home = distanceField(grid, groundCells(owner, seat), myBlocked)
  const ticksHome = ticksFor(stepsFrom(home, grid, me.head, me.direction), me.effects, tick)
  const reach = outside ? ticksFor(stepsFrom(distanceField(grid, me.trail.map(at), theirBlocked), grid, them.head, them.direction), them.effects, tick) : -1
  const threat = reach < 0 ? -1 : Math.max(reach, ticksLeft(me.effects.shield, tick))

  let cut: Int32Array | null = null
  let ticksToCut = -1
  if (them.trail.length > 0) {
    const toTheirTrail = distanceField(grid, them.trail.map(at), myBlocked)
    ticksToCut = ticksFor(stepsFrom(toTheirTrail, grid, me.head, me.direction), me.effects, tick)
    const theirHome = ticksFor(stepsFrom(distanceField(grid, groundCells(owner, other(seat)), theirBlocked), grid, them.head, them.direction), them.effects, tick)
    if (ticksToCut > ticksLeft(them.effects.shield, tick) && (theirHome < 0 || ticksToCut < theirHome) && (threat < 0 || ticksToCut < threat)) cut = toTheirTrail
  }
  return { me, them, outside, myBlocked, theirTrail, home, ticksHome, threat, cut, ticksToCut }
}

// A new loop from where the CPU is: out the way with the most room past its ground (never straight
// back), then to whichever side has more room, both cut short to stay a cell off the edge.
function makePlan(state: TurfState, seat: TurfSeat, params: CpuParams, random: () => number): TurfCpuPlan {
  const { grid, owner } = state
  const me = state.players[seat]
  let best: { out: Direction; room: number; edge: GridCell } | null = null
  for (const out of DIRECTIONS) {
    if (isOppositeDirection(out, me.direction)) continue
    // Ride across its own ground first; the loop is measured from where the ground ends.
    let edge = me.head
    while (isInBounds(stepCell(edge, out), grid) && owner[cellIndex(stepCell(edge, out), grid)] === seat) edge = stepCell(edge, out)
    // A little randomness so it doesn't always pick the same way out.
    const room = roomAhead(grid, edge, out) + random() * 3
    if (!best || room > best.room) best = { out, room, edge }
  }
  const { out, edge } = best!
  const depth = Math.max(1, Math.min(randomIn(params.depth, random), roomAhead(grid, edge, out) - 1))
  let corner = edge
  for (let i = 0; i < depth && isInBounds(stepCell(corner, out), grid); i++) corner = stepCell(corner, out)
  const leftRoom = roomAhead(grid, corner, LEFT_OF[out])
  const rightRoom = roomAhead(grid, corner, RIGHT_OF[out])
  const side = leftRoom === rightRoom ? (random() < 0.5 ? LEFT_OF[out] : RIGHT_OF[out]) : leftRoom > rightRoom ? LEFT_OF[out] : RIGHT_OF[out]
  const width = Math.max(1, Math.min(randomIn(params.width, random), Math.max(leftRoom, rightRoom) - 1))
  return { out, depth, side, width, aggressive: random() < params.attack, started: false }
}

export interface TurfCpuMove {
  direction: Direction
  plan: TurfCpuPlan | null
}

// The CPU's heading for the next tick.
//
// Out on a loop, it heads home as soon as the other rider could reach its trail before (or about as
// soon as) it gets home, or once its trail is as long as it allows. It goes for the other rider's
// trail whenever it can get there before that rider gets home, on a loop marked aggressive or while
// that rider is frozen or stuck in Mud. Normal and hard ride out for a pickup in reach when they're holding nothing.
// Every pick is filtered for safety first, over every cell it covers this tick (two under Dash or
// Gust): never off the board or into its own trail, never into a cell the other rider's head could
// take next unless that cell is its own ground (where it wins a head-on) or it's fenced, and never
// into a cell with no way back home.
export function chooseTurfCpuMove(state: TurfState, seat: TurfSeat, difficulty: TurfCpuDifficulty, plan: TurfCpuPlan | null, rules: TurfRules = DEFAULT_TURF_RULES, random: () => number = Math.random): TurfCpuMove {
  const params = PARAMS[difficulty]
  const { grid, owner } = state
  const r = read(state, seat, rules)
  const { me, them, outside } = r
  const at = (cell: GridCell) => cellIndex(cell, grid)
  const nextTick = state.tick + 1

  if (plan?.started && !outside) plan = null
  if (!plan && !outside) plan = makePlan(state, seat, params, random)
  if (plan && outside && !plan.started) plan = { ...plan, started: true }

  // Frozen, it still picks the heading it'll take once it thaws.
  const mySteps = Math.max(1, Math.ceil(speedMultiplier(me.effects, nextTick)))
  const fenced = isShielded(me.effects, nextTick)
  const theirSteps = Math.ceil(speedMultiplier(them.effects, nextTick))
  const threatened = new Set([at(them.head)])
  for (const d of [them.direction, LEFT_OF[them.direction], RIGHT_OF[them.direction]]) {
    let cell = them.head
    for (let i = 0; i < theirSteps; i++) {
      cell = stepCell(cell, d)
      if (isInBounds(cell, grid)) threatened.add(at(cell))
    }
  }
  const safe = (d: Direction) => {
    let cell = me.head
    let reachedHome = false
    for (let i = 0; i < mySteps; i++) {
      cell = stepCell(cell, d)
      if (!isInBounds(cell, grid)) return false
      const index = at(cell)
      if (owner[index] === seat) {
        // Home: its trail is claimed here, so nothing after this cell can run into it.
        reachedHome = true
        continue
      }
      if (!reachedHome && r.myBlocked[index]) return false
      if (!fenced && threatened.has(index) && !r.theirTrail[index]) return false
    }
    return owner[at(cell)] === seat || r.home[at(cell)] >= 0
  }

  const danger = r.threat >= 0 && r.threat - r.ticksHome <= params.margin

  let seek: Int32Array | null = null
  if (params.seekRange > 0 && !me.held && state.pickups.length > 0 && !danger) {
    const targets = state.pickups.flatMap(({ cell }) => pickupFootprint(cell, grid)).filter((i) => !r.myBlocked[i])
    const field = distanceField(grid, targets, r.myBlocked)
    const steps = stepsFrom(field, grid, me.head, me.direction)
    if (steps > 0 && steps <= params.seekRange && me.trail.length + steps <= params.maxTrail) seek = field
  }

  // What it's riding toward this tick: a distance field to walk down, or a heading from the plan.
  let field: Int32Array | null = null
  let wanted: Direction | null = null
  if (r.cut && (plan?.aggressive || isSlowed(them.effects, nextTick))) field = r.cut
  else if (outside && (danger || me.trail.length >= params.maxTrail)) field = r.home
  else if (seek) field = seek
  else if (outside) {
    if (!plan || me.trail.length >= plan.depth + plan.width) field = r.home
    else wanted = me.trail.length < plan.depth ? plan.out : plan.side
  } else if (plan) wanted = plan.out

  const candidates = [me.direction, LEFT_OF[me.direction], RIGHT_OF[me.direction]]
  const options = candidates.filter(safe)
  let direction: Direction
  if (options.length === 0) {
    // Nothing safe: anything that stays on the board and off its own trail, else straight on.
    direction = candidates.find((d) => isInBounds(stepCell(me.head, d), grid) && !r.myBlocked[at(stepCell(me.head, d))]) ?? me.direction
  } else if (params.wobble > 0 && random() < params.wobble) {
    direction = options[Math.floor(random() * options.length)]
  } else if (field) {
    const f = field
    // Straight on wins ties, so it doesn't zigzag.
    direction = options.reduce((best, d) => {
      const score = f[at(stepCell(me.head, d))]
      const bestScore = f[at(stepCell(me.head, best))]
      return score >= 0 && (bestScore < 0 || score < bestScore) ? d : best
    })
  } else {
    const turnToward = wanted && isOppositeDirection(wanted, me.direction) ? (plan?.side ?? LEFT_OF[me.direction]) : wanted
    direction = turnToward && options.includes(turnToward) ? turnToward : options[0]
  }
  return { direction, plan }
}

// Whether the CPU uses the powerup it's holding this tick.
//
// Every level uses Fence, Sod, Frost, Mud or Dash to get out of trouble: out on a trail the other
// rider could cut before it gets home. Normal and hard also wait for each one's moment: Sod on a long
// trail (it brings the trail home), Dash on a long ride home, Frost or Mud when the other rider's
// trail is close enough to cut while they're frozen or slowed, Tangle while they're out (a wrong turn costs most then), and
// Gust when they're heading for the edge or have a long trail of their own to run into. Otherwise
// each level has a small chance a tick of using it anyway.
export function shouldTurfCpuActivate(state: TurfState, seat: TurfSeat, difficulty: TurfCpuDifficulty, rules: TurfRules = DEFAULT_TURF_RULES, random: () => number = Math.random): boolean {
  const held = state.players[seat].held
  if (!held) return false
  const params = PARAMS[difficulty]
  const r = read(state, seat, rules)
  const { me, them, outside } = r
  const trouble = outside && r.threat >= 0 && r.threat - r.ticksHome <= params.margin + POWERUP_DANGER_SLACK
  const timed = params.timesPowerups
  switch (held) {
    case 'fence':
      if (trouble) return true
      break
    case 'sod':
      if (trouble || (timed && outside && me.trail.length >= 8)) return true
      break
    case 'dash':
      if (trouble || (timed && outside && me.trail.length >= 6 && r.ticksHome >= 6)) return true
      break
    case 'frost':
      if (trouble || (timed && r.ticksToCut > 0 && r.ticksToCut <= TURF_EFFECT_TICKS.frost)) return true
      break
    case 'mud':
      // Half speed for a while: about as long to cut them as Frost gives, with time to spare.
      if (trouble || (timed && r.ticksToCut > 0 && r.ticksToCut <= TURF_EFFECT_TICKS.mud / 2)) return true
      break
    case 'tangle':
      if (timed && them.trail.length >= 4) return true
      break
    case 'gust':
      if (timed && them.trail.length > 0 && (roomAhead(state.grid, them.head, them.direction) <= 4 || (rules.ownTrailDeadly && them.trail.length >= 10))) return true
      break
  }
  return random() < params.useAnyway
}

// The CPU's turn before a tick: uses its powerup when it's time, then queues its heading (a no-op
// when it's going straight on). Under Tangle, a heading it doesn't make up for comes out reversed,
// like a person's swipe.
export function applyTurfCpu(state: TurfState, seat: TurfSeat, difficulty: TurfCpuDifficulty, plan: TurfCpuPlan | null, rules: TurfRules = DEFAULT_TURF_RULES, random: () => number = Math.random): { state: TurfState; plan: TurfCpuPlan | null } {
  if (state.phase !== 'playing' || !state.players[seat].alive) return { state, plan }
  let s = state
  if (s.players[seat].held && shouldTurfCpuActivate(s, seat, difficulty, rules, random)) {
    s = applyTurfActivation(s, seat)
    // Sod can end the round.
    if (s.phase !== 'playing') return { state: s, plan }
  }
  const move = chooseTurfCpuMove(s, seat, difficulty, plan, rules, random)
  const tangled = s.players[seat].effects.reverse !== null && !compensatesForReverse(difficulty, random)
  return { state: applyTurfTurn(s, seat, applyControlInversion(move.direction, tangled)), plan: move.plan }
}
