import { type MenuOption, SectionedDropdown } from '@tastic/hud'
import { useCallback, useMemo } from 'react'

import { sharedArenaOptions } from '@/games/shared/arenaOptions'
import { GRID_SIZE_OPTIONS as SHARED_GRID_SIZE_OPTIONS, LoadoutOptionsRow, pickRandom, SPEED_OPTIONS as SHARED_SPEED_OPTIONS, useKeySchemeControl } from '@/shared/match/loadout'
import type { GameLoadout, LoadoutOptionsProps, RoundMode } from '@/shell/types'

import { SNAKE_CPU_DIFFICULTY_NAMES, SNAKE_POWERUP_ALL_TYPES, SNAKE_POWERUP_ICONS } from './constants/snake'
import { DEFAULT_SETTINGS, playerSettings } from './settings'
import type { Settings, SnakeArenaVariant, SnakeGridSizeTier, SnakePowerupType, SnakeSpeedTier } from './types'
import type { CpuDifficulty } from './utils/snakeAi'

// Snake-flavored escalation, matching LightCycles' Drone/Bot/Mainframe convention in reptile
// language: "Garter" (a famously harmless beginner snake), "Rattler" (a real pit-viper threat),
// "King Cobra" (the world's longest venomous snake, the final boss). Display only: the saved value
// stays easy/normal/hard. Solo is seat 2's Nobody, not a difficulty.
const CPU_DIFFICULTY_OPTIONS: MenuOption<CpuDifficulty>[] = [
  { value: 'easy', label: SNAKE_CPU_DIFFICULTY_NAMES.easy, icon: 'emoticon-happy-outline' },
  { value: 'normal', label: SNAKE_CPU_DIFFICULTY_NAMES.normal, icon: 'emoticon-neutral-outline' },
  { value: 'hard', label: SNAKE_CPU_DIFFICULTY_NAMES.hard, icon: 'emoticon-devil-outline' }
]

// Two board toggles in one multi-select section of the board menu, under the layouts: presence in
// the section's value array is each toggle's state. Pac-Man's own glyph for screen wrap, the
// expand-arrows glyph LightCycles' Full Screen uses.
const FULL_SCREEN_OPTION: MenuOption<'fullScreen'> = { value: 'fullScreen', label: 'Full Screen', icon: 'arrow-expand-all' }
const WRAP_EDGES_OPTION: MenuOption<'wrapEdges'> = { value: 'wrapEdges', label: 'Wrap Edges', icon: 'pac-man' }

// The board's static layout (see utils/arenas.ts for what each builds).
const ARENA_OPTIONS: MenuOption<SnakeArenaVariant>[] = sharedArenaOptions<SnakeArenaVariant>('snake')

// Shared pack icon language for grid size, to keep equivalent settings visually consistent across
// modes while Snake keeps its own setting values.
const GRID_SIZE_OPTIONS: MenuOption<SnakeGridSizeTier>[] = SHARED_GRID_SIZE_OPTIONS.map((option) => ({ ...option, value: option.value as SnakeGridSizeTier }))

// Shared pack icon language for speed, for the same cross-mode consistency as grid size.
const SPEED_OPTIONS: MenuOption<SnakeSpeedTier>[] = SHARED_SPEED_OPTIONS.map((option) => ({ ...option, value: option.value as SnakeSpeedTier }))

// The same icons and order as the held badge and the on-board glyph (constants/snake.ts).
const POWERUP_LABELS: Record<SnakePowerupType, string> = { sidewind: 'Sidewind', coldblood: 'Coldblood', scales: 'Scales', constrict: 'Constrict', mesmerize: 'Mesmerize', frenzy: 'Frenzy' }
const POWERUP_DESCRIPTIONS: Record<SnakePowerupType, string> = {
  sidewind: 'Self speed boost (Overdrive/Dash)',
  coldblood: 'Opponent freeze (Stasis/Freeze/Frost)',
  scales: 'Self shield (Shield/Safe/Fence)',
  constrict: 'Opponent trail cut (Prune)',
  mesmerize: 'Opponent controls reversed (Hack/Tangle)',
  frenzy: 'Opponent forced boost (Overclock/Gust)'
}
const POWERUP_OPTIONS: MenuOption<SnakePowerupType>[] = SNAKE_POWERUP_ALL_TYPES.map((type) => ({ value: type, label: POWERUP_LABELS[type], description: POWERUP_DESCRIPTIONS[type], icon: SNAKE_POWERUP_ICONS[type] }))

const OPTION_IDS = ['snakeBoard', 'snakeGridSize', 'snakeSpeed', 'snakePowerups']

