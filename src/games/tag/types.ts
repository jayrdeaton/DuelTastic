import type { Direction, GridCell, GridSize } from '@tastic/grid'

import type { Effects, Pickup } from '../shared/powerups'

// Tag: two riders on one board, one of them It. It touches the other rider (passing within a cell of
// them) to make them It instead, and the new It stands frozen for a moment while the other gets away
// (no tag-backs). Nothing crashes: the board's edge and its pillars just stop a rider until they turn,
// and with no trail to run into, a rider can turn straight back. The clock decides the round.

export type TagSeat = 1 | 2

export type TagPhase = 'onboarding' | 'playing' | 'roundOver'

// Which way the seats face each other: top and bottom (a phone flat on a table), or left and right (a
// wide window). Decides where each rider starts.
export type TagLayout = 'faceToFace' | 'sideBySide'

// How the clock decides the round (the loadout's Rules). 'hotPotato': whoever's It when time runs out
// loses. 'leastIt': whoever spent less of the round as It wins.
export type TagRule = 'hotPotato' | 'leastIt'

// What's on the board besides the riders: nothing, or pillars to run around.
export type TagArena = 'open' | 'pillars'

// Tag's powerups, Tag's names for the effects every game shares (src/games/shared/powerups.ts: same
// colors and icons everywhere; TAG_POWERUP_EFFECTS in constants.ts says which is which):
// - Dash (yours): double speed.
// - Freeze (theirs): they stand still, and a frozen It can't tag.
// - Mud (theirs): half speed for a while, a longer, softer Freeze (a slowed It can still tag).
// - Safe (yours): nobody can tag you for a while. Only while you're running: tapped as It, it stays
//   held for when you're not.
// - Tangle (theirs): their steering is reversed.
// No forced speed-up (Turf's Gust): with nothing to crash into, it would only ever help its target.
export type TagPowerup = 'dash' | 'freeze' | 'mud' | 'safe' | 'tangle'

export interface TagOptions {
  rule: TagRule
  arena: TagArena
  roundSeconds: number
  // The powerups that can turn up on the board. None: powerups are off.
  powerups: TagPowerup[]
}

export type TagOutcome = { type: 'win'; winner: TagSeat } | { type: 'draw' }

// A block of cells nobody can ride through.
export interface TagPillar {
  x: number
  y: number
  width: number
  height: number
}

export interface TagPlayer {
  head: GridCell
  direction: Direction
  pendingDirection: Direction | null
  // The last few cells it rode through, oldest first, the head's cell last: the short tail drawn
  // behind it. Nothing collides with it.
  recent: GridCell[]
  // How far through its next step it is, in hundredths of a cell. It rides a little faster than the
  // other rider, so its steps come more often (see TAG_IT_SPEED).
  stride: number
  // The powerup it's holding, used with a tap or its powerup key. One at a time: picking up another
  // swaps it.
  held: TagPowerup | null
  effects: Effects
}

// What happened on the last tick, for sounds, haptics and flashes. Reset every tick.
export interface TagEvents {
  // The seat that was made It this tick, if anyone was tagged.
  tagged: TagSeat | null
  // Seats a wall or a pillar stopped this tick.
  blocked: TagSeat[]
  // Seats that picked up a powerup.
  collected: TagSeat[]
}

export interface TagState {
  phase: TagPhase
  grid: GridSize
  pillars: TagPillar[]
  // The pillars' cells, row by row (index y * cols + x): 1 where nobody can ride.
  blocked: Uint8Array
  players: Record<TagSeat, TagPlayer>
  // At most one, when powerups are on.
  pickups: Pickup<TagPowerup>[]
  it: TagSeat
  // It stands frozen, and can't tag, through this tick: the other rider's head start after a tag.
  frozenThrough: number
  // Ticks each seat has spent as It this round.
  itTicks: Record<TagSeat, number>
  tags: number
  outcome: TagOutcome | null
  tick: number
  events: TagEvents
}
