import { endsInJump, trailRuns } from '@/shared/match/trailPath'

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
