import { cellToPixel, type GridCell } from '@tastic/grid'
import { useEffect, useRef } from 'react'
import { Easing, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'

// How much longer a glide runs than the rider takes to ride its cells: about a frame, so the head is
// still moving when the next step lands (one can land a frame late) instead of stopping on the cell
// and setting off again. Measured against frame-by-frame models of the round loop, this keeps the
// head's speed within a few percent at 60Hz and 120Hz, where a glide timed to the last gap between
// steps swung by a third and stood still on several frames a second.
export const GLIDE_OVERLAP_MS = 16

// The furthest a rider rides in a straight line between two renders: two cells (Dash). A move
// further than that, or not in a straight line, is a jump (a gate, a rider sent home) and is drawn
// as one.
const MAX_RUN_CELLS = 2

// One leg of a glide: where to, and how long it takes (0 for a jump).
export interface GlideLeg {
  x: number
  y: number
  ms: number
}

function cellCenter(cell: GridCell, cellPx: number) {
  const { x, y } = cellToPixel(cell, cellPx)
  return { x: x + cellPx / 2, y: y + cellPx / 2 }
}

// The legs from where the head is drawn now to the rider's new head: back onto the last head's cell
// first, then through each cell it rode since, so a turn is drawn round its corner rather than across
// it. The ride takes the rider's own time for those cells (plus the overlap), shared out by distance,
// the catch-up leg included, so the head keeps one even speed. Null when it rode no cells, only
// jumped.
export function glideRoute(from: { x: number; y: number }, lastHead: GridCell, path: readonly GridCell[], cellPx: number, msPerCell: number): GlideLeg[] | null {
  const head = path[path.length - 1]
  let seen = path.length - 1
  while (seen >= 0 && (path[seen].x !== lastHead.x || path[seen].y !== lastHead.y)) seen--
  const cells = seen >= 0 ? path.slice(seen + 1) : [head]

  const start = cellCenter(lastHead, cellPx)
  const catchUp = (Math.abs(start.x - from.x) + Math.abs(start.y - from.y)) / cellPx
  // Moves of their own, in cells, with 0 for a jump.
  const moves: { to: GridCell; cells: number }[] = []
  let at = lastHead
  for (const cell of cells) {
    const dx = Math.abs(cell.x - at.x)
    const dy = Math.abs(cell.y - at.y)
    const run = (dx === 0 || dy === 0) && dx + dy <= MAX_RUN_CELLS
    moves.push({ to: cell, cells: run ? dx + dy : 0 })
    at = cell
  }
  const ridden = moves.reduce((sum, m) => sum + m.cells, 0)
  if (ridden === 0) return null

  // A head drawn more than a cell behind has been held up (a stalled frame): it jumps onto the last
  // cell rather than racing to it.
  const legs: GlideLeg[] = []
  const totalMs = ridden * msPerCell + GLIDE_OVERLAP_MS
  const distance = (catchUp > 1 ? 0 : catchUp) + ridden
  if (catchUp > 0) legs.push({ ...start, ms: catchUp > 1 ? 0 : (totalMs * catchUp) / distance })
  for (const move of moves) legs.push({ ...cellCenter(move.to, cellPx), ms: (totalMs * move.cells) / distance })

  // Legs running on in the same direction are one leg.
  const merged: GlideLeg[] = []
  let legFrom = from
  let lastHeading: string | null = null
  for (const leg of legs) {
    const heading = leg.ms > 0 ? `${Math.sign(leg.x - legFrom.x)},${Math.sign(leg.y - legFrom.y)}` : null
    const last = merged[merged.length - 1]
    if (last && heading !== null && heading === lastHeading) merged[merged.length - 1] = { ...leg, ms: last.ms + leg.ms }
    else merged.push(leg)
    lastHeading = heading
    legFrom = leg
  }
  return merged
}

export interface RiderGlideParams {
  // The cells the rider rode through lately, oldest first, its head last: Tag's short tail, Turf's
  // trail. Only the head is needed for a straight move.
  path: readonly GridCell[]
  cellPx: number
  // How long the rider takes to ride one cell at its speed now.
  msPerCell: number
  // Holds the head on its cell instead of gliding (a new round being set up).
  snap: boolean
}

// Where to draw a rider's head: gliding from cell to cell at the rider's own pace, keyed on its own
// steps rather than the round's ticks, so a rider that steps more often (It in Tag) or less often
// (under Mud) still moves at one even speed.
export function useRiderGlide({ path, cellPx, msPerCell, snap }: RiderGlideParams) {
  const head = path[path.length - 1]
  const initial = cellCenter(head, cellPx)
  const x = useSharedValue(initial.x)
  const y = useSharedValue(initial.y)
  const lastHeadRef = useRef(head)

  useEffect(() => {
    const lastHead = lastHeadRef.current
    if (!snap && lastHead.x === head.x && lastHead.y === head.y) return
    lastHeadRef.current = head
    const legs = snap ? null : glideRoute({ x: x.value, y: y.value }, lastHead, path, cellPx, msPerCell)
    if (!legs) {
      const { x: hx, y: hy } = cellCenter(head, cellPx)
      x.value = hx
      y.value = hy
      return
    }
    const timing = (to: number, ms: number) => withTiming(to, { duration: ms, easing: Easing.linear })
    const xs = legs.map((leg) => timing(leg.x, leg.ms))
    const ys = legs.map((leg) => timing(leg.y, leg.ms))
    x.value = xs.length === 1 ? xs[0] : withSequence(...xs)
    y.value = ys.length === 1 ? ys[0] : withSequence(...ys)
  }, [head, path, cellPx, msPerCell, snap, x, y])

  return { x, y }
}
