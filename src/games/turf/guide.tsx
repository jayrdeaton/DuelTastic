import type { GuideStep } from '@tastic/hud/guide'
import { createGameGuideSlice } from '@tastic/shell'

import { steeringStep, twoPlayerStep } from '@/shared/match/guideCards'
import type { KeyScheme, Player } from '@/shared/match/types'

import { GuideTurfClaim, GuideTurfCut } from './GuideArt'
import type { TurfCrashRule } from './types'

// The version of Turf's How to Play cards this build teaches. Bump it only when a controls or rules
// change would leave the cards teaching something wrong: every player sees them once more.
export const GUIDE_VERSION = 1

// Which version this player has finished or skipped, under turfGuide (see createGameGuideSlice).
const slice = createGameGuideSlice('turfGuide')
export const guideActions = slice.actions
export const selectGuideVersionSeen = slice.selectVersionSeen
export const guideReducer = slice.reducer

interface GuideStepsInput {
  touch: boolean
  keys: Record<Player, KeyScheme>
  // What a crash costs this match (the loadout's rules): the round, or the rider's trail.
  crash: TurfCrashRule
}

// Turf's four cards: steering and two players on one device are every game's (shared/match), between
// them how ground is claimed and how a trail is cut, the two things a first-time player can't guess.
export function getGuideSteps({ touch, keys, crash }: GuideStepsInput): GuideStep[] {
  return [
    steeringStep(touch, keys[1], 'rider'),
    {
      title: 'Claim Your Ground',
      body: 'Leave your ground to lay a trail. Get back to claim everything it loops.',
      art: <GuideTurfClaim />
    },
    {
      title: 'Cut Their Trail',
      body: crash === 'out' ? 'Hit their trail before they get home and they crash. Most ground at the buzzer wins.' : 'Hit their trail before they get home and they lose it. Most ground at the buzzer wins.',
      art: <GuideTurfCut />
    },
    twoPlayerStep(touch, keys)
  ]
}
