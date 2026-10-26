import type { MenuOption } from '@tastic/hud'

export type SharedArenaVariant = 'open' | 'pillars' | 'gauntlet' | 'portals' | 'underpass'

type ArenaPickerMode = 'lightcycles' | 'snake' | 'tag' | 'turf'

const ARENA_LABELS: Record<ArenaPickerMode, Record<SharedArenaVariant, string>> = {
  lightcycles: { open: 'Open', pillars: 'Pillars', gauntlet: 'Gauntlet', portals: 'Portals', underpass: 'Underpass' },
  snake: { open: 'Open', pillars: 'Pillars', gauntlet: 'Gauntlet', portals: 'Holes', underpass: 'Tunnels' },
  tag: { open: 'Open', pillars: 'Pillars', gauntlet: 'Gauntlet', portals: 'Holes', underpass: 'Tunnels' },
  turf: { open: 'Open', pillars: 'Pillars', gauntlet: 'Gauntlet', portals: 'Gates', underpass: 'Tunnels' }
}

const ARENA_ICONS: Record<SharedArenaVariant, string> = {
  open: 'crop-square',
  pillars: 'dots-grid',
  gauntlet: 'view-column',
  portals: 'orbit-variant',
  underpass: 'tunnel'
}

const ARENA_DESCRIPTIONS: Record<ArenaPickerMode, Record<SharedArenaVariant, string>> = {
  lightcycles: {
    open: 'Nothing but the edge',
    pillars: 'Scattered solid blocks',
    gauntlet: 'Wall lanes with gaps',
    portals: 'Linked warp points (portals)',
    underpass: 'Safe crossing corridor (underpass)'
  },
  snake: {
    open: 'Nothing but the edge',
    pillars: 'Scattered solid blocks',
    gauntlet: 'Wall lanes with gaps',
    portals: 'Linked warp points (holes)',
    underpass: 'Safe crossing corridor (tunnels)'
  },
  tag: {
    open: 'Nothing but the edge',
    pillars: 'Scattered solid blocks',
    gauntlet: 'Wall lanes with gaps',
    portals: 'Linked warp points (holes)',
    underpass: 'Safe crossing corridor (tunnels)'
  },
  turf: {
    open: 'Nothing but the edge',
    pillars: 'Scattered solid blocks',
    gauntlet: 'Wall lanes with gaps',
    portals: 'Linked warp points (gates)',
    underpass: 'Safe crossing corridor (tunnels)'
  }
}

const ORDER: SharedArenaVariant[] = ['open', 'pillars', 'gauntlet', 'portals', 'underpass']

export function sharedArenaOptions<T extends SharedArenaVariant>(mode: ArenaPickerMode): MenuOption<T>[] {
  return ORDER.map((value) => ({ value: value as T, label: ARENA_LABELS[mode][value], description: ARENA_DESCRIPTIONS[mode][value], icon: ARENA_ICONS[value] }))
}
