import { games, pack } from '@/pack'

// DuelTastic as @tastic/shell's pack (pack.ts).
describe('the pack', () => {
  it('leaves the player picker to the setup screen every game opens', () => {
    expect(pack.homePlayerPicker).toBe(false)
    expect(games.every((game) => game.useLoadout)).toBe(true)
  })
})
