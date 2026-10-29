import { RootLayout } from '@tastic/shell'

import { pack, persistor, store } from '@/pack'

export default function Layout() {
  return <RootLayout pack={pack} store={store} persistor={persistor} />
}
