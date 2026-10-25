import { DEFAULT_GRID_SIZE_TIER } from '@/shared/match/constants'
import { KEY_SCHEMES } from '@/shared/match/loadout'
import type { KeyScheme } from '@/shared/match/types'
import { createPlayerSettings } from '@/shared/playerSettings'

import { DEFAULT_TURF_OPTIONS } from './constants'
import type { TurfSettings } from './types'

// What a player who hasn't changed a thing plays with. Each player's own changes are saved over it
// (see below), so a field added later starts at its default for everyone.
export const DEFAULT_SETTINGS: TurfSettings = {
  ...DEFAULT_TURF_OPTIONS,
  speedTier: 'normal',
  gridSizeTier: DEFAULT_GRID_SIZE_TIER,
  cpuDifficulty: 'normal',
  controlScheme: { 1: 'wasd', 2: 'arrows' }
}

// Turf's loadout, per player (shared/playerSettings.ts): the match settings seat 1's player last set
// up, under turfSettings, and the controls each player last picked, under turfControls.
export const playerSettings = createPlayerSettings<TurfSettings, KeyScheme>({ id: 'turf', defaults: DEFAULT_SETTINGS, distinctControls: KEY_SCHEMES })
