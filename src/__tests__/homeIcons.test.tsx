import { render } from '@testing-library/react-native'

import { GameIcon as SnakeIcon } from '@/games/snake/components/GameIcon'
import { GameIcon as TagIcon } from '@/games/tag/GameIcon'
import { GameIcon as TrapIcon } from '@/games/trap/components/GameIcon'
import { GameIcon as TurfIcon } from '@/games/turf/GameIcon'
import type { Matrix } from '@/shared/iconStroke'

// Every stroke a Home icon draws, with the transform its groups put round it. A stroke inside a
// group scaled more one way than the other comes out stretched (Affinity's SVG export does this to
// trails; iconStroke's bakeStroke takes them out of it), so no stroke may sit in one.
interface Stroke {
  props: Record<string, unknown>
  matrix: Matrix
}
const mockStrokes: Stroke[] = []

jest.mock('react-native-svg', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { compose, IDENTITY, parseMatrix } = jest.requireActual<typeof import('@/shared/iconStroke')>('@/shared/iconStroke')
  const Transform = React.createContext(IDENTITY)
  const G = ({ transform, children }: { transform?: string; children?: React.ReactNode }) => {
    const outer = React.useContext(Transform)
    return React.createElement(Transform.Provider, { value: transform ? compose(outer, parseMatrix(transform)) : outer }, children)
  }
  const Shape = (props: Record<string, unknown>) => {
    const matrix = React.useContext(Transform)
    if (props.stroke) mockStrokes.push({ props, matrix })
    return null
  }
  const Pass = ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children)
  return { __esModule: true, default: Pass, G, Path: Shape, Circle: Shape, Ellipse: Shape, Defs: Pass, RadialGradient: Pass, Stop: () => null }
})

jest.mock('@rific/auto-paper', () => ({ useAutoPaperTheme: () => ({ colors: { tertiary: '#5cf32c' } }) }))

const ICONS = { Trap: TrapIcon, Turf: TurfIcon, Tag: TagIcon, Snake: SnakeIcon }

// A transform keeps a stroke one width when it only turns, flips and scales the same both ways: the
// images of the x and y axes are the same length and at right angles.
function isUniform([a, b, c, d]: Matrix) {
  const x = Math.hypot(a, b)
  const y = Math.hypot(c, d)
  return Math.abs(x - y) < 1e-6 * Math.max(x, y) && Math.abs(a * c + b * d) < 1e-6 * x * y
}

beforeEach(() => {
  mockStrokes.length = 0
})

describe('Home icons', () => {
  it.each(Object.entries(ICONS))('%s draws no stroke inside a stretched transform', async (_, Icon) => {
    for (const dark of [false, true]) {
      await render(<Icon size={64} p1Color='#2196f3' p2Color='#f44336' dark={dark} />)
    }
    expect(mockStrokes.length).toBeGreaterThan(0)
    for (const { matrix } of mockStrokes) expect(isUniform(matrix)).toBe(true)
  })

  it("draws Trap's trails as the app icon does: 104 thick, seat 1's first run 441 down and seat 2's below it", async () => {
    await render(<TrapIcon size={64} p1Color='#2196f3' p2Color='#f44336' dark={false} />)
    const trails = mockStrokes.filter(({ props }) => String(props.d).split('L').length > 3)
    expect(trails).toHaveLength(2)
    for (const { props } of trails) expect(props.strokeWidth as number).toBeCloseTo(104.17, 1)
    // Each trail starts at the left, at its run's middle (the PNG measures 389 to 493 and 531 to 635).
    const startY = trails.map(({ props }) => Number(/^M[-\d.]+,([-\d.]+)/.exec(String(props.d))?.[1]))
    expect(startY[0]).toBeCloseTo(441.1, 0)
    expect(startY[1]).toBeCloseTo(582.9, 0)
  })
})
