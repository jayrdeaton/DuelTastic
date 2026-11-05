import type { GameIconProps } from '@tastic/shell'
import Svg, { Ellipse, G, Path } from 'react-native-svg'

// A rider's trail: in from the icon's edge, folding back on itself twice to its head.
const TRAIL = 'M380.76,1600.925L380.76,1116.633L647.083,1118.735L647.083,1358.786L913.37,1358.662L913.351,512L390.249,512'
// The trail's tail, running on off the icon's edge.
const TAIL = 'M380.76,1862.692L380.76,1600.925'
// A head's white ring, around its fill.
const RING = 'M479.844,585.473C449.156,585.473 424.241,608.561 424.241,637C424.241,665.439 449.156,688.527 479.844,688.527C510.532,688.527 535.447,665.439 535.447,637C535.447,608.561 510.532,585.473 479.844,585.473ZM479.844,607.201C497.591,607.201 512,620.554 512,637C512,653.446 497.591,666.799 479.844,666.799C462.097,666.799 447.688,653.446 447.688,637C447.688,620.554 462.097,607.201 479.844,607.201Z'
// A head's black line, just outside the white ring (and just inside it, under the fill): the game's
// heads (CLASSIC_SKIN), which shows on the light background and disappears on the dark one.
const OUTLINE = 'M479.844,576.161C443.61,576.161 414.192,603.422 414.192,637C414.192,670.578 443.61,697.839 479.844,697.839C516.078,697.839 545.496,670.578 545.496,637C545.496,603.422 516.078,576.161 479.844,576.161ZM479.844,585.473C510.532,585.473 535.447,608.561 535.447,637C535.447,665.439 510.532,688.527 479.844,688.527C449.156,688.527 424.241,665.439 424.241,637C424.241,608.561 449.156,585.473 479.844,585.473ZM479.844,607.201C462.097,607.201 447.688,620.554 447.688,637C447.688,653.446 462.097,666.799 479.844,666.799C497.591,666.799 512,653.446 512,637C512,620.554 497.591,607.201 479.844,607.201ZM479.844,616.513C492.045,616.513 501.951,625.693 501.951,637C501.951,648.307 492.045,657.487 479.844,657.487C467.643,657.487 457.737,648.307 457.737,637C457.737,625.693 467.643,616.513 479.844,616.513Z'
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
        <G transform='matrix(0,1.63683,-1.499699,0,1174.072184,-398.422959)'>
          <Path d={RING} fill='#F0F0F0' fillRule='evenodd' />
          <Path d={OUTLINE} fill='#000000' fillRule='evenodd' />
          <Ellipse cx={479.844} cy={637} rx={32.156} ry={29.799} fill={color} />
        </G>
      </G>
    </>
  )
}

// LightCycles' icon, the app icon's art: two riders' trails run in side by side from the left edge
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
