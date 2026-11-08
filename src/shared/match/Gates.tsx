import { useAutoPaperTheme } from '@rific/auto-paper'
import { cellToPixel, type GridCell } from '@tastic/grid'
import { Portal, usePortalProgress } from '@tastic/sprites/portal'
import { useMemo } from 'react'
import { type SharedValue, useDerivedValue } from 'react-native-reanimated'

import { type GateColors, gateColors } from '@/shared/match/gateColors'
import { pickupRadiusPx } from '@/shared/powerups'

// The gates of the linked-gates arena (Trap's Portals, Snake's and Tag's Holes, Turf's Gates),
// drawn the same in every game: @tastic/sprites' vortex Portal, three arms spinning into a dark core.
// Import it only from a board file: it pulls in Skia, which on web has to wait for CanvasKit (see the
// boards' host pairs).

// The pair colors for the board's theme (gateColors.ts). Call it in the board, outside its Canvas: the
// theme is React context, which doesn't reach inside a Skia Canvas (Skia draws with its own renderer).
export function useGateColors(): GateColors {
  const { colors, dark } = useAutoPaperTheme()
  const { primary, secondary, tertiary, background } = colors
  return useMemo(() => gateColors({ primary, secondary, tertiary, background }, dark), [primary, secondary, tertiary, background, dark])
}

// One gate: a vortex `r` across in its pair's color, the mirror image (turning the other way) for the
// second pair.
function Gate({ cell, cellPx, r, color, core, mirrored, progress }: { cell: GridCell; cellPx: number; r: number; color: string; core: string; mirrored: boolean; progress: SharedValue<number> }) {
  const { x, y } = cellToPixel(cell, cellPx)
  const cx = x + cellPx / 2
  const cy = y + cellPx / 2
  const sx = useDerivedValue(() => cx, [cx])
  const sy = useDerivedValue(() => cy, [cy])
  const sr = useDerivedValue(() => r, [r])
  const sColor = useDerivedValue(() => color, [color])
  const sCore = useDerivedValue(() => core, [core])
  return <Portal variant='vortex' x={sx} y={sy} radius={sr} color={sColor} coreColor={sCore} mirrored={mirrored} progress={progress} />
}

// Every pair's two ends look alike (either one is the way in), and the pairs differ twice over, so a
// rider can see where a gate comes out, the far corner that matches: each pair has its own color, and
// the second pair turns the other way, which a red-green colorblind player can still see (teal and
// pink, the pairs with the default seats, come out the same gray for them). All gates run on one
// clock, so both ends of a pair turn in step.
//
// A gate is the size of the game's powerup box, `radius`: a landmark, not a one-cell blip, though the
// real hitbox is still its own cell. That's pickupRadiusPx unless the game sizes its boxes its own
// way (Snake's, which a snake only takes from their own cell).
export function Gates({ portals, cellPx, colors, radius = pickupRadiusPx(cellPx) }: { portals: readonly { a: GridCell; b: GridCell }[]; cellPx: number; colors: GateColors; radius?: number }) {
  const progress = usePortalProgress()
  return <>{portals.flatMap((portal, pair) => [portal.a, portal.b].map((cell, end) => <Gate key={`${pair}-${end}`} cell={cell} cellPx={cellPx} r={radius} color={colors.pairs[pair % 2]} core={colors.core} mirrored={pair % 2 === 1} progress={progress} />))}</>
}
