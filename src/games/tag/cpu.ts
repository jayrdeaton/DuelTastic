import { ALL_DIRECTIONS, type Direction, type GridCell, isOppositeDirection, stepCell } from '@tastic/grid'

import { distanceField } from '../shared/distanceField'
import { TAG_IT_SPEED } from './constants'
import { applyTagTurn, cellIndex, isOpen, otherSeat } from './engine'
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
}

const PARAMS: Record<TagCpuDifficulty, CpuParams> = {
  easy: { wobble: 0.12, lead: 0, readsBoard: false },
  normal: { wobble: 0.04, lead: 2, readsBoard: true },
  hard: { wobble: 0, lead: 4, readsBoard: true }
}

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
// would take longest to reach of those it can get to first (counting It's speed and any freeze it
// has left), so it circles a pillar or doubles back rather than running into a corner.
export function chooseTagCpuMove(state: TagState, seat: TagSeat, difficulty: TagCpuDifficulty, random: () => number = Math.random): Direction {
  const params = PARAMS[difficulty]
  const { grid, blocked } = state
  const me = state.players[seat]
  const them = state.players[otherSeat(seat)]
  const at = (cell: GridCell) => cellIndex(cell, grid)
  const options = ALL_DIRECTIONS.filter((d) => isOpen(state, stepCell(me.head, d)))
  if (options.length === 0) return me.direction
  if (params.wobble > 0 && random() < params.wobble) return options[Math.floor(random() * options.length)]

  if (state.it === seat) {
    let target = them.head
    for (let i = 0; i < params.lead && isOpen(state, stepCell(target, them.direction)); i++) target = stepCell(target, them.direction)
    const toTarget = distanceField(grid, [at(target)], blocked)
    return best(options, me.direction, (d) => -toTarget[at(stepCell(me.head, d))])
  }

  const fromIt = distanceField(grid, [at(them.head)], blocked)
  if (!params.readsBoard) return best(options, me.direction, (d) => fromIt[at(stepCell(me.head, d))])
  // When It could be within a cell of each cell (so touching whoever's there), in ticks.
  const frozenFor = Math.max(0, state.frozenThrough - state.tick)
  const itArrives = (i: number) => frozenFor + Math.max(0, fromIt[i] - 1) / TAG_IT_SPEED
  return best(options, me.direction, (d) => {
    const next = stepCell(me.head, d)
    const mine = distanceField(grid, [at(next)], blocked)
    let escape = 0
    for (let i = 0; i < mine.length; i++) if (mine[i] >= 0 && mine[i] + 1 < itArrives(i)) escape = Math.max(escape, itArrives(i))
    return ESCAPE_WEIGHT * escape + fromIt[at(next)]
  })
}

// Queues the CPU's heading for the next tick (a no-op when it's going straight on).
export function applyTagCpu(state: TagState, seat: TagSeat, difficulty: TagCpuDifficulty, random: () => number = Math.random): TagState {
  if (state.phase !== 'playing') return state
  return applyTagTurn(state, seat, chooseTagCpuMove(state, seat, difficulty, random))
}
