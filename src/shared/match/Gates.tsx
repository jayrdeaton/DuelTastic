import { Circle } from '@shopify/react-native-skia'
import { cellToPixel, type GridCell } from '@tastic/grid'

import { pickupRadiusPx } from '@/shared/powerups'

// The gates of the linked-gates arena (LightCycles' and Snake's Portals, Turf's Gates, Tag's Holes),
// drawn the same in every game. Import it only from a board file: it pulls in Skia, which on web has
// to wait for CanvasKit (see the boards' host pairs).

// The ring's stroke, a little heavier than the board's 1.5 edge so a gate reads as a landmark.
const GATE_STROKE_WIDTH = 2
// The marks inside a gate that say which pair it's in: dots, as on a die, one for the first pair and
// two for the second. Sized and spaced from the ring, so they read at every cell size.
const PIP_RADIUS = 0.2
const PIP_SPACING = 0.5

// One gate: a ring `r` across, with `pips` dots across its middle.
function Gate({ cell, cellPx, r, pips, color }: { cell: GridCell; cellPx: number; r: number; pips: number; color: string }) {
  const { x, y } = cellToPixel(cell, cellPx)
  const cx = x + cellPx / 2
  const cy = y + cellPx / 2
  return (
    <>
      <Circle cx={cx} cy={cy} r={r} style='stroke' strokeWidth={GATE_STROKE_WIDTH} color={color} />
      {Array.from({ length: pips }, (_, i) => (
        <Circle key={i} cx={cx + (i - (pips - 1) / 2) * r * PIP_SPACING} cy={cy} r={r * PIP_RADIUS} color={color} />
      ))}
    </>
  )
}

// Every pair's two ends look alike (either one is the way in), and each pair has its own count of
// dots, so a rider can see where a gate comes out: the far corner with the same mark.
//
// A gate is the size of the game's powerup box, `radius`: a landmark, not a one-cell blip, though the
// real hitbox is still its own cell. That's pickupRadiusPx unless the game sizes its boxes its own
// way (Snake's, which a snake only takes from their own cell).
export function Gates({ portals, cellPx, color, radius = pickupRadiusPx(cellPx) }: { portals: readonly { a: GridCell; b: GridCell }[]; cellPx: number; color: string; radius?: number }) {
  return (
    <>
      {portals.map((portal, pair) => (
        <Gate key={`${pair}-a`} cell={portal.a} cellPx={cellPx} r={radius} pips={pair + 1} color={color} />
      ))}
      {portals.map((portal, pair) => (
        <Gate key={`${pair}-b`} cell={portal.b} cellPx={cellPx} r={radius} pips={pair + 1} color={color} />
      ))}
    </>
  )
}
