import { Circle, Path, Skia } from '@shopify/react-native-skia'
import type { GridCell } from '@tastic/grid'
import { useEffect, useState } from 'react'
import { Easing, type SharedValue, useDerivedValue, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'

import { deathAnimationDurationMs } from './constants'

// A rider's crash, the same in every game that has one (Trap, and Turf under either crash
// rule): its head bursts apart where it crashed, then the trail it was riding wipes itself out from
// the head back to the tail. Import it only from a board file: it pulls in Skia, which on web has to
// wait for CanvasKit (see the boards' host pairs).

// Walks `progress` (0 = nothing eaten, 1 = all of it) along a chain of grid cells and returns a path
// through only the part not yet eaten. The boundary cell is interpolated between its two neighbors, so
// the eaten edge creeps smoothly rather than a whole cell at a time. A step that isn't to a neighbor (a
// gate, or Trap's wrap round the edge) starts a new piece rather than drawing a line across the
// board. Trap's severed-trail eat-away walks it too. A worklet in its own right, since it's
// called from inside useDerivedValue callbacks rather than handed to one.
export function partialTrailPath(cells: { x: number; y: number }[], progress: number, cellPx: number) {
  'worklet'
  const path = Skia.PathBuilder.Make()
  if (cells.length < 2) return path.detach()
  const eatenFloat = progress * (cells.length - 1)
  const eatenWhole = Math.floor(eatenFloat)
  if (eatenWhole >= cells.length - 1) return path.detach()
  const frac = eatenFloat - eatenWhole
  // Inlined rather than calling @tastic/grid's isAdjacent: an imported function isn't guaranteed to
  // cross into a worklet the way a same-file one can.
  const adjacent = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
  const a = cells[eatenWhole]
  const b = cells[eatenWhole + 1]
  if (adjacent(a, b)) path.moveTo((a.x + (b.x - a.x) * frac) * cellPx + cellPx / 2, (a.y + (b.y - a.y) * frac) * cellPx + cellPx / 2)
  else path.moveTo(b.x * cellPx + cellPx / 2, b.y * cellPx + cellPx / 2)
  for (let i = eatenWhole + 1; i < cells.length; i++) {
    const x = cells[i].x * cellPx + cellPx / 2
    const y = cells[i].y * cellPx + cellPx / 2
    if (i === eatenWhole + 1 || adjacent(cells[i - 1], cells[i])) path.lineTo(x, y)
    else path.moveTo(x, y)
  }
  return path.detach()
}

// The shockwave ring's peak radius, as a multiple of the head's, and how many shards fly out.
const EXPLOSION_RING_MAX_SCALE = 4
const EXPLOSION_SHARD_COUNT = 8

// The head bursting apart: a flash core, an expanding shockwave ring and a ring of shards flying
// outward, all driven off the one `explosion` value (0 to 1) so every piece stays in step. In the
// rider's own color. At 0 the flash is a plain disc the size of the head, so there's no seam between
// the live head and the burst taking its place.
function Explosion({ x, y, explosion, headRadius, color }: { x: number; y: number; explosion: SharedValue<number>; headRadius: number; color: string }) {
  // Over the burst's first 40%, so it reads as an instant flash rather than a slow fade.
  const flashRadius = useDerivedValue(() => headRadius * (1 + Math.min(1, explosion.value / 0.4) * 0.6))
  const flashOpacity = useDerivedValue(() => 1 - Math.min(1, explosion.value / 0.4))
  const ringRadius = useDerivedValue(() => headRadius * (1 + explosion.value * (EXPLOSION_RING_MAX_SCALE - 1)))
  const ringOpacity = useDerivedValue(() => 1 - explosion.value)
  return (
    <>
      <Circle cx={x} cy={y} r={flashRadius} color={color} opacity={flashOpacity} />
      <Circle cx={x} cy={y} r={ringRadius} style='stroke' strokeWidth={2} color={color} opacity={ringOpacity} />
      {Array.from({ length: EXPLOSION_SHARD_COUNT }, (_, i) => (
        <Shard key={i} angle={(i / EXPLOSION_SHARD_COUNT) * Math.PI * 2} x={x} y={y} explosion={explosion} headRadius={headRadius} color={color} />
      ))}
    </>
  )
}

// One shard of the burst, as its own component so each keeps its own hooks. Evenly spaced, not
// random, so the burst never looks lopsided.
function Shard({ angle, x, y, explosion, headRadius, color }: { angle: number; x: number; y: number; explosion: SharedValue<number>; headRadius: number; color: string }) {
  const distance = headRadius * EXPLOSION_RING_MAX_SCALE
  const cx = useDerivedValue(() => x + Math.cos(angle) * distance * explosion.value)
  const cy = useDerivedValue(() => y + Math.sin(angle) * distance * explosion.value)
  const r = useDerivedValue(() => headRadius * 0.35 * (1 - explosion.value))
  const opacity = useDerivedValue(() => 1 - explosion.value)
  return <Circle cx={cx} cy={cy} r={r} color={color} opacity={opacity} />
}

export interface RiderCrashProps {
  // Where the head burst, in px: the center of the cell it crashed into (off the board for the edge,
  // so the burst sits on the edge).
  x: number
  y: number
  // The trail it was riding when it crashed, oldest first, its head last. Read once, at mount.
  trail: readonly GridCell[]
  cellPx: number
  headRadius: number
  // The trail's own stroke, so the wipe looks like the trail it's wiping.
  trailWidth: number
  trailOpacity?: number
  color: string
}

// Mount it when the rider crashes, keyed on the crash, so another crash replays it: it starts at once
// and draws nothing once it's done. The wipe waits for the burst, so the trail is still there to root
// it while the head bursts apart. deathAnimationDurationMs is how long it takes, which the result card
// waits on.
export function RiderCrash({ x, y, trail, cellPx, headRadius, trailWidth, trailOpacity = 1, color }: RiderCrashProps) {
  // Head first, so the wipe eats from where the crash happened back toward the tail.
  const [cells] = useState(() => [...trail].reverse().map((c) => ({ x: c.x, y: c.y })))
  const explosion = useSharedValue(0)
  const wipe = useSharedValue(0)
  useEffect(() => {
    const { explosionMs, wipeMs } = deathAnimationDurationMs(cells.length)
    explosion.value = withTiming(1, { duration: explosionMs, easing: Easing.out(Easing.cubic) })
    wipe.value = withDelay(explosionMs, withTiming(1, { duration: wipeMs, easing: Easing.linear }))
  }, [cells, explosion, wipe])
  const wipePath = useDerivedValue(() => partialTrailPath(cells, wipe.value, cellPx))
  return (
    <>
      <Path path={wipePath} style='stroke' strokeWidth={trailWidth} strokeCap='round' strokeJoin='round' color={color} opacity={trailOpacity} />
      <Explosion x={x} y={y} explosion={explosion} headRadius={headRadius} color={color} />
    </>
  )
}
