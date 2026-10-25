import { Canvas, Circle, Path, Skia, type SkPath } from '@shopify/react-native-skia'
import { cellToPixel, type GridCell, type GridSize } from '@tastic/grid'
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { EffectRings, PickupGlyph } from '@/shared/BoardPowerups'
import type { Pickup } from '@/shared/powerups'

import type { TurfPhase, TurfPlayer, TurfPowerup, TurfSeat } from './types'

export interface TurfBoardProps {
  grid: GridSize
  cellPx: number
  owner: Uint8Array
  players: Record<TurfSeat, TurfPlayer>
  colors: Record<TurfSeat, string>
  phase: TurfPhase
  // The board's own background, used to ring each head so it stands out over its trail and ground.
  background: string
  // The board's edge, which is deadly.
  edgeColor: string
  pickups: Pickup<TurfPowerup>[]
  pickupColor: string
}

const SEATS: readonly TurfSeat[] = [1, 2]
// Ground is a soft fill so trails and heads read on top of it, its own included.
const GROUND_OPACITY = 0.38
const TRAIL_WIDTH = 0.6
const HEAD_RADIUS = 0.72
const HEAD_RING = 0.22
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

export function TurfBoard({ grid, cellPx, owner, players, colors, phase, background, edgeColor, pickups, pickupColor }: TurfBoardProps) {
  const ground = useMemo(() => SEATS.map((seat) => groundPath(owner, grid, cellPx, seat)), [owner, grid, cellPx])
  const trails = useMemo(() => SEATS.map((seat) => trailPath(players[seat], cellPx)), [players, cellPx])
  const edge = useMemo(
    () =>
      Skia.PathBuilder.Make()
        .addRect(Skia.XYWHRect(0, 0, grid.cols * cellPx, grid.rows * cellPx))
        .detach(),
    [grid, cellPx]
  )

  return (
    <View style={styles.container}>
      <Canvas style={StyleSheet.absoluteFill}>
        {SEATS.map((seat, i) => (
          <Path key={`ground-${seat}`} path={ground[i]} color={colors[seat]} opacity={GROUND_OPACITY} />
        ))}
        <Path path={edge} style='stroke' strokeWidth={EDGE_STROKE_WIDTH} color={edgeColor} />
        {pickups.map((pickup) => (
          <PickupGlyph key={pickup.id} pickup={pickup} cellPx={cellPx} color={pickupColor} />
        ))}
        {SEATS.map((seat, i) => (
          <Path key={`trail-${seat}`} path={trails[i]} style='stroke' strokeWidth={cellPx * TRAIL_WIDTH} strokeCap='round' strokeJoin='round' color={colors[seat]} />
        ))}
        {SEATS.map((seat) => {
          const p = players[seat]
          const { x, y } = cellCenter(p.head, cellPx)
          return p.alive ? <Circle key={`head-${seat}`} cx={x} cy={y} r={cellPx * HEAD_RADIUS} color={colors[seat]} style='fill' /> : null
        })}
        {SEATS.map((seat) => {
          const p = players[seat]
          const { x, y } = cellCenter(p.head, cellPx)
          return p.alive ? <Circle key={`ring-${seat}`} cx={x} cy={y} r={cellPx * HEAD_RADIUS} style='stroke' strokeWidth={cellPx * HEAD_RING} color={background} /> : null
        })}
        {SEATS.map((seat) => {
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
