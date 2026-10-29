import { Line, Shadow, vec } from '@shopify/react-native-skia'
import { cellToPixel, type GridCell } from '@tastic/grid'

function cellCenter(cell: GridCell, cellPx: number) {
  const { x, y } = cellToPixel(cell, cellPx)
  return { x: x + cellPx / 2, y: y + cellPx / 2 }
}

// A tunnel (arenas.ts's buildArenaTunnels) in every game, drawn as a straight road rather than a
// glyph: per explicit user feedback, LightCycles' earlier single faint centerline with corner-marker
// mouths didn't read clearly, and Turf's and Tag's single thick line read as a wall. The corridor is
// always axis-aligned and dead straight, so its two long edges are the mouth-to-mouth centerline
// offset by half a cell either side, in the board's own wall stroke, with a drop shadow so the
// corridor reads as sitting at a different depth from the flat board around it (still ridable: going
// under is a collision rule, this is just what makes it legible at a glance).
export function TunnelRoad({ tunnel, cellPx, color, strokeWidth }: { tunnel: { cells: readonly GridCell[] }; cellPx: number; color: string; strokeWidth: number }) {
  if (tunnel.cells.length === 0) return null
  const first = cellCenter(tunnel.cells[0], cellPx)
  const last = cellCenter(tunnel.cells[tunnel.cells.length - 1], cellPx)
  const horizontal = first.y === last.y
  const offsetX = horizontal ? 0 : cellPx / 2
  const offsetY = horizontal ? cellPx / 2 : 0
  return (
    <>
      <Line p1={vec(first.x - offsetX, first.y - offsetY)} p2={vec(last.x - offsetX, last.y - offsetY)} strokeWidth={strokeWidth} color={color}>
        <Shadow dx={0} dy={2} blur={3} color='rgba(0, 0, 0, 0.65)' />
      </Line>
      <Line p1={vec(first.x + offsetX, first.y + offsetY)} p2={vec(last.x + offsetX, last.y + offsetY)} strokeWidth={strokeWidth} color={color}>
        <Shadow dx={0} dy={2} blur={3} color='rgba(0, 0, 0, 0.65)' />
      </Line>
    </>
  )
}
