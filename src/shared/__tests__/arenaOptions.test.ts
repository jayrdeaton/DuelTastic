import { sharedArenaOptions } from '@/shared/match/arenaOptions'

// Tunnels only mean something where a rider can cross its own trail in them: Trap's and
// Snake's. Turf has Cross Your Own Trail for that, and Tag has no trails to cross.
describe('the arena pickers', () => {
  it.each(['trap', 'snake'] as const)('offer Tunnels in %s', (mode) => {
    expect(sharedArenaOptions(mode).map((o) => o.value)).toEqual(['open', 'pillars', 'gauntlet', 'portals', 'underpass'])
  })

  it.each(['turf', 'tag'] as const)('leave Tunnels out of %s', (mode) => {
    expect(sharedArenaOptions(mode).map((o) => o.value)).toEqual(['open', 'pillars', 'gauntlet', 'portals'])
  })

  it.each(['trap', 'snake', 'turf', 'tag'] as const)('give every arena in %s a label and a line', (mode) => {
    for (const option of sharedArenaOptions(mode)) {
      expect(option.label).toBeTruthy()
      expect(option.description).toBeTruthy()
    }
  })
})
