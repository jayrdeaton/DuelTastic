import { Circle } from '@shopify/react-native-skia'
import type { SharedValue } from 'react-native-reanimated'

type Coordinate = number | SharedValue<number>

// The rider's color, a white ring on its edge, and a thin black line just outside the white. On the
// dark board the black is invisible and the white does the work; on a rider's own ground, a light
// theme or a light rider color (yellow), the black is what separates the white from what's behind.
// The black never covers the white, and is at least 1pt so it still reads at the smallest cells.
// Draw it after the trail, so the whole ring shows.
export function RiderHead({ x, y, radius, color, opacity = 1, outlineWidth, ringWidth, outlineColor = '#000000', ringColor = '#FFFFFF' }: { x: Coordinate; y: Coordinate; radius: number; color: string; opacity?: number; outlineWidth: number; ringWidth: number; outlineColor?: string; ringColor?: string }) {
  const outline = Math.max(1, outlineWidth)
  const outlineRadius = radius + ringWidth / 2 + outline / 2
  return (
    <>
      <Circle cx={x} cy={y} r={radius} color={color} opacity={opacity} />
      <Circle cx={x} cy={y} r={radius} style='stroke' strokeWidth={ringWidth} color={ringColor} />
      <Circle cx={x} cy={y} r={outlineRadius} style='stroke' strokeWidth={outline} color={outlineColor} />
    </>
  )
}
