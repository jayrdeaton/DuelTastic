import { readFileSync } from 'fs'
import { join } from 'path'

// @tastic/hud 0.39 heads each loadout dial's open menu with its title, which is its accessibilityLabel unless it passes
// one. A label that reads the setting's state ("Powerups off") would title the menu POWERUPS OFF, so a dial whose label
// changes with the setting passes a fixed title of its own.
const LOADOUTS = ['src/games/trap/useLoadout.tsx', 'src/games/turf/useLoadout.tsx', 'src/games/tag/useLoadout.tsx', 'src/games/snake/useLoadout.tsx', 'src/shared/match/loadout.tsx']

const dropdowns = (file: string) => readFileSync(join(__dirname, '..', '..', file), 'utf8').match(/<SectionedDropdown[\s\S]*?\/>/g) ?? []

describe('loadout menu titles', () => {
  it('finds the dials in every loadout', () => {
    for (const file of LOADOUTS) expect(dropdowns(file).length).toBeGreaterThan(0)
  })

  it('gives every dial whose label changes with its setting a fixed title', () => {
    const untitled = LOADOUTS.flatMap((file) =>
      dropdowns(file)
        .filter((tag) => /accessibilityLabel=\{`/.test(tag) && !/\btitle=/.test(tag))
        .map((tag) => `${file}: ${tag.slice(0, 80)}`)
    )
    expect(untitled).toEqual([])
  })

  it("titles each game's Powerups menu Powerups", () => {
    for (const file of LOADOUTS.slice(0, 4)) {
      const powerups = dropdowns(file).filter((tag) => tag.includes("icon='flash'"))
      expect(powerups).toHaveLength(1)
      expect(powerups[0]).toContain("title='Powerups'")
    }
  })
})
