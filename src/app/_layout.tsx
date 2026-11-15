import { setReloadSplash } from '@rific/updater'
import { RootLayout } from '@tastic/shell'

import { pack, persistor, store } from '@/pack'

// An OTA update restarts the app behind its splash (app.json's splash image), not expo-updates' white loading
// screen. @rific/updater takes the colors from app.json itself.
setReloadSplash({ image: require('../../assets/images/splash-light.png') })

export default function Layout() {
  return <RootLayout pack={pack} store={store} persistor={persistor} />
}
