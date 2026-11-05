import type { GridSize } from '@tastic/grid'

// Shared by the DuelTastic games' CPUs (Turf's and Tag's); moves to the pack's shared/ with them.

// Steps from the nearest source cell to every cell, moving up, down, left or right around blocked
// cells; -1 where there's no way through. One fill answers "how far is X" for every cell at once.
// The CPUs run several a tick on boards of thousands of cells, so the loop makes no function or
// closure per cell.
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
    if (x > 0 && distance[i - 1] === -1 && !blocked[i - 1]) {
      distance[i - 1] = d
      queue[tail++] = i - 1
    }
    if (x < cols - 1 && distance[i + 1] === -1 && !blocked[i + 1]) {
      distance[i + 1] = d
      queue[tail++] = i + 1
    }
    if (i >= cols && distance[i - cols] === -1 && !blocked[i - cols]) {
      distance[i - cols] = d
      queue[tail++] = i - cols
    }
    if (i < size - cols && distance[i + cols] === -1 && !blocked[i + cols]) {
      distance[i + cols] = d
      queue[tail++] = i + cols
    }
  }
  return distance
}
