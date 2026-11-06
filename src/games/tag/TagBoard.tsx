import { Canvas, Circle, Path, RadialGradient, Skia, vec } from '@shopify/react-native-skia'
import type { GridSize } from '@tastic/grid'
import { useEffect, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Easing, type SharedValue, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import { EffectRings, PickupGlyph } from '@/shared/BoardPowerups'
import { ArenaBlocks } from '@/shared/match/ArenaBlocks'
import { DazeStars } from '@/shared/match/DazeStars'
import { Gates } from '@/shared/match/Gates'
import { RiderHead } from '@/shared/match/RiderHead'
import { HEAD_RADIUS_CELLS } from '@/shared/match/riderSkin'
import { SplitWalls } from '@/shared/match/SplitWalls'
import { tailTrailPath } from '@/shared/match/trailPath'
import { useRiderGlide } from '@/shared/match/useRiderGlide'
import { type Pickup, speedMultiplier } from '@/shared/powerups'

import { TAG_GLOW_HOLD, TAG_GLOW_OPACITY, TAG_IT_SPEED, TAG_REACH_PX, TAG_TAIL_PX } from './constants'
import { isDazed } from './engine'
import type { TagPhase, TagPillar, TagPlayer, TagPortal, TagPowerup, TagSeat } from './types'

export interface TagBoardProps {
  grid: GridSize
  cellPx: number
  pillars: TagPillar[]
  portals: TagPortal[]
  players: Record<TagSeat, TagPlayer>
  it: TagSeat
  orientationMode: 'faceToFace' | 'sideBySide'
  p1OnRight: boolean
  // How much of It's freeze after a tag is left, 1 just tagged to 0 free to move.
  freezeLeft: number
  colors: Record<TagSeat, string>
  phase: TagPhase
  tick: number
  // Milliseconds per cell for the rider who isn't It, for how long each glide from cell to cell takes.
  intervalMs: number
  // The edge and the pillars: what stops a rider.
  structureColor: string
  pickups: Pickup<TagPowerup>[]
  pickupColor: string
}

const SEATS: readonly TagSeat[] = [1, 2]
// The heads are every game's size (HEAD_RADIUS_CELLS, LightCycles' and Turf's), It's a little bigger.
const IT_HEAD_SCALE = 1.25
// The tail: as wide as Turf's trail, as see-through, and TAG_TAIL_PX long.
const TAIL_WIDTH = 0.6
const TAIL_OPACITY = 0.4
// It's glow: a soft disc of its own color behind its head, breathing the whole round, so who's It
// reads at a glance, still or moving. Filled rather than a ring (Jay, 2026-11-05: the ring it replaced
// sat among the powerup effect rings, 4 to 10pt outside a head, in the same thin stroke, and in a
// seat color like cyan or gold read as Safe or Dash). At its biggest it's It's reach, TAG_REACH_PX: a
// rider touching it is tagged. It breathes in from there by IT_GLOW_PULSE of its radius, and its
// opacity is held from its middle out past the head (to TAG_GLOW_HOLD of its radius), then fades to
// nothing at its rim.
const IT_GLOW_PULSE = 0.12
const IT_GLOW_POSITIONS = [0, TAG_GLOW_HOLD, 1]
const IT_PULSE_MS = 620
// A frozen It's countdown ring, at its reach: It can't tag until the ring is gone.
const FREEZE_RING_WIDTH = 3
const EDGE_STROKE_WIDTH = 1.5
// A frozen It is dimmed, ringed by a white arc that empties as the freeze runs out: plain white, so
// it reads the same whatever the rider's color (an ice blue vanished against player 1's default).
const FROZEN_OPACITY = 0.55
const FROZEN_RING_COLOR = '#FFFFFF'

// The arc left of a frozen It's ring: a full circle just after the tag, gone when the freeze is over.
function FreezeRing({ x, y, left }: { x: SharedValue<number>; y: SharedValue<number>; left: number }) {
  const r = TAG_REACH_PX
  const arc = useDerivedValue(() => {
    const path = Skia.PathBuilder.Make()
    path.addArc(Skia.XYWHRect(x.value - r, y.value - r, r * 2, r * 2), -90, 360 * left)
    return path.detach()
  })
  return <Path path={arc} style='stroke' strokeWidth={FREEZE_RING_WIDTH} strokeCap='round' color={FROZEN_RING_COLOR} />
}

// It's glow, in its own color, held out past the head and gone at its rim.
function ItGlow({ x, y, color, pulse }: { x: SharedValue<number>; y: SharedValue<number>; color: string; pulse: SharedValue<number> }) {
  const r = useDerivedValue(() => TAG_REACH_PX * (1 - IT_GLOW_PULSE * pulse.value))
  const center = useDerivedValue(() => vec(x.value, y.value))
  const colors = useMemo(() => {
    const [red, green, blue] = Skia.Color(color)
    const held = Float32Array.of(red, green, blue, TAG_GLOW_OPACITY)
    return [held, held, Float32Array.of(red, green, blue, 0)]
  }, [color])
  return (
    <Circle cx={x} cy={y} r={r}>
      <RadialGradient c={center} r={r} colors={colors} positions={IT_GLOW_POSITIONS} />
    </Circle>
  )
}

function Rider({ player, color, cellPx, tick, intervalMs, isIt, freezeLeft, dazed, pulse, phase }: { player: TagPlayer; color: string; cellPx: number; tick: number; intervalMs: number; isIt: boolean; freezeLeft: number; dazed: boolean; pulse: SharedValue<number>; phase: TagPhase }) {
  // Its own pace, as the engine steps it: It a little faster, Dash and Mud on top (a frozen rider
  // takes no steps to glide).
  const speed = (isIt ? TAG_IT_SPEED : 1) * (speedMultiplier(player.effects, tick + 1) || 1)
  const { x, y } = useRiderGlide({ path: player.recent, cellPx, msPerCell: intervalMs / speed, snap: phase !== 'playing' })
  // The tail: a set length back from wherever the head is mid-glide, through the cells it rode, as one
  // path built every frame, so it slides along with the head at one strength (it was the cells
  // behind the head plus a line on to it: its back end dropped a cell every step, an inchworm, and
  // the two pieces doubled up just behind the head). Broken where it went through a gate.
  const cells = useMemo(() => player.recent.map((c) => ({ x: c.x, y: c.y })), [player.recent])
  const tail = useDerivedValue(() => tailTrailPath(cells, x.value, y.value, cellPx, TAG_TAIL_PX))
  const radius = cellPx * HEAD_RADIUS_CELLS * (isIt ? IT_HEAD_SCALE : 1)
  const frozen = isIt && freezeLeft > 0

  return (
    <>
      {isIt && !frozen && <ItGlow x={x} y={y} color={color} pulse={pulse} />}
      <Path path={tail} style='stroke' strokeWidth={cellPx * TAIL_WIDTH} strokeCap='round' strokeJoin='round' color={color} opacity={TAIL_OPACITY} />
      <RiderHead x={x} y={y} radius={radius} color={color} opacity={frozen ? FROZEN_OPACITY : 1} />
      <EffectRings x={x} y={y} headRadius={radius} effects={player.effects} />
      {frozen && <FreezeRing x={x} y={y} left={freezeLeft} />}
      {dazed && <DazeStars x={x} y={y} headRadius={radius} />}
    </>
  )
}

export function TagBoard({ grid, cellPx, pillars, portals, players, it, orientationMode, p1OnRight, freezeLeft, colors, phase, tick, intervalMs, structureColor, pickups, pickupColor }: TagBoardProps) {
  // Every arena's blocks as cells, so the Pillars arena's pillars and the shared arenas' walls are
  // drawn the same as in every game (ArenaBlocks).
  const blockCells = useMemo(() => pillars.flatMap((p) => Array.from({ length: p.width * p.height }, (_, i) => ({ x: p.x + (i % p.width), y: p.y + Math.floor(i / p.width) }))), [pillars])
  // It's glow breathes in and out the whole round.
  const pulse = useSharedValue(0)
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: IT_PULSE_MS, easing: Easing.inOut(Easing.quad) }), -1, true)
  }, [pulse])

  return (
    <View style={styles.container}>
      <Canvas style={StyleSheet.absoluteFill}>
        {phase !== 'onboarding' && <SplitWalls grid={grid} cellPx={cellPx} orientationMode={orientationMode} p1OnRight={p1OnRight} colors={colors} strokeWidth={EDGE_STROKE_WIDTH} />}
        <ArenaBlocks cells={blockCells} cellPx={cellPx} color={structureColor} />
        <Gates portals={portals} cellPx={cellPx} color={structureColor} />
        {pickups.map((pickup) => (
          <PickupGlyph key={pickup.id} pickup={pickup} cellPx={cellPx} color={pickupColor} />
        ))}
        {SEATS.map((seat) => (
          <Rider key={seat} player={players[seat]} color={colors[seat]} cellPx={cellPx} tick={tick} intervalMs={intervalMs} isIt={seat === it} freezeLeft={phase === 'playing' ? freezeLeft : 0} dazed={phase === 'playing' && isDazed(players[seat], tick + 1)} pulse={pulse} phase={phase} />
        ))}
      </Canvas>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 }
})
