import type { GridCell, GridSize } from '@tastic/grid'

import type { CpuDifficulty, Direction, GameMode, GamePhase, GridSizeTier, KeyScheme, Player, RoundOutcome, SpeedTier } from '@/shared/match/types'

// The types every game shares, re-exported so LightCycles' own files read them from one place.
export type { CpuDifficulty, Direction, GameMode, GamePhase, GridCell, GridSize, GridSizeTier, KeyboardScheme, KeyScheme, OrientationMode, Player, RoundOutcome, SpeedTier, TurnIntentEvent } from '@/shared/match/types'

// Selectable static obstacle layout for the round's board - see utils/arenas.ts's
// buildArenaObstacles, the sole place these are turned into actual GridCell obstacles. 'open' is
// the original, fully-open rectangle (empty obstacle list) and stays the default everywhere a
// caller doesn't specify otherwise (see gameEngine.ts's createInitialGameState). 'portals' and
// 'underpass' don't produce obstacles at all (see buildArenaObstacles' own branch for each) - their
// geometry lives on GameState.portals/.tunnels instead, since neither one blocks movement the way
// every other variant's obstacle cells do.
export type ArenaVariant = 'open' | 'pillars' | 'gauntlet' | 'portals' | 'underpass'

// How fast the trail's tail chases the head, not the visible outcome - describing the outcome (a
// fixed "short"/"full" length) would read backwards, since the trail never actually settles at any
// fixed length under any tier - it still grows without bound, just slower than 1:1 when the tail
// follows. 'off' matches the game's original behavior: the tail never follows at all, so the trail
// is the entire path since spawn - see constants/game.ts's TRAIL_SPEED_RATE and gameEngine.ts's
// shouldTrimTrailAt for the mechanics.
export type TrailSpeedTier = 'off' | 'medium' | 'fast'

// Overdrive is a self-targeted speed effect (2x); Overclock and Stasis are both opponent-targeted
// (2x/0x respectively - see gameEngine.ts's applyActivation) - kept as their own literals (not
// merged into Overdrive) so a boosted/frozen head can be told apart as "helping you" vs "done to
// you" for the on-board tell and CPU reasoning, even where the multiplier would otherwise match.
export type PowerupType = 'overdrive' | 'stasis' | 'shield' | 'prune' | 'hack' | 'overclock'

export interface SpeedEffect {
  type: 'overdrive' | 'stasis' | 'overclock'
  multiplier: 0 | 2
  // Absolute tick number this effect is in force through - tick-based (not a wall-clock
  // timestamp) to match the deterministic pure-tick model everything else here uses (see
  // shouldTrimTrailAt). Computed once at activation as `state.tick + duration` and never mutated
  // thereafter; tickGame just compares against it every tick.
  expiresAtTick: number
}

export interface ControlEffect {
  type: 'hack'
  expiresAtTick: number
}

export interface ShieldEffect {
  expiresAtTick: number
}

// One active effect per axis - a same-axis activation replaces whatever was already there rather
// than stacking (see applyActivation), which is what lets a landed Stasis instantly overwrite an
// existing Overclock (or vice versa) with a fresh timer instead of the two coexisting. Different
// axes coexist independently. Prune has no entry here at all - it's instant/one-shot, never an
// ongoing effect.
export interface PlayerEffects {
  speed: SpeedEffect | null
  control: ControlEffect | null
  shield: ShieldEffect | null
}

export interface PowerupPickup {
  id: string
  // Decided at spawn time (not collection) for simplicity - see GameBoard.tsx's Powerups layer,
  // which deliberately ignores this field and renders every live pickup identically, Mario-Kart
  // mystery-box style. Only revealed once collected, in the holder's own HUD badge.
  type: PowerupType
  cell: GridCell
}

// A linked pair of cells for the 'portals' arena (see utils/arenas.ts's buildArenaPortals) -
// stepping onto either one instantly redirects the mover to the other, continuing in the same
// direction, before any collision check runs (see gameEngine.ts's tickGame). Symmetric: `a` and
// `b` are interchangeable, neither is "the" entrance.
export interface Portal {
  a: GridCell
  b: GridCell
}

// A short, straight corridor for the 'underpass' arena (see utils/arenas.ts's buildArenaTunnels),
// ordered mouth-to-mouth. Traversing it checks collision against a separate underground-occupancy
// set instead of the surface one (see gameEngine.ts's buildTunnelOccupiedSet), so a tunnel-
// traveler and a surface trail can legitimately share the same coordinate without colliding.
// Direction of travel is unconstrained - either mouth, either direction - since `cells[i]` and
// `cells[i+1]` are always real geometric neighbors by construction.
export interface Tunnel {
  cells: GridCell[]
}

