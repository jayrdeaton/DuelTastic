import { type DirectionKeyLabels, DirectionKeysHint, type GuideStep, type SeatDevice, SeatDevicesHint, SeatDiagram, SwipeHint } from '@tastic/hud/guide'

import type { KeyboardScheme, KeyScheme, Player } from '@/shared/match/types'

// The How to Play cards every game in the pack shares: how to steer, and how two players share
// one device. Each game adds its own rules card between them (see each game's guideSteps.tsx).
// Copy rules (Jay, 2026-09-24): Title Case titles, bodies of 90 characters or less, no em dashes,
// and only say what's true in every mode - "your half" is only true in two-player, so it lives on
// the two-player card, not the steering one.

// How each scheme reads in a sentence, and on DirectionKeysHint's caps (undefined = draw the arrow
// keys as arrows; 'mouse' has no caps, a mouse seat drags rather than pressing anything).
// Deliberately not the loadout's own picker labels ('Arrows+Space'), which aren't prose.
const KEY_PHRASE: Record<KeyScheme, string> = { mouse: 'the mouse', wasd: 'WASD', arrows: 'the arrow keys', ijkl: 'IJKL', numpad: 'the numpad' }
const KEY_CAPS: Record<KeyboardScheme, DirectionKeyLabels | undefined> = {
  wasd: { up: 'W', left: 'A', down: 'S', right: 'D' },
  arrows: undefined,
  ijkl: { up: 'I', left: 'J', down: 'K', right: 'L' },
  numpad: { up: '8', left: '4', down: '2', right: '6' }
}

// SeatDevicesHint's device for a seat's scheme: every key scheme is the keyboard.
function seatDevice(scheme: KeyScheme): SeatDevice {
  return scheme === 'mouse' ? 'mouse' : 'keyboard'
}

// The fleet's desktop two-player sentence (the same template in every game with this card, Snake's
// included). A mouse seat's drags only steer inside its own half of the board in two-player
// (TouchInputLayer.web.tsx's resolvePlayer), so that's said here and nowhere else. With no mouse
// seat the tail says where the schemes are changed instead.
function twoPlayerBody(keys: Record<Player, KeyScheme>): string {
  const p1Mouse = keys[1] === 'mouse'
  const p2Mouse = keys[2] === 'mouse'
  if (p1Mouse && p2Mouse) return 'Both players use the mouse. Drag in your own half.'
  const tail = p1Mouse || p2Mouse ? ' Drag in your own half.' : ' Change them before a match.'
  return `Player 1 uses ${KEY_PHRASE[keys[1]]}, player 2 uses ${KEY_PHRASE[keys[2]]}.${tail}`
}

// Steering is absolute, not relative: a swipe, drag or key turns you that way on the board. `noun`
// is what the game calls the thing you steer ('cycle', 'rider'). A touch screen steers by swiping, a
// desktop by seat 1's scheme (the mouse or a key cluster).
export function steeringStep(touch: boolean, p1: KeyScheme, noun: string): GuideStep {
  return {
    title: `Steer Your ${noun[0].toUpperCase()}${noun.slice(1)}`,
    body: touch ? `Swipe up, down, left or right. Your ${noun} turns the way you swipe.` : p1 === 'mouse' ? `Drag the mouse up, down, left or right. Your ${noun} turns the way you drag.` : `Press a direction key and your ${noun} turns that way.`,
    art: touch ? <SwipeHint direction='up' /> : p1 === 'mouse' ? <SwipeHint pointer='mouse' direction='up' /> : <DirectionKeysHint labels={KEY_CAPS[p1]} />
  }
}

// Two players on one phone sit face to face, each steering in their own half; on a computer each
// uses their own scheme (any of them the mouse), named here so a replay after a loadout change is
// still right.
export function twoPlayerStep(touch: boolean, keys: Record<Player, KeyScheme>): GuideStep {
  if (touch) return { title: 'Two Players, One Phone', body: 'Sit across from each other and swipe in your own half.', art: <SeatDiagram /> }
  const usesMouse = keys[1] === 'mouse' || keys[2] === 'mouse'
  return {
    // "One Keyboard" is only true when neither seat is on the mouse.
    title: usesMouse ? 'Two Players, One Computer' : 'Two Players, One Keyboard',
    body: twoPlayerBody(keys),
    art: <SeatDevicesHint devices={[seatDevice(keys[1]), seatDevice(keys[2])]} />
  }
}
