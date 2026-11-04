import type { GridCell } from '@tastic/grid'

// A rectangle of an arena's blocked cells, in cells.
export interface ArenaBlock {
  x: number
  y: number
  width: number
  height: number
}

// An arena's blocked cells (pillars, gauntlet walls) as the fewest rectangles that cover them, near
// enough: each row's runs of touching cells, stacked into one block wherever the row below has a run
// exactly under it. So a wall is drawn as one bar and a pillar as one block, never as a string of
// separate cells.
export function mergeBlocks(cells: readonly GridCell[]): ArenaBlock[] {
  const rows = new Map<number, Set<number>>()
  for (const { x, y } of cells) {
    if (!rows.has(y)) rows.set(y, new Set())
    rows.get(y)!.add(x)
  }
  const runs: ArenaBlock[] = []
  for (const y of [...rows.keys()].sort((a, b) => a - b)) {
    const xs = [...rows.get(y)!].sort((a, b) => a - b)
    xs.forEach((x, i) => {
      if (i > 0 && xs[i - 1] === x - 1) runs[runs.length - 1].width++
      else runs.push({ x, y, width: 1, height: 1 })
    })
  }
  // The block each run would extend, by its columns: only if that block ends on the row just above.
  const open = new Map<string, ArenaBlock>()
  const blocks: ArenaBlock[] = []
  for (const run of runs) {
    const key = `${run.x},${run.width}`
    const above = open.get(key)
    if (above && above.y + above.height === run.y) above.height++
    else {
      const block = { ...run }
      blocks.push(block)
      open.set(key, block)
    }
  }
  return blocks
}
