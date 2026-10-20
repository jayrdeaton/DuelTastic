import { type Direction, resolveSchemeDirection } from '@tastic/input'

import { ACTIVATE_KEYS } from '@/constants/game'
import type { KeyboardScheme, KeyScheme, Player } from '@/types'

export type KeyAction = { kind: 'activate'; player: Player } | { kind: 'turn'; player: Player; direction: Direction }

type KeyEvent = Pick<KeyboardEvent, 'key' | 'code'>

// Numpad's activate key is matched by code, like its direction keys in @tastic/input's
// resolveSchemeDirection: a numpad key's .key flips with NumLock, its .code never does.
function isActivateKey(event: KeyEvent, scheme: KeyboardScheme): boolean {
  if (scheme === 'numpad') return event.code === 'NumpadEnter'
  return event.key.toLowerCase() === ACTIVATE_KEYS[scheme]
}

// What a keydown does on desktop web: the human seat whose scheme owns the key, and whether it uses
// the powerup (ACTIVATE_KEYS) or steers (@tastic/input's resolveSchemeDirection). A 'mouse' seat
// owns no keys, so its player never comes back from here. Activate keys are checked first; none of
// them is a direction key in any scheme.
export function resolveKeyAction(event: KeyEvent, keyScheme: Record<Player, KeyScheme>, humanPlayers: readonly Player[]): KeyAction | null {
  for (const player of humanPlayers) {
    const scheme = keyScheme[player]
    if (scheme !== 'mouse' && isActivateKey(event, scheme)) return { kind: 'activate', player }
  }
  for (const player of humanPlayers) {
    const scheme = keyScheme[player]
    if (scheme === 'mouse') continue
    const direction = resolveSchemeDirection(event, scheme)
    if (direction) return { kind: 'turn', player, direction }
  }
  return null
}
