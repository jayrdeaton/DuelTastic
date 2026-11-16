import { render } from '@testing-library/react-native'
import { readFileSync } from 'fs'
import { join } from 'path'

import SnakeKeyboardInputLayer from '@/games/snake/components/KeyboardInputLayer'
import SnakeTouchInputLayer from '@/games/snake/components/TouchInputLayer'
import MatchOverlaysModule = require('@/shared/match/MatchOverlays')
import TouchInputLayer from '@/shared/match/TouchInputLayer'
import TouchInputLayerWeb from '@/shared/match/TouchInputLayer.web'
import { useGameSound } from '@/shared/useGameSound'

// A tick re-renders the round screen (Trap's, Turf's and Tag's), and nothing in it should take the
// touch layer or the match's overlays along. A touch layer re-rendered every tick made
// gesture-handler send the live Pan's and Tap's config to native again 15 to 30 times a second (on
// Android, resetting each handler's config before setting it), and the web layer re-registered its
// listeners, throwing away the drag it was tracking, so a drag in a phone's browser gave one turn.
// The overlays ran every hidden dialog's hooks each tick. Both are memoized, and each round screen
// hands them props that only change when something they show does.

jest.mock('@/shared/useGameSound', () => ({ useGameSound: jest.fn(() => () => undefined) }))

const ROUNDS = {
  trap: join(__dirname, '..', 'games', 'trap', 'PlayScreen.tsx'),
  turf: join(__dirname, '..', 'games', 'turf', 'PlayScreen.tsx'),
  tag: join(__dirname, '..', 'games', 'tag', 'PlayScreen.tsx')
}
const source = (game: keyof typeof ROUNDS) => readFileSync(ROUNDS[game], 'utf8')

const MEMO = Symbol.for('react.memo')
const typeOf = (component: unknown) => (component as { $$typeof?: symbol }).$$typeof

describe('a tick re-renders neither the touch layer nor the overlays', () => {
  it("memoizes both touch layers and the overlays, and Snake's input layers", () => {
    expect(typeOf(TouchInputLayer)).toBe(MEMO)
    expect(typeOf(TouchInputLayerWeb)).toBe(MEMO)
    expect(typeOf(MatchOverlaysModule.MatchOverlays)).toBe(MEMO)
    expect(typeOf(SnakeTouchInputLayer)).toBe(MEMO)
    expect(typeOf(SnakeKeyboardInputLayer)).toBe(MEMO)
  })

  it("keys Snake's input layers on the headings and steering, and gives them callbacks that last the game", () => {
    const snake = readFileSync(join(__dirname, '..', 'games', 'snake', 'PlayScreen.tsx'), 'utf8')
    // A memo or callback on state.snakes (a new array every tick) would hand the layers new props every tick.
    expect(snake).toMatch(/const currentDirections\b[^\n]*\[direction1, direction2\]\)/)
    expect(snake).toMatch(/const controlInverted\b[^\n]*\[mesmerized1, mesmerized2\]\)/)
    const handleActivate = snake.match(/const handleActivate = useCallback\([^]*?\n {2}\)\n/)?.[0]
    expect(handleActivate).toBeDefined()
    expect(handleActivate).not.toMatch(/\[[^\]\n]*state\.snakes/)
  })

  it('skips the touch layer when its parent re-renders with the same props', async () => {
    const props = {
      orientationMode: 'faceToFace' as const,
      p1OnRight: false,
      humanPlayers: [1 as const],
      enabled: true,
      onTurn: () => undefined,
      onActivate: () => undefined,
      controlInverted: { 1: false, 2: false },
      keyScheme: { 1: 'wasd' as const, 2: 'arrows' as const },
      currentDirections: { 1: 'up' as const, 2: 'down' as const }
    }
    const renders = () => (useGameSound as jest.Mock).mock.calls.length
    const view = await render(<TouchInputLayer {...props} />)
    const afterMount = renders()
    await view.rerender(<TouchInputLayer {...props} />)
    expect(renders()).toBe(afterMount)
    // A new heading is a new render, so the layer gates its turn sound on the real heading.
    await view.rerender(<TouchInputLayer {...props} currentDirections={{ 1: 'left', 2: 'down' }} />)
    expect(renders()).toBeGreaterThan(afterMount)
  })

  it.each(Object.keys(ROUNDS) as (keyof typeof ROUNDS)[])('%s keys the touch layer on the headings and steering, not on state.players', (game) => {
    const round = source(game)
    expect(round).toMatch(/const currentDirections = useMemo/)
    // A memo on state.players (a new object every tick) would hand the layer new props every tick.
    expect(round).not.toMatch(/const (currentDirections|controlInverted|tangled)\b[^\n]*\[state\.players\]\)/)
  })

  it.each(Object.keys(ROUNDS) as (keyof typeof ROUNDS)[])('%s hands the overlays no callback made in render', (game) => {
    const overlays = source(game).match(/<MatchOverlays\b[^]*?\/>/)?.[0]
    expect(overlays).toBeDefined()
    expect(overlays).not.toMatch(/=>/)
  })
})
