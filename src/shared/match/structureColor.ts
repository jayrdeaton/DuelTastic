import { getBlendedColor } from '@rific/auto-paper'

// The one color every game draws its arena in (pillars, gauntlet walls, gates, tunnels): a neutral
// gray halfway between the theme's text and background, so it reads as inert board structure on a
// dark board and a light one and belongs to nothing that moves. Not the theme's outline, which is
// blended toward player 1's color (auto-paper's useComputedTheme.ts); not the tertiary, which is the
// powerup boxes' color (an arena blended with it read as part of the boxes, 2026-11-04); and never the
// board's own background (Turf drew its arena in that and every pillar, wall, gate and tunnel was
// invisible on unclaimed ground).
export function boardStructureColor(colors: { onSurface: string; background: string }): string {
  return getBlendedColor(colors.onSurface, colors.background, 0.5)
}
