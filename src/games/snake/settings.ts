import { KEY_SCHEMES } from '@/shared/match/loadout'
import { createPlayerSettings } from '@/shared/playerSettings'

import type { ControlScheme, Settings } from './types'

// What a player who hasn't changed a thing plays with: Snake's own defaults from when it was its
// own app, but for the CPU (seat 2's Nobody is Solo now, so the CPU starts at Normal). Each player's
// own changes are saved over it (see below), so a field added later starts at its default for
// everyone. WASD goes to player 1 because a wide desktop window puts player 1 on the left.
export const DEFAULT_SETTINGS: Settings = {
  wrapEdges: false,
  fullScreen: false,
  cpuDifficulty: 'normal',
  controlScheme: { 1: 'wasd', 2: 'arrows' },
  speedTier: 'normal',
  arenaVariant: 'open',
  enabledPowerups: [],
  gridSizeTier: 'medium'
}

// Snake's loadout, per player (shared/playerSettings.ts): the match settings seat 1's player last
// set up, under snakeSettings, and the controls each player last picked, under snakeControls.
export const playerSettings = createPlayerSettings<Settings, ControlScheme>({ id: 'snake', defaults: DEFAULT_SETTINGS, distinctControls: KEY_SCHEMES })
