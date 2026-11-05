import { ALL_DIRECTIONS, type Direction, type GridCell, isOppositeDirection, stepCell } from '@tastic/grid'
import { applyControlInversion } from '@tastic/input'

import { distanceField } from '@/shared/distanceField'
import { compensatesForReverse, isFrozen, isShielded, pickupFootprint, speedMultiplier, ticksFor, ticksLeft } from '@/shared/powerups'

import { TAG_IT_SPEED } from './constants'
import { applyTagActivation, applyTagTurn, cellIndex, isDazed, isOpen, nextCell, otherSeat } from './engine'
import type { TagSeat, TagState } from './types'

export type TagCpuDifficulty = 'easy' | 'normal' | 'hard'

// Distances below are in units (TAG_UNIT_PX, Tag's old cell, TagMeasures.unit cells each) and chances
// per unit of riding, so the CPU plays the same at every grid size.
interface CpuParams {
  // Chance per unit ridden of a random (open) heading instead of its pick.
  wobble: number
  // As It, how many units ahead of the other rider it aims, along that rider's heading: hard cuts
  // them off, easy chases where they are.
  lead: number
  // Running, whether it heads for the cell It would take longest to reach, of those it can reach
  // first (so it doesn't run itself into a corner), rather than just away.
  readsBoard: boolean
  // How far out of its way it rides for a box when it's holding nothing (0: only in passing).
  seekRange: number
  // Whether it waits for each powerup's moment. Every level uses one to get away when It is about to
  // tag it.
  timesPowerups: boolean
  // Chance per unit ridden it uses what it's holding anyway, so it doesn't sit on it all round.
  useAnyway: number
}

const PARAMS: Record<TagCpuDifficulty, CpuParams> = {
  easy: { wobble: 0.12, lead: 0, readsBoard: false, seekRange: 0, timesPowerups: false, useAnyway: 0.01 },
  normal: { wobble: 0.04, lead: 2, readsBoard: true, seekRange: 10, timesPowerups: true, useAnyway: 0.02 },
  hard: { wobble: 0, lead: 4, readsBoard: true, seekRange: 16, timesPowerups: true, useAnyway: 0.01 }
}

// Within this many units of a runner, It is about to tag it.
const ABOUT_TO_TAG = 3

// How much one tick more before It can reach the best cell a running CPU can get to first is worth,
// against one step further from It right now.
const ESCAPE_WEIGHT = 4

// Of the headings in `options`, the one with the best score (each scored once: a running CPU's score
// fills the board); straight on wins a tie, then any turn over turning straight back, so it doesn't
// jitter.
function best(options: Direction[], current: Direction, score: (d: Direction) => number): Direction {
  const ranked = options.map((d) => ({ d, rank: score(d) + (d === current ? 0.5 : isOppositeDirection(d, current) ? 0 : 0.25) }))
  return ranked.reduce((a, b) => (b.rank > a.rank ? b : a)).d
}

// How many ticks the CPU rides between decisions: about a unit of riding (TagMeasures.unit cells, a
// cell of Tag's old board), the cadence it always had, rather than every cell, so it costs no more
// on the shared cells than it did on its own (a running CPU's decision fills the board several
// times, and the shared cells give it several times the cells and the ticks).
const decisionEvery = (state: TagState) => Math.max(1, Math.round(state.measures.unit))

// The cells a rider may cover in the next `ticks` ticks: one a tick, more as It or under Dash,
// counting the stride it's partway through.
function cellsIn(state: TagState, seat: TagSeat, ticks: number): number {
  const me = state.players[seat]
  return Math.max(1, Math.floor((me.stride + ticks * Math.round((state.it === seat ? TAG_IT_SPEED : 1) * 100) * speedMultiplier(me.effects, state.tick + 1)) / 100))
}

// Whether `cells` cells heading `direction` from the rider's head are all open.
function clearFor(state: TagState, seat: TagSeat, direction: Direction, cells: number): boolean {
  let cell = state.players[seat].head
  for (let i = 0; i < cells; i++) {
    cell = nextCell(state, cell, direction)
    if (!isOpen(state, cell)) return false
  }
  return true
}

