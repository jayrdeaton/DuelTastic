import { games } from '@/pack'

// How each game's 2 Player loadout seats its players (the shell's sideBySideAtComputer and
// sideBySideWhenWide), the same way its match does: at a computer side by side in every game, whatever
// the window's shape (useAtComputer). On a phone or tablet Trap, Turf and Tag stay face to face
// in any window, on their one face-to-face board, and Snake splits by the window's shape.

const byId = Object.fromEntries(games.map((game) => [game.id, game]))

describe("the 2 Player loadout's seating", () => {
  it('sits side by side at a computer in every game', () => {
    for (const game of games) expect(game.sideBySideAtComputer).toBe(true)
  })

  it("follows the window's shape on a phone or tablet in Snake only", () => {
    expect(byId.snake.sideBySideWhenWide).toBe(true)
    for (const id of ['trap', 'turf', 'tag']) expect(byId[id].sideBySideWhenWide).toBeUndefined()
  })
})
