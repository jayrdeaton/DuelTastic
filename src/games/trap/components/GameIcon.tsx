import type { GameIconProps } from '@tastic/shell'
import Svg, { G, Path } from 'react-native-svg'

import { IconRiderHead } from '@/shared/IconRiderHead'

// A rider's trail: in from the icon's edge, folding back on itself twice to its head.
const TRAIL = 'M380.76,1600.925L380.76,1116.633L647.083,1118.735L647.083,1358.786L913.37,1358.662L913.351,512L390.249,512'
// The trail's tail, running on off the icon's edge.
const TAIL = 'M380.76,1862.692L380.76,1600.925'
// Every trail's stretch from the art's coordinates onto the board.
const TRAIL_TRANSFORM = 'matrix(0.588702,0,0,0.859523,-5.390577,-53.075537)'

// One rider: its trail, then its head on top.
function Rider({ color }: { color: string }) {
  return (
    <>
      <G transform={TRAIL_TRANSFORM}>
        <Path d={TRAIL} fill='none' stroke={color} strokeWidth={175.53} strokeLinecap='round' strokeLinejoin='round' />
      </G>
      <G transform='matrix(1,0,0,1,5.586146,0)'>
        <IconRiderHead color={color} />
      </G>
    </>
  )
}

// Trap's icon, the app icon's art: two riders' trails run in side by side from the left edge
// (seat 1's on top, seat 2's below), fold back twice and meet head-on at the right. Seat 2's rider
// is seat 1's mirrored. The same art on the light and dark backgrounds Home draws behind it. Drawn
// from art/icon.svg (Affinity's export); re-export there and copy the paths over when the art
// changes.
export function GameIcon({ size, p1Color, p2Color }: GameIconProps) {
  return (
    <Svg width={size} height={size} viewBox='0 0 1024 1024'>
      <G transform='matrix(1,0,0,-1,0,1024)'>
        <G transform='matrix(0,0.895071,-0.759966,0,1069.657286,387.053015)'>
          <Rider color={p1Color} />
          <G transform='matrix(-1,0,0,1,279.188846,0)'>
            <Rider color={p2Color} />
          </G>
          <G transform={TRAIL_TRANSFORM}>
            <Path d={TAIL} fill='none' stroke={p1Color} strokeWidth={175.53} strokeLinecap='round' strokeLinejoin='round' />
          </G>
          <G transform='matrix(0.588702,0,0,0.859523,-163.798294,-53.075537)'>
            <Path d={TAIL} fill='none' stroke={p2Color} strokeWidth={175.53} strokeLinecap='round' strokeLinejoin='round' />
          </G>
        </G>
      </G>
    </Svg>
  )
}
