import { render } from '@testing-library/react-native'

import { Gates } from '@/shared/match/Gates'
import { pickupRadiusPx } from '@/shared/powerups'

// Each gate is @tastic/sprites' Portal (its own tests cover the drawing); this checks which portal
// each gate gets.
const mockPortalProps: Record<string, unknown>[] = []
const mockClock = { value: 0.3 }
jest.mock('@tastic/sprites/portal', () => ({
  Portal: (props: Record<string, unknown>) => {
    mockPortalProps.push(props)
    return null
  },
  usePortalProgress: () => mockClock
}))

const COLORS = { pairs: ['#00d5b0', '#ff8dbe'] as const, core: '#0F0F0F' }
const PORTALS = [
  { a: { x: 2, y: 3 }, b: { x: 40, y: 70 } },
  { a: { x: 40, y: 3 }, b: { x: 2, y: 70 } }
]

const value = (prop: unknown) => (prop as { value: unknown }).value

beforeEach(() => {
  mockPortalProps.length = 0
})

describe('Gates', () => {
  it('draws a vortex at the middle of every gate cell, the size of a powerup box', async () => {
    await render(<Gates portals={PORTALS} cellPx={8} colors={COLORS} />)

    expect(mockPortalProps).toHaveLength(4)
    for (const props of mockPortalProps) {
      expect(props.variant).toBe('vortex')
      expect(value(props.radius)).toBe(pickupRadiusPx(8))
    }
    expect(mockPortalProps.map((props) => [value(props.x), value(props.y)])).toEqual([
      [20, 28],
      [324, 564],
      [324, 28],
      [20, 564]
    ])
  })

  it("gives each pair its own color, the second pair the mirror image, and every gate the board's core", async () => {
    await render(<Gates portals={PORTALS} cellPx={8} colors={COLORS} />)

    expect(mockPortalProps.map((props) => [value(props.color), props.mirrored])).toEqual([
      ['#00d5b0', false],
      ['#00d5b0', false],
      ['#ff8dbe', true],
      ['#ff8dbe', true]
    ])
    for (const props of mockPortalProps) expect(value(props.coreColor)).toBe('#0F0F0F')
  })

  it('runs every gate on one clock, so both ends of a pair turn in step', async () => {
    await render(<Gates portals={PORTALS} cellPx={8} colors={COLORS} />)

    for (const props of mockPortalProps) expect(props.progress).toBe(mockClock)
  })

  it("takes a game's own gate size", async () => {
    await render(<Gates portals={PORTALS} cellPx={18} colors={COLORS} radius={7.5} />)

    for (const props of mockPortalProps) expect(value(props.radius)).toBe(7.5)
  })
})
