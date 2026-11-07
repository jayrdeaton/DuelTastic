import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

// Every dialog and card over a match is upright: the OS turns the interface, so nothing is drawn turned
// for the device's hold any more. Only a board turns where a game turns one, and a dialog handed that
// board's turn lies on its side (PuckTastic's Paddles, found 2026-11-07). Player 2's own cards and toasts
// face to face turn 180 through their seat spot, not a rotation prop. This scans every source file for a
// dialog element given one.

const SRC = join(__dirname, '..')
const DIALOGS = ['ConfirmDialog', 'SettingsDialog', 'HowToPlayDialog', 'BaseSettingsDialog', 'GuideDialog']

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path)
    return /\.tsx$/.test(name) ? [path] : []
  })
}

describe('dialogs', () => {
  it('are never handed a rotation', () => {
    const offenders = sourceFiles(SRC).flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      return DIALOGS.flatMap((dialog) => [...source.matchAll(new RegExp(`<${dialog}\\b[^>]*\\brotation=`, 'g'))].map(() => `${relative(SRC, file)}: ${dialog}`))
    })
    expect(offenders).toEqual([])
  })
})
