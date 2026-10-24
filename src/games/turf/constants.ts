import { POWERUP_EFFECT_COLORS, POWERUP_ICONS } from '@/constants/game'

import type { TurfOptions, TurfPowerup } from './types'

// Milliseconds per cell at LightCycles' medium cell size (8px), scaled to the round's real cell size
// the same way LightCycles' speeds are (see constants/game.ts's scaleMsForCellPx), so a rider covers
// the same distance on screen per second at any grid size. Slower than LightCycles' own speeds: a
// loop has to be planned and brought home, not just survived.
export const TURF_SPEED_INTERVAL_MS = { slow: 120, normal: 90, fast: 66 } as const

export const TURF_ROUND_SECONDS = [60, 120, 180] as const

export const DEFAULT_TURF_OPTIONS: TurfOptions = { crash: 'out', ownTrailDeadly: true, powerups: [], roundSeconds: 120 }

// The most a single frame may count toward the round clock, so a stalled frame (the app pausing on a
// slow device, a debugger) can't eat seconds off the clock in one go.
export const TURF_MAX_CLOCK_STEP_MS = 250

// How long the round's end holds on the board before its result card shows.
export const TURF_RESULT_HOLD_MS = 900

// ─── Powerups ───────────────────────────────────────────────────────────────

export const TURF_POWERUPS: TurfPowerup[] = ['dash', 'frost', 'fence', 'sod', 'tangle', 'gust']

// Ticks a timed powerup lasts, at about 11 ticks a second on the normal speed (the same seconds as
// LightCycles' for the effects both have, except Fence, which gets longer than Shield: it has to
// cover a loop home).
export const TURF_EFFECT_TICKS: Record<'dash' | 'frost' | 'fence' | 'tangle' | 'gust', number> = {
  dash: 28, // about 2.5s
  frost: 16, // about 1.5s
  fence: 45, // about 4s
  tangle: 22, // about 2s
  gust: 22 // about 2s
}

// Sod claims the square this many cells out from the head: 2 gives 5 x 5.
export const TURF_SOD_RADIUS = 2

// A pickup turns up at least this many cells (in a straight or diagonal line) from either head, so
// it's never handed to whoever happens to be next to it.
export const TURF_PICKUP_MIN_DISTANCE = 4

// The same colors and icons as LightCycles' and Snake's effects; only the names are Turf's.
export const TURF_EFFECT_COLORS: Record<'dash' | 'frost' | 'fence' | 'tangle' | 'gust', string> = {
  dash: POWERUP_EFFECT_COLORS.overdrive,
  frost: POWERUP_EFFECT_COLORS.stasis,
  fence: POWERUP_EFFECT_COLORS.shield,
  tangle: POWERUP_EFFECT_COLORS.hack,
  gust: POWERUP_EFFECT_COLORS.overclock
}

export const TURF_POWERUP_ICONS: Record<TurfPowerup, string> = {
  dash: POWERUP_ICONS.overdrive,
  frost: POWERUP_ICONS.stasis,
  fence: POWERUP_ICONS.shield,
  sod: 'grass',
  tangle: POWERUP_ICONS.hack,
  gust: POWERUP_ICONS.overclock
}
