import type { Direction, GridCell, GridSize } from '@tastic/grid'

import type { Effects, Pickup } from '../shared/powerups'

// Turf: two riders on one board, each starting on a small square of their own ground. Leaving it lays
// a trail; getting back to it claims the trail and everything the trail encloses, the other rider's
// ground included. A round ends on a crash, when one rider's ground is all taken (suffocated), or when
// the clock runs out (most ground wins).

export type TurfSeat = 1 | 2

export type TurfPhase = 'onboarding' | 'playing' | 'roundOver'

// Which way the seats face each other: top and bottom (a phone flat on a table), or left and right (a
// wide window). Decides where each rider's ground starts.
export type TurfLayout = 'faceToFace' | 'sideBySide'

// What a crash costs (the loadout's Crashes option). 'out' is the classic rule: the round is over.
// 'home' is the gentler one: the rider loses their trail and starts again on their own ground, so a
// round only ends on the clock or a suffocation.
export type TurfCrashRule = 'out' | 'home'

// Turf's powerups, Turf's names for the effects every game shares (src/games/shared/powerups.ts:
// same colors and icons everywhere; TURF_POWERUP_EFFECTS in constants.ts says which is which):
// - Dash (yours): double speed. LightCycles' Overdrive.
// - Frost (theirs): frozen in place. LightCycles' Stasis.
// - Fence (yours): for a while nothing but the board's edge crashes you: nobody can cut your trail,
//   you can cross your own, and a head-on never takes you out. LightCycles' Shield.
// - Sod (yours): the ground around your head becomes yours at once, which brings you home if you're
//   out, claiming your trail.
// - Tangle (theirs): their steering is reversed. LightCycles' Hack.
// - Gust (theirs): forced double speed. LightCycles' Overclock.
export type TurfPowerup = 'dash' | 'frost' | 'fence' | 'sod' | 'tangle' | 'gust'

export interface TurfRules {
  crash: TurfCrashRule
  // Whether riding into your own trail is a crash. When it isn't, a trail may cross itself.
  ownTrailDeadly: boolean
  // The powerups that can turn up on the board. None: powerups are off.
  powerups: TurfPowerup[]
}

export const DEFAULT_TURF_RULES: TurfRules = { crash: 'out', ownTrailDeadly: true, powerups: [] }

// A round's options as the loadout picks them: the rules plus the clock.
export interface TurfOptions extends TurfRules {
  roundSeconds: number
}

export type TurfEndReason = 'crash' | 'suffocation' | 'time'

export type TurfOutcome = { type: 'win'; winner: TurfSeat; reason: TurfEndReason } | { type: 'draw'; reason: TurfEndReason }

export interface TurfPlayer {
  head: GridCell
  direction: Direction
  pendingDirection: Direction | null
  // The cells laid since leaving their own ground, oldest first, the head's cell last. Empty while the
  // rider is on their own ground.
  trail: GridCell[]
  // The last cell of their own ground before the trail began, where 'home' sends them back to (when
  // it's still theirs). Null while they're on their own ground.
  leftFrom: GridCell | null
  alive: boolean
  // Where the rider crashed (null when they didn't): the cell they hit, which is off the board for a
  // wall.
  crashCell: GridCell | null
  // The powerup they're holding, used with a tap or their powerup key. One at a time: picking up
  // another swaps it.
  held: TurfPowerup | null
  effects: Effects
}

// What happened on the last tick, for sounds, haptics and flashes. Reset every tick.
export interface TurfEvents {
  // Cells each seat claimed by getting back to its ground.
  captured: Record<TurfSeat, number>
  crashed: TurfSeat[]
  // Seats a crash sent back to their ground (the 'home' rule).
  sentHome: TurfSeat[]
  // Seats that picked up a powerup.
  collected: TurfSeat[]
}

export interface TurfState {
  phase: TurfPhase
  grid: GridSize
  // Who owns each cell, row by row (index y * cols + x): 0 for nobody, else the seat.
  owner: Uint8Array
  // How many cells each seat owns, kept in step with `owner`.
  ground: Record<TurfSeat, number>
  players: Record<TurfSeat, TurfPlayer>
  // At most one, when powerups are on.
  pickups: Pickup<TurfPowerup>[]
  outcome: TurfOutcome | null
  tick: number
  events: TurfEvents
}
