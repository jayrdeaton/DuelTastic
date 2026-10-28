import { MONO_FONT } from '@tastic/hud'

import { release } from '@/constants/release'
import { lightCycles } from '@/games/lightcycles'
import { snake } from '@/games/snake'
import { tag } from '@/games/tag'
import { turf } from '@/games/turf'
import { HERO_FONTS } from '@/hero/fonts'
import { HeroTitle } from '@/hero/HeroTitle'
import { createPackStore } from '@/shell/redux/createPackStore'
import type { GameDefinition, PackDefinition } from '@/shell/types'

// DuelTastic: the pack's identity and its games, in Home's order. LightCycles first: the pack grew
// out of it. Snake, from its own app, last for now.
export const games: readonly GameDefinition[] = [lightCycles, turf, tag, snake]

export const pack: PackDefinition = {
  name: 'DuelTastic',
  wordmark: ['Duel', 'Tastic'],
  colorCaption: 'DuelTastic only',
  games,
  // LightCycles' blue (player 1) and red (player 2), which match @rific/auto-paper's ColorPicker
  // swatches exactly ('Blue' / 'Red'), so a fresh seat shows as picked on the swatch page.
  seatColors: { 1: '#2196f3', 2: '#f44336' },
  // Dark on a fresh install, not the system's: the games are drawn for a dark board (LightCycles'
  // look since its first build). Still changeable in Settings.
  appearance: 'dark',
  // LightCycles' light-trail wordmark, in Orbitron, its display face.
  HeroTitle,
  fonts: HERO_FONTS,
  // Every Paper text variant in the system monospace, the pack's look since LightCycles.
  fontFamily: MONO_FONT,
  otaVersion: release.otaVersion
}

// The one store, saved under 'dueltastic:root', every game's keys named for it. LightCycles' own
// save ('lightcycles:root') is left where it is and never read: nothing has shipped that a player
// would miss. Never change this prefix or a key once the pack ships: every player would start over.
export const { store, persistor } = createPackStore(pack, { keyPrefix: 'dueltastic:' })
