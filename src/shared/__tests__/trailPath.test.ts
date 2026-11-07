import { endsInJump, leadingRuns, trailRuns, trimmedRuns } from '@/shared/match/trailPath'

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

  it('starts a new piece where Trap wraps round the edge', () => {
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

// Trap's trail front, drawn up to its gliding head: a line from where the head last stopped
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

// Tag's tail is cut to a set length behind the head, so its back end slides along with the head
// rather than dropping a whole cell every step (the inchworm Jay saw).
describe('trimmedRuns', () => {
  const points = (...pairs: [number, number][]) => pairs.map(([x, y]) => ({ x, y }))

  it('cuts a straight run partway along a segment', () => {
    expect(trimmedRuns([points([0, 0], [10, 0], [20, 0], [25, 0])], 12)).toEqual([points([13, 0], [20, 0], [25, 0])])
  })

  it('follows the run back round a corner', () => {
    expect(trimmedRuns([points([0, 10], [0, 0], [10, 0], [14, 0])], 20)).toEqual([points([0, 6], [0, 0], [10, 0], [14, 0])])
  })

  it('keeps a run shorter than the length whole', () => {
    expect(trimmedRuns([points([0, 0], [10, 0], [14, 0])], 30)).toEqual([points([0, 0], [10, 0], [14, 0])])
  })

  it('counts nothing for a jump between runs', () => {
    // 5 px in the run the head is on, then the other 5 from the end of the run before the gate.
    expect(trimmedRuns([points([90, 0], [100, 0]), points([0, 0], [5, 0])], 10)).toEqual([points([95, 0], [100, 0]), points([0, 0], [5, 0])])
  })

  it('slides its back end along by however far the head moved', () => {
    const before = trimmedRuns([points([0, 0], [10, 0], [20, 0], [24, 0])], 15)
    const after = trimmedRuns([points([0, 0], [10, 0], [20, 0], [27, 0])], 15)
    expect(before[0][0]).toEqual({ x: 9, y: 0 })
    expect(after[0][0]).toEqual({ x: 12, y: 0 })
  })
})
