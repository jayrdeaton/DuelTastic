import type { GridCell, GridSize } from '@tastic/grid'

import type { TurfSeat } from './types'

// The cells a seat claims when its trail gets back to its ground: the trail itself, plus every cell
// the trail and the seat's ground together close off from the board's edge. Found by filling in from
// the edge with the seat's ground and trail as walls; whatever the fill can't reach is enclosed. The
// other seat's ground is no wall, so whatever of it is enclosed is claimed too. Returns cell indices
// (y * cols + x), never including a cell the seat already owns.
//
// Trails only ever step up, down, left or right, so a closed loop is a 4-connected wall and a fill
// that also only moves up, down, left or right can't slip through it at a corner.
export function claimedCells(owner: Uint8Array, grid: GridSize, seat: TurfSeat, trail: readonly GridCell[]): number[] {
  const { cols, rows } = grid
  const size = cols * rows
  const wall = new Uint8Array(size)
  for (let i = 0; i < size; i++) if (owner[i] === seat) wall[i] = 1
  for (const cell of trail) wall[cell.y * cols + cell.x] = 1

  const outside = new Uint8Array(size)
  const queue = new Int32Array(size)
  let tail = 0
  const reach = (i: number) => {
    if (wall[i] || outside[i]) return
    outside[i] = 1
    queue[tail++] = i
  }
  for (let x = 0; x < cols; x++) {
    reach(x)
    reach((rows - 1) * cols + x)
  }
  for (let y = 0; y < rows; y++) {
    reach(y * cols)
    reach(y * cols + cols - 1)
  }
  for (let head = 0; head < tail; head++) {
    const i = queue[head]
    const x = i % cols
    if (x > 0) reach(i - 1)
    if (x < cols - 1) reach(i + 1)
    if (i >= cols) reach(i - cols)
    if (i < size - cols) reach(i + cols)
  }

  const claimed: number[] = []
  for (let i = 0; i < size; i++) if (owner[i] !== seat && !outside[i]) claimed.push(i)
  return claimed
}
