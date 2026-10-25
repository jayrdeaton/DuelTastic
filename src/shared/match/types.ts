import type { GridCell, GridSize } from '@tastic/grid'

export type { GridCell, GridSize }

// What every game in the pack plays on: two riders on a grid, steered with absolute swipes or keys,
// a match of rounds with the same countdown, result cards and dialogs (see shared/match).

export type Player = 1 | 2

export type Direction = 'up' | 'down' | 'left' | 'right'

// Which way the seats face each other on the board: top and bottom (a phone flat on a table), or
// left and right. The play screen always plays face to face (see MatchScreen).
export type OrientationMode = 'faceToFace' | 'sideBySide'

// A round against the CPU (seat 2), or two people on one device. None of the games has a solo mode.
export type GameMode = 'twoPlayer' | 'vsCpu'

export type SpeedTier = 'slow' | 'normal' | 'fast'

export type CpuDifficulty = 'easy' | 'normal' | 'hard'

export type GridSizeTier = 'small' | 'medium' | 'large'

// A seat's controls on desktop web. 'mouse' has no keys of its own: dragging steers and a click uses
// the powerup, which works on every seat whatever its scheme (TouchInputLayer.web.tsx's pointer
// listeners are always on), so picking it only turns that seat's keys off. Same five as Snake's.
export type KeyScheme = 'mouse' | 'wasd' | 'arrows' | 'ijkl' | 'numpad'

// The schemes that do have keys (@tastic/input's KeyScheme).
export type KeyboardScheme = Exclude<KeyScheme, 'mouse'>

export type GamePhase = 'onboarding' | 'playing' | 'roundOver'

export type RoundOutcome = { type: 'win'; winner: Player } | { type: 'draw' }

export interface TurnIntentEvent {
  player: Player
  direction: Direction
}

// The players who steer: seat 1, and seat 2 too in 2 Player (the CPU always plays seat 2).
export function humanPlayersFor(gameMode: GameMode): Player[] {
  return gameMode === 'vsCpu' ? [1] : [1, 2]
}
