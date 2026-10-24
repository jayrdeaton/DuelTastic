import type { Direction, GridCell, GridSize } from '@tastic/grid'

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

export interface TagOptions {
  rule: TagRule
  arena: TagArena
  roundSeconds: number
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
}

// What happened on the last tick, for sounds, haptics and flashes. Reset every tick.
export interface TagEvents {
  // The seat that was made It this tick, if anyone was tagged.
  tagged: TagSeat | null
  // Seats a wall or a pillar stopped this tick.
  blocked: TagSeat[]
}

export interface TagState {
  phase: TagPhase
  grid: GridSize
  pillars: TagPillar[]
  // The pillars' cells, row by row (index y * cols + x): 1 where nobody can ride.
  blocked: Uint8Array
  players: Record<TagSeat, TagPlayer>
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
