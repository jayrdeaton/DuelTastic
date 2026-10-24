import type { MenuOption } from '@tastic/hud'

import { TURF_POWERUP_ICONS, TURF_ROUND_SECONDS } from './constants'
import type { TurfCrashRule, TurfPowerup } from './types'

// Turf's own rows in the loadout's shared controls. Labels follow the fleet's copy rules: Title Case,
// short, no em dashes.

export const TURF_CRASH_OPTIONS: MenuOption<TurfCrashRule>[] = [
  { value: 'out', label: 'Crash Ends Round', description: 'The first crash loses', icon: 'flag-checkered' },
  { value: 'home', label: 'Crash Sends Home', description: 'Lose your trail, keep playing', icon: 'home-outline' }
]

// A one-row toggle, in the same menu as the crash rule (the multi-select row LightCycles' arena menu
// uses for its board toggles).
export const TURF_OWN_TRAIL_SAFE_OPTION: MenuOption<'ownTrailSafe'> = { value: 'ownTrailSafe', label: 'Cross Your Own Trail', description: 'Your trail never crashes you', icon: 'vector-polyline' }

export const TURF_ROUND_OPTIONS: MenuOption<number>[] = TURF_ROUND_SECONDS.map((seconds) => ({ value: seconds, label: seconds === 60 ? '1 Minute' : `${seconds / 60} Minutes`, icon: 'timer-outline' }))

export const TURF_POWERUP_OPTIONS: MenuOption<TurfPowerup>[] = [
  { value: 'dash', label: 'Dash', description: 'Ride at double speed', icon: TURF_POWERUP_ICONS.dash },
  { value: 'frost', label: 'Frost', description: 'Freeze the other rider', icon: TURF_POWERUP_ICONS.frost },
  { value: 'mud', label: 'Mud', description: 'Slow the other rider down', icon: TURF_POWERUP_ICONS.mud },
  { value: 'fence', label: 'Fence', description: 'Only the edge can crash you', icon: TURF_POWERUP_ICONS.fence },
  { value: 'sod', label: 'Sod', description: 'Claim the ground around you', icon: TURF_POWERUP_ICONS.sod },
  { value: 'tangle', label: 'Tangle', description: 'Reverse their steering', icon: TURF_POWERUP_ICONS.tangle },
  { value: 'gust', label: 'Gust', description: 'Force them to double speed', icon: TURF_POWERUP_ICONS.gust }
]
