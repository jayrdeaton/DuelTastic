// A 2D affine matrix as SVG writes it: matrix(a,b,c,d,e,f) takes (x, y) to (a x + c y + e, b x + d y + f).
export type Matrix = readonly [number, number, number, number, number, number]

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

// A stroke drawn straight in the icon's coordinates, with no transform around it.
export interface BakedStroke {
  d: string
  width: number
}

// Reads one of Affinity's transforms, copied from its export as is ('matrix(...)').
export function parseMatrix(transform: string): Matrix {
  const match = /^\s*matrix\(([^)]*)\)\s*$/.exec(transform)
  const values = match
    ? match[1]
        .trim()
        .split(/[\s,]+/)
        .map(Number)
    : []
  if (values.length !== 6 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`parseMatrix: not a matrix(a,b,c,d,e,f): ${transform}`)
  }
  return values as unknown as Matrix
}

// The groups' matrices, outermost first, as one: what a shape nested in all of them is drawn with.
export function compose(...matrices: Matrix[]): Matrix {
  return matrices.reduce<Matrix>(([a, b, c, d, e, f], [A, B, C, D, E, F]) => [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f], IDENTITY)
}

export function matrixString(matrix: Matrix): string {
  return `matrix(${matrix.join(',')})`
}

const round = (value: number) => String(Number(value.toFixed(3)))

// Moves a stroked path out of its transform and into the icon's own coordinates. Affinity's SVG
// export keeps a stroke inside a group scaled more one way than the other, which an SVG renderer
// stretches along with the shape (Trap's trails came out 93 thick across and 115 up and down, where
// Affinity draws 104 both ways). Baked, the path's points take the transform and the stroke stays one
// width: the export's width times the root-mean-square of the transform's scales, the width Affinity
// draws (104.17 for Trap's trails; its PNG export measures 104.18). Only absolute M, L, C and Z, all
// Affinity writes; anything else throws, so a re-export that brings one in fails loudly.
export function bakeStroke(d: string, matrix: Matrix, width: number): BakedStroke {
  const unsupported = /[^MLCZ\d\s,.eE+-]/.exec(d)
  if (unsupported) throw new Error(`bakeStroke: unsupported path command '${unsupported[0]}' in ${d}`)
  const [a, b, c, dd, e, f] = matrix
  const number = '(-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?)'
  const baked = d.replace(new RegExp(`${number}[\\s,]+${number}`, 'g'), (_, xs: string, ys: string) => {
    const x = Number(xs)
    const y = Number(ys)
    return `${round(a * x + c * y + e)},${round(b * x + dd * y + f)}`
  })
  return { d: baked, width: width * Math.sqrt((a * a + b * b + c * c + dd * dd) / 2) }
}
