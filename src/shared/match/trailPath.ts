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

// The front of a trail as its head glides along it (LightCycles): from where the head last stopped
// through the cells it's riding to (`cells`, oldest first), as far as the head at (x, y) has got, then
// on to the head itself, as runs of points in px. The head is on one of the straight runs between
// those cells, or still on its way to the first one (useRiderGlide draws it a little behind its
// steps), or standing on one. A jump between two cells (a gate, a wrap round the edge) starts a new run and is never ridden
// along. Drawn this way the front follows the head round a corner instead of cutting across it, and
// never runs ahead of it into a cell it hasn't reached. A worklet, called from a useDerivedValue
// every frame; adjacency is checked inline, since an imported function isn't guaranteed to cross into
// a worklet.
export function leadingRuns(cells: readonly { x: number; y: number }[], x: number, y: number, cellPx: number): { x: number; y: number }[][] {
  'worklet'
  if (cells.length === 0) return []
  const near = 0.5
  const px = (c: { x: number; y: number }) => ({ x: c.x * cellPx + cellPx / 2, y: c.y * cellPx + cellPx / 2 })
  const adjacent = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
  const between = (v: number, a: number, b: number) => v >= Math.min(a, b) - near && v <= Math.max(a, b) + near
  // The last cell the head has passed: the one it's standing on, or the start of the run it's on.
  let reached = 0
  for (let i = cells.length - 1; i >= 0; i--) {
    const b = px(cells[i])
    if (Math.abs(x - b.x) < near && Math.abs(y - b.y) < near) {
      reached = i
      break
    }
    if (i > 0 && adjacent(cells[i - 1], cells[i])) {
      const a = px(cells[i - 1])
      const onRun = a.x === b.x ? Math.abs(x - a.x) < near && between(y, a.y, b.y) : Math.abs(y - a.y) < near && between(x, a.x, b.x)
      if (onRun) {
        reached = i - 1
        break
      }
    }
  }
  const runs: { x: number; y: number }[][] = []
  let run: { x: number; y: number }[] = []
  for (let i = 0; i <= reached; i++) {
    if (i > 0 && !adjacent(cells[i - 1], cells[i])) {
      runs.push(run)
      run = []
    }
    run.push(px(cells[i]))
  }
  run.push({ x, y })
  runs.push(run)
  return runs
}

// leadingRuns as a path, for a board's useDerivedValue. One path, so a see-through trail (Turf's,
// Tag's tail) is the same strength all along: drawn as two pieces, a settled part and a line on to
// the head, it doubled where they overlapped, a brighter patch just behind the head.
export function leadingTrailPath(cells: readonly { x: number; y: number }[], x: number, y: number, cellPx: number): SkPath {
  'worklet'
  const path = Skia.PathBuilder.Make()
  for (const run of leadingRuns(cells, x, y, cellPx)) {
    run.forEach((point, i) => {
      if (i === 0) path.moveTo(point.x, point.y)
      else path.lineTo(point.x, point.y)
    })
  }
  return path.detach()
}

// The last `length` px of leadingRuns, measured back from the head (a jump between runs counts for
// nothing), oldest first: a tail of one length (Tag's) whose back end slides along with the head,
// rather than dropping a whole cell every step.
export function trimmedRuns(runs: { x: number; y: number }[][], length: number): { x: number; y: number }[][] {
  'worklet'
  const kept: { x: number; y: number }[][] = []
  let left = length
  for (let r = runs.length - 1; r >= 0 && left > 0; r--) {
    const run = runs[r]
    const back = [run[run.length - 1]]
    for (let i = run.length - 1; i > 0 && left > 0; i--) {
      const a = run[i]
      const b = run[i - 1]
      const d = Math.hypot(b.x - a.x, b.y - a.y)
      if (d <= left) {
        back.push(b)
        left -= d
      } else {
        back.push({ x: a.x + ((b.x - a.x) * left) / d, y: a.y + ((b.y - a.y) * left) / d })
        left = 0
      }
    }
    if (back.length > 1) kept.unshift(back.reverse())
  }
  return kept
}

// A tail `length` px long behind the head at (x, y), as one path (trimmedRuns of leadingRuns).
export function tailTrailPath(cells: readonly { x: number; y: number }[], x: number, y: number, cellPx: number, length: number): SkPath {
  'worklet'
  const path = Skia.PathBuilder.Make()
  for (const run of trimmedRuns(leadingRuns(cells, x, y, cellPx), length)) {
    run.forEach((point, i) => {
      if (i === 0) path.moveTo(point.x, point.y)
      else path.lineTo(point.x, point.y)
    })
  }
  return path.detach()
}
