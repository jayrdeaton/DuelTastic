import type { GridSize } from '@tastic/grid'

// Shared by the DuelTastic games' CPUs (Turf's and Tag's); moves to the pack's shared/ with them.

// Steps from the nearest source cell to every cell, moving up, down, left or right around blocked
// cells; -1 where there's no way through. One fill answers "how far is X" for every cell at once.
export function distanceField(grid: GridSize, sources: Iterable<number>, blocked: Uint8Array): Int32Array {
  const { cols } = grid
  const size = cols * grid.rows
  const distance = new Int32Array(size).fill(-1)
  const queue = new Int32Array(size)
  let tail = 0
  for (const i of sources) {
    if (distance[i] !== -1) continue
    distance[i] = 0
    queue[tail++] = i
  }
  for (let head = 0; head < tail; head++) {
    const i = queue[head]
    const x = i % cols
    const d = distance[i] + 1
    const visit = (j: number) => {
      if (distance[j] !== -1 || blocked[j]) return
      distance[j] = d
      queue[tail++] = j
    }
    if (x > 0) visit(i - 1)
    if (x < cols - 1) visit(i + 1)
    if (i >= cols) visit(i - cols)
    if (i < size - cols) visit(i + cols)
  }
  return distance
}
