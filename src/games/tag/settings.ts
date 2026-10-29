import { createPlayerSettings } from '@tastic/shell'

import { DEFAULT_GRID_SIZE_TIER } from '@/shared/match/constants'
import { KEY_SCHEMES } from '@/shared/match/loadout'
import type { KeyScheme } from '@/shared/match/types'

import { DEFAULT_TAG_OPTIONS } from './constants'
import type { TagSettings } from './types'

// What a player who hasn't changed a thing plays with. Each player's own changes are saved over it
// (see below), so a field added later starts at its default for everyone.
export const DEFAULT_SETTINGS: TagSettings = {
  ...DEFAULT_TAG_OPTIONS,
  speedTier: 'normal',
  gridSizeTier: DEFAULT_GRID_SIZE_TIER,
  cpuDifficulty: 'normal',
  controlScheme: { 1: 'wasd', 2: 'arrows' }
}

// Tag's loadout, per player (@tastic/shell's createPlayerSettings): the match settings seat 1's
// player last set up, under tagSettings, and the controls each player last picked, under tagControls.
export const playerSettings = createPlayerSettings<TagSettings, KeyScheme>({ id: 'tag', defaults: DEFAULT_SETTINGS, distinctControls: KEY_SCHEMES })
