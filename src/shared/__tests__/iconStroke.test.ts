import { bakeStroke, compose, IDENTITY, type Matrix, matrixString, parseMatrix } from '@/shared/iconStroke'

const apply = ([a, b, c, d, e, f]: Matrix, x: number, y: number) => [a * x + c * y + e, b * x + d * y + f]

describe('parseMatrix', () => {
  it("reads Affinity's matrix strings", () => {
    expect(parseMatrix('matrix(0,0.895071,-0.759966,0,1069.657286,387.053015)')).toEqual([0, 0.895071, -0.759966, 0, 1069.657286, 387.053015])
    expect(parseMatrix(' matrix(1 -0 -0 1 5.5 0) ')).toEqual([1, -0, -0, 1, 5.5, 0])
  })

  it('throws on anything else', () => {
    expect(() => parseMatrix('translate(1,2)')).toThrow()
    expect(() => parseMatrix('matrix(1,0,0,1,0)')).toThrow()
    expect(() => parseMatrix('matrix(1,0,0,1,0,x)')).toThrow()
  })

  it('round-trips through matrixString', () => {
    const matrix: Matrix = [0.5, 0, 0, -2, 10, 1024]
    expect(parseMatrix(matrixString(matrix))).toEqual(matrix)
  })
})

describe('compose', () => {
  it('places a point as the nested groups would, outermost first', () => {
    const outer: Matrix = [1, 0, 0, -1, 0, 1024]
    const middle: Matrix = [0, 0.895071, -0.759966, 0, 1069.657286, 387.053015]
    const inner: Matrix = [0.588702, 0, 0, 0.859523, -5.390577, -53.075537]
    const [x, y] = apply(outer, ...(apply(middle, ...(apply(inner, 380.76, 1600.925) as [number, number])) as [number, number]))
    const [cx, cy] = apply(compose(outer, middle, inner), 380.76, 1600.925)
    expect(cx).toBeCloseTo(x, 9)
    expect(cy).toBeCloseTo(y, 9)
  })

  it('is the identity with nothing to compose', () => {
    expect(compose()).toEqual(IDENTITY)
  })
})

describe('bakeStroke', () => {
  it('moves every point of a path into the transform and keeps its commands', () => {
    const baked = bakeStroke('M1,1L3,1C1,2 3,4 5,6Z', [2, 0, 0, 8, 10, 20], 10)
    expect(baked.d).toBe('M12,28L16,28C12,36 16,52 20,68Z')
  })

  it("scales the stroke by the root-mean-square of the transform's scales, Affinity's width", () => {
    expect(bakeStroke('M0,0L1,0', [2, 0, 0, 8, 0, 0], 10).width).toBeCloseTo(10 * Math.sqrt((4 + 64) / 2), 9)
    // A turn and a flip don't change it.
    expect(bakeStroke('M0,0L1,0', [0, -3, 3, 0, 5, 5], 10).width).toBeCloseTo(30, 9)
    // Trap's trails: the export's 175.53 in its stretched groups, 104.18 thick in the app icon's PNG.
    const trap = compose([1, 0, 0, -1, 0, 1024], [0, 0.895071, -0.759966, 0, 1069.657286, 387.053015], [0.588702, 0, 0, 0.859523, -5.390577, -53.075537])
    expect(bakeStroke('M0,0L1,0', trap, 175.53).width).toBeCloseTo(104.17, 2)
  })

  it('reads numbers with signs, leading dots and exponents', () => {
    expect(bakeStroke('M-1.5,.5L1e1,-2E-1', IDENTITY, 1).d).toBe('M-1.5,0.5L10,-0.2')
  })

  it('throws on a command it does not bake', () => {
    for (const d of ['M0,0l1,1', 'M0,0H5', 'M0,0V5', 'M0,0A1,1 0 0 1 2,2', 'M0,0Q1,1 2,2']) {
      expect(() => bakeStroke(d, IDENTITY, 1)).toThrow(/unsupported path command/)
    }
  })
})
