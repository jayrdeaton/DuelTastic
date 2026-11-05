import { GRID_CELL_PX } from '@/shared/match/constants'
import type { SpeedTier } from '@/shared/match/types'
import { EFFECT_ICONS, type EffectKind } from '@/shared/powerups'

import type { TagOptions, TagPowerup } from './types'

// Tag's board is the shared grid size's, GRID_CELL_PX, like every game's (Jay, 2026-11-05). Until
// then it had cells of its own, 16, 22 and 30pt, and everything it counts in cells was tuned on the
// 22pt ones: TAG_UNIT_PX. Those distances are in px below, or in units of TAG_UNIT_PX, and the round
// turns them into cells and ticks for its own cell size and speed (TagMeasures), so Tag plays the same
// on screen at every grid size. At 22pt cells and the old 115ms speed they come out as they were.
export const TAG_UNIT_PX = 22

// Milliseconds per cell at GRID_CELL_PX.medium for the loadout's shared speed, scaled to the round's
// real cell size (scaleMsForCellPx), so a rider covers the same distance on screen per second at any
// grid size: the pace Tag's 22pt cells rode at 150, 115 and 90ms.
export const TAG_SPEED_INTERVAL_MS: Record<SpeedTier, number> = { slow: 55, normal: 42, fast: 33 }

// How much faster It rides than the other rider, so a chase can end without a corner.
export const TAG_IT_SPEED = 1.15

// How near It has to come to tag the other rider, head center to head center, in px: It's glow is
// this big, so a rider touching it is It. Measured, not counted in cells, so it's the same at every
// grid size (it was "within a cell" on 22pt cells, 22pt straight across and 31pt diagonally).
export const TAG_REACH_PX = 28

// How long a new It stands frozen after being tagged: the other rider's head start, and what stops an
// instant tag-back.
export const TAG_FREEZE_MS = 1500

// How long a rider stands dazed after riding into the edge or a pillar: what a bump costs, now that
// nothing in Tag crashes.
export const TAG_DAZE_MS = 900

// How long the tail drawn behind each rider is, in px.
export const TAG_TAIL_PX = 77
// How many of its last cells the engine keeps for the tail: enough for TAG_TAIL_PX at the smallest
// grid size, with the head drawn up to a cell behind its latest step.
export const TAG_TAIL_CELLS = Math.ceil(TAG_TAIL_PX / GRID_CELL_PX.small) + 3

export const TAG_ROUND_SECONDS = [30, 60, 90] as const

export const DEFAULT_TAG_OPTIONS: TagOptions = { rule: 'hotPotato', arena: 'pillars', roundSeconds: 60, powerups: [] }

// The most a single frame may count toward the round clock (a stalled frame can't eat seconds).
export const TAG_MAX_CLOCK_STEP_MS = 250

// How long the round's end holds on the board before its result card shows.
export const TAG_RESULT_HOLD_MS = 700

// Pillars, in px: square blocks this big, this far apart, kept this far off the edge (2 x 2 cells, 7
// apart and 3 in on 22pt cells), none within a unit of a rider's start.
export const TAG_PILLAR_SIZE_PX = 44
export const TAG_PILLAR_SPACING_PX = 154
export const TAG_PILLAR_MARGIN_PX = 66
// A board that leaves fewer pillars than this (a narrow one: room for one column of pillars, and it's
// the riders' own, so the ones by their starts go) gets the tighter lattice instead: two columns
// either side of the riders.
export const TAG_MIN_PILLARS = 4
export const TAG_PILLAR_SPACING_TIGHT_PX = 110
export const TAG_PILLAR_MARGIN_TIGHT_PX = 44

// ─── Powerups ───────────────────────────────────────────────────────────────

export const TAG_POWERUPS: TagPowerup[] = ['dash', 'freeze', 'mud', 'safe', 'tangle']

// What each of Tag's powerups does.
export const TAG_POWERUP_EFFECTS: Record<TagPowerup, EffectKind> = { dash: 'boost', freeze: 'freeze', mud: 'slow', safe: 'shield', tangle: 'reverse' }

// How long each lasts.
export const TAG_EFFECT_MS: Record<TagPowerup, number> = {
  dash: 2500,
  freeze: 1500, // like the freeze after a tag
  mud: 3000, // at half speed
  safe: 3000,
  tangle: 2000
}

export const TAG_POWERUP_ICONS: Record<TagPowerup, string> = { dash: EFFECT_ICONS.boost, freeze: EFFECT_ICONS.freeze, mud: EFFECT_ICONS.slow, safe: EFFECT_ICONS.shield, tangle: EFFECT_ICONS.reverse }
