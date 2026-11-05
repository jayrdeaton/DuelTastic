import { Path, Skia } from '@shopify/react-native-skia'
import { useEffect } from 'react'
import { Easing, type SharedValue, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import { CLASSIC_SKIN } from './riderSkin'

// A dazed rider: three little stars circling its head, for the second or so it stands still after a
// bump into the edge or a pillar in Tag, or a crash home in Turf. The same in every game. Gold with
// the head's thin dark outline (riderSkin.ts), so they read on the dark board, a rider's own ground
// and the light theme alike. In points rather than scaled with the head, like the effect rings, so
// Turf's small head and Tag's big one get the same stars. Import it only from a board file: it pulls
// in Skia, which on web has to wait for CanvasKit (see the boards' host pairs).

const STAR_COUNT = 3
const STAR_POINTS = 5
const STAR_OUTER = 5
const STAR_INNER = 2.2
// How far outside the head the stars circle, and how long one lap takes.
const ORBIT_OFFSET = 6
const LAP_MS = 900
const STAR_COLOR = '#FFD54F'

// `x`/`y` is the head's center, gliding with it.
export function DazeStars({ x, y, headRadius }: { x: SharedValue<number>; y: SharedValue<number>; headRadius: number }) {
  const lap = useSharedValue(0)
  useEffect(() => {
    lap.value = withRepeat(withTiming(1, { duration: LAP_MS, easing: Easing.linear }), -1, false)
  }, [lap])
  const orbit = headRadius + ORBIT_OFFSET
  const stars = useDerivedValue(() => {
    const path = Skia.PathBuilder.Make()
    for (let i = 0; i < STAR_COUNT; i++) {
      const angle = (lap.value + i / STAR_COUNT) * Math.PI * 2
      const cx = x.value + Math.cos(angle) * orbit
      const cy = y.value + Math.sin(angle) * orbit
      for (let p = 0; p < STAR_POINTS * 2; p++) {
        const r = p % 2 === 0 ? STAR_OUTER : STAR_INNER
        const a = (p / (STAR_POINTS * 2)) * Math.PI * 2 - Math.PI / 2
        if (p === 0) path.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
        else path.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      }
      path.close()
    }
    return path.detach()
  })
  return (
    <>
      <Path path={stars} color={STAR_COLOR} />
      <Path path={stars} style='stroke' strokeWidth={CLASSIC_SKIN.outlineWidth} strokeJoin='round' color={CLASSIC_SKIN.outlineColor} />
    </>
  )
}
