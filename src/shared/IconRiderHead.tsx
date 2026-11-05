import { Ellipse, G, Path } from 'react-native-svg'

// A head's white ring, around its fill.
const RING = 'M479.844,585.473C449.156,585.473 424.241,608.561 424.241,637C424.241,665.439 449.156,688.527 479.844,688.527C510.532,688.527 535.447,665.439 535.447,637C535.447,608.561 510.532,585.473 479.844,585.473ZM479.844,607.201C497.591,607.201 512,620.554 512,637C512,653.446 497.591,666.799 479.844,666.799C462.097,666.799 447.688,653.446 447.688,637C447.688,620.554 462.097,607.201 479.844,607.201Z'
// A head's black line, just outside the white ring (and just inside it, under the fill).
const OUTLINE = 'M479.844,576.161C443.61,576.161 414.192,603.422 414.192,637C414.192,670.578 443.61,697.839 479.844,697.839C516.078,697.839 545.496,670.578 545.496,637C545.496,603.422 516.078,576.161 479.844,576.161ZM479.844,585.473C510.532,585.473 535.447,608.561 535.447,637C535.447,665.439 510.532,688.527 479.844,688.527C449.156,688.527 424.241,665.439 424.241,637C424.241,608.561 449.156,585.473 479.844,585.473ZM479.844,607.201C462.097,607.201 447.688,620.554 447.688,637C447.688,653.446 462.097,666.799 479.844,666.799C497.591,666.799 512,653.446 512,637C512,620.554 497.591,607.201 479.844,607.201ZM479.844,616.513C492.045,616.513 501.951,625.693 501.951,637C501.951,648.307 492.045,657.487 479.844,657.487C467.643,657.487 457.737,648.307 457.737,637C457.737,625.693 467.643,616.513 479.844,616.513Z'

// A rider's head as the Home icons draw it: the rider's color in a white ring with a black line
// outside it, the game's heads (CLASSIC_SKIN), whose black line shows on the light background and on
// a rider's ground and disappears on the dark background. One Affinity symbol in every icon's art,
// placed by the icon's own transforms around this one; copy its paths over here if it changes.
export function IconRiderHead({ color }: { color: string }) {
  return (
    <G transform='matrix(0,1.63683,-1.499699,0,1174.072184,-398.422959)'>
      <Path d={RING} fill='#F0F0F0' fillRule='evenodd' />
      <Path d={OUTLINE} fill='#000000' fillRule='evenodd' />
      <Ellipse cx={479.844} cy={637} rx={32.156} ry={29.799} fill={color} />
    </G>
  )
}
