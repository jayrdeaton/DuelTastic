import { Canvas, Circle, Line, Path, RoundedRect, Skia, vec } from '@shopify/react-native-skia'
import { cellToPixel, type GridCell, type GridSize } from '@tastic/grid'
import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Easing, type SharedValue, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import type { TagPhase, TagPillar, TagPlayer, TagSeat } from './types'

export interface TagBoardProps {
  grid: GridSize
  cellPx: number
  pillars: TagPillar[]
  players: Record<TagSeat, TagPlayer>
  it: TagSeat
  // How much of It's freeze after a tag is left, 1 just tagged to 0 free to move.
  freezeLeft: number
  colors: Record<TagSeat, string>
  phase: TagPhase
  tick: number
  // Milliseconds per step, for how long each glide from cell to cell takes.
  intervalMs: number
  // The board's own background, used to ring each head so it stands out over the other's tail.
  background: string
  // The edge and the pillars: what stops a rider.
  structureColor: string
}

const SEATS: readonly TagSeat[] = [1, 2]
const HEAD_RADIUS = 0.42
// It's head is drawn bigger, so who's It reads at a glance.
const IT_HEAD_RADIUS = 0.52
const HEAD_RING = 0.12
const TAIL_WIDTH = 0.3
const TAIL_OPACITY = 0.35
// It's pulsing ring, as a multiple of the cell.
const IT_RING_RADIUS = 0.85
const IT_RING_PULSE = 0.18
const IT_RING_WIDTH = 3
const IT_PULSE_MS = 500
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
  const target = cellCenter(head, cellPx)
  const x = useSharedValue(target.x)
  const y = useSharedValue(target.y)
  const lastStepAtRef = useRef(0)
  useEffect(() => {
    const now = performance.now()
    const far = Math.abs(x.value - target.x) > cellPx * 2.5 || Math.abs(y.value - target.y) > cellPx * 2.5
    // Measured against the real gap since the last step (the loop can run a frame late), capped so
    // a stall can't stretch one glide out.
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

function Rider({ player, color, cellPx, tick, intervalMs, isIt, freezeLeft, pulse, background }: { player: TagPlayer; color: string; cellPx: number; tick: number; intervalMs: number; isIt: boolean; freezeLeft: number; pulse: SharedValue<number>; background: string }) {
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
      <Path path={tail} style='stroke' strokeWidth={cellPx * TAIL_WIDTH} strokeCap='round' strokeJoin='round' color={color} opacity={TAIL_OPACITY} />
      {last && <Line p1={vec(last.x, last.y)} p2={headPoint} style='stroke' strokeWidth={cellPx * TAIL_WIDTH} strokeCap='round' color={color} opacity={TAIL_OPACITY} />}
      <Circle cx={x} cy={y} r={radius} color={color} opacity={frozen ? FROZEN_OPACITY : 1} />
      <Circle cx={x} cy={y} r={radius} style='stroke' strokeWidth={cellPx * HEAD_RING} color={background} />
      {isIt && !frozen && <Circle cx={x} cy={y} r={ringRadius} style='stroke' strokeWidth={IT_RING_WIDTH} color={color} />}
      {frozen && <FreezeRing x={x} y={y} cellPx={cellPx} left={freezeLeft} />}
    </>
  )
}

export function TagBoard({ grid, cellPx, pillars, players, it, freezeLeft, colors, phase, tick, intervalMs, background, structureColor }: TagBoardProps) {
  const edge = useMemo(
    () =>
      Skia.PathBuilder.Make()
        .addRect(Skia.XYWHRect(0, 0, grid.cols * cellPx, grid.rows * cellPx))
        .detach(),
    [grid, cellPx]
  )
  // It's ring breathes in and out the whole round.
  const pulse = useSharedValue(0)
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: IT_PULSE_MS, easing: Easing.inOut(Easing.quad) }), -1, true)
  }, [pulse])

  return (
    <View style={styles.container}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Path path={edge} style='stroke' strokeWidth={EDGE_STROKE_WIDTH} color={structureColor} />
        {pillars.map((p) => (
          <RoundedRect key={`${p.x},${p.y}`} x={p.x * cellPx} y={p.y * cellPx} width={p.width * cellPx} height={p.height * cellPx} r={cellPx * PILLAR_CORNER} color={structureColor} />
        ))}
        {SEATS.map((seat) => (
          <Rider key={seat} player={players[seat]} color={colors[seat]} cellPx={cellPx} tick={tick} intervalMs={intervalMs} isIt={seat === it} freezeLeft={phase === 'playing' ? freezeLeft : 0} pulse={pulse} background={background} />
        ))}
      </Canvas>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 }
})
