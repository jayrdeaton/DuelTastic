import { Circle } from '@shopify/react-native-skia'
import type { SharedValue } from 'react-native-reanimated'

type Coordinate = number | SharedValue<number>

export function RiderHead({ x, y, radius, color, opacity = 1, outlineWidth, ringWidth, outlineColor = '#000000', ringColor = '#FFFFFF' }: { x: Coordinate; y: Coordinate; radius: number; color: string; opacity?: number; outlineWidth: number; ringWidth: number; outlineColor?: string; ringColor?: string }) {
  const whiteRingRadius = radius + Math.max(0.5, ringWidth * 0.55)
  const blackRingRadius = whiteRingRadius + Math.max(0.5, outlineWidth * 0.35)
  return (
    <>
      <Circle cx={x} cy={y} r={radius} color={color} opacity={opacity} />
      <Circle cx={x} cy={y} r={whiteRingRadius} style='stroke' strokeWidth={ringWidth} color={ringColor} />
      <Circle cx={x} cy={y} r={blackRingRadius} style='stroke' strokeWidth={outlineWidth} color={outlineColor} />
    </>
  )
}
