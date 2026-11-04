import { mergeBlocks } from '@/shared/match/mergeBlocks'

const cells = (...pairs: [number, number][]) => pairs.map(([x, y]) => ({ x, y }))
// Every cell the blocks cover, as "x,y", sorted.
const covered = (blocks: ReturnType<typeof mergeBlocks>) => blocks.flatMap((b) => Array.from({ length: b.width * b.height }, (_, i) => `${b.x + (i % b.width)},${b.y + Math.floor(i / b.width)}`)).sort()

describe('mergeBlocks', () => {
  it('draws a gauntlet wall as one bar', () => {
    const wall = Array.from({ length: 12 }, (_, x) => ({ x: x + 3, y: 7 }))
    expect(mergeBlocks(wall)).toEqual([{ x: 3, y: 7, width: 12, height: 1 }])
  })

  it('draws an upright wall as one bar', () => {
    const wall = Array.from({ length: 9 }, (_, y) => ({ x: 4, y: y + 2 }))
    expect(mergeBlocks(wall)).toEqual([{ x: 4, y: 2, width: 1, height: 9 }])
  })

  it('draws a pillar as one block, whatever order its cells come in', () => {
    expect(mergeBlocks(cells([6, 6], [5, 5], [6, 5], [5, 6]))).toEqual([{ x: 5, y: 5, width: 2, height: 2 }])
  })

  it('keeps a wall with a gap as two bars', () => {
    expect(mergeBlocks(cells([0, 0], [1, 0], [3, 0], [4, 0]))).toEqual([
      { x: 0, y: 0, width: 2, height: 1 },
      { x: 3, y: 0, width: 2, height: 1 }
    ])
  })

  it('covers exactly the cells it was given, for a shape that is not a rectangle', () => {
    // An L and a lone cell.
    const shape = cells([0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [5, 5])
    const blocks = mergeBlocks(shape)
    expect(covered(blocks)).toEqual(shape.map((c) => `${c.x},${c.y}`).sort())
    expect(blocks).toHaveLength(3)
  })

  it('draws nothing for no cells', () => {
    expect(mergeBlocks([])).toEqual([])
  })
})
