import type { MenuOption } from '@tastic/hud'

import { TAG_ROUND_SECONDS } from './constants'
import type { TagArena, TagRule } from './types'

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
