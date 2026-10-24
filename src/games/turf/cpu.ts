import { type Direction, type GridCell, type GridSize, isInBounds, isOppositeDirection, stepCell } from '@tastic/grid'

import { applyTurfTurn, cellIndex } from './engine'
import { DEFAULT_TURF_RULES, type TurfRules, type TurfSeat, type TurfState } from './types'

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
}

const PARAMS: Record<TurfCpuDifficulty, CpuParams> = {
  easy: { depth: [2, 5], width: [2, 5], margin: -1, attack: 0, wobble: 0.08, maxTrail: 16 },
  normal: { depth: [4, 9], width: [3, 8], margin: 1, attack: 0.5, wobble: 0.02, maxTrail: 32 },
  hard: { depth: [5, 14], width: [4, 12], margin: 3, attack: 1, wobble: 0, maxTrail: 48 }
}

const LEFT_OF: Record<Direction, Direction> = { up: 'left', left: 'down', down: 'right', right: 'up' }
const RIGHT_OF: Record<Direction, Direction> = { up: 'right', right: 'down', down: 'left', left: 'up' }
const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left']

const other = (seat: TurfSeat): TurfSeat => (seat === 1 ? 2 : 1)

// Steps from the nearest source cell to every cell, moving up, down, left or right around blocked
// cells; -1 where there's no way through. One fill answers "how far is X" for every cell at once.
function distanceField(grid: GridSize, sources: Iterable<number>, blocked: Uint8Array): Int32Array {
  const { cols } = grid
  const size = cols * grid.rows
  const distance = new Int32Array(size).fill(-1)
  const queue = new Int32Array(size)
  let tail = 0
  for (const i of sources) {
    if (distance[i] !== -1) continue
    distance[i] = 0
    queue[tail++] = i
  }
  for (let head = 0; head < tail; head++) {
    const i = queue[head]
    const x = i % cols
    const d = distance[i] + 1
    const visit = (j: number) => {
      if (distance[j] !== -1 || blocked[j]) return
      distance[j] = d
      queue[tail++] = j
    }
    if (x > 0) visit(i - 1)
    if (x < cols - 1) visit(i + 1)
    if (i >= cols) visit(i - cols)
    if (i < size - cols) visit(i + cols)
  }
  return distance
}

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
// soon as) it gets home, or once its trail is as long as it allows. On a loop marked aggressive, it
// goes for the other rider's trail whenever it can get there before that rider gets home. Every pick
// is filtered for safety first: never off the board or into its own trail, never into a cell the
// other rider's head could take next unless that cell is its own ground (where it wins a head-on), and
// never into a cell with no way back home.
export function chooseTurfCpuMove(state: TurfState, seat: TurfSeat, difficulty: TurfCpuDifficulty, plan: TurfCpuPlan | null, rules: TurfRules = DEFAULT_TURF_RULES, random: () => number = Math.random): TurfCpuMove {
  const params = PARAMS[difficulty]
  const { grid, owner } = state
  const me = state.players[seat]
  const them = state.players[other(seat)]
  const at = (cell: GridCell) => cellIndex(cell, grid)
  const outside = me.trail.length > 0

  if (plan?.started && !outside) plan = null
  if (!plan && !outside) plan = makePlan(state, seat, params, random)
  if (plan && outside && !plan.started) plan = { ...plan, started: true }

  const myTrail = trailMask(grid, me.trail)
  const theirTrail = trailMask(grid, them.trail)
  const myBlocked = rules.ownTrailDeadly ? myTrail : new Uint8Array(myTrail.length)
  const theirBlocked = rules.ownTrailDeadly ? theirTrail : new Uint8Array(theirTrail.length)
  const home = distanceField(grid, groundCells(owner, seat), myBlocked)

  const candidates = [me.direction, LEFT_OF[me.direction], RIGHT_OF[me.direction]]
  const threatened = new Set([
    at(them.head),
    ...[them.direction, LEFT_OF[them.direction], RIGHT_OF[them.direction]]
      .map((d) => stepCell(them.head, d))
      .filter((c) => isInBounds(c, grid))
      .map(at)
  ])
  const safe = (d: Direction) => {
    const next = stepCell(me.head, d)
    if (!isInBounds(next, grid)) return false
    const i = at(next)
    if (myBlocked[i]) return false
    if (owner[i] === seat) return true
    if (threatened.has(i) && !theirTrail[i]) return false
    return home[i] >= 0
  }

  // Whether this loop can go for the other rider's trail: they're out, and it can get to their trail
  // before they get home (or before they could reach its own trail, when it's out too).
  const toMyTrail = outside ? stepsFrom(distanceField(grid, me.trail.map(at), theirBlocked), grid, them.head, them.direction) : -1
  let cutField: Int32Array | null = null
  if (plan?.aggressive && them.trail.length > 0) {
    const toTheirTrail = distanceField(grid, them.trail.map(at), myBlocked)
    const mine = stepsFrom(toTheirTrail, grid, me.head, me.direction)
    const theirHome = stepsFrom(distanceField(grid, groundCells(owner, other(seat)), theirBlocked), grid, them.head, them.direction)
    if (mine > 0 && (theirHome < 0 || mine < theirHome) && (toMyTrail < 0 || mine < toMyTrail)) cutField = toTheirTrail
  }

  // What it's riding toward this tick: a distance field to walk down, or a heading from the plan.
  let field: Int32Array | null = null
  let wanted: Direction | null = null
  if (cutField) field = cutField
  else if (outside) {
    const danger = toMyTrail >= 0 && toMyTrail - stepsFrom(home, grid, me.head, me.direction) <= params.margin
    if (danger || me.trail.length >= params.maxTrail || !plan || me.trail.length >= plan.depth + plan.width) field = home
    else wanted = me.trail.length < plan.depth ? plan.out : plan.side
  } else if (plan) wanted = plan.out

  const options = candidates.filter(safe)
  let direction: Direction
  if (options.length === 0) {
    // Nothing safe: anything that stays on the board and off its own trail, else straight on.
    direction = candidates.find((d) => isInBounds(stepCell(me.head, d), grid) && !myBlocked[at(stepCell(me.head, d))]) ?? me.direction
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

// Applies the CPU's choice as a turn for the next tick (a no-op when it's going straight on).
export function applyTurfCpu(state: TurfState, seat: TurfSeat, difficulty: TurfCpuDifficulty, plan: TurfCpuPlan | null, rules: TurfRules = DEFAULT_TURF_RULES, random: () => number = Math.random): { state: TurfState; plan: TurfCpuPlan | null } {
  if (state.phase !== 'playing' || !state.players[seat].alive) return { state, plan }
  const move = chooseTurfCpuMove(state, seat, difficulty, plan, rules, random)
  return { state: applyTurfTurn(state, seat, move.direction), plan: move.plan }
}
