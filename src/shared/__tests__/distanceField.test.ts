import { distanceField } from '../distanceField'

describe('distanceField', () => {
  const grid = { cols: 5, rows: 3 }
  const at = (x: number, y: number) => y * grid.cols + x

  it('counts steps from the nearest source, up, down, left and right', () => {
    const field = distanceField(grid, [at(0, 0), at(4, 2)], new Uint8Array(15))
    expect(field[at(0, 0)]).toBe(0)
    expect(field[at(2, 1)]).toBe(3)
    expect(field[at(4, 0)]).toBe(2)
  })

  it('goes round blocked cells, and marks cells it can’t reach -1', () => {
    // A wall down column 2 with a gap at the bottom; (4, 0) is walled in on its own.
    const blocked = new Uint8Array(15)
    blocked[at(2, 0)] = blocked[at(2, 1)] = 1
    blocked[at(3, 0)] = blocked[at(4, 1)] = 1
    const field = distanceField(grid, [at(0, 0)], blocked)
    expect(field[at(3, 1)]).toBe(6)
    expect(field[at(2, 0)]).toBe(-1)
    expect(field[at(4, 0)]).toBe(-1)
  })
})
