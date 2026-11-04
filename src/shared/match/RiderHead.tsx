import { Circle } from '@shopify/react-native-skia'
import type { SharedValue } from 'react-native-reanimated'

import { CLASSIC_SKIN, type RiderSkin } from './riderSkin'

type Coordinate = number | SharedValue<number>

// A rider's head in its color, ringed by the skin (riderSkin.ts): the ring on the head's edge and the
// outline just outside it, so the outline never covers the ring. Draw it after the trail, so the
// whole ring shows.
export function RiderHead({ x, y, radius, color, opacity = 1, skin = CLASSIC_SKIN }: { x: Coordinate; y: Coordinate; radius: number; color: string; opacity?: number; skin?: RiderSkin }) {
  const outlineRadius = radius + skin.ringWidth / 2 + skin.outlineWidth / 2
  return (
    <>
      <Circle cx={x} cy={y} r={radius} color={color} opacity={opacity} />
      <Circle cx={x} cy={y} r={radius} style='stroke' strokeWidth={skin.ringWidth} color={skin.ringColor} />
      <Circle cx={x} cy={y} r={outlineRadius} style='stroke' strokeWidth={skin.outlineWidth} color={skin.outlineColor} />
    </>
  )
}
