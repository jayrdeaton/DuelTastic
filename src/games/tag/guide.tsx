import type { GuideStep } from '@tastic/hud/guide'

import { steeringStep, twoPlayerStep } from '@/shared/match/guideCards'
import type { KeyScheme, Player } from '@/shared/match/types'
import { createGameGuideSlice } from '@/shell/redux/gameGuideSlice'

import { GuideTagChase } from './GuideArt'
import type { TagRule } from './types'

// The version of Tag's How to Play cards this build teaches. Bump it only when a controls or rules
// change would leave the cards teaching something wrong: every player sees them once more.
export const GUIDE_VERSION = 1

// Which version this player has finished or skipped, under tagGuide (see createGameGuideSlice).
const slice = createGameGuideSlice('tagGuide')
export const guideActions = slice.actions
export const selectGuideVersionSeen = slice.selectVersionSeen
export const guideReducer = slice.reducer

interface GuideStepsInput {
  touch: boolean
  keys: Record<Player, KeyScheme>
  // How this match's round is won (the loadout's rules).
  rule: TagRule
}

// Tag's three cards: steering and two players on one device are every game's (shared/match), between
// them who's chasing whom and how the round is decided.
export function getGuideSteps({ touch, keys, rule }: GuideStepsInput): GuideStep[] {
  return [
    steeringStep(touch, keys[1], 'rider'),
    {
      title: "Don't Be It",
      body: rule === 'hotPotato' ? "If you're It, catch the other rider. Whoever's It at the buzzer loses." : "If you're It, catch the other rider. Less time as It wins.",
      art: <GuideTagChase />
    },
    twoPlayerStep(touch, keys)
  ]
}
