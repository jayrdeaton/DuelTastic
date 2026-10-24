import type { MenuOption } from '@tastic/hud'

import { TURF_ROUND_SECONDS } from './constants'
import type { TurfCrashRule } from './types'

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
