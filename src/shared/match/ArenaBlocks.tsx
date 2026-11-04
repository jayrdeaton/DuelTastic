import { RoundedRect } from '@shopify/react-native-skia'
import type { GridCell } from '@tastic/grid'
import { useMemo } from 'react'

import { mergeBlocks } from './mergeBlocks'

// An arena's blocks (pillars, gauntlet walls), drawn the same in every game: solid, in the arena's
// structure color, merged into one rounded block per wall or pillar (mergeBlocks.ts). Import it only
// from a board file: it pulls in Skia, which on web has to wait for CanvasKit (see the boards' host
// pairs).

// The corners' rounding, as a share of a cell, so a wall reads as one solid bar at every cell size.
const CORNER = 0.25

export function ArenaBlocks({ cells, cellPx, color }: { cells: readonly GridCell[]; cellPx: number; color: string }) {
  const blocks = useMemo(() => mergeBlocks(cells), [cells])
  return (
    <>
      {blocks.map((b) => (
        <RoundedRect key={`${b.x},${b.y}`} x={b.x * cellPx} y={b.y * cellPx} width={b.width * cellPx} height={b.height * cellPx} r={cellPx * CORNER} color={color} />
      ))}
    </>
  )
}
