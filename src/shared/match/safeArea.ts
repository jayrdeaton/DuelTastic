import type { GridSize } from '@tastic/grid'

// A board that plays under the device's safe areas (a game's Full Screen option, extendIntoSafeArea)
// has cells a notch, Dynamic Island, home indicator or speaker cutout can hide. Nothing a player has
// to see or reach may be put there: a game blocks these cells when it places a powerup box. The
// insets are MatchScreen's safeAreaInsetsPx, all zero unless the round is bleeding under them, so the
// mask is empty then. Each margin is rounded up to whole cells, so a box never sits half hidden.
export function safeAreaMask(grid: GridSize, cellPx: number, insetsPx: { top: number; right: number; bottom: number; left: number }): Uint8Array {
  const mask = new Uint8Array(grid.cols * grid.rows)
  const top = Math.ceil(insetsPx.top / cellPx)
  const bottom = Math.ceil(insetsPx.bottom / cellPx)
  const left = Math.ceil(insetsPx.left / cellPx)
  const right = Math.ceil(insetsPx.right / cellPx)
  if (top <= 0 && bottom <= 0 && left <= 0 && right <= 0) return mask
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      if (x < left || x >= grid.cols - right || y < top || y >= grid.rows - bottom) mask[y * grid.cols + x] = 1
    }
  }
  return mask
}
