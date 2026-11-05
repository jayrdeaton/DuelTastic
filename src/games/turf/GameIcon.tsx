import type { GameIconProps } from '@tastic/shell'
import Svg, { G, Path } from 'react-native-svg'

import { IconRiderHead } from '@/shared/IconRiderHead'

// A seat's ground: a rounded square.
const GROUND = 'M533.936,362.425C591.77,362.425 638.724,409.379 638.724,467.213L638.724,676.79C638.724,734.624 591.77,781.578 533.936,781.578L324.36,781.578C266.526,781.578 219.572,734.624 219.572,676.79L219.572,467.213C219.572,409.379 266.526,362.425 324.36,362.425L533.936,362.425Z'
// A rider's trail: out of its own ground and across the other seat's, to its head.
const TRAIL = 'M913.351,933.975L913.351,617.888L133.192,619.306'
// The trails as drawn: the lighter layer over the solid ground, as on the board (whose
// TURF_TRAIL_OPACITY is 0.4), so a trail over the other seat's ground mixes with it.
const TRAIL_OPACITY = 0.45

function Trail({ transform, color }: { transform: string; color: string }) {
  return (
    <G transform={transform}>
      <Path d={TRAIL} fill='none' stroke={color} strokeOpacity={TRAIL_OPACITY} strokeWidth={175.53} strokeLinecap='round' strokeLinejoin='round' />
    </G>
  )
}

// Turf's icon: each seat's ground (seat 1's bottom left, seat 2's top right), and each rider out on
// the other's, its trail running back across to its own: the moment before a claim or a cut. The
// two halves mirror each other. The same art on the light and dark backgrounds Home draws behind
// it. Drawn from art/icon.svg (Affinity's export); re-export there and copy the paths over when the
// art changes.
export function GameIcon({ size, p1Color, p2Color }: GameIconProps) {
  return (
    <Svg width={size} height={size} viewBox='0 0 1024 1024'>
      <G transform='matrix(0.980763,0,0,0.980763,-114.436674,156.546736)'>
        <Path d={GROUND} fill={p1Color} />
      </G>
      <G transform='matrix(0.980763,0,0,0.980763,296.652316,-254.542253)'>
        <Path d={GROUND} fill={p2Color} />
      </G>
      <Trail transform='matrix(0.52693,0,0,-0.653208,236.272558,1122.080434)' color={p2Color} />
      <G transform='matrix(0.895071,0,0,-0.759966,110.646359,1011.651469)'>
        <IconRiderHead color={p2Color} />
      </G>
      <Trail transform='matrix(-0.52693,0,0,0.653208,787.727442,-98.080434)' color={p1Color} />
      <G transform='matrix(-0.895071,0,0,0.759966,913.353641,12.348531)'>
        <IconRiderHead color={p1Color} />
      </G>
    </Svg>
  )
}
