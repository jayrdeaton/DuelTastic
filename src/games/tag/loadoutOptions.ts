import type { MenuOption } from '@tastic/hud'

import { TAG_POWERUP_ICONS, TAG_ROUND_SECONDS } from './constants'
import type { TagArena, TagPowerup, TagRule } from './types'

// Tag's own rows in the loadout's shared controls. Labels follow the fleet's copy rules: Title Case,
// short, no em dashes.

export const TAG_RULE_OPTIONS: MenuOption<TagRule>[] = [
  { value: 'hotPotato', label: 'Hot Potato', description: "Whoever's It at the end loses", icon: 'fire' },
  { value: 'leastIt', label: 'Least Time It', description: 'Less time as It wins', icon: 'timer-sand' }
]

export const TAG_ARENA_OPTIONS: MenuOption<TagArena>[] = [
  { value: 'pillars', label: 'Pillars', description: 'Pillars to run around', icon: 'pillar' },
  { value: 'open', label: 'Open', description: 'Nothing but the edge', icon: 'square-outline' }
]

export const TAG_ROUND_OPTIONS: MenuOption<number>[] = TAG_ROUND_SECONDS.map((seconds) => ({ value: seconds, label: seconds === 60 ? '1 Minute' : seconds === 90 ? '1½ Minutes' : `${seconds} Seconds`, icon: 'timer-outline' }))

export const TAG_POWERUP_OPTIONS: MenuOption<TagPowerup>[] = [
  { value: 'dash', label: 'Dash', description: 'Ride at double speed', icon: TAG_POWERUP_ICONS.dash },
  { value: 'freeze', label: 'Freeze', description: 'Freeze the other rider', icon: TAG_POWERUP_ICONS.freeze },
  { value: 'mud', label: 'Mud', description: 'Slow the other rider down', icon: TAG_POWERUP_ICONS.mud },
  { value: 'safe', label: 'Safe', description: "Can't be tagged for a bit", icon: TAG_POWERUP_ICONS.safe },
  { value: 'tangle', label: 'Tangle', description: 'Reverse their steering', icon: TAG_POWERUP_ICONS.tangle }
]