export interface PlayerState {
  // Ordered cells the cycle has occupied, oldest first - trail[trail.length - 1] is the head.
  trail: GridCell[]
  direction: Direction
  // A turn queued by input but not yet applied - consumed (and cleared) on the next tick, so a
  // swipe that lands between ticks isn't dropped and can't apply more than one turn per tick.
  pendingDirection: Direction | null
  alive: boolean
  color: string
  // Single-slot inventory - null when empty. Set on pickup collection, cleared on activation.
  heldPowerup: PowerupType | null
  effects: PlayerEffects
  // The cell this player actually attempted to move into on the tick they crashed - set once, in
  // tickGame's crash branch, and never touched again after. Unlike `trail` above, this is populated
  // even for an out-of-bounds crash, whose true destination has no `trail` slot to append to (it
  // doesn't exist on the grid) but is still exactly what GameBoard.tsx's death explosion needs to
  // center on: a GridCell just past the boundary is meaningless as board state, but perfectly fine
  // as a pixel coordinate (cellToPixel is pure arithmetic). Null while alive, and stays null forever
  // for a player who wins outright (never crashed this round).
  crashCell: GridCell | null
}

// LightCycles' loadout, saved per player (see redux/settingsSlice.ts): the match settings seat 1's
// player last set up, and each seat's controls.
export interface Settings {
  speedTier: SpeedTier
  speedRampEnabled: boolean
  cpuDifficulty: CpuDifficulty
  gridSizeTier: GridSizeTier
  trailSpeedTier: TrailSpeedTier
  // Each seat's controls on desktop web (see TouchInputLayer.web.tsx); native ignores them.
  controlScheme: Record<Player, KeyScheme>
  // Which powerup types can spawn this round - not a separate on/off flag: "powerups off" is just
  // an empty array (see gameEngine.ts's maybeSpawnPickup, which only ever spawns from this list),
  // so a single multi-select control (see SectionedDropdown.tsx) covers both at once.
  enabledPowerups: PowerupType[]
  // Static obstacle layout for the round's board - see utils/arenas.ts's buildArenaObstacles.
  arenaVariant: ArenaVariant
  // Labeled "Full Screen" in the loadout: whether the board bleeds all the way to the physical
  // screen edge, or stays inset by the device's safe area (notch/home indicator) plus a
  // @tastic/core gutter on anything wider than MAX_BOARD_CONTENT_WIDTH (see shared/match's
  // MatchScreen). Left out of Randomize: it's how the board fits a screen, not a game variant.
  extendIntoSafeArea: boolean
  // Pac-Man-style screen wrap: stepping off one edge of the grid re-enters from the opposite edge
  // instead of crashing (see grid.ts's wrapCell and gameEngine.ts's tickGame, which applies it
  // before the usual out-of-bounds check). GameBoard.tsx's boundary outline is hidden whenever this
  // is on, since edges stop being fatal.
  wrapEdges: boolean
}

// The settings a round plays with: the loadout's, plus who seat 2 is (the CPU or a person).
export interface RoundSettings extends Settings {
  gameMode: GameMode
}

export interface GameState {
  phase: GamePhase
  grid: GridSize
  players: Record<Player, PlayerState>
  outcome: RoundOutcome | null
  // Ticks elapsed since 'playing' started - GameBoard.tsx's head-glide animation keys off this
  // rather than trail length, since a laggy trailSpeedTier can leave trail length unchanged on a
  // tick that both grows and trims it (see gameEngine.ts's tickGame).
  tick: number
  // Board-wide, not per-player - at most one entry at a time (see gameEngine.ts's
  // maybeSpawnPickup), so a linear scan is fine.
  pickups: PowerupPickup[]
  // Static per-round obstacle layout from the selected ArenaVariant (see utils/arenas.ts's
  // buildArenaObstacles) - computed once in createInitialGameState and never mutated after, unlike
  // pickups.
  obstacles: GridCell[]
  // Static per-round portal pair from the 'portals' ArenaVariant (see utils/arenas.ts's
  // buildArenaPortals) - empty for every other variant. Computed once in createInitialGameState and
  // never mutated after, same as `obstacles`.
  portals: Portal[]
  // Static per-round tunnel corridor from the 'underpass' ArenaVariant (see utils/arenas.ts's
  // buildArenaTunnels) - empty for every other variant. Computed once in createInitialGameState and
  // never mutated after, same as `obstacles`.
  tunnels: Tunnel[]
  // Cells inside the round's device safe-area margin (see gameEngine.ts's buildUnsafeAreaCells) -
  // only non-empty when the round is bleeding under that margin (extendIntoSafeArea; see
  // Settings' own comment), since otherwise the board's own pixel container already stops short
  // of the inset and every cell is already clear of it. A pickup never spawns here (see
  // maybeSpawnPickup) because a notch/Dynamic Island/home-indicator/speaker cutout can physically
  // hide it there - the board itself stays fully traversable, same as any other cosmetically-
  // obscured cell. Computed once in createInitialGameState and never mutated after, same as
  // `obstacles`.
  unsafeCells: GridCell[]
}
