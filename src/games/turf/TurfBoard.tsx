import { Canvas, Group, Path, Skia, type SkPath } from '@shopify/react-native-skia'
import { cellToPixel, type GridCell, type GridSize } from '@tastic/grid'
import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useDerivedValue } from 'react-native-reanimated'

import { EffectRings, PickupGlyph } from '@/shared/BoardPowerups'
import { ArenaBlocks } from '@/shared/match/ArenaBlocks'
import { DazeStars } from '@/shared/match/DazeStars'
import { Gates, useGateColors } from '@/shared/match/Gates'
import { RiderCrash } from '@/shared/match/RiderCrash'
import { RiderHead } from '@/shared/match/RiderHead'
import { HEAD_RADIUS_CELLS } from '@/shared/match/riderSkin'
import { SplitWalls } from '@/shared/match/SplitWalls'
import { leadingTrailPath, trailPath } from '@/shared/match/trailPath'
import { useRiderGlide } from '@/shared/match/useRiderGlide'
import { type Pickup, speedMultiplier } from '@/shared/powerups'

import { TURF_TRAIL_OPACITY } from './constants'
import type { TurfPhase, TurfPlayer, TurfPowerup, TurfSeat } from './types'

export interface TurfBoardProps {
  grid: GridSize
  cellPx: number
  owner: Uint8Array
  obstacles: GridCell[]
  portals: { a: GridCell; b: GridCell }[]
  players: Record<TurfSeat, TurfPlayer>
  colors: Record<TurfSeat, string>
  orientationMode: 'faceToFace' | 'sideBySide'
  p1OnRight: boolean
  phase: TurfPhase
  tick: number
  // Milliseconds per step, for how long each glide from cell to cell takes.
  intervalMs: number
  // The arena (pillars, gauntlet walls, gates), in the pack's boardStructureColor.
  structureColor: string
  pickups: Pickup<TurfPowerup>[]
  pickupColor: string
}

const SEATS: readonly TurfSeat[] = [1, 2]
// Ground is solid, in the seat's own color (Jay), so it reads as owned turf first; the trail is the
// lighter layer above it, and a head on its own ground stands out by its white ring and black line.
const TRAIL_WIDTH = 0.6
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

// The cells a rider's trail is drawn through: from the last cell of its ground, so it visibly leaves
// from there, to its head.
const trailCells = (player: TurfPlayer): GridCell[] => (player.leftFrom ? [player.leftFrom, ...player.trail] : player.trail)

// How a crash is drawn (RiderCrash), from the cell the rider crashed into and the trail it was riding.
function Crash({ cell, trail, color, cellPx }: { cell: GridCell; trail: readonly GridCell[]; color: string; cellPx: number }) {
  const { x, y } = cellCenter(cell, cellPx)
  return <RiderCrash x={x} y={y} trail={trail} cellPx={cellPx} headRadius={cellPx * HEAD_RADIUS_CELLS} trailWidth={cellPx * TRAIL_WIDTH} trailOpacity={TURF_TRAIL_OPACITY} color={color} />
}

