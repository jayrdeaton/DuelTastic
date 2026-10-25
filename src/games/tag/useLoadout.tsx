import { SectionedDropdown } from '@tastic/hud'
import { useCallback, useMemo } from 'react'

import { CPU_DIFFICULTY_OPTIONS, GRID_SIZE_OPTIONS, LoadoutOptionsRow, pickRandom, SPEED_OPTIONS, useKeySchemeControl } from '@/shared/match/loadout'
import type { CpuDifficulty } from '@/shared/match/types'
import type { GameLoadout, LoadoutOptionsProps, RoundMode } from '@/shell/types'

import { TAG_POWERUPS } from './constants'
import { TAG_ARENA_OPTIONS, TAG_POWERUP_OPTIONS, TAG_ROUND_OPTIONS, TAG_RULE_OPTIONS } from './loadoutOptions'
import { DEFAULT_SETTINGS, playerSettings } from './settings'
import type { TagSettings } from './types'

const OPTION_IDS = ['tagRules', 'tagArena', 'tagRound', 'gridSize', 'speed', 'tagPowerups']

// Tag's part of the shared loadout (shell/screens/LoadoutScreen.tsx): its rules, arena, round length
// and powerups, the grid size and speed every game has, each seat's controls on desktop web, and the
// CPU's difficulty.
export function useLoadout(mode: RoundMode): GameLoadout {
  const { settings, setSettings } = playerSettings.useSettings()

  const randomize = useCallback(() => {
    setSettings({
      rule: pickRandom(TAG_RULE_OPTIONS),
      arena: pickRandom(TAG_ARENA_OPTIONS),
      roundSeconds: pickRandom(TAG_ROUND_OPTIONS),
      gridSizeTier: pickRandom(GRID_SIZE_OPTIONS),
      speedTier: pickRandom(SPEED_OPTIONS),
      powerups: TAG_POWERUPS.filter(() => Math.random() < 0.5)
    })
  }, [setSettings])

  const reset = useCallback(() => {
    setSettings({
      rule: DEFAULT_SETTINGS.rule,
      arena: DEFAULT_SETTINGS.arena,
      roundSeconds: DEFAULT_SETTINGS.roundSeconds,
      gridSizeTier: DEFAULT_SETTINGS.gridSizeTier,
      speedTier: DEFAULT_SETTINGS.speedTier,
      powerups: DEFAULT_SETTINGS.powerups
    })
  }, [setSettings])

  const options = useCallback(
    ({ host, accentColor, mutedColor, onAccentColor, dark, onRandomize, onReset }: LoadoutOptionsProps) => {
      const look = { accentColor, mutedColor, onAccentColor, dark }
      return (
        <LoadoutOptionsRow ids={OPTION_IDS} host={host} onRandomize={onRandomize} onReset={onReset} dark={dark}>
          <SectionedDropdown id='tagRules' host={host} icon='gavel' accessibilityLabel='Rules' sections={[{ kind: 'single', id: 'tagRule', options: TAG_RULE_OPTIONS, value: settings.rule, onChange: (rule) => setSettings({ rule }) }]} {...look} />
          <SectionedDropdown id='tagArena' host={host} icon='pillar' accessibilityLabel='Arena' sections={[{ kind: 'single', id: 'tagArena', options: TAG_ARENA_OPTIONS, value: settings.arena, onChange: (arena) => setSettings({ arena }) }]} {...look} />
          <SectionedDropdown id='tagRound' host={host} icon='timer-outline' accessibilityLabel='Round length' sections={[{ kind: 'single', id: 'tagRound', options: TAG_ROUND_OPTIONS, value: settings.roundSeconds, onChange: (roundSeconds) => setSettings({ roundSeconds }) }]} {...look} />
          <SectionedDropdown id='gridSize' host={host} icon='grid' accessibilityLabel='Grid size' sections={[{ kind: 'single', id: 'gridSize', options: GRID_SIZE_OPTIONS, value: settings.gridSizeTier, onChange: (gridSizeTier) => setSettings({ gridSizeTier }) }]} {...look} />
          <SectionedDropdown id='speed' host={host} icon='speedometer' accessibilityLabel='Speed' sections={[{ kind: 'single', id: 'speed', options: SPEED_OPTIONS, value: settings.speedTier, onChange: (speedTier) => setSettings({ speedTier }) }]} {...look} />
          <SectionedDropdown id='tagPowerups' host={host} icon='flash' accessibilityLabel={`Powerups ${settings.powerups.length > 0 ? 'on' : 'off'}`} sections={[{ kind: 'multi', id: 'tagPowerups', options: TAG_POWERUP_OPTIONS, value: settings.powerups, onChange: (powerups) => setSettings({ powerups }), allClear: true }]} {...look} />
        </LoadoutOptionsRow>
      )
    },
    [settings, setSettings]
  )

  const setControlScheme = useCallback((controlScheme: TagSettings['controlScheme']) => setSettings({ controlScheme }), [setSettings])
  const seatControl = useKeySchemeControl(settings.controlScheme, setControlScheme, mode === 'twoPlayer')

  const cpuDifficulty = useMemo(() => ({ value: settings.cpuDifficulty, options: CPU_DIFFICULTY_OPTIONS, onChange: (value: string) => setSettings({ cpuDifficulty: value as CpuDifficulty }) }), [settings.cpuDifficulty, setSettings])

  return { roundSettings: settings, options, optionIds: OPTION_IDS, randomize, reset, seatControl, cpuDifficulty }
}
