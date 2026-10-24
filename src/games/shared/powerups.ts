import { type GridCell, type GridSize, isInBounds } from '@tastic/grid'

// What every DuelTastic game's powerups share, whatever each game calls them: what an effect does
// and how it times out, where a mystery box turns up and how it's picked up, the CPU's sums about
// them, and the colors and icons that say which effect is which. LightCycles' own older powerup code
// reads its colors, icons, pickup radius and box sizing from here too (constants/game.ts), so a
// Frost in Turf and a Stasis in LightCycles look the same. Moves to the pack's shared/ with the games.

// ─── Effects ────────────────────────────────────────────────────────────────

// What a powerup does. Each game names its own (Turf's Dash and Tag's Dash are boosts, LightCycles'
// Hack is a reverse):
// - boost: the rider who used it rides at double speed.
// - freeze: the other rider stands still.
// - rush: the other rider is forced to double speed.
// - reverse: the other rider's steering is reversed.
// - shield: protects the rider who used it; from what is each game's (crashes in Turf, being tagged
//   in Tag).
export type EffectKind = 'boost' | 'freeze' | 'rush' | 'reverse' | 'shield'

export type SpeedKind = 'boost' | 'freeze' | 'rush'

// Who an effect lands on: the rider who used it, or the other one.
export const EFFECT_TARGETS: Record<EffectKind, 'self' | 'other'> = { boost: 'self', freeze: 'other', rush: 'other', reverse: 'other', shield: 'self' }

// The ring around an affected head, keyed by what's driving the effect, so being sped up by your own
// boost reads differently from a rush forced on you.
export const EFFECT_COLORS: Record<EffectKind, string> = {
  boost: '#FFC107', // gold: your own speed-up
  freeze: '#29B6F6', // ice blue: frozen
  rush: '#E53935', // red: danger, forced on you
  reverse: '#AB47BC', // violet: your steering's been tampered with
  shield: '#26C6DA' // bright cyan: protected
}

// The held powerup's icon in its holder's badge (MDI names). The box on the board never shows it.
export const EFFECT_ICONS: Record<EffectKind, string> = { boost: 'speedometer', freeze: 'pause-circle-outline', rush: 'chip', reverse: 'swap-horizontal-bold', shield: 'shield-outline' }

// An effect lasts through the tick `expiresAtTick` and is gone after it.
export interface TimedEffect {
  expiresAtTick: number
}

// What's on a rider: one speed effect at a time (a new one replaces it, so a boost thaws a freeze),
// a reverse and a shield.
export interface Effects {
  speed: (TimedEffect & { kind: SpeedKind }) | null
  reverse: TimedEffect | null
  shield: TimedEffect | null
}

export const NO_EFFECTS = (): Effects => ({ speed: null, reverse: null, shield: null })

export const isActive = (effect: TimedEffect | null, tick: number) => effect !== null && tick <= effect.expiresAtTick

// How many times its usual pace a rider rides on tick `tick`: 0 frozen, 2 boosted or rushed, else 1.
export function speedMultiplier(effects: Effects, tick: number): 0 | 1 | 2 {
  if (!effects.speed || !isActive(effects.speed, tick)) return 1
  return effects.speed.kind === 'freeze' ? 0 : 2
}

export const isFrozen = (effects: Effects, tick: number) => speedMultiplier(effects, tick) === 0

export const isShielded = (effects: Effects, tick: number) => isActive(effects.shield, tick)

// Ticks an effect has left after tick `tick`; 0 when there isn't one.
export const ticksLeft = (effect: TimedEffect | null, tick: number) => (effect ? Math.max(0, effect.expiresAtTick - tick) : 0)

// An effect added until `expiresAtTick`, replacing one of the same sort.
export function addEffect(effects: Effects, kind: EffectKind, expiresAtTick: number): Effects {
  if (kind === 'reverse') return { ...effects, reverse: { expiresAtTick } }
  if (kind === 'shield') return { ...effects, shield: { expiresAtTick } }
  return { ...effects, speed: { kind, expiresAtTick } }
}