function Rider({ seat, player, color, cellPx, tick, intervalMs }: { seat: TurfSeat; player: TurfPlayer; color: string; cellPx: number; tick: number; intervalMs: number }) {
  // Its own pace: a cell a tick, two under Dash or Gust, one every other tick under Mud (a frozen
  // rider takes no steps to glide).
  const msPerCell = intervalMs / (speedMultiplier(player.effects, tick + 1) || 1)
  const path = useMemo(() => (player.trail.length > 0 ? player.trail : [player.head]), [player.trail, player.head])
  // Sent home after a crash, the head flies there, landing as the rider's wait at home runs out.
  const flightMs = player.flight ? Math.max(0, player.flight.landsAtTick - tick) * intervalMs : null
  const { x, y } = useRiderGlide({ path, cellPx, msPerCell, snap: false, flightMs })
  const cells = useMemo(() => trailCells(player), [player])
  // The trail as one path, built every frame through the cells as far as the gliding head has got
  // and on to the head (leadingTrailPath), so it's one strength all along: it was the cells behind
  // the head plus a line on to it, which doubled up just behind the head. Broken at a gate.
  const leadCells = useMemo(() => cells.map((c) => ({ x: c.x, y: c.y })), [cells])
  const trail = useDerivedValue(() => leadingTrailPath(leadCells, x.value, y.value, cellPx))
  const headRadius = cellPx * HEAD_RADIUS_CELLS

  // A crash under Crash Sends Home: by the time it's drawn the engine has already put the rider back
  // home without its trail, so the trail it lost is the one drawn last time. Kept in state, as the
  // crash's own trail, so the burst and wipe play out while the rider flies home and rides on. Keyed
  // on the flight, which lasts until it lands, rather than crashCell, which only lasts the crash's
  // own tick and is gone if a second tick runs in the same frame.
  const [seen, setSeen] = useState({ cells, flight: player.flight })
  const [crash, setCrash] = useState<{ tick: number; cell: GridCell; trail: GridCell[] } | null>(null)
  if (seen.cells !== cells || seen.flight !== player.flight) {
    if (player.flight && player.flight !== seen.flight) setCrash({ tick: player.flight.startTick, cell: player.flight.from, trail: seen.cells })
    setSeen({ cells, flight: player.flight })
  }

  return (
    <>
      <Path path={trail} style='stroke' strokeWidth={cellPx * TRAIL_WIDTH} strokeCap='round' strokeJoin='round' color={color} opacity={TURF_TRAIL_OPACITY} />
      {crash && <Crash key={crash.tick} cell={crash.cell} trail={crash.trail} color={color} cellPx={cellPx} />}
      {player.alive ? <RiderHead x={x} y={y} radius={headRadius} color={color} /> : null}
      {player.alive ? <EffectRings key={`effects-${seat}`} x={x} y={y} headRadius={headRadius} effects={player.effects} /> : null}
      {/* Flying home and standing there until it lands is the crash's daze. */}
      {player.alive && player.flight ? <DazeStars x={x} y={y} headRadius={headRadius} /> : null}
    </>
  )
}

export function TurfBoard({ grid, cellPx, owner, obstacles, portals, players, colors, orientationMode, p1OnRight, phase, tick, intervalMs, structureColor, pickups, pickupColor }: TurfBoardProps) {
  const ground = useMemo(() => SEATS.map((seat) => groundPath(owner, grid, cellPx, seat)), [owner, grid, cellPx])
  const trails = useMemo(() => SEATS.map((seat) => trailPath(trailCells(players[seat]), cellPx)), [players, cellPx])
  const gateColors = useGateColors()

  return (
    <View style={styles.container}>
      <Canvas style={StyleSheet.absoluteFill}>
        {SEATS.map((seat, i) => (
          <Path key={`ground-${seat}`} path={ground[i]} color={colors[seat]} />
        ))}
        <ArenaBlocks cells={obstacles} cellPx={cellPx} color={structureColor} />
        <Gates portals={portals} cellPx={cellPx} colors={gateColors} />
        {phase !== 'onboarding' && <SplitWalls grid={grid} cellPx={cellPx} orientationMode={orientationMode} p1OnRight={p1OnRight} colors={colors} strokeWidth={EDGE_STROKE_WIDTH} />}
        {pickups.map((pickup) => (
          <PickupGlyph key={pickup.id} pickup={pickup} cellPx={cellPx} color={pickupColor} />
        ))}
        {SEATS.map((seat, i) => {
          const p = players[seat]
          if (phase === 'playing') return <Rider key={`rider-${seat}`} seat={seat} player={p} color={colors[seat]} cellPx={cellPx} tick={tick} intervalMs={intervalMs} />
          // The round's over: whoever lost it crashes as in every game (a rider who was suffocated
          // bursts where it stands), and the other stands still with its trail.
          if (!p.alive) return <Crash key={`crash-${seat}`} cell={p.crashCell ?? p.head} trail={trailCells(p)} color={colors[seat]} cellPx={cellPx} />
          const { x, y } = cellCenter(p.head, cellPx)
          return (
            <Group key={`still-${seat}`}>
              <Path path={trails[i]} style='stroke' strokeWidth={cellPx * TRAIL_WIDTH} strokeCap='round' strokeJoin='round' color={colors[seat]} opacity={TURF_TRAIL_OPACITY} />
              <RiderHead x={x} y={y} radius={cellPx * HEAD_RADIUS_CELLS} color={colors[seat]} />
              <EffectRings x={x} y={y} headRadius={cellPx * HEAD_RADIUS_CELLS} effects={p.effects} />
            </Group>
          )
        })}
      </Canvas>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 }
})
