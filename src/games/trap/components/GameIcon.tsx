import type { GameIconProps } from '@tastic/shell'
import Svg, { G, Path } from 'react-native-svg'

import { IconRiderHead } from '@/shared/IconRiderHead'
import { type BakedStroke, bakeStroke, compose, matrixString, parseMatrix } from '@/shared/iconStroke'

// A rider's trail: in from the icon's edge, folding back on itself twice to its head.
const TRAIL = 'M380.76,1600.925L380.76,1116.633L647.083,1118.735L647.083,1358.786L913.37,1358.662L913.351,512L390.249,512'
// The trail's tail, running on off the icon's edge.
const TAIL = 'M380.76,1862.692L380.76,1600.925'
const TRAIL_WIDTH = 175.53

// The export's groups, as it writes them: the art flipped and turned onto the icon, seat 2's rider
// mirrored onto seat 1's, each trail's stretch from the art's coordinates (seat 2's tail has its
// own), and each head's place.
const BOARD = compose(parseMatrix('matrix(1,0,0,-1,0,1024)'), parseMatrix('matrix(0,0.895071,-0.759966,0,1069.657286,387.053015)'))
const SEAT_2 = compose(BOARD, parseMatrix('matrix(-1,0,0,1,279.188846,0)'))
const TRAIL_STRETCH = parseMatrix('matrix(0.588702,0,0,0.859523,-5.390577,-53.075537)')
const SEAT_2_TAIL_STRETCH = parseMatrix('matrix(0.588702,0,0,0.859523,-163.798294,-53.075537)')
const HEAD = parseMatrix('matrix(1,0,0,1,5.586146,0)')

// The trails baked out of those groups (bakeStroke), so they're one width all the way round. The
// heads are fills, which the groups place as drawn.
const P1_TRAIL = bakeStroke(TRAIL, compose(BOARD, TRAIL_STRETCH), TRAIL_WIDTH)
const P2_TRAIL = bakeStroke(TRAIL, compose(SEAT_2, TRAIL_STRETCH), TRAIL_WIDTH)
const P1_TAIL = bakeStroke(TAIL, compose(BOARD, TRAIL_STRETCH), TRAIL_WIDTH)
const P2_TAIL = bakeStroke(TAIL, compose(BOARD, SEAT_2_TAIL_STRETCH), TRAIL_WIDTH)
const P1_HEAD = matrixString(compose(BOARD, HEAD))
const P2_HEAD = matrixString(compose(SEAT_2, HEAD))

function Trail({ stroke, color }: { stroke: BakedStroke; color: string }) {
  return <Path d={stroke.d} fill='none' stroke={color} strokeWidth={stroke.width} strokeLinecap='round' strokeLinejoin='round' />
}

// Trap's icon, the app icon's art: two riders' trails run in side by side from the left edge
// (seat 1's on top, seat 2's below), fold back twice and meet head-on at the right. Seat 2's rider
// is seat 1's mirrored. The same art on the light and dark backgrounds Home draws behind it. Drawn
// from art/icon.svg (Affinity's export); re-export there and copy the paths and matrices over when
// the art changes. Each rider's head goes on top of its trail.
export function GameIcon({ size, p1Color, p2Color }: GameIconProps) {
  return (
    <Svg width={size} height={size} viewBox='0 0 1024 1024'>
      <Trail stroke={P1_TRAIL} color={p1Color} />
      <G transform={P1_HEAD}>
        <IconRiderHead color={p1Color} />
      </G>
      <Trail stroke={P2_TRAIL} color={p2Color} />
      <G transform={P2_HEAD}>
        <IconRiderHead color={p2Color} />
      </G>
      <Trail stroke={P1_TAIL} color={p1Color} />
      <Trail stroke={P2_TAIL} color={p2Color} />
    </Svg>
  )
}
