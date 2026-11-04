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

// A ring around a head per kind of effect it's under, each in its own slot: speed (boost, freeze,
// slow or rush) innermost, then reverse, then shield. Set a fixed distance outside the head and each
// other rather than scaled with the head, so they look the same in every game whatever its head size
// and stay clear of the head's own ring and outline (riderSkin.ts). Scaled, LightCycles' small head put
// the speed ring on top of its outline and its three rings over each other.
const RING_OFFSET = 4
const RING_SPACING = 3
const RING_WIDTH = 2
const ringRadius = (headRadius: number, slot: number) => headRadius + RING_OFFSET + RING_SPACING * slot

// `x`/`y` is the head's center: a plain number, or a shared value for a head that glides.
export function EffectRings({ x, y, headRadius, effects }: { x: number | SharedValue<number>; y: number | SharedValue<number>; headRadius: number; effects: Effects }) {
  const { speed, reverse, shield } = effects
  return (
    <>
      {speed && <Circle cx={x} cy={y} r={ringRadius(headRadius, 0)} style='stroke' strokeWidth={RING_WIDTH} color={EFFECT_COLORS[speed.kind]} />}
      {reverse && <Circle cx={x} cy={y} r={ringRadius(headRadius, 1)} style='stroke' strokeWidth={RING_WIDTH} color={EFFECT_COLORS.reverse} />}
      {shield && <Circle cx={x} cy={y} r={ringRadius(headRadius, 2)} style='stroke' strokeWidth={RING_WIDTH} color={EFFECT_COLORS.shield} />}
    </>
  )
}
