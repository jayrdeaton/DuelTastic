import type { TurfOptions } from './types'

// Milliseconds per cell at LightCycles' medium cell size (8px), scaled to the round's real cell size
// the same way LightCycles' speeds are (see constants/game.ts's scaleMsForCellPx), so a rider covers
// the same distance on screen per second at any grid size. Slower than LightCycles' own speeds: a
// loop has to be planned and brought home, not just survived.
export const TURF_SPEED_INTERVAL_MS = { slow: 120, normal: 90, fast: 66 } as const

export const TURF_ROUND_SECONDS = [60, 120, 180] as const

export const DEFAULT_TURF_OPTIONS: TurfOptions = { crash: 'out', ownTrailDeadly: true, roundSeconds: 120 }

// The most a single frame may count toward the round clock, so a stalled frame (the app pausing on a
// slow device, a debugger) can't eat seconds off the clock in one go.
export const TURF_MAX_CLOCK_STEP_MS = 250

// How long the round's end holds on the board before its result card shows.
export const TURF_RESULT_HOLD_MS = 900
