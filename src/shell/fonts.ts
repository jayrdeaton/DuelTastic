// System monospace - the app's workhorse font for body copy, labels, and buttons (stats,
// loadout, dropdowns, ReadyButton). Deliberately left alone here: a heavy geometric display face
// reads great at hero size but hurts legibility at small UI sizes, so it's scoped to DISPLAY_FONT
// below rather than replacing this everywhere.
export { MONO_FONT } from '@tastic/hud'

// Registered via Fonts.tsx (gated on the splash screen through splashGate.ts's 'fonts' gate)
// - only ever reference this after that gate has resolved, i.e. from screens mounted inside
// RootLayout's provider tree, same as MONO_FONT's own usage sites.
export const DISPLAY_FONT = 'Orbitron_700Bold'
