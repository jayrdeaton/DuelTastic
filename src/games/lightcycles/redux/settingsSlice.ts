import type { KeyScheme, Settings } from '@/games/lightcycles/types'
import { DEFAULT_GRID_SIZE_TIER } from '@/shared/match/constants'
import { KEY_SCHEMES } from '@/shared/match/loadout'
import { createPlayerSettings } from '@/shared/playerSettings'

// What a player who hasn't changed a thing plays with. Each player's own changes are saved over it
// (see below), so a field added later starts at its default for everyone.
export const DEFAULT_SETTINGS: Settings = {
  speedTier: 'normal',
  speedRampEnabled: false,
  cpuDifficulty: 'normal',
  gridSizeTier: DEFAULT_GRID_SIZE_TIER,
  trailSpeedTier: 'off',
  // WASD for player 1 because a wide desktop window puts player 1 on the left.
  controlScheme: { 1: 'wasd', 2: 'arrows' },
  enabledPowerups: [],
  arenaVariant: 'open',
  extendIntoSafeArea: false,
  wrapEdges: false
}

// LightCycles' loadout, per player (shared/playerSettings.ts): the match settings seat 1's player
// last set up, under lightcyclesSettings, and the controls each player last picked, under
// lightcyclesControls. Two seats can't share a key cluster, so when both players saved the same one,
// seat 2 takes the next free one in the loadout's menu order for that match.
export const playerSettings = createPlayerSettings<Settings, KeyScheme>({ id: 'lightcycles', defaults: DEFAULT_SETTINGS, distinctControls: KEY_SCHEMES })
