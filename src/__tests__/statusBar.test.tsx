import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

// The status bar is set per screen: the root Stack's screen options (@tastic/shell's RootLayout, from
// @tastic/core's useRotationAwareStatusBar) hide it while the content is turned, and /game hides it for
// the whole round. That needs UIViewControllerBasedStatusBarAppearance on (@tastic/core's config plugin),
// and with it on, every React Native StatusBar logs an error (a red box in a dev build). An app linked
// against the iOS 27 SDK can't set the bar app-wide anyway, which is the only way that component works on
// iOS. So nothing in the app may mount one: not a component here, and not auto-paper's own (the shell's
// Theme turns that off, pinned by the package's own test).

const SRC = join(__dirname, '..')

/** Every app source file (tests and mocks left out). */
function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' || name === '__mocks__' ? [] : sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

describe('the status bar', () => {
  it('is never a StatusBar component: no source file imports expo-status-bar or React Native StatusBar', () => {
    const offenders = sourceFiles().filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /from ['"]expo-status-bar['"]/.test(source) || /import\s*\{[^}]*\bStatusBar\b[^}]*\}\s*from ['"]react-native['"]/.test(source)
    })
    expect(offenders.map((file) => relative(SRC, file))).toEqual([])
  })
})
