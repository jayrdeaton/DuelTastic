import type { GuideStep } from '@tastic/hud/guide'

import { steeringStep, twoPlayerStep } from '@/shared/match/guideCards'
import { createGameGuideSlice } from '@/shell/redux/gameGuideSlice'

import { GuideSnakeCrash } from './components/GuideArt'
import type { ControlScheme, SnakeId } from './types'

// The version of Snake's How to Play cards this build teaches. Bump it only when a controls or rules
// change would leave the cards teaching something wrong: every player sees them once more.
export const GUIDE_VERSION = 1

// Which version this player has finished or skipped, under snakeGuide (see createGameGuideSlice).
const slice = createGameGuideSlice('snakeGuide')
export const guideActions = slice.actions
export const selectGuideVersionSeen = slice.selectVersionSeen
export const guideReducer = slice.reducer

interface GuideStepsInput {
  touch: boolean
  // Each seat's live controls, only read on desktop: seats pick their own in the loadout, any of
  // them the mouse, so a replayed guide names the real ones.
  controls: Record<SnakeId, ControlScheme>
}

// Snake's three cards: steering and two players on one device are every game's (shared/match), and
// between them the one rule every mode shares. Not a win condition, since Solo has none (the run
// ends on the first crash), so the versus rule is scoped: a same-tick double crash is a draw, which
// "the first to crash loses" still covers. No card for powerups (off by default).
export function getGuideSteps({ touch, controls }: GuideStepsInput): GuideStep[] {
  return [
    steeringStep(touch, controls[1], 'snake'),
    {
      title: "Don't Crash",
      body: 'Walls and snakes, even your own, are deadly. With two snakes, the first to crash loses.',
      art: <GuideSnakeCrash />
    },
    twoPlayerStep(touch, controls)
  ]
}
