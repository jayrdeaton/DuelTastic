import type { GuideStep } from '@tastic/hud/guide'

import { GuideTrailCrash } from '@/games/lightcycles/components/GuideArt'
import type { KeyScheme, Player } from '@/games/lightcycles/types'
import { steeringStep, twoPlayerStep } from '@/shared/match/guideCards'

interface GuideStepsInput {
  // A touch screen vs. a desktop browser: a phone steers by swiping, a desktop by mouse or key.
  touch: boolean
  // Each seat's live controls (settings.controlScheme) - only read on desktop. Seats pick their own
  // in the loadout, any of them 'mouse', so a replayed guide has to name the real ones.
  keys: Record<Player, KeyScheme>
}

// The three cards of LightCycles' how-to-play flow. Pure and hook-free so it's trivially testable;
// the shell's GuideHost feeds it the device and the live controls, and memoizes the result.
//
// What's here is what a first-time player cannot work out alone (none of it is printed anywhere in
// the game): steering is absolute, not relative; walls and ANY trail are lethal, your own included;
// the last cycle riding wins; and in two-player one phone is shared face to face (the steering and
// two-player cards are shared/match's, the same in every game in the pack).
export function getGuideSteps({ touch, keys }: GuideStepsInput): GuideStep[] {
  return [
    steeringStep(touch, keys[1], 'cycle'),
    {
      title: 'Last One Riding Wins',
      body: 'Hit a wall or a trail, even your own, and you crash.',
      art: <GuideTrailCrash />
    },
    twoPlayerStep(touch, keys)
  ]
}
