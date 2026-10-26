import { Canvas, Circle, Line, Path, Skia, type SkPath, vec } from '@shopify/react-native-skia'
import { cellToPixel, type GridCell, type GridSize } from '@tastic/grid'
import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated'

import { EffectRings, PickupGlyph } from '@/shared/BoardPowerups'
import { RiderHead } from '@/shared/match/RiderHead'
import { SplitWalls } from '@/shared/match/SplitWalls'
import type { Pickup } from '@/shared/powerups'

import type { TurfPhase, TurfPlayer, TurfPowerup, TurfSeat } from './types'

export interface TurfBoardProps {
  grid: GridSize
  cellPx: number
  owner: Uint8Array
  obstacles: GridCell[]
  portals: { a: GridCell; b: GridCell }[]
  tunnels: { cells: GridCell[] }[]
  players: Record<TurfSeat, TurfPlayer>
  colors: Record<TurfSeat, string>
  orientationMode: 'faceToFace' | 'sideBySide'
  p1OnRight: boolean
  phase: TurfPhase
  tick: number
  // Milliseconds per step, for how long each glide from cell to cell takes.
  intervalMs: number
  // The board's own background, used for neutral board structures (obstacles, tunnels, portals).
  background: string
  pickups: Pickup<TurfPowerup>[]
  pickupColor: string
}

const SEATS: readonly TurfSeat[] = [1, 2]
// Ground reads as owned turf first; trail is the lighter layer above it.
const GROUND_OPACITY = 0.85
const TRAIL_WIDTH = 0.6
const TRAIL_OPACITY = 1
const HEAD_RADIUS = 0.72
const HEAD_RING_OUTLINE = 0.24
const HEAD_RING_WHITE = 0.11
const EDGE_STROKE_WIDTH = 1.5

function cellCenter(cell: GridCell, cellPx: number) {
  const { x, y } = cellToPixel(cell, cellPx)
  return { x: x + cellPx / 2, y: y + cellPx / 2 }
}

// One seat's ground as a single path: a rectangle per run of its cells along each row, so even a
// board that's half one color is a few hundred rectangles rather than thousands of cells.
function groundPath(owner: Uint8Array, grid: GridSize, cellPx: number, seat: TurfSeat): SkPath {
  const path = Skia.PathBuilder.Make()
  for (let y = 0; y < grid.rows; y++) {
    let runStart = -1
    for (let x = 0; x <= grid.cols; x++) {
      const mine = x < grid.cols && owner[y * grid.cols + x] === seat
      if (mine && runStart < 0) runStart = x
      else if (!mine && runStart >= 0) {
        path.addRect(Skia.XYWHRect(runStart * cellPx, y * cellPx, (x - runStart) * cellPx, cellPx))
        runStart = -1
      }
    }
  }
  return path.detach()
}

// The trail from the last cell of the rider's ground, so it visibly leaves from there, to its head.
function trailPath(player: TurfPlayer, cellPx: number): SkPath {
  const path = Skia.PathBuilder.Make()
  const cells = player.leftFrom ? [player.leftFrom, ...player.trail] : player.trail
  if (cells.length < 2) return path.detach()
  const first = cellCenter(cells[0], cellPx)
  path.moveTo(first.x, first.y)
  for (const cell of cells.slice(1)) {
    const { x, y } = cellCenter(cell, cellPx)
    path.lineTo(x, y)
  }
  return path.detach()
}

function settledTrailPath(player: TurfPlayer, cellPx: number): SkPath {
  const path = Skia.PathBuilder.Make()
  const cells = player.leftFrom ? [player.leftFrom, ...player.trail] : player.trail
  const settled = cells.slice(0, -1)
  if (settled.length < 2) return path.detach()
  const first = cellCenter(settled[0], cellPx)
  path.moveTo(first.x, first.y)
  for (const cell of settled.slice(1)) {
    const { x, y } = cellCenter(cell, cellPx)
    path.lineTo(x, y)
  }
  return path.detach()
}

function useGlide(head: GridCell, tick: number, cellPx: number, intervalMs: number) {
  const target = cellCenter(head, cellPx)
  const x = useSharedValue(target.x)
  const y = useSharedValue(target.y)
  const lastStepAtRef = useRef(0)
  useEffect(() => {
    const now = performance.now()
    const far = Math.abs(x.value - target.x) > cellPx * 2.5 || Math.abs(y.value - target.y) > cellPx * 2.5
    const duration = Math.max(1, Math.min(now - lastStepAtRef.current, intervalMs * 3))
    lastStepAtRef.current = now
    if (tick === 0 || far) {
      x.value = target.x
      y.value = target.y
      return
    }
    x.value = withTiming(target.x, { duration, easing: Easing.linear })
    y.value = withTiming(target.y, { duration, easing: Easing.linear })
  }, [tick, target.x, target.y, cellPx, intervalMs, x, y])
  return { x, y }
}

