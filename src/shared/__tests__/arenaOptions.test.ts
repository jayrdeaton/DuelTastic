import { sharedArenaOptions } from '@/shared/match/arenaOptions'

// The 'underpass' variant (Snake's Tunnels, Trap's Overpass) only means something where a trail can
// cross one: Trap's and Snake's. Turf has Cross Your Own Trail for that, and Tag has no trails.
describe('the arena pickers', () => {
  it('call the variant Overpass in Trap, with its own icon, and Tunnels in Snake', () => {
    const trap = sharedArenaOptions('trap').find((o) => o.value === 'underpass')
    const snake = sharedArenaOptions('snake').find((o) => o.value === 'underpass')
    expect(trap).toMatchObject({ label: 'Overpass', icon: 'bridge' })
    expect(snake).toMatchObject({ label: 'Tunnels', icon: 'tunnel' })
  })

  it.each(['trap', 'snake'] as const)('offer it in %s', (mode) => {
    expect(sharedArenaOptions(mode).map((o) => o.value)).toEqual(['open', 'pillars', 'gauntlet', 'portals', 'underpass'])
  })

  it.each(['turf', 'tag'] as const)('leave it out of %s', (mode) => {
    expect(sharedArenaOptions(mode).map((o) => o.value)).toEqual(['open', 'pillars', 'gauntlet', 'portals'])
  })

  it.each(['trap', 'snake', 'turf', 'tag'] as const)('give every arena in %s a label and a line', (mode) => {
    for (const option of sharedArenaOptions(mode)) {
      expect(option.label).toBeTruthy()
      expect(option.description).toBeTruthy()
    }
  })
})