// Snake's part of the shared loadout (shell/screens/LoadoutScreen.tsx): its board (layout, Full
// Screen, Wrap Edges), cell size, speed and powerups, each seat's controls on desktop web, and the
// CPU's difficulty.
export function useLoadout(mode: RoundMode): GameLoadout {
  // Seat 1's player's own setup, and each seat's player's controls (settings.ts).
  const { settings, setSettings } = playerSettings.useSettings()

  // Everything the options row shows but Full Screen: it's how the board fits the screen, a
  // preference a player wouldn't want flipped on every shuffle.
  const randomize = useCallback(() => {
    setSettings({
      wrapEdges: Math.random() < 0.5,
      arenaVariant: pickRandom(ARENA_OPTIONS),
      gridSizeTier: pickRandom(GRID_SIZE_OPTIONS),
      speedTier: pickRandom(SPEED_OPTIONS),
      enabledPowerups: SNAKE_POWERUP_ALL_TYPES.filter(() => Math.random() < 0.5)
    })
  }, [setSettings])

  const reset = useCallback(() => {
    setSettings({
      wrapEdges: DEFAULT_SETTINGS.wrapEdges,
      arenaVariant: DEFAULT_SETTINGS.arenaVariant,
      gridSizeTier: DEFAULT_SETTINGS.gridSizeTier,
      speedTier: DEFAULT_SETTINGS.speedTier,
      enabledPowerups: DEFAULT_SETTINGS.enabledPowerups
    })
  }, [setSettings])

  const options = useCallback(
    ({ host, accentColor, mutedColor, onAccentColor, dark, onRandomize, onReset }: LoadoutOptionsProps) => {
      const look = { accentColor, mutedColor, onAccentColor, dark }
      return (
        <LoadoutOptionsRow ids={OPTION_IDS} host={host} onRandomize={onRandomize} onReset={onReset} dark={dark}>
          {/* Board first, size second, as in every game's loadout. */}
          <SectionedDropdown
            id='snakeBoard'
            host={host}
            icon='crop-square'
            accessibilityLabel='Board'
            sections={[
              { kind: 'single', id: 'arenaVariant', options: ARENA_OPTIONS, value: settings.arenaVariant, onChange: (arenaVariant) => setSettings({ arenaVariant }) },
              {
                kind: 'multi',
                id: 'boardToggles',
                options: [FULL_SCREEN_OPTION, WRAP_EDGES_OPTION],
                value: [...(settings.fullScreen ? [FULL_SCREEN_OPTION.value] : []), ...(settings.wrapEdges ? [WRAP_EDGES_OPTION.value] : [])],
                onChange: (value) => setSettings({ fullScreen: value.includes(FULL_SCREEN_OPTION.value), wrapEdges: value.includes(WRAP_EDGES_OPTION.value) })
              }
            ]}
            {...look}
          />
          <SectionedDropdown id='snakeGridSize' host={host} icon='grid' accessibilityLabel='Grid size' sections={[{ kind: 'single', id: 'gridSize', options: GRID_SIZE_OPTIONS, value: settings.gridSizeTier, onChange: (gridSizeTier) => setSettings({ gridSizeTier }) }]} {...look} />
          <SectionedDropdown id='snakeSpeed' host={host} icon='speedometer' accessibilityLabel='Speed' sections={[{ kind: 'single', id: 'speed', options: SPEED_OPTIONS, value: settings.speedTier, onChange: (speedTier) => setSettings({ speedTier }) }]} {...look} />
          <SectionedDropdown id='snakePowerups' host={host} icon='flash' accessibilityLabel={`Powerups ${settings.enabledPowerups.length > 0 ? 'on' : 'off'}`} sections={[{ kind: 'multi', id: 'powerups', options: POWERUP_OPTIONS, value: settings.enabledPowerups, onChange: (enabledPowerups) => setSettings({ enabledPowerups }), allClear: true }]} {...look} />
        </LoadoutOptionsRow>
      )
    },
    [settings, setSettings]
  )

  const setControlScheme = useCallback((controlScheme: Settings['controlScheme']) => setSettings({ controlScheme }), [setSettings])
  const seatControl = useKeySchemeControl(settings.controlScheme, setControlScheme, mode === 'twoPlayer')

  const cpuDifficulty = useMemo(() => ({ value: settings.cpuDifficulty, options: CPU_DIFFICULTY_OPTIONS, onChange: (value: string) => setSettings({ cpuDifficulty: value as CpuDifficulty }) }), [settings.cpuDifficulty, setSettings])

  return { roundSettings: settings, options, optionIds: OPTION_IDS, randomize, reset, seatControl, cpuDifficulty }
}
