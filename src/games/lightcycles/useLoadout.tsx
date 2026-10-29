import { type MenuOption, SectionedDropdown } from '@tastic/hud'
import type { GameLoadout, LoadoutOptionsProps, RoundMode } from '@tastic/shell'
import { useCallback, useMemo } from 'react'

import { POWERUP_ALL_TYPES, POWERUP_ICONS } from '@/games/lightcycles/constants/game'
import { DEFAULT_SETTINGS, playerSettings } from '@/games/lightcycles/redux/settingsSlice'
import type { ArenaVariant, CpuDifficulty, PowerupType, Settings, TrailSpeedTier } from '@/games/lightcycles/types'
import { sharedArenaOptions } from '@/shared/match/arenaOptions'
import { CPU_DIFFICULTY_OPTIONS, GRID_SIZE_OPTIONS, LoadoutOptionsRow, pickRandom, SPEED_OPTIONS, useKeySchemeControl } from '@/shared/match/loadout'

// The board's static obstacle layout (see shared/match/arenas.ts's buildArenaObstacles) - a "board shape"
// concept like grid size, not a gameplay-tuning tier, so each icon just depicts the layout itself.
const ARENA_OPTIONS: MenuOption<ArenaVariant>[] = sharedArenaOptions<ArenaVariant>('lightcycles')

// Two rows of one multi-select section in the arena menu, right under the layouts: both simple
// board-shape toggles. Each option's presence in the section's value array is that toggle's state.
// Pac-Man's own glyph for wrap edges - nothing reads "screen wrap" as clearly as its source.
const EXTEND_SAFE_AREA_OPTION: MenuOption<'extendIntoSafeArea'> = { value: 'extendIntoSafeArea', label: 'Full Screen', icon: 'arrow-expand-all' }
const WRAP_EDGES_OPTION: MenuOption<'wrapEdges'> = { value: 'wrapEdges', label: 'Wrap Edges', icon: 'pac-man' }

// Off -> fast tail-chase. Seed/sprout/tree growth stages: 'off' never trims so the trail grows to a
// full tree; 'fast' trims most aggressively, keeping it seed-small. 'off' alone gets a description:
// it's the game's original behavior, and "this is the one you already know" is useful context.
const TRAIL_SPEED_OPTIONS: MenuOption<TrailSpeedTier>[] = [
  { value: 'off', label: 'Slow (Off)', description: 'Classic', icon: 'tree-outline' },
  { value: 'medium', label: 'Medium', icon: 'sprout-outline' },
  { value: 'fast', label: 'Fast', icon: 'seed-outline' }
]

// Icons match POWERUP_ICONS exactly - the same glyph a held item shows in PowerupHud.tsx once
// revealed, so a player who's already seen one in a HUD badge recognizes it here too.
const POWERUP_OPTIONS: MenuOption<PowerupType>[] = [
  { value: 'overdrive', label: 'Overdrive', description: 'Boosts your speed', icon: POWERUP_ICONS.overdrive },
  { value: 'stasis', label: 'Stasis', description: 'Freezes your opponent', icon: POWERUP_ICONS.stasis },
  { value: 'shield', label: 'Shield', description: 'Protects you from one crash', icon: POWERUP_ICONS.shield },
  { value: 'prune', label: 'Prune', description: "Cuts your opponent's trail", icon: POWERUP_ICONS.prune },
  { value: 'hack', label: 'Hack', description: "Reverses your opponent's controls", icon: POWERUP_ICONS.hack },
  { value: 'overclock', label: 'Overclock', description: 'Forces your opponent to boost', icon: POWERUP_ICONS.overclock }
]

const OPTION_IDS = ['arena', 'gridSize', 'speed', 'trailSpeed', 'powerups']

