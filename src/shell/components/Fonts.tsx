import { MaterialCommunityIcons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { useFonts } from 'expo-font'
import Head from 'expo-router/head'
import { ReactNode } from 'react'
import { Platform } from 'react-native'

import { usePack } from '@/shell/PackContext'
import { SplashGate } from '@/shell/splashGate'

interface Props {
  children: ReactNode
}

// Holds the splash screen up (see splashGate.ts's 'fonts' gate) until the MaterialCommunityIcons
// glyph font and the pack's own fonts (PackDefinition.fonts, its hero's display face) have actually
// loaded - otherwise every react-native-paper Icon/IconButton (and @rific/feedback-press's
// IconButton, which wraps paper's under the hood) would render blank, and a hero would render in
// its fallback font, for one visible frame before snapping in once the async load resolves.
// Gated via the Gate component (SplashGate, per splashGate.ts's own alias) rather than a
// hand-rolled `if (!loaded) return null` - marking the splash gate ready and holding `children`
// back until then happen in one place this way, same as RootLayout's 'profiles' gate.
export function Fonts({ children }: Props) {
  const pack = usePack()
  // A failed load counts as ready too: `loaded` stays false forever after an error, which would hold
  // the splash up for good, so the app opens on the system fallback font instead.
  const [loaded, error] = useFonts({ ...pack.fonts, ...MaterialCommunityIcons.font })
  return (
    <>
      {/* The web tab title, outside the fonts gate. Since SDK 58 Head only sets it after hydration; the static export's HTML no longer carries it (see TODO.md). Web only: on iOS, expo-router's Head is Handoff/Spotlight metadata that needs the plugin's `origin` set, and without it every route change throws (a dev build) or shows a system alert (a production build) */}
      {Platform.OS === 'web' && (
        <Head>
          <title>{Constants.expoConfig?.name}</title>
        </Head>
      )}
      <SplashGate gate='fonts' ready={loaded || !!error}>
        {children}
      </SplashGate>
    </>
  )
}
