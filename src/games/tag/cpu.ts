import { ALL_DIRECTIONS, type Direction, type GridCell, isOppositeDirection, stepCell } from '@tastic/grid'
import { applyControlInversion } from '@tastic/input'

import { distanceField } from '../shared/distanceField'
import { compensatesForReverse, isFrozen, isShielded, pickupFootprint, ticksFor, ticksLeft } from '../shared/powerups'
import { TAG_IT_SPEED } from './constants'
import { applyTagActivation, applyTagTurn, cellIndex, isOpen, otherSeat } from './engine'
import type { TagSeat, TagState } from './types'

export type TagCpuDifficulty = 'easy' | 'normal' | 'hard'

interface CpuParams {
  // Chance per tick of a random (open) heading instead of its pick.
  wobble: number
  // As It, how many cells ahead of the other rider it aims, along that rider's heading: hard cuts
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
  // Chance per tick it uses what it's holding anyway, so it doesn't sit on it all round.
  useAnyway: number
}

const PARAMS: Record<TagCpuDifficulty, CpuParams> = {
  easy: { wobble: 0.12, lead: 0, readsBoard: false, seekRange: 0, timesPowerups: false, useAnyway: 0.01 },
  normal: { wobble: 0.04, lead: 2, readsBoard: true, seekRange: 10, timesPowerups: true, useAnyway: 0.02 },
  hard: { wobble: 0, lead: 4, readsBoard: true, seekRange: 16, timesPowerups: true, useAnyway: 0.01 }
}

// Within this many steps of a runner, It is about to tag it.
const ABOUT_TO_TAG = 3

// How much one tick more before It can reach the best cell a running CPU can get to first is worth,
// against one step further from It right now.
const ESCAPE_WEIGHT = 4

// Of the headings in `options`, the one with the best score; straight on wins a tie, then any turn
// over turning straight back, so it doesn't jitter.
function best(options: Direction[], current: Direction, score: (d: Direction) => number): Direction {
  const rank = (d: Direction) => score(d) + (d === current ? 0.5 : isOppositeDirection(d, current) ? 0 : 0.25)
  return options.reduce((a, b) => (rank(b) > rank(a) ? b : a))
}

// The CPU's heading for the next tick.
//
// As It, it rides the shortest way round the pillars to the other rider, or to where they're headed
// on normal and hard. Running, it keeps away from It, and on normal and hard heads for the cell It
// would take longest to reach of those it can get to first (counting It's speed, effects and any
// freeze it has left, its own speed, and any time it's Safe), so it circles a pillar or doubles back
// rather than running into a corner. Holding nothing, normal and hard ride for a box in reach: as
// It when it's much nearer than the other rider, running when they'd get there well before It.
export function chooseTagCpuMove(state: TagState, seat: TagSeat, difficulty: TagCpuDifficulty, random: () => number = Math.random): Direction {
  const params = PARAMS[difficulty]
  const { grid, blocked, tick } = state
  const me = state.players[seat]
  const them = state.players[otherSeat(seat)]
  const at = (cell: GridCell) => cellIndex(cell, grid)
  const options = ALL_DIRECTIONS.filter((d) => isOpen(state, stepCell(me.head, d)))
  if (options.length === 0) return me.direction
  if (params.wobble > 0 && random() < params.wobble) return options[Math.floor(random() * options.length)]
  const walk = (field: Int32Array, toward: boolean) => best(options, me.direction, (d) => (toward ? -1 : 1) * field[at(stepCell(me.head, d))])

  let toBox: Int32Array | null = null
  if (params.seekRange > 0 && !me.held && state.pickups.length > 0) {
    const field = distanceField(
      grid,
      state.pickups.flatMap((p) => pickupFootprint(p.cell, grid)).filter((i) => !blocked[i]),
      blocked
    )
    const steps = field[at(me.head)]
    if (steps > 0 && steps <= params.seekRange) toBox = field
  }

  if (state.it === seat) {
    let target = them.head
    for (let i = 0; i < params.lead && isOpen(state, stepCell(target, them.direction)); i++) target = stepCell(target, them.direction)
    const toTarget = distanceField(grid, [at(target)], blocked)
    if (toBox && toBox[at(me.head)] * 2 < toTarget[at(me.head)]) return walk(toBox, true)
    return walk(toTarget, true)
  }

  const fromIt = distanceField(grid, [at(them.head)], blocked)
  // When It could be within a cell of each cell (so touching whoever's there), in ticks: never while
  // this rider is Safe.
  const frozenFor = Math.max(0, state.frozenThrough - tick)
  const safeFor = ticksLeft(me.effects.shield, tick)
  const itArrives = (i: number) => Math.max(safeFor, frozenFor + ticksFor(Math.max(0, fromIt[i] - 1) / TAG_IT_SPEED, them.effects, tick))
  if (toBox && ticksFor(toBox[at(me.head)], me.effects, tick) + 2 < itArrives(at(state.pickups[0].cell))) return walk(toBox, true)
  if (!params.readsBoard) return walk(fromIt, false)
  return best(options, me.direction, (d) => {
    const next = stepCell(me.head, d)
    const mine = distanceField(grid, [at(next)], blocked)
    let escape = 0
    for (let i = 0; i < mine.length; i++) {
      if (mine[i] < 0) continue
      const arrives = itArrives(i)
      if (ticksFor(mine[i], me.effects, tick) + 1 < arrives) escape = Math.max(escape, arrives)
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
  const apart = distanceField(grid, [cellIndex(them.head, grid)], blocked)[cellIndex(me.head, grid)]
  const itCanTag = nextTick > state.frozenThrough && !isFrozen(state.players[state.it].effects, nextTick)
  const trouble = !isIt && itCanTag && apart <= ABOUT_TO_TAG && !isShielded(me.effects, nextTick)
  // As It, nothing's worth using until its own freeze after a tag is over.
  const chasing = params.timesPowerups && isIt && nextTick > state.frozenThrough
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
  return random() < params.useAnyway
}

// The CPU's turn before a tick: uses its powerup when it's time, then queues its heading (a no-op
// when it's going straight on). Under Tangle, a heading it doesn't make up for comes out reversed,
// like a person's swipe.
export function applyTagCpu(state: TagState, seat: TagSeat, difficulty: TagCpuDifficulty, random: () => number = Math.random): TagState {
  if (state.phase !== 'playing') return state
  let s = state
  if (s.players[seat].held && shouldTagCpuActivate(s, seat, difficulty, random)) s = applyTagActivation(s, seat)
  const direction = chooseTagCpuMove(s, seat, difficulty, random)
  const tangled = s.players[seat].effects.reverse !== null && !compensatesForReverse(difficulty, random)
  return applyTagTurn(s, seat, applyControlInversion(direction, tangled))
}