// The effects still going after tick `tick`, for the end of it.
export function expireEffects(effects: Effects, tick: number): Effects {
  const keep = <T extends TimedEffect>(effect: T | null) => (effect && tick >= effect.expiresAtTick ? null : effect)
  return { speed: keep(effects.speed), reverse: keep(effects.reverse), shield: keep(effects.shield) }
}

export interface PowerupHolder {
  held: string | null
  effects: Effects
}

// Uses a held powerup's effect: on its holder or the other rider (EFFECT_TARGETS), until
// `expiresAtTick`, emptying the holder's slot.
export function activateEffect<P extends PowerupHolder>(players: Record<1 | 2, P>, seat: 1 | 2, kind: EffectKind, expiresAtTick: number): Record<1 | 2, P> {
  const target = EFFECT_TARGETS[kind] === 'self' ? seat : seat === 1 ? 2 : 1
  const emptied = { ...players, [seat]: { ...players[seat], held: null } }
  return { ...emptied, [target]: { ...emptied[target], effects: addEffect(emptied[target].effects, kind, expiresAtTick) } }
}

// ─── Pickups ────────────────────────────────────────────────────────────────

// A powerup waiting on the board. What it is stays hidden until someone picks it up.
export interface Pickup<T extends string> {
  id: string
  type: T
  cell: GridCell
}

// A rider picks a box up by passing within this many cells of it, straight or diagonally: the box is
// drawn wider than a cell.
export const PICKUP_RADIUS_CELLS = 1

// The box on the board: never smaller than this, however small the cells, and animated in when it
// turns up, then pulsing until it's picked up.
export function pickupRadiusPx(cellPx: number): number {
  return Math.max(cellPx * 1.8, 9)
}
export const PICKUP_SPAWN_FADE_MS = 260
export const PICKUP_PULSE_DURATION_MS = 900
export const PICKUP_PULSE_SCALE = 0.16

// The cells a box is picked up from (its own and the ring round it, on the board), row by row.
export function pickupFootprint(cell: GridCell, grid: GridSize): number[] {
  const cells: number[] = []
  for (let dy = -PICKUP_RADIUS_CELLS; dy <= PICKUP_RADIUS_CELLS; dy++) {
    for (let dx = -PICKUP_RADIUS_CELLS; dx <= PICKUP_RADIUS_CELLS; dx++) {
      const c = { x: cell.x + dx, y: cell.y + dy }
      if (isInBounds(c, grid)) cells.push(c.y * grid.cols + c.x)
    }
  }
  return cells
}

// The box a head is within reach of, if any, and the boxes left once it's taken.
export function takePickup<T extends string>(pickups: Pickup<T>[], head: GridCell): { taken: Pickup<T>; rest: Pickup<T>[] } | null {
  const taken = pickups.find((p) => Math.abs(p.cell.x - head.x) <= PICKUP_RADIUS_CELLS && Math.abs(p.cell.y - head.y) <= PICKUP_RADIUS_CELLS)
  return taken ? { taken, rest: pickups.filter((p) => p.id !== taken.id) } : null
}

// A box turns up at least this many cells (straight or diagonally) from either head, so it's never
// handed to whoever happens to be next to it.
export const PICKUP_MIN_DISTANCE = 4
// How much nearer one rider a box may turn up than the other, in steps.
export const PICKUP_FAIR_SLACK = 2
// How much further from the riders than the nearest fair cell a box may turn up, in steps, so it's
// somewhere between them rather than anywhere along the line that's as far from each.
export const PICKUP_SPREAD = 12
// Cells kept clear of boxes along each edge, where the glyph would hang off the board.
export const PICKUP_EDGE_MARGIN = 2

