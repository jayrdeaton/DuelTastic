import { getBlendedColor } from '@rific/auto-paper'

// The one color every game draws its arena in (pillars, gauntlet walls, portals, tunnels). The theme's
// outline on its own is blended toward player 1's color (auto-paper's useComputedTheme.ts), so it
// read as player 1's; blending it halfway with tertiary (the neutral, belongs-to-neither-seat role
// pickups use) makes it inert board structure, visible on a dark board and a light one. Never the
// board's own background: Turf drew its arena in that and every pillar, wall, gate and tunnel was
// invisible on unclaimed ground.
export function boardStructureColor(colors: { tertiary: string; outline: string }): string {
  return getBlendedColor(colors.tertiary, colors.outline, 0.5)
}
