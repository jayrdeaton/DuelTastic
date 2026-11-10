import { Path } from 'react-native-svg'

import { bakeStroke, parseMatrix } from './iconStroke'

// A rider's trail as Turf's and Tag's Home icons draw it: an L round one corner to its head, placed
// by each icon's own transform (the export's, copied as is) and baked out of it (bakeStroke), since
// the export's transform is scaled more one way than the other and would stretch the stroke.
const TRAIL = 'M913.351,933.975L913.351,617.888L133.192,619.306'
// The trails as drawn: the lighter layer, as on the boards (Turf's TURF_TRAIL_OPACITY and Tag's tail
// are 0.4), so a trail over a seat's ground or It's glow mixes with it.
const TRAIL_OPACITY = 0.45
const TRAIL_WIDTH = 175.53

export function IconTrail({ transform, color }: { transform: string; color: string }) {
  const trail = bakeStroke(TRAIL, parseMatrix(transform), TRAIL_WIDTH)
  return <Path d={trail.d} fill='none' stroke={color} strokeOpacity={TRAIL_OPACITY} strokeWidth={trail.width} strokeLinecap='round' strokeLinejoin='round' />
}
