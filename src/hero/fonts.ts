import { Orbitron_700Bold } from '@expo-google-fonts/orbitron'

// The hero's display face, LightCycles' wordmark since its first build. Scoped to the hero: a heavy
// geometric display face reads great at hero size but hurts legibility at small UI sizes, which stay
// in the pack's MONO_FONT (pack.ts's fontFamily).
export const DISPLAY_FONT = 'Orbitron_700Bold'

// Handed to the shell as PackDefinition.fonts, which loads them behind the splash screen's 'fonts'
// gate, so the hero never renders a frame in its fallback font.
export const HERO_FONTS = { [DISPLAY_FONT]: Orbitron_700Bold }
