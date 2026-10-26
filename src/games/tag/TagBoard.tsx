import { Canvas, Circle, Line, Path, RoundedRect, Skia, vec } from '@shopify/react-native-skia'
import { cellToPixel, type GridCell, type GridSize } from '@tastic/grid'
import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Easing, type SharedValue, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import { EffectRings, PickupGlyph } from '@/shared/BoardPowerups'
import { RiderHead } from '@/shared/match/RiderHead'
import { SplitWalls } from '@/shared/match/SplitWalls'
import type { Pickup } from '@/shared/powerups'

import type { TagPhase, TagPillar, TagPlayer, TagPortal, TagPowerup, TagSeat, TagTunnel } from './types'

export interface TagBoardProps {
  grid: GridSize
  cellPx: number
  pillars: TagPillar[]
  portals: TagPortal[]
  tunnels: TagTunnel[]
  players: Record<TagSeat, TagPlayer>
  it: TagSeat
  orientationMode: 'faceToFace' | 'sideBySide'
  p1OnRight: boolean
  // How much of It's freeze after a tag is left, 1 just tagged to 0 free to move.
  freezeLeft: number
  colors: Record<TagSeat, string>
  phase: TagPhase
  tick: number
  // Milliseconds per step, for how long each glide from cell to cell takes.
  intervalMs: number
  // The edge and the pillars: what stops a rider.
  structureColor: string
  pickups: Pickup<TagPowerup>[]
  pickupColor: string
}

const SEATS: readonly TagSeat[] = [1, 2]
const HEAD_RADIUS = 0.42
// It's head is drawn bigger, so who's It reads at a glance.
const IT_HEAD_RADIUS = 0.52
const HEAD_RING_OUTLINE = 0.17
const HEAD_RING_WHITE = 0.1
const TAIL_WIDTH = 0.3
const TAIL_OPACITY = 0.35
// It's pulsing ring, as a multiple of the cell.
const IT_RING_RADIUS = 0.85
const IT_RING_PULSE = 0.18
const IT_RING_WIDTH = 3
const IT_PULSE_MS = 620
const GLIDE_MAX_DURATION_INTERVALS = 1.7
const PILLAR_CORNER = 0.25
const EDGE_STROKE_WIDTH = 1.5
// A frozen It is dimmed, ringed by a white arc that empties as the freeze runs out: plain white, so
// it reads the same whatever the rider's color (an ice blue vanished against player 1's default).
const FROZEN_OPACITY = 0.55
const FROZEN_RING_COLOR = '#FFFFFF'

function cellCenter(cell: GridCell, cellPx: number) {
  const { x, y } = cellToPixel(cell, cellPx)
  return { x: x + cellPx / 2, y: y + cellPx / 2 }
}

// A rider's head glides from cell to cell over the time between steps, rather than jumping a whole
// cell each step; it jumps only for a new round or a move that isn't a step.
function useGlide(head: GridCell, tick: number, cellPx: number, intervalMs: number) {
  const { x: targetX, y: targetY } = cellCenter(head, cellPx)
  const x = useSharedValue(targetX)
  const y = useSharedValue(targetY)
  const lastMoveAtRef = useRef(0)
  const lastTargetRef = useRef({ x: targetX, y: targetY })
  useEffect(() => {
    const now = performance.now()
    const moved = lastTargetRef.current.x !== targetX || lastTargetRef.current.y !== targetY
    const far = Math.abs(x.value - targetX) > cellPx * 2.5 || Math.abs(y.value - targetY) > cellPx * 2.5
    if (tick === 0 || far) {
      x.value = targetX
      y.value = targetY
      lastMoveAtRef.current = now
      lastTargetRef.current = { x: targetX, y: targetY }
      return
    }
    if (!moved) {
      return
    }
    // Measured against the real gap since this rider's previous move (not every global tick): Tag
    // riders can move at different cadences (It speed, Dash, Mud, freeze), so tying duration to
    // every tick makes slow/paused riders jump when they finally move.
    const duration = Math.max(1, Math.min(now - lastMoveAtRef.current, intervalMs * GLIDE_MAX_DURATION_INTERVALS))
    lastMoveAtRef.current = now
    lastTargetRef.current = { x: targetX, y: targetY }
    x.value = withTiming(targetX, { duration, easing: Easing.linear })
    y.value = withTiming(targetY, { duration, easing: Easing.linear })
  }, [tick, targetX, targetY, cellPx, intervalMs, x, y])
  return { x, y }
}

// The arc left of a frozen It's ring: a full circle just after the tag, gone when the freeze is over.
function FreezeRing({ x, y, cellPx, left }: { x: SharedValue<number>; y: SharedValue<number>; cellPx: number; left: number }) {
  const r = cellPx * IT_RING_RADIUS
  const arc = useDerivedValue(() => {
    const path = Skia.PathBuilder.Make()
    path.addArc(Skia.XYWHRect(x.value - r, y.value - r, r * 2, r * 2), -90, 360 * left)
    return path.detach()
  })
  return <Path path={arc} style='stroke' strokeWidth={IT_RING_WIDTH} strokeCap='round' color={FROZEN_RING_COLOR} />
}

