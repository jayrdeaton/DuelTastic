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
  it.each(['trap', 'turf', 'tag'])("is boardStructureColor in %s's play screen, never the background", (game) => {
    // Trap's Overpass deck is the one thing drawn in the background, on purpose: it's the board's own
    // color laid over the riders under the bridge, so they show dimmed through it.
    const source = readFileSync(join(GAMES, game, 'PlayScreen.tsx'), 'utf8').replace('deckColor={themeColors.background}', '')
    expect(source).toMatch(/boardStructureColor\(themeColors\)/)
    expect(source).not.toMatch(/'#000000'|'#FFFFFF'|colors\.background/i)
  })

  it("is Snake's too, for its obstacles and tunnels", () => {
    const source = readFileSync(join(GAMES, 'snake', 'components', 'SnakeBoardCanvas.tsx'), 'utf8')
    expect(source).toMatch(/boardStructureColor\(colors\)/)
    expect(source).not.toMatch(/(Obstacles|Tunnels) [^\n]*color=\{colors\.outline\}/)
  })

  // Snake's portals were rings in the theme's secondaryContainer, a shade of player 2's color, with
  // nothing to tell the two pairs apart (2026-11-04). They're every game's gates, which have colors of
  // their own (below).
  it("is not Snake's portals' color", () => {
    const source = readFileSync(join(GAMES, 'snake', 'components', 'SnakeBoardCanvas.tsx'), 'utf8')
    expect(source).toMatch(/<Gates\b/)
    expect(source).not.toMatch(/colors\.secondaryContainer/)
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

// Snake's food is the theme's tertiary, the color the other games' boxes are, so its boxes can't be
// that; they were the theme's secondary (player 2's red) and the same solid dot as the food, so they
// read as player 2's food. They're the pack's box shape in the theme's text color (2026-11-04).
describe("Snake's boxes", () => {
  const source = readFileSync(join(GAMES, 'snake', 'components', 'SnakeBoardCanvas.tsx'), 'utf8')

  it('are the pack box shape, in the theme text color', () => {
    expect(source).toMatch(/<MysteryPickup\b/)
    expect(source).toMatch(/<Pickups [^\n]*color=\{colors\.onSurface\}/)
  })

  it("are never a seat's color or the food's", () => {
    expect(source).not.toMatch(/<Pickups [^\n]*color=\{colors\.(primary|secondary|tertiary)\}/)
  })
})

// The gates were rings in the arena gray, the two pairs told apart only by die dots (2026-11-08). Each
// pair has its own color now, from the theme (shared/match/gateColors.ts), read by every board outside
// its Skia Canvas, since the theme is React context and doesn't reach inside one.
describe('the gate colors', () => {
  const BOARDS = {
    trap: join(GAMES, 'trap', 'components', 'GameBoard.tsx'),
    turf: join(GAMES, 'turf', 'TurfBoard.tsx'),
    tag: join(GAMES, 'tag', 'TagBoard.tsx'),
    snake: join(GAMES, 'snake', 'components', 'SnakeBoardCanvas.tsx')
  }

  it.each(Object.entries(BOARDS))("are the theme's in %s's board, not the arena gray", (_, file) => {
    const source = readFileSync(file, 'utf8')
    expect(source).toMatch(/const gateColors = useGateColors\(\)/)
    expect(source).toMatch(/<Gates [^\n]*colors=\{gateColors\}/)
    expect(source).not.toMatch(/<Gates [^\n]*\bcolor=/)
  })
})
