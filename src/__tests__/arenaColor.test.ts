import { readFileSync } from 'fs'
import { join } from 'path'

// Turf drew its arena (pillars, gauntlet walls, gates, tunnels) in the board's own background color,
// so all of it was invisible on unclaimed ground. Every game with the shared arenas draws them in the
// pack's one structure color, boardStructureColor, handed to its board from its play screen.

const GAMES = join(__dirname, '..', 'games')

describe('the arena color', () => {
  it.each(['lightcycles', 'turf', 'tag'])("is boardStructureColor in %s's play screen, never the background", (game) => {
    const source = readFileSync(join(GAMES, game, 'PlayScreen.tsx'), 'utf8')
    expect(source).toMatch(/boardStructureColor\(themeColors\)/)
    expect(source).not.toMatch(/'#000000'|'#FFFFFF'|colors\.background/i)
  })
})
