import type { GameIconProps } from '@tastic/shell'
import { useId } from 'react'
import Svg, { Defs, Ellipse, G, RadialGradient, Stop } from 'react-native-svg'

import { IconRiderHead } from '@/shared/IconRiderHead'
import { IconTrail } from '@/shared/IconTrail'

import { TAG_GLOW_HOLD, TAG_GLOW_OPACITY } from './constants'

// Tag's icon: two riders chasing each other round a loop, each head just behind the other's tail,
// seat 1 It in its glow (the board's: TAG_GLOW_OPACITY held to TAG_GLOW_HOLD, gone at the rim). The two
// riders mirror each other. The same art on the light and dark backgrounds Home draws behind it.
// Drawn from art/icon.svg (Affinity's export); re-export there and copy the paths over when the art
// changes. The export draws the glow as a picture clipped to the ellipse below, so the gradient is
// written here, in seat 1's color.
export function GameIcon({ size, p1Color, p2Color }: GameIconProps) {
  // Unique per icon: on the web every icon's gradient is in one document.
  const glowId = `tagGlow${useId().replace(/[^\w-]/g, '')}`
  return (
    <Svg width={size} height={size} viewBox='0 0 1024 1024'>
      <Defs>
        <RadialGradient id={glowId}>
          <Stop offset={0} stopColor={p1Color} stopOpacity={TAG_GLOW_OPACITY} />
          <Stop offset={TAG_GLOW_HOLD} stopColor={p1Color} stopOpacity={TAG_GLOW_OPACITY} />
          <Stop offset={1} stopColor={p1Color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <G transform='matrix(0,6.392103,6.897755,0,-3676.325536,-2760.756589)'>
        <Ellipse cx={479.844} cy={637} rx={32.156} ry={29.799} fill={`url(#${glowId})`} />
      </G>
      <IconTrail transform='matrix(0.52693,0,0,-0.653208,236.272558,1122.080434)' color={p2Color} />
      <G transform='matrix(0.895071,0,0,-0.759966,110.646359,1011.651469)'>
        <IconRiderHead color={p2Color} />
      </G>
      <IconTrail transform='matrix(-0.52693,0,0,0.653208,787.727442,-98.080434)' color={p1Color} />
      <G transform='matrix(-0.895071,0,0,0.759966,913.353641,12.348531)'>
        <IconRiderHead color={p1Color} />
      </G>
    </Svg>
  )
}
