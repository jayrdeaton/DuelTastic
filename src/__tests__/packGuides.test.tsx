import { games } from '@/pack'
import type { KeyScheme, Player } from '@/shared/match/types'
import type { RoundMode } from '@/shell/types'

// Every game's How to Play cards, against the fleet's copy rules (Jay, 2026-09-24): Title Case
// titles, bodies of 90 characters or less, art on every card, no em dashes, and nothing untrue for
// the device: touch copy never mentions keys, a mouse or dragging, desktop copy never says swipe.
// Each game's own cards come from its live settings, read through its selectInput, so this checks
// them across every pair of desktop controls and every game's own rules.

const SCHEME_SET: Record<KeyScheme, true> = { mouse: true, wasd: true, arrows: true, ijkl: true, numpad: true }
const SCHEMES = Object.keys(SCHEME_SET) as KeyScheme[]
const EVERY_PAIR: Record<Player, KeyScheme>[] = SCHEMES.flatMap((p1) => SCHEMES.map((p2) => ({ 1: p1, 2: p2 })))
const MODES: RoundMode[] = ['vsCpu', 'twoPlayer']

// Each game's guide input with the given controls, plus every value of its own rule option.
const RULE_VARIANTS: Record<string, object[]> = {
  lightcycles: [{}],
  turf: [{ crash: 'out' }, { crash: 'home' }],
  tag: [{ rule: 'hotPotato' }, { rule: 'leastIt' }]
}

function cardsFor(gameId: string, touch: boolean, keys: Record<Player, KeyScheme>, variant: object, mode: RoundMode) {
  const game = games.find((g) => g.id === gameId)!
  return game.guide.getSteps({ control1: keys[1], control2: keys[2], ...variant }, { touch, mode })
}

describe.each(games.map((g) => [g.id]))("%s's How to Play cards", (gameId) => {
  it('follow the copy rules on every device, controls and rules', () => {
    for (const variant of RULE_VARIANTS[gameId])
      for (const mode of MODES) {
        for (const touch of [true, false])
          for (const keys of touch ? [EVERY_PAIR[0]] : EVERY_PAIR) {
            const steps = cardsFor(gameId, touch, keys, variant, mode)
            expect(steps.length).toBeGreaterThanOrEqual(3)
            for (const step of steps) {
              expect(step.body.length).toBeLessThanOrEqual(90)
              expect(step.art).toBeDefined()
              expect(step.title).toMatch(/^([A-Z0-9][^\s]*)(\s(a|an|the|of|to|in|on|and|or|at)\b|\s[A-Z0-9][^\s]*)*$/)
              expect(`${step.title} ${step.body}`).not.toMatch(/—/)
              if (touch) expect(step.body).not.toMatch(/\b(key|keys|mouse|drag)\b/i)
              else expect(step.body).not.toMatch(/swipe/i)
            }
          }
      }
  })

  it('names the rider and the two-player setup on the first and last cards', () => {
    const steps = cardsFor(gameId, true, EVERY_PAIR[0], RULE_VARIANTS[gameId][0], 'vsCpu')
    expect(steps[0].title).toMatch(/^Steer Your /)
    expect(steps[steps.length - 1].title).toBe('Two Players, One Phone')
  })
})

describe('the rules cards follow the loadout', () => {
  it("Turf's says what a crash costs this match", () => {
    expect(cardsFor('turf', true, EVERY_PAIR[0], { crash: 'out' }, 'vsCpu')[2].body).toMatch(/they crash/)
    expect(cardsFor('turf', true, EVERY_PAIR[0], { crash: 'home' }, 'vsCpu')[2].body).toMatch(/they lose it/)
  })

  it("Tag's says how the round is decided", () => {
    expect(cardsFor('tag', true, EVERY_PAIR[0], { rule: 'hotPotato' }, 'vsCpu')[1].body).toMatch(/It at the buzzer loses/)
    expect(cardsFor('tag', true, EVERY_PAIR[0], { rule: 'leastIt' }, 'vsCpu')[1].body).toMatch(/Less time as It wins/)
  })
})
