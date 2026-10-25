import { lightCycles } from '@/games/lightcycles'
import { tag } from '@/games/tag'
import { turf } from '@/games/turf'
import { createPackStore } from '@/shell/redux/createPackStore'
import type { GameDefinition, PackDefinition } from '@/shell/types'

// DuelTastic: the pack's identity and its games, in Home's order. LightCycles first: it's the
// game this repo shipped as. The App Store record, bundle id, EAS project and URL scheme all stay
// LightCycles' for now (see app.json).
export const games: readonly GameDefinition[] = [lightCycles, turf, tag]

export const pack: PackDefinition = {
  name: 'DuelTastic',
  wordmark: ['Duel', 'Tastic'],
  colorCaption: 'DuelTastic only',
  games
}

// The one store, saved under 'dueltastic:root', every game's keys named for it. LightCycles' own
// save ('lightcycles:root') is left where it is and never read: nothing has shipped that a player
// would miss. Never change this prefix or a key once the pack ships: every player would start over.
export const { store, persistor } = createPackStore({
  keyPrefix: 'dueltastic:',
  gameReducers: Object.assign({}, ...games.map((g) => g.reducers))
})
