import { lazySkia } from '@/shared/lazySkia'

import type { HeroTitleTrailsProps } from './HeroTitleTrails'

// Same reasoning as every board's web host (shared/lazySkia.tsx): HeroTitleTrails.tsx's `Skia` import
// binds to global.CanvasKit at module-evaluation time, so it can only be imported after loadSkiaWeb()
// resolves. Home is the first screen that ever needs canvaskit.wasm - the hero's letters render and
// stagger in immediately regardless, and this trail canvas just pops in a beat later once the wasm
// resolves (loadSkiaWeb is idempotent, so by the time a match mounts its board, CanvasKit is very
// likely already warm).
export default lazySkia<HeroTitleTrailsProps>(() => import('./HeroTitleTrails').then((m) => ({ default: m.HeroTitleTrails })))
