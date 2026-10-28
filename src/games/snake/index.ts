import { imageGameIcon } from '@/shell/components/imageGameIcon'
import type { GameDefinition } from '@/shell/types'

import { getGuideSteps, GUIDE_VERSION, guideActions, guideReducer, selectGuideVersionSeen } from './guide'
import PlayScreen from './PlayScreen'
import { playerSettings } from './settings'
import { snakeStats } from './stats'
import type { ControlScheme } from './types'
import { useLoadout } from './useLoadout'

// What Snake's How to Play cards are built from (see getGuideSteps), flat for the guide's shallow
// compare.
interface GuideInput {
  control1: ControlScheme
  control2: ControlScheme
}

// Snake, from its own app (the Snake repo) into DuelTastic. Its store keys are its own
// (snakeSettings, snakeControls, snakeAchievements, snakeGuide).
export const snake: GameDefinition = {
  id: 'snake',
  title: 'Snake',
  blurb: 'The arcade classic. Eat, grow, and keep off the walls.',
  icon: imageGameIcon({ light: require('./art/icon-light.png'), dark: require('./art/icon-dark.png') }),
  // Nobody is Solo: one snake, scored, the run ending on the first crash.
  seatTwo: ['cpu', 'person', 'nobody'],
  // On a phone 2 Player always splits face to face, snake 1 at the bottom, however it's held; a
  // desktop window splits by its shape, side by side when wider than tall (see useSeatSplit), and the
  // loadout follows it there too.
  twoPlayerSeats: { faceToFaceOnWeb: false, followUpsideDown: false },
  reducers: { ...playerSettings.reducers, ...snakeStats.reducers, snakeGuide: guideReducer },
  Provider: snakeStats.Provider,
  useLoadout,
  PlayScreen,
  StatsSections: snakeStats.StatsSections,
  AchievementList: snakeStats.AchievementList,
  resetStats: snakeStats.actions.reset,
  guide: {
    version: GUIDE_VERSION,
    selectVersionSeen: (state) => selectGuideVersionSeen(state),
    markSeen: guideActions.markSeen,
    selectInput: (state): GuideInput => {
      const s = playerSettings.select(state)
      return { control1: s.controlScheme[1], control2: s.controlScheme[2] }
    },
    getSteps: (input, { touch }) => {
      const { control1, control2 } = input as GuideInput
      return getGuideSteps({ touch, controls: { 1: control1, 2: control2 } })
    }
  }
}
