import { Orbitron_700Bold } from '@expo-google-fonts/orbitron'
import type { TextStyle } from 'react-native'

// The hero's display face, Trap's wordmark since its first build, and the pack's titles (titleType).
// Never small UI: a heavy geometric display face reads great at hero and title size but hurts
// legibility at small sizes, which stay in the pack's MONO_FONT (pack.ts's fontFamily), labels included.
export const DISPLAY_FONT = 'Orbitron_700Bold'

// The pack's title lettering (PackDefinition.titleStyle), laid over each title's own type: Home's game
// cards, each loadout's header, the stats screen's title and game headings, and every hud dialog's title.
// One weight: the face is bold already, and a synthesized bold would thicken it again.
export const titleType: TextStyle = { fontFamily: DISPLAY_FONT, fontWeight: 'normal' }

// Handed to the shell as PackDefinition.fonts, which loads them behind the splash screen's 'fonts'
// gate, so the hero never renders a frame in its fallback font.
export const HERO_FONTS = { [DISPLAY_FONT]: Orbitron_700Bold }
