import { G, Path } from 'react-native-svg'

// A rider's trail as Turf's and Tag's Home icons draw it: an L round one corner to its head, placed
// by each icon's own transform around this one.
const TRAIL = 'M913.351,933.975L913.351,617.888L133.192,619.306'
// The trails as drawn: the lighter layer, as on the boards (Turf's TURF_TRAIL_OPACITY and Tag's tail
// are 0.4), so a trail over a seat's ground or It's glow mixes with it.
const TRAIL_OPACITY = 0.45
const TRAIL_WIDTH = 175.53

export function IconTrail({ transform, color }: { transform: string; color: string }) {
  return (
    <G transform={transform}>
      <Path d={TRAIL} fill='none' stroke={color} strokeOpacity={TRAIL_OPACITY} strokeWidth={TRAIL_WIDTH} strokeLinecap='round' strokeLinejoin='round' />
    </G>
  )
}
