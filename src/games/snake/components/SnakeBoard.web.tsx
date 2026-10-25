// Web loads Skia's CanvasKit before it imports the board (see shared/lazySkia.tsx for why);
// SnakeBoard.tsx is the native entry point, which needs none of that.
import { lazySkia } from '@/shared/lazySkia'

import type { SnakeBoardProps } from './SnakeBoardCanvas'

export const SnakeBoard = lazySkia<SnakeBoardProps>(() => import('./SnakeBoardCanvas').then((m) => ({ default: m.SnakeBoard })))
