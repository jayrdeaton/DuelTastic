import { claimedCells } from '../capture'

// A board from rows of characters: '.' nobody's, '1' or '2' that seat's ground. Trails are passed
// separately, as cells.
function board(rows: string[]) {
  const grid = { cols: rows[0].length, rows: rows.length }
  const owner = new Uint8Array(grid.cols * grid.rows)
  rows.forEach((row, y) => [...row].forEach((ch, x) => (owner[y * grid.cols + x] = ch === '.' ? 0 : Number(ch))))
  return { grid, owner }
}

const cells = (...xy: [number, number][]) => xy.map(([x, y]) => ({ x, y }))
const at = (grid: { cols: number }, x: number, y: number) => y * grid.cols + x

describe('claimedCells', () => {
  it('claims the trail and the cells it closes off against the ground', () => {
    const { grid, owner } = board([
      '........', //
      '........',
      '........',
      '..111...',
      '..111...',
      '........'
    ])
    // Up from (3, 3), across to (5, 1), down to (5, 3): (4, 2) is closed off.
    const trail = cells([3, 2], [3, 1], [4, 1], [5, 1], [5, 2], [5, 3])
    const claimed = claimedCells(owner, grid, 1, trail).sort((a, b) => a - b)
    expect(claimed).toEqual([at(grid, 3, 1), at(grid, 4, 1), at(grid, 5, 1), at(grid, 3, 2), at(grid, 4, 2), at(grid, 5, 2), at(grid, 5, 3)].sort((a, b) => a - b))
  })

  it('claims only the trail when it closes nothing off', () => {
    const { grid, owner } = board([
      '......', //
      '.11...',
      '.11...',
      '......'
    ])
    const trail = cells([3, 1], [3, 2])
    expect(claimedCells(owner, grid, 1, trail)).toHaveLength(2)
  })

  it("takes the other seat's ground when it's closed off", () => {
    const { grid, owner } = board([
      '.......', //
      '.......',
      '..22...',
      '.......',
      '.11111.',
      '.......'
    ])
    const trail = cells([1, 3], [1, 2], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [5, 2], [5, 3])
    const claimed = new Set(claimedCells(owner, grid, 1, trail))
    expect(claimed.has(at(grid, 2, 2))).toBe(true)
    expect(claimed.has(at(grid, 3, 2))).toBe(true)
    // Everything inside: rows 2 and 3, columns 2 to 4.
    for (let x = 2; x <= 4; x++) for (const y of [2, 3]) expect(claimed.has(at(grid, x, y))).toBe(true)
  })

  it("doesn't count the board's edge as a wall", () => {
    const { grid, owner } = board([
      '......', //
      '1.....',
      '1.....',
      '1.....'
    ])
    // A trail from (0, 1) out and down to the bottom edge: the pocket between it and the edge is still
    // open to the edge, so only the trail is claimed.
    const trail = cells([1, 1], [2, 1], [2, 2], [2, 3])
    expect(claimedCells(owner, grid, 1, trail)).toHaveLength(4)
  })

  it('never returns a cell the seat already owns', () => {
    const { grid, owner } = board([
      '.....', //
      '.111.',
      '.1.1.',
      '.111.',
      '.....'
    ])
    // No trail at all: the hole in the middle is closed off by the ground alone.
    expect(claimedCells(owner, grid, 1, [])).toEqual([at(grid, 2, 2)])
  })
})
