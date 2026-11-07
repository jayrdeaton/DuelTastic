import { MONO_FONT } from '@tastic/hud'
import { createPackStore, type GameDefinition, type PackDefinition } from '@tastic/shell'

import { release } from '@/constants/release'
import { snake } from '@/games/snake'
import { tag } from '@/games/tag'
import { trap } from '@/games/trap'
import { turf } from '@/games/turf'
import { HERO_FONTS } from '@/hero/fonts'
import { HeroTitle } from '@/hero/HeroTitle'

// DuelTastic: the pack's identity and its games, in Home's order. Trap first: the pack grew
// out of it. Snake last for now.
export const games: readonly GameDefinition[] = [trap, turf, tag, snake]

export const pack: PackDefinition = {
  name: 'DuelTastic',
  wordmark: ['Duel', 'Tastic'],
  colorCaption: 'DuelTastic only',
  games,
  // Trap's blue (player 1) and red (player 2), which match @rific/auto-paper's ColorPicker
  // swatches exactly ('Blue' / 'Red'), so a fresh seat shows as picked on the swatch page.
  seatColors: { 1: '#2196f3', 2: '#f44336' },
  // Dark on a fresh install, not the system's: the games are drawn for a dark board. Still
  // changeable in Settings.
  appearance: 'dark',
  // Trap's light-trail wordmark, in Orbitron, its display face.
  HeroTitle,
  fonts: HERO_FONTS,
  // Every Paper text variant in the system monospace, the pack's look.
  fontFamily: MONO_FONT,
  otaVersion: release.otaVersion
}

// The one store, saved under 'dueltastic:root', every game's keys named for it. Never change this
// prefix or a key once the pack ships: every player would start over.
export const { store, persistor } = createPackStore(pack, { keyPrefix: 'dueltastic:' })
