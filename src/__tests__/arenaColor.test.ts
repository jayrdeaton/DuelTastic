import { readFileSync } from 'fs'
import { join } from 'path'

import { boardStructureColor } from '@/shared/match/structureColor'

// Turf drew its arena (pillars, gauntlet walls, gates, tunnels) in the board's own background color,
// so all of it was invisible on unclaimed ground. Every game draws its arena in the pack's one
// structure color, boardStructureColor, a neutral gray: it was blended with the theme's tertiary,
// the powerup boxes' color, and a box between two walls read as part of them (2026-11-04).

const GAMES = join(__dirname, '..', 'games')

// The pack's own theme colors, read off the running app (auto-paper's dark and light themes with
// DuelTastic's blue and red seats): its text and background, and the green tertiary boxes are drawn in.
const THEMES = {
  dark: { onSurface: 'rgba(230, 225, 229, 1)', background: '#0F0F0F', tertiary: '#5cf32c' },
  light: { onSurface: 'rgba(28, 27, 31, 1)', background: '#F0F0F0', tertiary: '#5cf32c' }
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

describe('the arena color', () => {
  it.each(['lightcycles', 'turf', 'tag'])("is boardStructureColor in %s's play screen, never the background", (game) => {
    const source = readFileSync(join(GAMES, game, 'PlayScreen.tsx'), 'utf8')
    expect(source).toMatch(/boardStructureColor\(themeColors\)/)
    expect(source).not.toMatch(/'#000000'|'#FFFFFF'|colors\.background/i)
  })

  it("is Snake's too, for its obstacles and tunnels", () => {
    const source = readFileSync(join(GAMES, 'snake', 'components', 'SnakeBoardCanvas.tsx'), 'utf8')
    expect(source).toMatch(/boardStructureColor\(colors\)/)
    expect(source).not.toMatch(/(Obstacles|Tunnels) [^\n]*color=\{colors\.outline\}/)
  })

  it.each(Object.entries(THEMES))('is a mid gray, well apart from the boxes, in the %s theme', (_, theme) => {
    const arena = rgb(boardStructureColor(theme))
    expect(Math.max(...arena) - Math.min(...arena)).toBeLessThanOrEqual(8)
    expect(arena[0]).toBeGreaterThan(90)
    expect(arena[0]).toBeLessThan(170)
    const box = rgb(theme.tertiary)
    const distance = Math.hypot(arena[0] - box[0], arena[1] - box[1], arena[2] - box[2])
    expect(distance).toBeGreaterThan(120)
  })
})
