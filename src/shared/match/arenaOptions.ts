import type { MenuOption } from '@tastic/hud'

export type SharedArenaVariant = 'open' | 'pillars' | 'gauntlet' | 'portals' | 'underpass'

type ArenaPickerMode = 'trap' | 'snake' | 'tag' | 'turf'

const ARENA_LABELS: Record<ArenaPickerMode, Partial<Record<SharedArenaVariant, string>>> = {
  trap: { open: 'Open', pillars: 'Pillars', gauntlet: 'Gauntlet', portals: 'Portals', underpass: 'Overpass' },
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

// A game whose arena is a different thing from the rest's under the same variant: Trap's 'underpass'
// is the Overpass, a two-level crossing, where Snake's is a tunnel.
const ARENA_ICON_OVERRIDES: Partial<Record<ArenaPickerMode, Partial<Record<SharedArenaVariant, string>>>> = {
  trap: { underpass: 'bridge' }
}

const ARENA_DESCRIPTIONS: Record<ArenaPickerMode, Partial<Record<SharedArenaVariant, string>>> = {
  trap: {
    open: 'Nothing but the edge',
    pillars: 'Scattered solid blocks',
    gauntlet: 'Wall lanes with gaps',
    portals: 'Linked warp points',
    underpass: 'Ride over or under'
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

// Each game's arenas in menu order: those it has a label for. Turf and Tag have no 'underpass': it's
// Snake's Tunnels and Trap's Overpass, which mean something only where a trail can cross one.
export function sharedArenaOptions<T extends SharedArenaVariant>(mode: ArenaPickerMode): MenuOption<T>[] {
  return ORDER.flatMap((value) => {
    const label = ARENA_LABELS[mode][value]
    return label ? [{ value: value as T, label, description: ARENA_DESCRIPTIONS[mode][value], icon: ARENA_ICON_OVERRIDES[mode]?.[value] ?? ARENA_ICONS[value] }] : []
  })
}
