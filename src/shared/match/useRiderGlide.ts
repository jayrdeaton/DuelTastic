import { cellToPixel, type GridCell } from '@tastic/grid'
import { useCallback, useEffect, useRef } from 'react'
import { type FrameInfo, useFrameCallback, useSharedValue } from 'react-native-reanimated'

// How far behind its steps a rider's head is drawn, in ms of its own riding: a little more than a
// frame at 60Hz, so a step that lands a frame late (the round loops step on frames) finds the head
// still on its way rather than standing on its last cell.
export const GLIDE_LAG_MS = 24

// How much further behind than that a head may fall (a stalled frame, a burst of steps after one)
// before it skips ahead along its way to GLIDE_LAG_MS behind, rather than racing to catch up.
const GLIDE_MAX_BEHIND_MS = 100

// The most whole cells a head can be drawn behind the cell its rider last stood on before its latest
// step, at `msPerCell`: for a board that draws the trail's front live up to the head (Trap's),
// which has to start at least that far back or the settled trail would run ahead of the head.
export function glideCellsBehind(msPerCell: number): number {
  return Math.ceil((GLIDE_LAG_MS + GLIDE_MAX_BEHIND_MS) / msPerCell) + 1
}

// How quickly a head's pace corrects toward GLIDE_LAG_MS behind its steps: this many ms off changes
// its pace by its whole speed. Slow enough that steps landing a frame early or late change it by a
// few percent at most; it settles within a few steps of a change of speed.
const GLIDE_CORRECTION_MS = 400
const MIN_PACE = 0.5
const MAX_PACE = 2.5

// The longest frame counted: the first frame after a pause or the app coming back moves the head no
// further than this.
const MAX_FRAME_MS = 100

// The furthest a rider rides in a straight line between two renders: two cells (Dash). A move
// further than that, or not in a straight line, is a jump (a gate), or a flight when it's handed one
// (a Turf rider sent home, see flightMs).
const MAX_RUN_CELLS = 2

// A point a head is on its way to: a cell's center ridden to at the rider's pace, jumped to, or flown
// to over `ms`.
export interface GlideStop {
  x: number
  y: number
  kind: 'ride' | 'jump' | 'fly'
  ms: number
}

// Where a head is drawn and where it's going, kept on the UI thread and moved on by every frame.
export interface Glide {
  x: number
  y: number
  stops: GlideStop[]
  // The rider's pace, in px a ms.
  pxPerMs: number
  // How long the latest step's riding takes at that pace, and how long ago it was queued.
  stepMs: number
  sinceStep: number
  // A flight under way: where it took off and how far through it is, -1 when there's none.
  flyFromX: number
  flyFromY: number
  flyMs: number
}

function cellCenter(cell: GridCell, cellPx: number) {
  const { x, y } = cellToPixel(cell, cellPx)
  return { x: x + cellPx / 2, y: y + cellPx / 2 }
}

// A head standing at (x, y), going nowhere.
export function restingGlide(x: number, y: number, pxPerMs: number): Glide {
  'worklet'
  return { x, y, stops: [], pxPerMs, stepMs: 0, sinceStep: 0, flyFromX: x, flyFromY: y, flyMs: -1 }
}

// The stops for a rider's latest step: each cell it rode through since its last head, from the last
// time it was on that cell (Tag's riders can turn straight back, so a cell can be in the tail twice),
// ridden at its pace, or jumped or flown to when the move isn't a run. With how long the riding takes.
export function glideStops(lastHead: GridCell, path: readonly GridCell[], cellPx: number, msPerCell: number, flightMs: number | null = null): { stops: GlideStop[]; stepMs: number } {
  const head = path[path.length - 1]
  let seen = path.length - 1
  while (seen >= 0 && (path[seen].x !== lastHead.x || path[seen].y !== lastHead.y)) seen--
  const cells = seen >= 0 ? path.slice(seen + 1) : [head]
  const stops: GlideStop[] = []
  let ridden = 0
  let at = lastHead
  for (const cell of cells) {
    const dx = Math.abs(cell.x - at.x)
    const dy = Math.abs(cell.y - at.y)
    const run = (dx === 0 || dy === 0) && dx + dy <= MAX_RUN_CELLS
    const { x, y } = cellCenter(cell, cellPx)
    if (run) {
      stops.push({ x, y, kind: 'ride', ms: (dx + dy) * msPerCell })
      ridden += dx + dy
    } else stops.push({ x, y, kind: flightMs ? 'fly' : 'jump', ms: flightMs ?? 0 })
    at = cell
  }
  return { stops, stepMs: ridden * msPerCell }
}

// The head with a step's stops queued after the ones it's still on its way to.
export function queueGlide(glide: Glide, stops: readonly GlideStop[], stepMs: number, pxPerMs: number): Glide {
  'worklet'
  return { ...glide, stops: [...glide.stops, ...stops], pxPerMs, stepMs, sinceStep: 0 }
}

