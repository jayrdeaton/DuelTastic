import { EFFECT_ICONS, type EffectKind } from '../shared/powerups'
import type { TurfOptions, TurfPowerup } from './types'

// Milliseconds per cell at LightCycles' medium cell size (8px), scaled to the round's real cell size
// the same way LightCycles' speeds are (see constants/game.ts's scaleMsForCellPx), so a rider covers
// the same distance on screen per second at any grid size. Slower than LightCycles' own speeds: a
// loop has to be planned and brought home, not just survived.
export const TURF_SPEED_INTERVAL_MS = { slow: 120, normal: 90, fast: 66 } as const

export const TURF_ROUND_SECONDS = [60, 120, 180] as const

export const DEFAULT_TURF_OPTIONS: TurfOptions = { crash: 'out', ownTrailDeadly: true, powerups: [], roundSeconds: 120 }

// Saved options with every field filled in. Read them through this: options saved before a field
// existed don't have it, and the settings slice only fills in missing top-level settings.
export const withTurfDefaults = (saved: Partial<TurfOptions> | undefined): TurfOptions => ({ ...DEFAULT_TURF_OPTIONS, ...saved })

// The most a single frame may count toward the round clock, so a stalled frame (the app pausing on a
// slow device, a debugger) can't eat seconds off the clock in one go.
export const TURF_MAX_CLOCK_STEP_MS = 250

// How long the round's end holds on the board before its result card shows.
export const TURF_RESULT_HOLD_MS = 900

// ─── Powerups ───────────────────────────────────────────────────────────────

export const TURF_POWERUPS: TurfPowerup[] = ['dash', 'frost', 'mud', 'fence', 'sod', 'tangle', 'gust']

// Ticks a timed powerup lasts, at about 11 ticks a second on the normal speed (the same seconds as
// LightCycles' for the effects both have, except Fence, which gets longer than Shield: it has to
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