// The CPU's heading for the next tick.
//
// As It, it rides the shortest way round the pillars to the other rider, or to where they're headed
// on normal and hard. Running, it keeps away from It, and on normal and hard heads for the cell It
// would take longest to reach of those it can get to first (counting It's speed, effects and any
// freeze it has left, its own speed, and any time it's Safe), so it circles a pillar or doubles back
// rather than running into a corner. Holding nothing, normal and hard ride for a box in reach: as
// It when it's much nearer than the other rider, running when they'd get there well before It.
// Every level keeps off the edge and the pillars, since a bump dazes it: it only heads where every
// cell it may cover before it next decides is open.
export function chooseTagCpuMove(state: TagState, seat: TagSeat, difficulty: TagCpuDifficulty, random: () => number = Math.random): Direction {
  const params = PARAMS[difficulty]
  const { grid, blocked, tick } = state
  const { unit } = state.measures
  const me = state.players[seat]
  const them = state.players[otherSeat(seat)]
  const at = (cell: GridCell) => cellIndex(cell, grid)
  const open = ALL_DIRECTIONS.filter((d) => isOpen(state, nextCell(state, me.head, d)))
  if (open.length === 0) return me.direction
  // The cells it may cover before it next decides, so none of them can be a bump.
  const ahead = cellsIn(state, seat, decisionEvery(state))
  const cleared = open.filter((d) => clearFor(state, seat, d, ahead))
  const options = cleared.length > 0 ? cleared : open
  if (params.wobble > 0 && random() < params.wobble / unit) return options[Math.floor(random() * options.length)]
  const walk = (field: Int32Array, toward: boolean) => best(options, me.direction, (d) => (toward ? -1 : 1) * field[at(stepCell(me.head, d))])

  let toBox: Int32Array | null = null
  if (params.seekRange > 0 && !me.held && state.pickups.length > 0) {
    const field = distanceField(
      grid,
      state.pickups.flatMap((p) => pickupFootprint(p.cell, grid)).filter((i) => !blocked[i]),
      blocked
    )
    const steps = field[at(me.head)]
    if (steps > 0 && steps <= params.seekRange * unit) toBox = field
  }

  if (state.it === seat) {
    let target = them.head
    for (let i = 0; i < Math.round(params.lead * unit) && isOpen(state, stepCell(target, them.direction)); i++) target = stepCell(target, them.direction)
    const toTarget = distanceField(grid, [at(target)], blocked)
    if (toBox && toBox[at(me.head)] * 2 < toTarget[at(me.head)]) return walk(toBox, true)
    return walk(toTarget, true)
  }

  const fromIt = distanceField(grid, [at(them.head)], blocked)
  // When It could be within reach of each cell (so touching whoever's there), in ticks: never while
  // this rider is Safe, and not before It's freeze or daze is over.
  const frozenFor = Math.max(0, state.frozenThrough - tick, them.dazedThrough - tick)
  const safeFor = ticksLeft(me.effects.shield, tick)
  const itReach = Math.floor(state.measures.reach)
  const itArrives = (i: number) => Math.max(safeFor, frozenFor + ticksFor(Math.max(0, fromIt[i] - itReach) / TAG_IT_SPEED, them.effects, tick))
  // When this rider could get somewhere, after its own daze.
  const dazedFor = Math.max(0, me.dazedThrough - tick)
  const myTicks = (steps: number) => dazedFor + ticksFor(steps, me.effects, tick)
  if (toBox && myTicks(toBox[at(me.head)]) + 2 * unit < itArrives(at(state.pickups[0].cell))) return walk(toBox, true)
  if (!params.readsBoard) return walk(fromIt, false)
  // It's arrival at every cell, once for all the headings, and how many steps this rider can take
  // before each tick count, so the loop over the board for each heading is plain arithmetic (it runs
  // over thousands of cells a decision).
  const arrivals = new Float64Array(fromIt.length)
  for (let i = 0; i < arrivals.length; i++) arrivals[i] = itArrives(i)
  const plainPace = !me.effects.speed
  return best(options, me.direction, (d) => {
    const next = stepCell(me.head, d)
    const mine = distanceField(grid, [at(next)], blocked)
    let escape = 0
    for (let i = 0; i < mine.length; i++) {
      const steps = mine[i]
      if (steps < 0) continue
      const arrives = arrivals[i]
      if (arrives <= escape) continue
      if ((plainPace ? dazedFor + steps : myTicks(steps)) + unit < arrives) escape = arrives
    }
    return ESCAPE_WEIGHT * escape + fromIt[at(next)]
  })
}

