import { resolveKeyAction } from '@/utils/keyControls'

// A keydown as the browser reports it: `key` is the character, `code` the physical key.
const press = (key: string, code = '') => ({ key, code })

describe('resolveKeyAction', () => {
  it("steers and uses the powerup with each seat's own keys", () => {
    const keys = { 1: 'wasd', 2: 'arrows' } as const

    expect(resolveKeyAction(press('a', 'KeyA'), keys, [1, 2])).toEqual({ kind: 'turn', player: 1, direction: 'left' })
    expect(resolveKeyAction(press('A', 'KeyA'), keys, [1, 2])).toEqual({ kind: 'turn', player: 1, direction: 'left' })
    expect(resolveKeyAction(press('ArrowRight', 'ArrowRight'), keys, [1, 2])).toEqual({ kind: 'turn', player: 2, direction: 'right' })
    expect(resolveKeyAction(press('Q', 'KeyQ'), keys, [1, 2])).toEqual({ kind: 'activate', player: 1 })
    expect(resolveKeyAction(press(' ', 'Space'), keys, [1, 2])).toEqual({ kind: 'activate', player: 2 })
    expect(resolveKeyAction(press('u', 'KeyU'), { 1: 'ijkl', 2: 'wasd' }, [1, 2])).toEqual({ kind: 'activate', player: 1 })
    expect(resolveKeyAction(press('x', 'KeyX'), keys, [1, 2])).toBeNull()
  })

  // Numpad is matched by code: a numpad key's .key flips between a digit and an arrow name with
  // NumLock, while its .code stays NumpadN.
  it('steers the numpad by code, NumLock on or off, and uses the powerup with NumpadEnter', () => {
    const keys = { 1: 'numpad', 2: 'wasd' } as const

    expect(resolveKeyAction(press('8', 'Numpad8'), keys, [1, 2])).toEqual({ kind: 'turn', player: 1, direction: 'up' })
    expect(resolveKeyAction(press('ArrowLeft', 'Numpad4'), keys, [1, 2])).toEqual({ kind: 'turn', player: 1, direction: 'left' })
    expect(resolveKeyAction(press('Enter', 'NumpadEnter'), keys, [1, 2])).toEqual({ kind: 'activate', player: 1 })
    // The main Enter key and the top-row digits aren't the numpad.
    expect(resolveKeyAction(press('Enter', 'Enter'), keys, [1, 2])).toBeNull()
    expect(resolveKeyAction(press('8', 'Digit8'), keys, [1, 2])).toBeNull()
  })

  it('gives a Mouse seat no keys at all, and the other seat keeps its own', () => {
    const keys = { 1: 'mouse', 2: 'arrows' } as const

    for (const key of ['w', 'a', 's', 'd', 'q', 'i', 'j', 'k', 'l', 'u']) expect(resolveKeyAction(press(key), keys, [1, 2])).toBeNull()
    expect(resolveKeyAction(press('Enter', 'NumpadEnter'), keys, [1, 2])).toBeNull()
    expect(resolveKeyAction(press('ArrowLeft', 'ArrowLeft'), keys, [1, 2])).toEqual({ kind: 'turn', player: 2, direction: 'left' })
    expect(resolveKeyAction(press(' ', 'Space'), keys, [1, 2])).toEqual({ kind: 'activate', player: 2 })
    expect(resolveKeyAction(press('w', 'KeyW'), { 1: 'mouse', 2: 'mouse' }, [1, 2])).toBeNull()
  })

  it("ignores the CPU seat's keys in Vs CPU", () => {
    expect(resolveKeyAction(press('ArrowUp', 'ArrowUp'), { 1: 'wasd', 2: 'arrows' }, [1])).toBeNull()
    expect(resolveKeyAction(press(' ', 'Space'), { 1: 'wasd', 2: 'arrows' }, [1])).toBeNull()
  })
})
