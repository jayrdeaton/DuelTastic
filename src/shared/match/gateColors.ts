import { getOklch, getOklchHex } from '@rific/auto-paper'

import { EFFECT_COLORS } from '@/shared/powerups'

// The colors of the linked-gates arena's two pairs, worked out from the theme so they never look
// like anything else on the board. Colors already mean something there: each seat's color (any of
// the 20 a player can pick), the theme's tertiary (the powerup boxes, Snake's food), the effect rings
// (gold, ice blue, mud, red, violet, cyan) and the arena gray. A fixed pair would always clash with
// some seat a player can pick, so the hues are picked fresh from the theme: the two hues furthest from
// every hue already on the board, at least a third of the way round from each other. Lightness and
// chroma are set for the board's background, so both pairs read the same on a dark board and a light
// one. Hues are OKLCH's, where equal steps look equal.

export type GateColors = {
  /** Pair 1's color, then pair 2's. */
  pairs: readonly [string, string]
  /** The hole in the middle of each gate. */
  core: string
}

type ThemeColors = { primary: string; secondary: string; tertiary: string; background: string }

// Below this chroma a color is a gray to the eye (the arena, Taupe, Blue Grey), so its hue can't be
// confused with a gate's.
const HUED_CHROMA = 0.05
// How far round the two pairs' hues have to be from each other, in degrees.
const MIN_PAIR_GAP_DEG = 120
// The pairs' OKLCH lightness and chroma on each board: bright on dark, deeper on light, so each
// stands out from the background as much as a seat color does.
const DARK_TONE = { l: 0.78, c: 0.16 }
const LIGHT_TONE = { l: 0.58, c: 0.18 }

function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

// The hues already on the board: the seats', the boxes' and every effect ring's.
export function occupiedHues(colors: ThemeColors): number[] {
  const hues: number[] = []
  for (const color of [colors.primary, colors.secondary, colors.tertiary, ...Object.values(EFFECT_COLORS)]) {
    const oklch = getOklch(color)
    if (oklch && oklch.c >= HUED_CHROMA) hues.push(oklch.h)
  }
  return hues
}

// The two hues for the gates: as far as they can be from every occupied hue (the nearer of the two
// decides), then as far in total, at least minGapDeg apart, in whole degrees, lower hue first.
export function gateHues(occupied: readonly number[], minGapDeg: number = MIN_PAIR_GAP_DEG): [number, number] {
  const clearance = Array.from({ length: 360 }, (_, h) => (occupied.length ? Math.min(...occupied.map((o) => hueGap(h, o))) : 180))
  let best: [number, number] = [0, minGapDeg]
  let bestMin = -1
  let bestSum = -1
  for (let a = 0; a < 360; a++) {
    for (let b = a + 1; b < 360; b++) {
      if (hueGap(a, b) < minGapDeg) continue
      const min = Math.min(clearance[a], clearance[b])
      const sum = clearance[a] + clearance[b]
      if (min > bestMin || (min === bestMin && sum > bestSum)) {
        best = [a, b]
        bestMin = min
        bestSum = sum
      }
    }
  }
  return best
}

export function gateColors(colors: ThemeColors, dark: boolean): GateColors {
  const tone = dark ? DARK_TONE : LIGHT_TONE
  const [a, b] = gateHues(occupiedHues(colors))
  return { pairs: [getOklchHex({ ...tone, h: a }), getOklchHex({ ...tone, h: b })], core: colors.background }
}
