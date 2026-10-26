import { Path, Skia, type SkPath } from '@shopify/react-native-skia'
import type { GridSize } from '@tastic/grid'
import { useMemo } from 'react'

import { zoneSideFor } from './playerZones'

type Seat = 1 | 2
type OrientationMode = 'faceToFace' | 'sideBySide'

export function splitWallPath(grid: GridSize, cellPx: number, orientationMode: OrientationMode, p1OnRight: boolean, seat: Seat): SkPath {
  const path = Skia.PathBuilder.Make()
  const width = grid.cols * cellPx
  const height = grid.rows * cellPx
  const midX = width / 2
  const midY = height / 2
  const side = zoneSideFor(seat, orientationMode, p1OnRight)
  if (side === 'top') {
    path.moveTo(0, midY)
    path.lineTo(0, 0)
    path.lineTo(width, 0)
    path.lineTo(width, midY)
  } else if (side === 'bottom') {
    path.moveTo(0, midY)
    path.lineTo(0, height)
    path.lineTo(width, height)
    path.lineTo(width, midY)
  } else if (side === 'left') {
    path.moveTo(midX, 0)
    path.lineTo(0, 0)
    path.lineTo(0, height)
    path.lineTo(midX, height)
  } else {
    path.moveTo(midX, 0)
    path.lineTo(width, 0)
    path.lineTo(width, height)
    path.lineTo(midX, height)
  }
  return path.detach()
}

export function SplitWalls({ grid, cellPx, orientationMode, p1OnRight, colors, strokeWidth }: { grid: GridSize; cellPx: number; orientationMode: OrientationMode; p1OnRight: boolean; colors: Record<Seat, string>; strokeWidth: number }) {
  const p1Path = useMemo(() => splitWallPath(grid, cellPx, orientationMode, p1OnRight, 1), [grid, cellPx, orientationMode, p1OnRight])
  const p2Path = useMemo(() => splitWallPath(grid, cellPx, orientationMode, p1OnRight, 2), [grid, cellPx, orientationMode, p1OnRight])
  return (
    <>
      <Path path={p1Path} style='stroke' strokeWidth={strokeWidth} color={colors[1]} />
      <Path path={p2Path} style='stroke' strokeWidth={strokeWidth} color={colors[2]} />
    </>
  )
}
