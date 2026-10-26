import { SectionedDropdown } from '@tastic/hud'
import { useCallback, useMemo } from 'react'

import { CPU_DIFFICULTY_OPTIONS, GRID_SIZE_OPTIONS, LoadoutOptionsRow, pickRandom, SPEED_OPTIONS, useKeySchemeControl } from '@/shared/match/loadout'
import type { CpuDifficulty } from '@/shared/match/types'
import type { GameLoadout, LoadoutOptionsProps, RoundMode } from '@/shell/types'

import { TURF_POWERUPS } from './constants'
import { TURF_ARENA_OPTIONS, TURF_CRASH_OPTIONS, TURF_OWN_TRAIL_SAFE_OPTION, TURF_POWERUP_OPTIONS, TURF_ROUND_OPTIONS } from './loadoutOptions'
import { DEFAULT_SETTINGS, playerSettings } from './settings'
import type { TurfSettings } from './types'

const OPTION_IDS = ['turfArena', 'turfRules', 'turfRound', 'gridSize', 'speed', 'turfPowerups']

// Turf's part of the shared loadout (shell/screens/LoadoutScreen.tsx): its rules (the crash rule and
// Cross Your Own Trail), round length and powerups, the grid size and speed every game has, each
// seat's controls on desktop web, and the CPU's difficulty.
export function useLoadout(mode: RoundMode): GameLoadout {
  const { settings, setSettings } = playerSettings.useSettings()

  const randomize = useCallback(() => {
    setSettings({
      arena: pickRandom(TURF_ARENA_OPTIONS),
      crash: pickRandom(TURF_CRASH_OPTIONS),
      ownTrailDeadly: Math.random() < 0.5,
      roundSeconds: pickRandom(TURF_ROUND_OPTIONS),
      gridSizeTier: pickRandom(GRID_SIZE_OPTIONS),
      speedTier: pickRandom(SPEED_OPTIONS),
      powerups: TURF_POWERUPS.filter(() => Math.random() < 0.5)
    })
  }, [setSettings])

  const reset = useCallback(() => {
    setSettings({
      arena: DEFAULT_SETTINGS.arena,
      crash: DEFAULT_SETTINGS.crash,
      ownTrailDeadly: DEFAULT_SETTINGS.ownTrailDeadly,
      roundSeconds: DEFAULT_SETTINGS.roundSeconds,
      gridSizeTier: DEFAULT_SETTINGS.gridSizeTier,
      speedTier: DEFAULT_SETTINGS.speedTier,
      powerups: DEFAULT_SETTINGS.powerups
    })
  }, [setSettings])

  const options = useCallback(
    ({ host, accentColor, mutedColor, onAccentColor, dark, rotation, onRandomize, onReset }: LoadoutOptionsProps) => {
      const look = { accentColor, mutedColor, onAccentColor, dark, rotation }
      return (
        <LoadoutOptionsRow ids={OPTION_IDS} host={host} onRandomize={onRandomize} onReset={onReset} dark={dark}>
          <SectionedDropdown id='turfArena' host={host} icon='crop-square' accessibilityLabel='Arena' sections={[{ kind: 'single', id: 'turfArena', options: TURF_ARENA_OPTIONS, value: settings.arena, onChange: (arena) => setSettings({ arena }) }]} {...look} />
          <SectionedDropdown
            id='turfRules'
            host={host}
            icon='gavel'
            accessibilityLabel='Rules'
            sections={[
              { kind: 'single', id: 'turfCrash', options: TURF_CRASH_OPTIONS, value: settings.crash, onChange: (crash) => setSettings({ crash }) },
              { kind: 'multi', id: 'turfOwnTrail', options: [TURF_OWN_TRAIL_SAFE_OPTION], value: settings.ownTrailDeadly ? [] : [TURF_OWN_TRAIL_SAFE_OPTION.value], onChange: (value) => setSettings({ ownTrailDeadly: !value.includes(TURF_OWN_TRAIL_SAFE_OPTION.value) }) }
            ]}
            {...look}
          />
          <SectionedDropdown id='turfRound' host={host} icon='timer-outline' accessibilityLabel='Round length' sections={[{ kind: 'single', id: 'turfRound', options: TURF_ROUND_OPTIONS, value: settings.roundSeconds, onChange: (roundSeconds) => setSettings({ roundSeconds }) }]} {...look} />
          <SectionedDropdown id='gridSize' host={host} icon='grid' accessibilityLabel='Grid size' sections={[{ kind: 'single', id: 'gridSize', options: GRID_SIZE_OPTIONS, value: settings.gridSizeTier, onChange: (gridSizeTier) => setSettings({ gridSizeTier }) }]} {...look} />
          <SectionedDropdown id='speed' host={host} icon='speedometer' accessibilityLabel='Speed' sections={[{ kind: 'single', id: 'speed', options: SPEED_OPTIONS, value: settings.speedTier, onChange: (speedTier) => setSettings({ speedTier }) }]} {...look} />
          <SectionedDropdown id='turfPowerups' host={host} icon='flash' accessibilityLabel={`Powerups ${settings.powerups.length > 0 ? 'on' : 'off'}`} sections={[{ kind: 'multi', id: 'turfPowerups', options: TURF_POWERUP_OPTIONS, value: settings.powerups, onChange: (powerups) => setSettings({ powerups }), allClear: true }]} {...look} />
        </LoadoutOptionsRow>
      )
    },
    [settings, setSettings]
  )

  const setControlScheme = useCallback((controlScheme: TurfSettings['controlScheme']) => setSettings({ controlScheme }), [setSettings])
  const seatControl = useKeySchemeControl(settings.controlScheme, setControlScheme, mode === 'twoPlayer')

  const cpuDifficulty = useMemo(() => ({ value: settings.cpuDifficulty, options: CPU_DIFFICULTY_OPTIONS, onChange: (value: string) => setSettings({ cpuDifficulty: value as CpuDifficulty }) }), [settings.cpuDifficulty, setSettings])

  return { roundSettings: settings, options, optionIds: OPTION_IDS, randomize, reset, seatControl, cpuDifficulty }
}