function Rider({ seat, player, color, cellPx, tick, intervalMs }: { seat: TurfSeat; player: TurfPlayer; color: string; cellPx: number; tick: number; intervalMs: number }) {
  const { x, y } = useGlide(player.head, tick, cellPx, intervalMs)
  const settled = useMemo(() => settledTrailPath(player, cellPx), [player, cellPx])
  const cells = player.leftFrom ? [player.leftFrom, ...player.trail] : player.trail
  const lastSettled = cells.length > 1 ? cellCenter(cells[cells.length - 2], cellPx) : null
  const headPoint = useDerivedValue(() => vec(x.value, y.value))
  const headRadius = cellPx * HEAD_RADIUS
  return (
    <>
      {player.alive ? <RiderHead x={x} y={y} radius={headRadius} color={color} outlineWidth={cellPx * HEAD_RING_OUTLINE} ringWidth={cellPx * HEAD_RING_WHITE} /> : null}
      <Path path={settled} style='stroke' strokeWidth={cellPx * TRAIL_WIDTH} strokeCap='round' strokeJoin='round' color={color} opacity={TRAIL_OPACITY} />
      {lastSettled && <Line p1={vec(lastSettled.x, lastSettled.y)} p2={headPoint} style='stroke' strokeWidth={cellPx * TRAIL_WIDTH} strokeCap='round' color={color} opacity={TRAIL_OPACITY} />}
      {player.alive ? <EffectRings key={`effects-${seat}`} x={x} y={y} headRadius={headRadius} effects={player.effects} /> : null}
    </>
  )
}

// Where a rider crashed, held on the board for the tick it happened (or until the next round, when
// the crash ended this one). A crash off the edge is drawn on the edge.
function CrashMark({ cell, grid, cellPx, color }: { cell: GridCell; grid: GridSize; cellPx: number; color: string }) {
  const onBoard = { x: Math.min(grid.cols - 1, Math.max(0, cell.x)), y: Math.min(grid.rows - 1, Math.max(0, cell.y)) }
  const { x, y } = cellCenter(onBoard, cellPx)
  return (
    <>
      <Circle cx={x} cy={y} r={cellPx * 1.6} style='stroke' strokeWidth={2} color={color} />
      <Circle cx={x} cy={y} r={cellPx * 0.7} color={color} />
    </>
  )
}

export function TurfBoard({ grid, cellPx, owner, obstacles, portals, tunnels, players, colors, orientationMode, p1OnRight, phase, tick, intervalMs, background, pickups, pickupColor }: TurfBoardProps) {
  const ground = useMemo(() => SEATS.map((seat) => groundPath(owner, grid, cellPx, seat)), [owner, grid, cellPx])
  const trails = useMemo(() => SEATS.map((seat) => trailPath(players[seat], cellPx)), [players, cellPx])

  return (
    <View style={styles.container}>
      <Canvas style={StyleSheet.absoluteFill}>
        {SEATS.map((seat, i) => (
          <Path key={`ground-${seat}`} path={ground[i]} color={colors[seat]} opacity={GROUND_OPACITY} />
        ))}
        {obstacles.map((cell, i) => {
          const { x, y } = cellToPixel(cell, cellPx)
          const path = Skia.PathBuilder.Make()
          path.addRect(Skia.XYWHRect(x, y, cellPx, cellPx))
          return <Path key={`obstacle-${i}`} path={path.detach()} color={background} />
        })}
        {tunnels.map((tunnel, index) => {
          const path = Skia.PathBuilder.Make()
          tunnel.cells.forEach((cell, i) => {
            const { x, y } = cellCenter(cell, cellPx)
            if (i === 0) path.moveTo(x, y)
            else path.lineTo(x, y)
          })
          return <Path key={`tunnel-${index}`} path={path.detach()} style='stroke' strokeWidth={cellPx * 0.5} color={background} opacity={0.75} />
        })}
        {portals.map((portal, index) => {
          const a = cellCenter(portal.a, cellPx)
          const b = cellCenter(portal.b, cellPx)
          const r = cellPx * 0.3
          const path = Skia.PathBuilder.Make()
          path.addCircle(a.x, a.y, r)
          path.addCircle(b.x, b.y, r)
          return <Path key={`portal-${index}`} path={path.detach()} style='stroke' strokeWidth={2} color={background} />
        })}
        {phase !== 'onboarding' && <SplitWalls grid={grid} cellPx={cellPx} orientationMode={orientationMode} p1OnRight={p1OnRight} colors={colors} strokeWidth={EDGE_STROKE_WIDTH} />}
        {pickups.map((pickup) => (
          <PickupGlyph key={pickup.id} pickup={pickup} cellPx={cellPx} color={pickupColor} />
        ))}
        {SEATS.map((seat, i) => (phase === 'playing' ? <Rider key={`rider-${seat}`} seat={seat} player={players[seat]} color={colors[seat]} cellPx={cellPx} tick={tick} intervalMs={intervalMs} /> : <Path key={`trail-${seat}`} path={trails[i]} style='stroke' strokeWidth={cellPx * TRAIL_WIDTH} strokeCap='round' strokeJoin='round' color={colors[seat]} opacity={TRAIL_OPACITY} />))}
        {phase !== 'playing' &&
          SEATS.map((seat) => {
            const p = players[seat]
            const { x, y } = cellCenter(p.head, cellPx)
            return p.alive ? <RiderHead key={`head-${seat}`} x={x} y={y} radius={cellPx * HEAD_RADIUS} color={colors[seat]} outlineWidth={cellPx * HEAD_RING_OUTLINE} ringWidth={cellPx * HEAD_RING_WHITE} /> : null
          })}
        {phase !== 'playing' &&
          SEATS.map((seat) => {
            const p = players[seat]
            if (!p.alive) return null
            const { x, y } = cellCenter(p.head, cellPx)
            return <EffectRings key={`effects-${seat}`} x={x} y={y} headRadius={cellPx * HEAD_RADIUS} effects={p.effects} />
          })}
        {phase !== 'onboarding' && SEATS.map((seat) => (players[seat].crashCell ? <CrashMark key={`crash-${seat}`} cell={players[seat].crashCell!} grid={grid} cellPx={cellPx} color={colors[seat]} /> : null))}
      </Canvas>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 }
})
