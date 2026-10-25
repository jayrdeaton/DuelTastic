import { Circle } from '@shopify/react-native-skia'
import { cellToPixel } from '@tastic/grid'
import { MysteryPickup } from '@tastic/sprites/shapes'
import type { SharedValue } from 'react-native-reanimated'

import { EFFECT_COLORS, type Effects, type Pickup, PICKUP_PULSE_DURATION_MS, PICKUP_PULSE_SCALE, PICKUP_SPAWN_FADE_MS, pickupRadiusPx } from './powerups'

// The powerup pieces of a game's Skia board, drawn the same in every game. Import them only from a
// board file: they pull in Skia, which on web has to wait for CanvasKit (see the boards' host pairs).

// A box on the board. Every one looks the same: what it holds shows only in its holder's badge.
export function PickupGlyph({ pickup, cellPx, color }: { pickup: Pickup<string>; cellPx: number; color: string }) {
  const { x, y } = cellToPixel(pickup.cell, cellPx)
  return <MysteryPickup x={x + cellPx / 2} y={y + cellPx / 2} radius={pickupRadiusPx(cellPx)} color={color} spawnFadeMs={PICKUP_SPAWN_FADE_MS} pulseDurationMs={PICKUP_PULSE_DURATION_MS} pulseScale={PICKUP_PULSE_SCALE} />
}

// A ring around a head per kind of effect it's under, at LightCycles' sizes relative to the head:
// speed (boost, rush or freeze) innermost, then reverse, then shield.
const RING_SCALE = { speed: 1.35, reverse: 1.7, shield: 2.05 }
const RING_WIDTH = 2

// `x`/`y` is the head's center: a plain number, or a shared value for a head that glides.
export function EffectRings({ x, y, headRadius, effects }: { x: number | SharedValue<number>; y: number | SharedValue<number>; headRadius: number; effects: Effects }) {
  const { speed, reverse, shield } = effects
  return (
    <>
      {speed && <Circle cx={x} cy={y} r={headRadius * RING_SCALE.speed} style='stroke' strokeWidth={RING_WIDTH} color={EFFECT_COLORS[speed.kind]} />}
      {reverse && <Circle cx={x} cy={y} r={headRadius * RING_SCALE.reverse} style='stroke' strokeWidth={RING_WIDTH} color={EFFECT_COLORS.reverse} />}
      {shield && <Circle cx={x} cy={y} r={headRadius * RING_SCALE.shield} style='stroke' strokeWidth={RING_WIDTH} color={EFFECT_COLORS.shield} />}
    </>
  )
}
