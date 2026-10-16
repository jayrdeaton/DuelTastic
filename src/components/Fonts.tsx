import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Orbitron_700Bold, useFonts } from '@expo-google-fonts/orbitron'
import Constants from 'expo-constants'
import Head from 'expo-router/head'
import { ReactNode } from 'react'

import { SplashGate } from '@/utils/splashGate'

interface Props {
  children: ReactNode
}

// Holds the splash screen up (see utils/splashGate.ts's 'fonts' gate) until both DISPLAY_FONT and
// the MaterialCommunityIcons glyph font have actually loaded - otherwise the hero title would
// render in its fallback font, and every react-native-paper Icon/IconButton would render blank,
// for one visible frame before snapping in once each async load resolves. Gated via the Gate
// component (SplashGate, per splashGate.ts's own alias) rather than a hand-rolled
// `if (!loaded) return null` - marking the splash gate ready and holding `children` back until then
// happen in one place this way, same as Pong's own reference Fonts.tsx and the modern approach
// _layout.tsx already uses for the 'settings'/'profiles' gates.
export function Fonts({ children }: Props) {
  // A failed load counts as ready too: `loaded` stays false forever after an error, which would hold
  // the splash up for good, so the app opens on the system fallback font instead.
  const [loaded, error] = useFonts({ Orbitron_700Bold, ...MaterialCommunityIcons.font })
  return (
    <>
      {/* The web tab title, outside the fonts gate. Since SDK 58 Head only sets it after hydration; the static export's HTML no longer carries it (see TODO.md) */}
      <Head>
        <title>{Constants.expoConfig?.name}</title>
      </Head>
      <SplashGate gate='fonts' ready={loaded || !!error}>
        {children}
      </SplashGate>
    </>
  )
}