// The head `dt` ms on. It rides its stops at the rider's own pace, corrected a little toward
// GLIDE_LAG_MS behind the latest step, so it moves the same distance every ms of every frame whenever
// its steps land: an animation restarted each step started from where the head was drawn the frame
// before, so the first frame of every step lost the time since that frame and moved short. A jump is
// taken at once; a flight runs on its own clock, easing out and back in. A head that has fallen more
// than GLIDE_MAX_BEHIND_MS further behind skips ahead along its way.
export function advanceGlide(glide: Glide, dt: number): Glide {
  'worklet'
  const stops = glide.stops.slice()
  let { x, y, flyFromX, flyFromY, flyMs } = glide
  const sinceStep = glide.sinceStep + dt
  const done = () => ({ ...glide, x, y, stops, sinceStep, flyFromX, flyFromY, flyMs })

  while (stops.length > 0 && stops[0].kind !== 'ride') {
    const stop = stops[0]
    if (stop.kind === 'jump') {
      x = stop.x
      y = stop.y
      stops.shift()
      continue
    }
    if (flyMs < 0) {
      flyFromX = x
      flyFromY = y
      flyMs = 0
    }
    flyMs = Math.min(stop.ms, flyMs + dt)
    const t = stop.ms > 0 ? flyMs / stop.ms : 1
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    x = flyFromX + (stop.x - flyFromX) * eased
    y = flyFromY + (stop.y - flyFromY) * eased
    // A flight takes the whole frame.
    if (flyMs < stop.ms) return done()
    stops.shift()
    flyMs = -1
    return done()
  }
  if (stops.length === 0) return done()

  // Riding left to the last stop, in ms at the rider's pace (jumps take none).
  let left = 0
  let px = x
  let py = y
  for (const stop of stops) {
    if (stop.kind === 'fly') break
    if (stop.kind === 'ride') left += Math.hypot(stop.x - px, stop.y - py)
    px = stop.x
    py = stop.y
  }
  // Both as of the start of the frame: the head moves this frame's ms below.
  const leftMs = left / glide.pxPerMs
  const behind = leftMs - Math.max(0, GLIDE_LAG_MS + glide.stepMs - glide.sinceStep)
  const skipMs = behind > GLIDE_MAX_BEHIND_MS ? behind : 0
  const pace = skipMs > 0 ? 1 : Math.min(MAX_PACE, Math.max(MIN_PACE, 1 + behind / GLIDE_CORRECTION_MS))
  let travel = (skipMs + pace * dt) * glide.pxPerMs

  while (travel > 0 && stops.length > 0) {
    const stop = stops[0]
    if (stop.kind === 'fly') break
    if (stop.kind === 'jump') {
      x = stop.x
      y = stop.y
      stops.shift()
      continue
    }
    const d = Math.hypot(stop.x - x, stop.y - y)
    if (d <= travel) {
      x = stop.x
      y = stop.y
      travel -= d
      stops.shift()
    } else {
      x += ((stop.x - x) * travel) / d
      y += ((stop.y - y) * travel) / d
      travel = 0
    }
  }
  return done()
}

export interface RiderGlideParams {
  // The cells the rider rode through lately, oldest first, its head last: Tag's short tail, Turf's
  // and Trap's trail. Only the head is needed for a straight move.
  path: readonly GridCell[]
  cellPx: number
  // How long the rider takes to ride one cell at its speed now.
  msPerCell: number
  // Holds the head on its cell instead of gliding (a new round being set up).
  snap: boolean
  // A jump to a new cell flies there instead, over this long, easing out and back in so it's easy to
  // follow (a Turf rider sent home after a crash). Null for a plain jump (a gate).
  flightMs?: number | null
}

// Where to draw a rider's head (Trap, Turf and Tag): gliding from cell to cell at the rider's
// own pace, keyed on its own steps rather than the round's ticks, so a rider that steps more often (It
// in Tag) or less often (under Mud) still moves at one even speed, and round a corner rather than
// across it. Each step queues its cells; a frame callback moves the head along them (advanceGlide).
export function useRiderGlide({ path, cellPx, msPerCell, snap, flightMs = null }: RiderGlideParams) {
  const head = path[path.length - 1]
  const initial = cellCenter(head, cellPx)
  const glide = useSharedValue<Glide>(restingGlide(initial.x, initial.y, cellPx / msPerCell))
  const x = useSharedValue(initial.x)
  const y = useSharedValue(initial.y)
  const lastHeadRef = useRef(head)

  useEffect(() => {
    const lastHead = lastHeadRef.current
    if (!snap && lastHead.x === head.x && lastHead.y === head.y) return
    lastHeadRef.current = head
    const pxPerMs = cellPx / msPerCell
    if (snap) {
      const { x: hx, y: hy } = cellCenter(head, cellPx)
      glide.modify(() => {
        'worklet'
        return restingGlide(hx, hy, pxPerMs)
      })
      return
    }
    const { stops, stepMs } = glideStops(lastHead, path, cellPx, msPerCell, flightMs)
    glide.modify((g) => {
      'worklet'
      return queueGlide(g, stops, stepMs, pxPerMs)
    })
  }, [head, path, cellPx, msPerCell, snap, flightMs, glide])

  // The same callback every render: useFrameCallback registers it again whenever it changes, and a
  // callback's first frame has no time since the one before, so a new one each step (the boards
  // render on every step) stood the head still for a frame each step.
  const onFrame = useCallback(
    (frame: FrameInfo) => {
      'worklet'
      const dt = Math.min(frame.timeSincePreviousFrame ?? 0, MAX_FRAME_MS)
      glide.modify((g) => {
        'worklet'
        return advanceGlide(g, dt)
      })
      const { x: hx, y: hy } = glide.get()
      x.set(hx)
      y.set(hy)
    },
    [glide, x, y]
  )
  useFrameCallback(onFrame)

  return { x, y }
}
