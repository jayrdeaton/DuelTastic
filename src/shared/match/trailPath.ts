import { Skia, type SkPath } from '@shopify/react-native-skia'
import { cellToPixel, type GridCell, isAdjacent } from '@tastic/grid'

// A rider's trail (LightCycles, Turf) or tail (Tag), drawn the same in every game. Import it only from
// a board file: it pulls in Skia, which on web has to wait for CanvasKit (see the boards' host pairs).

// The pieces of a rider's path it rode cell to cell, oldest first: a new piece starts wherever it
// jumped (a gate, or wrapping round the edge in LightCycles), so the drawing never runs a line across
// the board from where it went in to where it came out.
export function trailRuns(cells: readonly GridCell[]): GridCell[][] {
  const runs: GridCell[][] = []
  cells.forEach((cell, i) => {
    if (i === 0 || !isAdjacent(cells[i - 1], cell)) runs.push([cell])
    else runs[runs.length - 1].push(cell)
  })
  return runs
}

// Whether the last two cells of a path are a jump: the head just came out of a gate, so the segment
// gliding into it from the cell before must not be drawn.
export function endsInJump(cells: readonly GridCell[]): boolean {
  return cells.length > 1 && !isAdjacent(cells[cells.length - 2], cells[cells.length - 1])
}

// The path through each cell's center, one piece per run.
export function trailPath(cells: readonly GridCell[], cellPx: number): SkPath {
  const path = Skia.PathBuilder.Make()
  for (const run of trailRuns(cells)) {
    run.forEach((cell, i) => {
      const { x, y } = cellToPixel(cell, cellPx)
      if (i === 0) path.moveTo(x + cellPx / 2, y + cellPx / 2)
      else path.lineTo(x + cellPx / 2, y + cellPx / 2)
    })
  }
  return path.detach()
}
