import { createSettingsSlice } from '@rific/core'

import { DEFAULT_GRID_SIZE_TIER } from '@/constants/game'
import { DEFAULT_TAG_OPTIONS } from '@/games/tag/constants'
import { DEFAULT_TURF_OPTIONS } from '@/games/turf/constants'
import type { Settings } from '@/types'

// The persisted settings: a Redux slice like every other persisted value in this app, read and
// written only through hooks/useSettings.ts. Built on @rific/core's createSettingsSlice: `initialize`
// in 'merge' mode is the single write path (setSettings' partial patch), and its REHYDRATE handling
// fills any field added after a player's settings were saved from DEFAULT_SETTINGS, so no
// validation or migration is needed.
export const DEFAULT_SETTINGS: Settings = {
  speedTier: 'normal',
  speedRampEnabled: false,
  gameMode: 'twoPlayer',
  cpuDifficulty: 'normal',
  gridSizeTier: DEFAULT_GRID_SIZE_TIER,
  trailSpeedTier: 'off',
  keyScheme: { 1: 'wasd', 2: 'arrows' },
  lockOrientation: false,
  enabledPowerups: [],
  arenaVariant: 'open',
  extendIntoSafeArea: false,
  wrapEdges: false,
  deferBottomEdgeGestures: false,
  game: 'lightcycles',
  turf: DEFAULT_TURF_OPTIONS,
  tag: DEFAULT_TAG_OPTIONS
}

const { actions, reducer } = createSettingsSlice<Settings, 'merge', never>('settings', {
  initialState: DEFAULT_SETTINGS,
  initializeMode: 'merge',
  fieldSetters: []
})

export const settingsActions = actions
export default reducer
