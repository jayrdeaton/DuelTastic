import { EFFECT_ICONS, type EffectKind } from '@/shared/powerups'

import type { TurfOptions, TurfPowerup } from './types'

// Milliseconds per cell at Trap's medium cell size (8px), scaled to the round's real cell size
// the same way Trap's speeds are (see constants/game.ts's scaleMsForCellPx), so a rider covers
// the same distance on screen per second at any grid size. Slower than Trap's own speeds: a
// loop has to be planned and brought home, not just survived.
export const TURF_SPEED_INTERVAL_MS = { slow: 120, normal: 90, fast: 66 } as const

export const TURF_ROUND_SECONDS = [60, 120, 180] as const

export const DEFAULT_TURF_OPTIONS: TurfOptions = { arena: 'open', crash: 'out', ownTrailDeadly: true, powerups: [], roundSeconds: 120 }

// The most a single frame may count toward the round clock, so a stalled frame (the app pausing on a
// slow device, a debugger) can't eat seconds off the clock in one go.
export const TURF_MAX_CLOCK_STEP_MS = 250

// How long a round that ends on the clock holds on the board before its result card shows (a crash
// waits for its own animation, deathAnimationDurationMs).
export const TURF_RESULT_HOLD_MS = 900

// A trail's opacity, over the board and over ground, which is solid: the lighter layer, so ground
// reads as owned turf first. The board and How to Play's art both draw it.
export const TURF_TRAIL_OPACITY = 0.4

// Under Crash Sends Home, the ticks a crashed rider takes to fly home, standing still there until it
// lands: about 0.9s at the normal speed. The same however far it flies, so a crash costs the same
// wherever it happens.
export const TURF_FLIGHT_TICKS = 10

// ─── Powerups ───────────────────────────────────────────────────────────────

export const TURF_POWERUPS: TurfPowerup[] = ['dash', 'frost', 'mud', 'fence', 'sod', 'tangle', 'gust']

// Ticks a timed powerup lasts, at about 11 ticks a second on the normal speed (the same seconds as
// Trap's for the effects both have, except Fence, which gets longer than Shield: it has to
// cover a loop home).
export const TURF_EFFECT_TICKS: Record<Exclude<TurfPowerup, 'sod'>, number> = {
  dash: 28, // about 2.5s
  frost: 16, // about 1.5s
  mud: 33, // about 3s at half speed
  fence: 45, // about 4s
  tangle: 22, // about 2s
  gust: 22 // about 2s
}

// Sod claims the square this many cells out from the head: 2 gives 5 x 5.
export const TURF_SOD_RADIUS = 2

// What each of Turf's timed powerups does (Sod is Turf's own and happens at once).
export const TURF_POWERUP_EFFECTS: Record<Exclude<TurfPowerup, 'sod'>, EffectKind> = { dash: 'boost', frost: 'freeze', mud: 'slow', fence: 'shield', tangle: 'reverse', gust: 'rush' }

// Every game's icon for its effect, and a patch of grass for Sod.
export const TURF_POWERUP_ICONS: Record<TurfPowerup, string> = {
  dash: EFFECT_ICONS.boost,
  frost: EFFECT_ICONS.freeze,
  mud: EFFECT_ICONS.slow,
  fence: EFFECT_ICONS.shield,
  sod: 'grass',
  tangle: EFFECT_ICONS.reverse,
  gust: EFFECT_ICONS.rush
}
