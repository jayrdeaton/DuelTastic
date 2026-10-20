import { type DirectionKeyLabels, DirectionKeysHint, type GuideStep, type SeatDevice, SeatDevicesHint, SeatDiagram, SwipeHint } from '@tastic/hud/guide'

import { GuideTrailCrash } from '@/components/GuideArt'
import type { KeyboardScheme, KeyScheme, Player } from '@/types'

// How each scheme reads in a sentence, and on DirectionKeysHint's caps (undefined = draw the arrow
// keys as arrows; 'mouse' has no caps, a mouse seat drags rather than pressing anything).
// Deliberately not the lobby's own KEY_SCHEME_OPTIONS labels ('Arrows+Space'), which are picker
// labels, not prose.
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

interface GuideStepsInput {
  // A touch screen vs. a desktop browser: a phone steers by swiping, a desktop by mouse or key.
  touch: boolean
  // Each seat's live scheme (settings.keyScheme) - only read on desktop. Seats pick their own in the
  // lobby, any of them 'mouse', so a replayed guide has to name the real ones, not the defaults.
  keys: Record<Player, KeyScheme>
}

// The three cards of LightCycles' how-to-play flow. Pure and hook-free so it's trivially testable;
// GuideHost feeds it useIsTouchPrimaryDevice() and the live key schemes, and memoizes the result.
//
// What's here is what a first-time player cannot work out alone (none of it is printed anywhere in
// the game): steering is absolute, not relative; walls and ANY trail are lethal, your own included;
// the last cycle riding wins; and in two-player one phone is shared face to face. Copy rules (Jay,
// 2026-09-24): Title Case titles, short bodies, and only say what's true in every mode - "your half"
// is only true in two-player, so it lives on the two-player card, not the steering one. There's no
// card explaining One Player vs Two Player: those buttons are right behind the dialog.
export function getGuideSteps({ touch, keys }: GuideStepsInput): GuideStep[] {
  const p1 = keys[1]
  const usesMouse = keys[1] === 'mouse' || keys[2] === 'mouse'

  return [
    {
      title: 'Steer Your Cycle',
      body: touch ? 'Swipe up, down, left or right. Your cycle turns the way you swipe.' : p1 === 'mouse' ? 'Drag the mouse up, down, left or right. Your cycle turns the way you drag.' : 'Press a direction key and your cycle turns that way.',
      art: touch ? <SwipeHint direction='up' /> : p1 === 'mouse' ? <SwipeHint pointer='mouse' direction='up' /> : <DirectionKeysHint labels={KEY_CAPS[p1]} />
    },
    {
      title: 'Last One Riding Wins',
      body: 'Hit a wall or a trail, even your own, and you crash.',
      art: <GuideTrailCrash />
    },
    touch
      ? {
          title: 'Two Players, One Phone',
          body: 'Sit across from each other and swipe in your own half.',
          art: <SeatDiagram />
        }
      : {
          // "One Keyboard" is only true when neither seat is on the mouse.
          title: usesMouse ? 'Two Players, One Computer' : 'Two Players, One Keyboard',
          body: twoPlayerBody(keys),
          art: <SeatDevicesHint devices={[seatDevice(keys[1]), seatDevice(keys[2])]} />
        }
  ]
}
