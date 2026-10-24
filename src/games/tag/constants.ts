import type { GridSizeTier, SpeedTier } from '@/types'

import { EFFECT_ICONS, type EffectKind } from '../shared/powerups'
import type { TagOptions, TagPowerup } from './types'

// Tag's cells are much bigger than LightCycles' and Turf's: a chase wants a board a rider can cross
// in a few seconds, not a field to fill. Picked by the loadout's shared grid size.
export const TAG_CELL_PX: Record<GridSizeTier, number> = { small: 16, medium: 22, large: 30 }

// Milliseconds per cell for the loadout's shared speed. Not scaled to the cell size: Tag's pace is
// cells a second, so a bigger board takes longer to cross.
export const TAG_SPEED_INTERVAL_MS: Record<SpeedTier, number> = { slow: 150, normal: 115, fast: 90 }

// How much faster It rides than the other rider, so a chase can end without a corner.
export const TAG_IT_SPEED = 1.15

// Ticks a new It stands frozen after being tagged (about a second and a half at the normal speed):
// the other rider's head start, and what stops an instant tag-back.
export const TAG_FREEZE_TICKS = 13

// How many cells of tail are drawn behind each rider.
export const TAG_TAIL_CELLS = 5

export const TAG_ROUND_SECONDS = [30, 60, 90] as const

export const DEFAULT_TAG_OPTIONS: TagOptions = { rule: 'hotPotato', arena: 'pillars', roundSeconds: 60, powerups: [] }

// Saved options with every field filled in. Read them through this: options saved before a field
// existed don't have it, and the settings slice only fills in missing top-level settings.
export const withTagDefaults = (saved: Partial<TagOptions> | undefined): TagOptions => ({ ...DEFAULT_TAG_OPTIONS, ...saved })

// The most a single frame may count toward the round clock (a stalled frame can't eat seconds).
export const TAG_MAX_CLOCK_STEP_MS = 250

// How long the round's end holds on the board before its result card shows.
export const TAG_RESULT_HOLD_MS = 700

// Pillars: 2 x 2 blocks this many cells apart, kept this far off the edge.
export const TAG_PILLAR_SIZE = 2
export const TAG_PILLAR_SPACING = 7
export const TAG_PILLAR_MARGIN = 3

// ─── Powerups ───────────────────────────────────────────────────────────────

export const TAG_POWERUPS: TagPowerup[] = ['dash', 'freeze', 'safe', 'tangle']

// What each of Tag's powerups does.
export const TAG_POWERUP_EFFECTS: Record<TagPowerup, EffectKind> = { dash: 'boost', freeze: 'freeze', safe: 'shield', tangle: 'reverse' }

// Ticks each lasts, at about 9 ticks a second on the normal speed.
export const TAG_EFFECT_TICKS: Record<TagPowerup, number> = {
  dash: 22, // about 2.5s
  freeze: 13, // about 1.5s, like the freeze after a tag
  safe: 26, // about 3s
  tangle: 17 // about 2s
}

export const TAG_POWERUP_ICONS: Record<TagPowerup, string> = { dash: EFFECT_ICONS.boost, freeze: EFFECT_ICONS.freeze, safe: EFFECT_ICONS.shield, tangle: EFFECT_ICONS.reverse }
