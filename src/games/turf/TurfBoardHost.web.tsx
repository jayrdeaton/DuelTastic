import { loadSkiaWeb } from '@tastic/hud/skia'
import { lazy, Suspense } from 'react'

import type { TurfBoardProps } from './TurfBoard'

// TurfBoard.tsx imports Skia, which binds to CanvasKit the moment the module is evaluated, so it's
// only imported once loadSkiaWeb() has loaded CanvasKit (the same as components/GameBoardHost.web.tsx).
const LazyTurfBoard = lazy(() => loadSkiaWeb().then(() => import('./TurfBoard').then((m) => ({ default: m.TurfBoard }))))

export default function TurfBoardHost(props: TurfBoardProps) {
  return (
    <Suspense fallback={null}>
      <LazyTurfBoard {...props} />
    </Suspense>
  )
}