// Whether the CPU uses the powerup it's holding this tick.
//
// Every level uses Safe, Freeze, Mud or Dash to get away when It is about to tag it. Normal and hard
// also wait for each one's moment as It: Freeze when the other rider is near enough to catch while
// they're frozen, Mud from a little further, Dash to close a gap, and Tangle when the other rider is
// near (as It or running).
// Otherwise each level has a small chance a tick of using it anyway, except Safe as It, which would
// do nothing.
export function shouldTagCpuActivate(state: TagState, seat: TagSeat, difficulty: TagCpuDifficulty, random: () => number = Math.random): boolean {
  const { held } = state.players[seat]
  if (!held) return false
  const params = PARAMS[difficulty]
  const { grid, blocked } = state
  const me = state.players[seat]
  const them = state.players[otherSeat(seat)]
  const nextTick = state.tick + 1
  const isIt = state.it === seat
  // How far apart they are, in units.
  const apart = distanceField(grid, [cellIndex(them.head, grid)], blocked)[cellIndex(me.head, grid)] / state.measures.unit
  const itCanTag = nextTick > state.frozenThrough && !isFrozen(state.players[state.it].effects, nextTick) && !isDazed(state.players[state.it], nextTick)
  const trouble = !isIt && itCanTag && apart <= ABOUT_TO_TAG && !isShielded(me.effects, nextTick)
  // As It, nothing's worth using until its own freeze after a tag (or a daze) is over.
  const chasing = params.timesPowerups && isIt && nextTick > state.frozenThrough && !isDazed(me, nextTick)
  switch (held) {
    case 'safe':
      if (trouble) return true
      if (isIt) return false
      break
    case 'freeze':
      if (trouble || (chasing && apart <= 12)) return true
      break
    case 'mud':
      if (trouble || (chasing && apart <= 16)) return true
      break
    case 'dash':
      if (trouble || (chasing && apart <= 10)) return true
      break
    case 'tangle':
      if (params.timesPowerups && apart <= (isIt ? 8 : 5) && nextTick > state.frozenThrough) return true
      break
  }
  return random() < params.useAnyway / state.measures.unit
}

// The CPU's turn before a tick: uses its powerup when it's time, then queues its heading (a no-op
// when it's going straight on). Under Tangle, a heading it doesn't make up for comes out reversed,
// like a person's swipe. It decides every decisionEvery ticks, and between them only when the way
// it's going is about to run it into the edge or a pillar.
export function applyTagCpu(state: TagState, seat: TagSeat, difficulty: TagCpuDifficulty, random: () => number = Math.random): TagState {
  if (state.phase !== 'playing') return state
  const me = state.players[seat]
  const heading = me.pendingDirection && isOpen(state, nextCell(state, me.head, me.pendingDirection)) ? me.pendingDirection : me.direction
  if (state.tick % decisionEvery(state) !== 0 && clearFor(state, seat, heading, cellsIn(state, seat, 1))) return state
  let s = state
  if (s.players[seat].held && shouldTagCpuActivate(s, seat, difficulty, random)) s = applyTagActivation(s, seat)
  const direction = chooseTagCpuMove(s, seat, difficulty, random)
  const tangled = s.players[seat].effects.reverse !== null && !compensatesForReverse(difficulty, random)
  return applyTagTurn(s, seat, applyControlInversion(direction, tangled))
}