export interface PickupPlacement {
  grid: GridSize
  heads: readonly [GridCell, GridCell]
  // Cells a box's footprint has to keep clear of (a trail in Turf, a pillar in Tag).
  blocked: (index: number) => boolean
  // Cells it would rather be on when any fit (nobody's ground in Turf, so going for it means leaving
  // home).
  preferred?: (index: number) => boolean
}

// A cell for the next box: about as far from one head as the other, so neither rider is handed it,
// and not much further from them than it has to be, never right next to either, never at the edge,
// with its footprint clear. Falls back to any cell that fits; null when none does.
export function pickupCell({ grid, heads, blocked, preferred = () => true }: PickupPlacement, random: () => number): GridCell | null {
  const m = PICKUP_EDGE_MARGIN
  // Best first: fair and preferred, fair, preferred, anywhere. Each cell with its steps from the
  // nearer head.
  const pools: { cell: GridCell; steps: number }[][] = [[], [], [], []]
  for (let y = m; y < grid.rows - m; y++) {
    for (let x = m; x < grid.cols - m; x++) {
      if (heads.some((h) => Math.max(Math.abs(h.x - x), Math.abs(h.y - y)) < PICKUP_MIN_DISTANCE)) continue
      if (pickupFootprint({ x, y }, grid).some(blocked)) continue
      const a = Math.abs(heads[0].x - x) + Math.abs(heads[0].y - y)
      const b = Math.abs(heads[1].x - x) + Math.abs(heads[1].y - y)
      const fair = Math.abs(a - b) <= PICKUP_FAIR_SLACK
      const liked = preferred(y * grid.cols + x)
      pools[fair ? (liked ? 0 : 1) : liked ? 2 : 3].push({ cell: { x, y }, steps: Math.min(a, b) })
    }
  }
  const pool = pools.find((p) => p.length > 0)
  if (!pool) return null
  const nearest = Math.min(...pool.map((c) => c.steps))
  const near = pool.filter((c) => c.steps <= nearest + PICKUP_SPREAD)
  return near[Math.floor(random() * near.length)].cell
}

// A new box on `cell`, its powerup picked from the round's. The id is the tick and the cell, which is
// already unique (no clock or uuid, so engines stay pure).
export function newPickup<T extends string>(tick: number, cell: GridCell, powerups: readonly T[], random: () => number): Pickup<T> {
  return { id: `pu-${tick}-${cell.x}-${cell.y}`, type: powerups[Math.floor(random() * powerups.length)], cell }
}

// ─── The CPU ────────────────────────────────────────────────────────────────

// Ticks for a rider to cover `steps` cells after tick `tick`: a freeze still to run out comes first,
// and a boost or rush covers two cells a tick while it lasts. No way there (-1) stays -1.
export function ticksFor(steps: number, effects: Effects, tick: number): number {
  if (steps < 0) return -1
  const speed = effects.speed
  const left = ticksLeft(speed, tick)
  if (!speed || left <= 0) return steps
  if (speed.kind === 'freeze') return left + steps
  const fast = Math.min(left, Math.ceil(steps / 2))
  return fast + Math.max(0, steps - 2 * fast)
}

// How often a CPU with its steering reversed notices and steers to make up for it, by level: hard
// always shrugs it off, normal mostly, easy never (a decision-quality knob, as LightCycles' Hack has
// always been).
export const REVERSE_COMPENSATION_CHANCE: Record<'easy' | 'normal' | 'hard', number> = { easy: 0, normal: 0.6, hard: 1 }

// Whether a CPU with its steering reversed makes up for it this tick. Chances of exactly 0 or 1 skip
// the roll, so they never use up a random number.
export function compensatesForReverse(difficulty: 'easy' | 'normal' | 'hard', random: () => number): boolean {
  const chance = REVERSE_COMPENSATION_CHANCE[difficulty]
  if (chance <= 0) return false
  if (chance >= 1) return true
  return random() < chance
}
