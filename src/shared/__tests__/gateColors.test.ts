import { defaultColors, getContrastRatio, getOklch, getThirdColor } from '@rific/auto-paper'

import { gateColors, gateHues, occupiedHues } from '@/shared/match/gateColors'
import { EFFECT_COLORS } from '@/shared/powerups'

// The linked-gates arena's two pair colors come from the theme: the two hues furthest from the seats'
// colors, the boxes' tertiary and the effect rings. The seats are any two of auto-paper's 20 colors,
// and the theme's tertiary is getThirdColor of the two (the shell's seat theme).

const BOARDS = { dark: '#0F0F0F', light: '#F0F0F0' }

function themeFor(primary: string, secondary: string, dark: boolean) {
  return { primary, secondary, tertiary: getThirdColor(primary, secondary), background: dark ? BOARDS.dark : BOARDS.light }
}

function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

const hue = (color: string) => getOklch(color)!.h

describe('occupiedHues', () => {
  it("is the seats', the tertiary's and every effect ring's", () => {
    expect(occupiedHues(themeFor('#2196f3', '#f44336', true))).toHaveLength(3 + Object.keys(EFFECT_COLORS).length)
  })

  it('skips grays, whose hue nobody can see (Taupe, Blue Grey)', () => {
    expect(occupiedHues(themeFor('#8d7b68', '#607d8b', true))).toHaveLength(1 + Object.keys(EFFECT_COLORS).length)
  })
})

describe('gateHues', () => {
  it('picks the two hues furthest from everything, at least 120 apart, lower first', () => {
    expect(gateHues([0, 180])).toEqual([90, 270])
  })

  it('goes teal and pink with the default blue and red seats', () => {
    expect(gateHues(occupiedHues(themeFor('#2196f3', '#f44336', true)))).toEqual([174, 354])
  })
})

describe('gateColors', () => {
  it('cores each gate in the board color', () => {
    expect(gateColors(themeFor('#2196f3', '#f44336', true), true).core).toBe(BOARDS.dark)
    expect(gateColors(themeFor('#2196f3', '#f44336', false), false).core).toBe(BOARDS.light)
  })

  it('moves away from a seat a player picks in its place', () => {
    const blueRed = gateColors(themeFor('#2196f3', '#f44336', true), true).pairs
    const pinkTeal = gateColors(themeFor('#ec407a', '#009688', true), true).pairs

    expect(pinkTeal).not.toEqual(blueRed)
    for (const pair of pinkTeal) {
      expect(hueGap(hue(pair), hue('#ec407a'))).toBeGreaterThan(24)
      expect(hueGap(hue(pair), hue('#009688'))).toBeGreaterThan(24)
    }
  })

  // Every pair of seat colors a player can pick, both boards: each pair color well clear of every hue
  // already on the board, the two well apart, and each standing out from the board.
  it.each(Object.entries(BOARDS))('keeps clear of every seat pick and stands out on the %s board', (name, background) => {
    const dark = name === 'dark'
    for (let i = 0; i < defaultColors.length; i++) {
      for (let j = i + 1; j < defaultColors.length; j++) {
        const theme = themeFor(defaultColors[i].value, defaultColors[j].value, dark)
        const [one, two] = gateColors(theme, dark).pairs
        expect(hueGap(hue(one), hue(two))).toBeGreaterThanOrEqual(119)
        for (const pair of [one, two]) {
          for (const taken of occupiedHues(theme)) expect(hueGap(hue(pair), taken)).toBeGreaterThan(24)
          expect(getContrastRatio(pair, background)).toBeGreaterThan(3)
        }
      }
    }
  })
})
