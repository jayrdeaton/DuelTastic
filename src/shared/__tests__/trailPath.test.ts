import { endsInJump, leadingRuns, trailRuns } from '@/shared/match/trailPath'

const cells = (...pairs: [number, number][]) => pairs.map(([x, y]) => ({ x, y }))

// Turf's trail and Tag's tail joined every cell with a line, so going through a gate drew a line
// across the board from one gate to the other (TODO.md's playtest callout 3, seen in Tag).
describe('trailRuns', () => {
  it('keeps a path ridden cell to cell as one piece, round its corners', () => {
    expect(trailRuns(cells([2, 5], [2, 4], [3, 4], [4, 4]))).toEqual([cells([2, 5], [2, 4], [3, 4], [4, 4])])
  })

  it('starts a new piece where the rider came out of a gate', () => {
    // In at the bottom right (gate at 119,94), out at the top left (5,5).
    expect(trailRuns(cells([119, 96], [119, 95], [5, 5], [5, 4]))).toEqual([cells([119, 96], [119, 95]), cells([5, 5], [5, 4])])
  })

  it('starts a new piece where LightCycles wraps round the edge', () => {
    expect(trailRuns(cells([1, 3], [0, 3], [79, 3]))).toEqual([cells([1, 3], [0, 3]), cells([79, 3])])
  })

  it('has no pieces for no cells', () => {
    expect(trailRuns([])).toEqual([])
  })
})

describe('endsInJump', () => {
  it('is true when the head just came out of a gate', () => {
    expect(endsInJump(cells([119, 96], [119, 95], [5, 5]))).toBe(true)
  })

  it('is false for a step to a neighbor, or a head on its own', () => {
    expect(endsInJump(cells([5, 5], [5, 4]))).toBe(false)
    expect(endsInJump(cells([5, 5]))).toBe(false)
  })
})

// LightCycles' trail front, drawn up to its gliding head: a line from where the head last stopped
// straight to the head cut across a boosted tick's corner and ran ahead of the head (2026-11-04).
describe('leadingRuns', () => {
  // 10px cells: a cell's center is at 10 * cell + 5.
  const PX = 10
  const pt = (x: number, y: number) => ({ x, y })

  it('runs from the last stop to the head mid-cell', () => {
    expect(leadingRuns(cells([2, 5], [2, 4]), 25, 50, PX)).toEqual([[pt(25, 55), pt(25, 50)]])
  })

  it('stops at the head before a corner it hasn’t reached', () => {
    // A boosted tick up a cell and then right; the head is still on the way up.
    expect(leadingRuns(cells([2, 5], [2, 4], [3, 4]), 25, 50, PX)).toEqual([[pt(25, 55), pt(25, 50)]])
  })

  it('goes round the corner once the head has', () => {
    expect(leadingRuns(cells([2, 5], [2, 4], [3, 4]), 30, 45, PX)).toEqual([[pt(25, 55), pt(25, 45), pt(30, 45)]])
  })

  it('reaches back to a head still catching up to the last stop', () => {
    expect(leadingRuns(cells([2, 5], [2, 4]), 25, 58, PX)).toEqual([[pt(25, 55), pt(25, 58)]])
  })

  it('starts a new run after a gate, never a line across the board', () => {
    expect(leadingRuns(cells([2, 5], [9, 9], [9, 8]), 95, 90, PX)).toEqual([[pt(25, 55)], [pt(95, 95), pt(95, 90)]])
    // Standing at the far gate, nothing yet ridden past it.
    expect(leadingRuns(cells([2, 5], [9, 9]), 95, 95, PX)).toEqual([[pt(25, 55)], [pt(95, 95), pt(95, 95)]])
  })

  it('has no runs for no cells', () => {
    expect(leadingRuns([], 0, 0, PX)).toEqual([])
  })
})
