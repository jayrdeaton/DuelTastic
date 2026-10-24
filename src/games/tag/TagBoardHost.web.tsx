import { loadSkiaWeb } from '@tastic/hud/skia'
import { lazy, Suspense } from 'react'

import type { TagBoardProps } from './TagBoard'

// TagBoard.tsx imports Skia, which binds to CanvasKit the moment the module is evaluated, so it's
// only imported once loadSkiaWeb() has loaded CanvasKit (the same as components/GameBoardHost.web.tsx).
const LazyTagBoard = lazy(() => loadSkiaWeb().then(() => import('./TagBoard').then((m) => ({ default: m.TagBoard }))))

export default function TagBoardHost(props: TagBoardProps) {
  return (
    <Suspense fallback={null}>
      <LazyTagBoard {...props} />
    </Suspense>
  )
}