function Rider({ player, color, cellPx, tick, intervalMs, isIt, freezeLeft, pulse }: { player: TagPlayer; color: string; cellPx: number; tick: number; intervalMs: number; isIt: boolean; freezeLeft: number; pulse: SharedValue<number> }) {
  const { x, y } = useGlide(player.head, tick, cellPx, intervalMs)
  // The tail: through the cells behind the head, then on to wherever the head is mid-glide.
  const tail = useMemo(() => {
    const path = Skia.PathBuilder.Make()
    player.recent.slice(0, -1).forEach((cell, i) => {
      const { x: px, y: py } = cellCenter(cell, cellPx)
      if (i === 0) path.moveTo(px, py)
      else path.lineTo(px, py)
    })
    return path.detach()
  }, [player.recent, cellPx])
  const last = player.recent.length > 1 ? cellCenter(player.recent[player.recent.length - 2], cellPx) : null
  const headPoint = useDerivedValue(() => vec(x.value, y.value))
  const radius = cellPx * (isIt ? IT_HEAD_RADIUS : HEAD_RADIUS)
  const ringRadius = useDerivedValue(() => cellPx * (IT_RING_RADIUS + IT_RING_PULSE * pulse.value))
  const frozen = isIt && freezeLeft > 0

  return (
    <>
      <RiderHead x={x} y={y} radius={radius} color={color} opacity={frozen ? FROZEN_OPACITY : 1} outlineWidth={cellPx * HEAD_RING_OUTLINE} ringWidth={cellPx * HEAD_RING_WHITE} />
      <Path path={tail} style='stroke' strokeWidth={cellPx * TAIL_WIDTH} strokeCap='round' strokeJoin='round' color={color} opacity={TAIL_OPACITY} />
      {last && <Line p1={vec(last.x, last.y)} p2={headPoint} style='stroke' strokeWidth={cellPx * TAIL_WIDTH} strokeCap='round' color={color} opacity={TAIL_OPACITY} />}
      <EffectRings x={x} y={y} headRadius={radius} effects={player.effects} />
      {isIt && !frozen && <Circle cx={x} cy={y} r={ringRadius} style='stroke' strokeWidth={IT_RING_WIDTH} color={color} />}
      {frozen && <FreezeRing x={x} y={y} cellPx={cellPx} left={freezeLeft} />}
    </>
  )
}

export function TagBoard({ grid, cellPx, pillars, portals, tunnels, players, it, orientationMode, p1OnRight, freezeLeft, colors, phase, tick, intervalMs, structureColor, pickups, pickupColor }: TagBoardProps) {
  // It's ring breathes in and out the whole round.
  const pulse = useSharedValue(0)
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: IT_PULSE_MS, easing: Easing.inOut(Easing.quad) }), -1, true)
  }, [pulse])

  return (
    <View style={styles.container}>
      <Canvas style={StyleSheet.absoluteFill}>
        {phase !== 'onboarding' && <SplitWalls grid={grid} cellPx={cellPx} orientationMode={orientationMode} p1OnRight={p1OnRight} colors={colors} strokeWidth={EDGE_STROKE_WIDTH} />}
        {pillars.map((p) => (
          <RoundedRect key={`${p.x},${p.y}`} x={p.x * cellPx} y={p.y * cellPx} width={p.width * cellPx} height={p.height * cellPx} r={cellPx * PILLAR_CORNER} color={structureColor} />
        ))}
        {tunnels.map((tunnel, index) => {
          const path = Skia.PathBuilder.Make()
          tunnel.cells.forEach((cell, i) => {
            const { x, y } = cellCenter(cell, cellPx)
            if (i === 0) path.moveTo(x, y)
            else path.lineTo(x, y)
          })
          return <Path key={`tunnel-${index}`} path={path.detach()} style='stroke' strokeWidth={cellPx * 0.5} color={structureColor} opacity={0.75} />
        })}
        {portals.map((portal, index) => {
          const a = cellCenter(portal.a, cellPx)
          const b = cellCenter(portal.b, cellPx)
          const r = cellPx * 0.34
          return (
            <Path
              key={`portal-link-${index}`}
              path={(() => {
                const path = Skia.PathBuilder.Make()
                path.addCircle(a.x, a.y, r)
                path.addCircle(b.x, b.y, r)
                return path.detach()
              })()}
              style='stroke'
              strokeWidth={2}
              color={structureColor}
            />
          )
        })}
        {pickups.map((pickup) => (
          <PickupGlyph key={pickup.id} pickup={pickup} cellPx={cellPx} color={pickupColor} />
        ))}
        {SEATS.map((seat) => (
          <Rider key={seat} player={players[seat]} color={colors[seat]} cellPx={cellPx} tick={tick} intervalMs={intervalMs} isIt={seat === it} freezeLeft={phase === 'playing' ? freezeLeft : 0} pulse={pulse} />
        ))}
      </Canvas>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 }
})