// LightCycles' part of the shared loadout (@tastic/shell's LoadoutScreen): its match options
// (arena, grid size, speed, trail speed, powerups), each seat's controls on desktop web, and the
// CPU's difficulty.
export function useLoadout(mode: RoundMode): GameLoadout {
  // Seat 1's player's own setup, and each seat's player's controls (redux/settingsSlice.ts).
  const { settings, setSettings } = playerSettings.useSettings()

  // Covers exactly the fields the options row exposes, but Full Screen: it sets how the board fits
  // the screen (the gutter as well as the safe area), a preference a player wouldn't want flipped
  // on every shuffle.
  const randomize = useCallback(() => {
    setSettings({
      gridSizeTier: pickRandom(GRID_SIZE_OPTIONS),
      arenaVariant: pickRandom(ARENA_OPTIONS),
      wrapEdges: Math.random() < 0.5,
      speedTier: pickRandom(SPEED_OPTIONS),
      trailSpeedTier: pickRandom(TRAIL_SPEED_OPTIONS),
      enabledPowerups: POWERUP_ALL_TYPES.filter(() => Math.random() < 0.5)
    })
  }, [setSettings])

  const reset = useCallback(() => {
    setSettings({
      gridSizeTier: DEFAULT_SETTINGS.gridSizeTier,
      arenaVariant: DEFAULT_SETTINGS.arenaVariant,
      extendIntoSafeArea: DEFAULT_SETTINGS.extendIntoSafeArea,
      wrapEdges: DEFAULT_SETTINGS.wrapEdges,
      speedTier: DEFAULT_SETTINGS.speedTier,
      trailSpeedTier: DEFAULT_SETTINGS.trailSpeedTier,
      enabledPowerups: DEFAULT_SETTINGS.enabledPowerups
    })
  }, [setSettings])

  const options = useCallback(
    ({ host, accentColor, mutedColor, onAccentColor, dark, rotation, onRandomize, onReset }: LoadoutOptionsProps) => {
      const look = { accentColor, mutedColor, onAccentColor, dark, rotation }
      return (
        <LoadoutOptionsRow ids={OPTION_IDS} host={host} onRandomize={onRandomize} onReset={onReset} dark={dark}>
          {/* Board first, size second, as in every game's loadout. */}
          <SectionedDropdown
            id='arena'
            host={host}
            icon='crop-square'
            accessibilityLabel='Arena'
            sections={[
              { kind: 'single', id: 'arenaVariant', options: ARENA_OPTIONS, value: settings.arenaVariant, onChange: (arenaVariant) => setSettings({ arenaVariant }) },
              {
                kind: 'multi',
                id: 'boardToggles',
                options: [EXTEND_SAFE_AREA_OPTION, WRAP_EDGES_OPTION],
                value: [...(settings.extendIntoSafeArea ? [EXTEND_SAFE_AREA_OPTION.value] : []), ...(settings.wrapEdges ? [WRAP_EDGES_OPTION.value] : [])],
                onChange: (value) => setSettings({ extendIntoSafeArea: value.includes(EXTEND_SAFE_AREA_OPTION.value), wrapEdges: value.includes(WRAP_EDGES_OPTION.value) })
              }
            ]}
            {...look}
          />
          <SectionedDropdown id='gridSize' host={host} icon='grid' accessibilityLabel='Grid size' sections={[{ kind: 'single', id: 'gridSize', options: GRID_SIZE_OPTIONS, value: settings.gridSizeTier, onChange: (gridSizeTier) => setSettings({ gridSizeTier }) }]} {...look} />
          <SectionedDropdown id='speed' host={host} icon='speedometer' accessibilityLabel='Speed' sections={[{ kind: 'single', id: 'speed', options: SPEED_OPTIONS, value: settings.speedTier, onChange: (speedTier) => setSettings({ speedTier }) }]} {...look} />
          {/* Speed ramp toggle hidden for now - settings.speedRampEnabled stays wired through
          gameEngine and useGameState and defaults to false, so this is a pure UI hide. */}
          <SectionedDropdown id='trailSpeed' host={host} icon='chart-line' accessibilityLabel='Trail speed' sections={[{ kind: 'single', id: 'trailSpeed', options: TRAIL_SPEED_OPTIONS, value: settings.trailSpeedTier, onChange: (trailSpeedTier) => setSettings({ trailSpeedTier }) }]} {...look} />
          <SectionedDropdown id='powerups' host={host} icon='flash' accessibilityLabel={`Powerups ${settings.enabledPowerups.length > 0 ? 'on' : 'off'}`} sections={[{ kind: 'multi', id: 'powerups', options: POWERUP_OPTIONS, value: settings.enabledPowerups, onChange: (enabledPowerups) => setSettings({ enabledPowerups }), allClear: true }]} {...look} />
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
