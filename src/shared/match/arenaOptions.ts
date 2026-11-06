import type { MenuOption } from '@tastic/hud'

export type SharedArenaVariant = 'open' | 'pillars' | 'gauntlet' | 'portals' | 'underpass'

type ArenaPickerMode = 'lightcycles' | 'snake' | 'tag' | 'turf'

const ARENA_LABELS: Record<ArenaPickerMode, Partial<Record<SharedArenaVariant, string>>> = {
  lightcycles: { open: 'Open', pillars: 'Pillars', gauntlet: 'Gauntlet', portals: 'Portals', underpass: 'Underpass' },
  snake: { open: 'Open', pillars: 'Pillars', gauntlet: 'Gauntlet', portals: 'Holes', underpass: 'Tunnels' },
  tag: { open: 'Open', pillars: 'Pillars', gauntlet: 'Gauntlet', portals: 'Holes' },
  turf: { open: 'Open', pillars: 'Pillars', gauntlet: 'Gauntlet', portals: 'Gates' }
}

const ARENA_ICONS: Record<SharedArenaVariant, string> = {
  open: 'crop-square',
  pillars: 'dots-grid',
  gauntlet: 'view-column',
  portals: 'orbit-variant',
  underpass: 'tunnel'
}

const ARENA_DESCRIPTIONS: Record<ArenaPickerMode, Partial<Record<SharedArenaVariant, string>>> = {
  lightcycles: {
    open: 'Nothing but the edge',
    pillars: 'Scattered solid blocks',
    gauntlet: 'Wall lanes with gaps',
    portals: 'Linked warp points',
    underpass: 'Safe crossing tunnel'
  },
  snake: {
    open: 'Nothing but the edge',
    pillars: 'Scattered solid blocks',
    gauntlet: 'Wall lanes with gaps',
    portals: 'Linked holes',
    underpass: 'Safe crossing tunnel'
  },
  tag: {
    open: 'Nothing but the edge',
    pillars: 'Scattered solid blocks',
    gauntlet: 'Wall lanes with gaps',
    portals: 'Linked holes'
  },
  turf: {
    open: 'Nothing but the edge',
    pillars: 'Scattered solid blocks',
    gauntlet: 'Wall lanes with gaps',
    portals: 'Linked gates'
  }
}

const ORDER: SharedArenaVariant[] = ['open', 'pillars', 'gauntlet', 'portals', 'underpass']

// Each game's arenas in menu order: those it has a label for. Turf and Tag have no Tunnels, which only
// mean something where a rider can cross its own trail in them (LightCycles, Snake).
export function sharedArenaOptions<T extends SharedArenaVariant>(mode: ArenaPickerMode): MenuOption<T>[] {
  return ORDER.flatMap((value) => {
    const label = ARENA_LABELS[mode][value]
    return label ? [{ value: value as T, label, description: ARENA_DESCRIPTIONS[mode][value], icon: ARENA_ICONS[value] }] : []
  })
}
